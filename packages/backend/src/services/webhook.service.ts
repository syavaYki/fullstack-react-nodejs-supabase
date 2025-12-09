import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { membershipService } from './membership.service.js';
import { stripeService } from './stripe.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export class WebhookService {
  /**
   * Verify and construct Stripe webhook event
   */
  verifyWebhookSignature(payload: Buffer, signature: string): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      throw new ApiError(400, `Webhook signature verification failed`);
    }
  }

  /**
   * Log webhook event to database
   */
  async logWebhookEvent(event: Stripe.Event): Promise<void> {
    const { error } = await supabaseAdmin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    });

    if (error && error.code !== '23505') {
      // Ignore duplicate key errors
      console.error('Error logging webhook event:', error);
    }
  }

  /**
   * Mark webhook event as processed
   */
  async markEventProcessed(eventId: string, error?: string): Promise<void> {
    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: error || null,
      })
      .eq('stripe_event_id', eventId);
  }

  /**
   * Process Stripe webhook event
   */
  async processEvent(event: Stripe.Event): Promise<void> {
    // Log the event first
    await this.logWebhookEvent(event);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      await this.markEventProcessed(event.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markEventProcessed(event.id, errorMessage);
      throw error;
    }
  }

  /**
   * Handle checkout.session.completed
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.supabase_user_id;
    const tierId = session.metadata?.tier_id;
    const billingCycle = session.metadata?.billing_cycle as 'monthly' | 'yearly';

    if (!userId || !tierId || !session.subscription) {
      console.error('Missing required metadata in checkout session');
      return;
    }

    // Save stripe_customer_id to user_profiles (if not already saved)
    await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', userId)
      .is('stripe_customer_id', null);

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    // Upgrade user membership (stripe_customer_id is in user_profiles now)
    await membershipService.upgradeMembership(userId, tierId, {
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price.id || '',
      billing_cycle: billingCycle,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
    });

    console.log(`User ${userId} upgraded to tier ${tierId}`);
  }

  /**
   * Handle subscription updates
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      console.error('Missing supabase_user_id in subscription metadata');
      return;
    }

    // Determine status
    let status: 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due' = 'active';
    if (subscription.status === 'trialing') status = 'trial';
    else if (subscription.status === 'past_due') status = 'past_due';
    else if (subscription.status === 'canceled') status = 'cancelled';
    else if (subscription.status === 'unpaid') status = 'expired';

    // Update membership
    await membershipService.updateMembership(userId, {
      status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      stripe_latest_invoice_id: subscription.latest_invoice as string | undefined,
    });

    console.log(`Subscription ${subscription.id} updated for user ${userId}`);
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      console.error('Missing supabase_user_id in subscription metadata');
      return;
    }

    // Get free tier
    const freeTier = await membershipService.getTierByName('free');

    // Downgrade to free tier
    await membershipService.updateMembership(userId, {
      tier_id: freeTier.id,
      status: 'active',
      cancelled_at: new Date().toISOString(),
      stripe_subscription_id: null,
      stripe_price_id: null,
      billing_cycle: null,
      current_period_start: null,
      current_period_end: null,
    });

    console.log(`User ${userId} downgraded to free tier after subscription cancellation`);
  }

  /**
   * Handle successful invoice payment
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    // Get subscription to find user
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) return;

    // Get user's membership ID
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Record payment
    await stripeService.recordPayment({
      user_id: userId,
      membership_id: membership?.id || null,
      stripe_payment_intent_id: invoice.payment_intent as string || null,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: invoice.charge as string || null,
      stripe_subscription_id: invoice.subscription as string || null,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: 'succeeded',
      invoice_url: invoice.hosted_invoice_url || null,
      receipt_url: null,
      invoice_pdf: invoice.invoice_pdf || null,
      description: invoice.description || `Payment for ${invoice.lines.data[0]?.description || 'subscription'}`,
      metadata: {},
      failure_reason: null,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : new Date().toISOString(),
    });

    // Update membership with payment info
    await membershipService.updateMembership(userId, {
      last_payment_at: new Date().toISOString(),
      last_payment_amount: invoice.amount_paid / 100,
      last_payment_currency: invoice.currency,
      stripe_latest_invoice_id: invoice.id,
      stripe_latest_invoice_status: 'paid',
    });

    console.log(`Invoice ${invoice.id} paid for user ${userId}`);
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) return;

    // Get user's membership ID
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Record failed payment
    await stripeService.recordPayment({
      user_id: userId,
      membership_id: membership?.id || null,
      stripe_payment_intent_id: invoice.payment_intent as string || null,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: invoice.charge as string || null,
      stripe_subscription_id: invoice.subscription as string || null,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: 'failed',
      invoice_url: invoice.hosted_invoice_url || null,
      receipt_url: null,
      invoice_pdf: null,
      description: `Failed payment for ${invoice.lines.data[0]?.description || 'subscription'}`,
      metadata: {},
      failure_reason: invoice.last_finalization_error?.message || 'Payment failed',
      paid_at: null,
    });

    // Update membership status
    await membershipService.updateMembership(userId, {
      status: 'past_due',
      stripe_latest_invoice_id: invoice.id,
      stripe_latest_invoice_status: 'payment_failed',
    });

    console.log(`Invoice ${invoice.id} payment failed for user ${userId}`);
  }
}

export const webhookService = new WebhookService();
