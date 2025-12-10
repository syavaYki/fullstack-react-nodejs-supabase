import Stripe from 'stripe';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { membershipService } from './membership.service.js';
import { BillingCycle, PaymentHistory } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * Service for handling Stripe payment operations.
 * Manages customers, checkout sessions, billing portal, and subscription lifecycle.
 * Note: stripe_customer_id is stored in user_profiles, not memberships.
 */
export class StripeService {
  /**
   * Gets an existing Stripe customer or creates a new one for the user.
   * Checks user_profiles for existing customer ID before creating.
   *
   * @param userId - The Supabase user ID
   * @param email - The user's email for Stripe customer creation
   * @returns The Stripe customer ID (cus_xxx)
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
   * Creates a Stripe Checkout session for subscription purchase.
   * User is redirected to Stripe's hosted checkout page to complete payment.
   * Includes user and tier metadata for webhook processing.
   *
   * @param userId - The Supabase user ID
   * @param email - The user's email address
   * @param tierId - The membership tier ID to purchase
   * @param billingCycle - Either 'monthly' or 'yearly'
   * @param successUrl - Optional redirect URL after successful payment
   * @param cancelUrl - Optional redirect URL if user cancels
   * @returns The Stripe checkout session URL to redirect the user to
   * @throws {ApiError} 400 if tier has no configured Stripe price
   * @throws {ApiError} 500 if session creation fails
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
      billingCycle === 'monthly' ? tier.stripe_price_id_monthly : tier.stripe_price_id_yearly;

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
      success_url:
        successUrl || `${env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
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
   * Creates a Stripe Billing Portal session for subscription management.
   * Allows users to update payment methods, view invoices, and cancel subscriptions.
   *
   * @param userId - The Supabase user ID
   * @returns The billing portal URL to redirect the user to
   * @throws {ApiError} 400 if user has no Stripe customer ID
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
   * Retrieves a user's payment history from the database.
   * Returns all payments ordered by most recent first.
   *
   * @param userId - The Supabase user ID
   * @returns Array of payment history records
   * @throws {ApiError} 500 if database query fails
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
   * Records a payment in the payment_history table.
   * Called by webhook handlers after processing payment events.
   *
   * @param payment - Payment data excluding auto-generated fields
   * @throws {ApiError} 500 if database insert fails
   */
  async recordPayment(payment: Omit<PaymentHistory, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabaseAdmin.from('payment_history').insert(payment);

    if (error) {
      console.error('Error recording payment:', error);
      throw new ApiError(500, error.message);
    }
  }

  /**
   * Retrieves a Stripe subscription by its ID.
   *
   * @param subscriptionId - The Stripe subscription ID (sub_xxx)
   * @returns The full Stripe subscription object
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Cancels a subscription at the end of the current billing period.
   * User retains access until the period ends.
   *
   * @param subscriptionId - The Stripe subscription ID to cancel
   * @returns The updated Stripe subscription object
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Reactivates a subscription that was scheduled for cancellation.
   * Only works if the subscription hasn't ended yet.
   *
   * @param subscriptionId - The Stripe subscription ID to reactivate
   * @returns The updated Stripe subscription object
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }
}

export const stripeService = new StripeService();
