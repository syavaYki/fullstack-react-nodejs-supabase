import Stripe from 'stripe';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { membershipService } from './membership.service.js';
import { BillingCycle, MembershipTier, PaymentHistory } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Service for handling Stripe payment operations.
 * Manages customers, checkout sessions, billing portal, and subscription lifecycle.
 * Note: stripe_customer_id is stored in user_profiles, not memberships.
 */
export class StripeService {
  /**
   * Gets an existing Stripe customer or creates a new one for the user.
   * Checks database first, then searches Stripe directly to prevent duplicates.
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id, first_name, last_name')
      .eq('id', userId)
      .single();

    if (profile?.stripe_customer_id) {
      try {
        await stripe.customers.retrieve(profile.stripe_customer_id);
        return profile.stripe_customer_id;
      } catch {
        logger.debug('STRIPE', 'Stale Stripe customer ID, will create new', {
          userId,
          staleCustomerId: profile.stripe_customer_id,
        });
        await supabaseAdmin
          .from('user_profiles')
          .update({ stripe_customer_id: null })
          .eq('id', userId);
      }
    }

    const existingCustomers = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${userId}'`,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      const existingCustomer = existingCustomers.data[0];
      await supabaseAdmin
        .from('user_profiles')
        .update({ stripe_customer_id: existingCustomer.id })
        .eq('id', userId);
      return existingCustomer.id;
    }

    const nameParts = [profile?.first_name, profile?.last_name].filter(Boolean);
    const name = nameParts.length > 0 ? nameParts.join(' ') : undefined;

    const customer = await stripe.customers.create(
      {
        email,
        ...(name && { name }),
        metadata: {
          supabase_user_id: userId,
        },
      },
      {
        idempotencyKey: `create-customer-${userId}`,
      }
    );

    await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);

    return customer.id;
  }

  /**
   * Creates a Stripe Checkout session for subscription purchase.
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    tierId: string,
    billingCycle: BillingCycle,
    successUrl?: string,
    cancelUrl?: string,
    skipTrial = false
  ): Promise<string> {
    const { hasActive } = await this.userHasActiveSubscription(userId);
    if (hasActive) {
      throw new ApiError(400, 'ACTIVE_SUBSCRIPTION_EXISTS');
    }

    const tier = await membershipService.getTierById(tierId);

    // Prevent checkout for free/default tiers
    if (tier.is_default || tier.price_monthly === 0) {
      throw new ApiError(400, 'Cannot create checkout for a free tier');
    }

    const priceId =
      billingCycle === 'monthly' ? tier.stripe_price_id_monthly : tier.stripe_price_id_yearly;

    if (!priceId) {
      throw new ApiError(400, `No Stripe price configured for ${tier.name} ${billingCycle}`);
    }

    const customerId = await this.getOrCreateCustomer(userId, email);

    const canUseTrial = !skipTrial && tier.trial_days > 0 && !(await this.hasUserUsedTrial(userId));

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        successUrl || `${env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${env.FRONTEND_URL}/billing/cancel`,
      allow_promotion_codes: true,
      metadata: {
        supabase_user_id: userId,
        tier_id: tierId,
        billing_cycle: billingCycle,
      },
    };

    if (canUseTrial) {
      sessionParams.payment_method_collection = 'if_required';
      sessionParams.subscription_data = {
        trial_period_days: tier.trial_days,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
        metadata: {
          supabase_user_id: userId,
          tier_id: tierId,
        },
      };
    } else {
      sessionParams.subscription_data = {
        metadata: {
          supabase_user_id: userId,
          tier_id: tierId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      throw new ApiError(500, 'Failed to create checkout session');
    }

    return session.url;
  }

  /**
   * Checks if a user has already used their Stripe trial.
   */
  async hasUserUsedTrial(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('memberships')
      .select('has_used_trial')
      .eq('user_id', userId)
      .single();

    return data?.has_used_trial ?? false;
  }

  /**
   * Marks a user as having used their trial.
   */
  async markTrialUsed(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('memberships')
      .update({ has_used_trial: true })
      .eq('user_id', userId);

    if (error) {
      logger.error('STRIPE', 'Error marking trial as used', { error: error.message, userId });
    }
  }

  /**
   * Creates a Stripe Billing Portal session for subscription management.
   */
  async createPortalSession(userId: string): Promise<string> {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) {
      throw new ApiError(400, 'User profile not found');
    }

