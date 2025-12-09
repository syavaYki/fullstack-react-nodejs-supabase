import Stripe from 'stripe';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { membershipService } from './membership.service.js';
import { BillingCycle, PaymentHistory } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

export class StripeService {
  /**
   * Create or get Stripe customer for user
   * Note: stripe_customer_id is now stored in user_profiles, not memberships
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    // Check if user already has a Stripe customer ID (stored in user_profiles)
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profile?.stripe_customer_id) {
      return profile.stripe_customer_id;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        supabase_user_id: userId,
      },
    });

    // Save customer ID to user_profiles
    await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);

    return customer.id;
  }

  /**
   * Create Stripe Checkout session for subscription upgrade
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    tierId: string,
    billingCycle: BillingCycle,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<string> {
    // Get the tier
    const tier = await membershipService.getTierById(tierId);

    // Get the price ID based on billing cycle
    const priceId =
      billingCycle === 'monthly'
        ? tier.stripe_price_id_monthly
        : tier.stripe_price_id_yearly;

    if (!priceId) {
      throw new ApiError(400, `No Stripe price configured for ${tier.name} ${billingCycle}`);
    }

    // Get or create Stripe customer
    const customerId = await this.getOrCreateCustomer(userId, email);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${env.FRONTEND_URL}/billing/cancel`,
      metadata: {
        supabase_user_id: userId,
        tier_id: tierId,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          tier_id: tierId,
        },
      },
    });

    if (!session.url) {
      throw new ApiError(500, 'Failed to create checkout session');
    }

    return session.url;
  }

  /**
   * Create Stripe Customer Portal session for managing subscription
   */
  async createPortalSession(userId: string): Promise<string> {
    // Get user's Stripe customer ID from user_profiles
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      throw new ApiError(400, 'No active subscription found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${env.FRONTEND_URL}/settings/billing`,
    });

    return session.url;
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    const { data, error } = await supabaseAdmin
      .from('payment_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as PaymentHistory[];
  }

  /**
   * Record a payment in history
   */
  async recordPayment(payment: Omit<PaymentHistory, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabaseAdmin.from('payment_history').insert(payment);

    if (error) {
      console.error('Error recording payment:', error);
      throw new ApiError(500, error.message);
    }
  }

  /**
   * Get Stripe subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Cancel Stripe subscription at period end
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }
}

export const stripeService = new StripeService();