    const customerId = await this.getOrCreateCustomer(userId, profile.email);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.FRONTEND_URL}/dashboard/billing`,
    });

    return session.url;
  }

  /**
   * Retrieves a user's payment history directly from Stripe API.
   */
  async getPaymentHistory(userId: string, limit = 10): Promise<PaymentHistory[]> {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return [];
    }

    const invoices = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: Math.min(Math.max(limit, 1), 100),
      expand: ['data.charge'],
    });

    return invoices.data.map((invoice) => this.transformInvoiceToPaymentHistory(invoice, userId));
  }

  /**
   * Transforms a Stripe Invoice to PaymentHistory format.
   */
  private transformInvoiceToPaymentHistory(
    invoice: Stripe.Invoice,
    userId: string
  ): PaymentHistory {
    const charge = typeof invoice.charge === 'object' ? invoice.charge : null;

    let status: PaymentHistory['status'] = 'pending';
    if (invoice.status === 'paid') {
      status = 'succeeded';
    } else if (invoice.status === 'open' || invoice.status === 'draft') {
      status = 'pending';
    } else if (invoice.status === 'uncollectible' || invoice.status === 'void') {
      status = 'failed';
    }

    if (charge?.refunded) {
      status = charge.amount_refunded === charge.amount ? 'refunded' : 'partially_refunded';
    }

    return {
      id: invoice.id,
      user_id: userId,
      membership_id: null,
      stripe_payment_intent_id:
        typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice.payment_intent?.id || null,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: typeof invoice.charge === 'string' ? invoice.charge : charge?.id || null,
      stripe_subscription_id:
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription as Stripe.Subscription)?.id || null,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status,
      invoice_url: invoice.hosted_invoice_url || null,
      receipt_url: charge?.receipt_url || null,
      invoice_pdf: invoice.invoice_pdf || null,
      description:
        invoice.description ||
        `Payment for ${invoice.lines.data[0]?.description || 'subscription'}`,
      metadata: invoice.metadata || {},
      failure_reason: invoice.last_finalization_error?.message || null,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
      created_at: new Date(invoice.created * 1000).toISOString(),
    };
  }

  /**
   * Retrieves a Stripe subscription by its ID.
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Retrieves the latest active or trialing subscription for a customer.
   * Prioritizes trialing > active subscriptions.
   */
  async getLatestActiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 1,
    });

    if (trialingSubscriptions.data.length > 0) {
      return trialingSubscriptions.data[0];
    }

    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (activeSubscriptions.data.length > 0) {
      return activeSubscriptions.data[0];
    }

    return null;
  }

  /**
   * Cancels a subscription at the end of the current billing period.
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Reactivates a subscription that was scheduled for cancellation.
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Syncs subscription data from Stripe to the Supabase memberships table.
   * Sets a 24-hour cache expiration to avoid excessive Stripe API calls.
   */
  async syncSubscriptionToDatabase(
    userId: string,
    subscription: Stripe.Subscription
  ): Promise<void> {
    logger.debug('STRIPE', 'Syncing subscription to database', {
      subscriptionId: subscription.id,
      userId,
      status: subscription.status,
    });

    const priceId = subscription.items.data[0]?.price.id;
    const tier = priceId ? await this.getTierByStripePriceId(priceId) : null;

    const interval = subscription.items.data[0]?.price.recurring?.interval;
    const billingCycle: BillingCycle | null =
      interval === 'month' ? 'monthly' : interval === 'year' ? 'yearly' : null;

    const updateData: Record<string, unknown> = {
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_status: subscription.status,
      stripe_current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      billing_cycle: billingCycle,
      last_synced_at: new Date().toISOString(),
      sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    if (tier) {
      updateData.tier_id = tier.id;
    }

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      updateData.status = 'active';
    } else if (subscription.status === 'past_due') {
      updateData.status = 'past_due';
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      updateData.status = 'cancelled';
    }

    if (subscription.trial_start) {
      updateData.trial_starts_at = new Date(subscription.trial_start * 1000).toISOString();
    }
    if (subscription.trial_end) {
      updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
    }

    if (subscription.status === 'trialing') {
      updateData.has_used_trial = true;
    }

    const { error } = await supabaseAdmin
      .from('memberships')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      logger.error('STRIPE', 'Error syncing subscription to database', {
        error: error.message,
        userId,
      });
      throw new ApiError(500, 'Failed to sync subscription');
    }
  }

  /**
   * Maps a Stripe price ID to a membership tier.
   */
  async getTierByStripePriceId(priceId: string): Promise<MembershipTier | null> {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
      .single();

    if (error || !data) {
      return null;
    }

    return data as MembershipTier;
  }

  /**
   * Checks if a user has an active Stripe subscription.
   */
  async userHasActiveSubscription(
    userId: string
  ): Promise<{ hasActive: boolean; subscriptionId?: string }> {
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('stripe_subscription_id, stripe_status')
      .eq('user_id', userId)
      .single();

    if (!membership?.stripe_subscription_id) {
      return { hasActive: false };
    }

    const activeStatuses = ['active', 'trialing', 'past_due'];
    const isActive = membership.stripe_status
      ? activeStatuses.includes(membership.stripe_status)
      : false;

    return {
      hasActive: isActive,
      subscriptionId: membership.stripe_subscription_id,
    };
  }
}

export const stripeService = new StripeService();
