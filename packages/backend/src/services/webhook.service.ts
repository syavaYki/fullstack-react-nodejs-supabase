import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { membershipService } from './membership.service.js';
import { stripeService } from './stripe.service.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Service for handling Stripe webhook events.
 * Events are logged to stripe_webhook_events table for auditing and replay.
 */
export class WebhookService {
  /**
   * Verifies the Stripe webhook signature and constructs the event object.
   */
  verifyWebhookSignature(payload: Buffer, signature: string): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new ApiError(400, 'Webhook signature verification failed');
    }
  }

  /**
   * Logs a webhook event to the database for auditing.
   * Ignores duplicate events (idempotency via stripe_event_id unique constraint).
   */
  async logWebhookEvent(event: Stripe.Event): Promise<void> {
    const { error } = await supabaseAdmin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    });

    if (error && error.code !== '23505') {
      logger.error('STRIPE', 'Error logging webhook event', {
        error: error.message,
        eventId: event.id,
      });
    }
  }

  /**
   * Marks a webhook event as processed in the database.
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
   * Routes and processes a Stripe webhook event.
   */
  async processEvent(event: Stripe.Event): Promise<void> {
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

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.debug('STRIPE', 'Unhandled webhook event type', { eventType: event.type });
      }

      await this.markEventProcessed(event.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markEventProcessed(event.id, errorMessage);
      throw error;
    }
  }

  /**
   * Handles successful checkout completion.
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.supabase_user_id;

    if (!userId || !session.subscription) {
      logger.error('STRIPE', 'Missing required metadata in checkout session', {
        sessionId: session.id,
      });
      return;
    }

    await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', userId)
      .is('stripe_customer_id', null);

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    await stripeService.syncSubscriptionToDatabase(userId, subscription);

    logger.info('STRIPE', 'Subscription synced after checkout', { userId });
  }

  /**
   * Handles subscription create/update events.
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.error('STRIPE', 'Missing supabase_user_id in subscription metadata', {
        subscriptionId: subscription.id,
      });
      return;
    }

    await stripeService.syncSubscriptionToDatabase(userId, subscription);

    if (subscription.status === 'trialing') {
      await stripeService.markTrialUsed(userId);
      logger.info('STRIPE', 'Trial marked as used', { userId });
    }

    logger.info('STRIPE', 'Subscription synced', { subscriptionId: subscription.id, userId });
  }

  /**
   * Handles subscription deletion/cancellation.
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.error('STRIPE', 'Missing supabase_user_id in subscription metadata for deletion', {
        subscriptionId: subscription.id,
      });
      return;
    }

    const wasTrialing = subscription.status === 'trialing' || subscription.trial_end !== null;
    const reason = wasTrialing ? 'Trial ended without payment' : 'Subscription ended';

    await membershipService.downgradeToFree(userId, reason);

    logger.info('STRIPE', 'User downgraded to Free tier', { userId, reason });
  }

  /**
   * Handles trial_will_end event (sent 3 days before trial ends).
   */
  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.error('STRIPE', 'Missing supabase_user_id for trial_will_end', {
        subscriptionId: subscription.id,
      });
      return;
    }

    const trialEndDate = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    const daysRemaining = trialEndDate
      ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 3;

    const hasPaymentMethod = subscription.default_payment_method !== null;

    logger.info('STRIPE', 'Trial will end', {
      userId,
      daysRemaining,
      hasPaymentMethod,
    });
  }

  /**
   * Handles successful invoice payment.
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    let subscriptionId: string | null = null;

    if (typeof invoice.subscription === 'string') {
      subscriptionId = invoice.subscription;
    } else if (invoice.subscription && typeof invoice.subscription === 'object') {
      subscriptionId = (invoice.subscription as Stripe.Subscription).id;
    }

    if (!subscriptionId && invoice.lines?.data?.length > 0) {
      const lineSubscription = invoice.lines.data[0]?.subscription;
      if (typeof lineSubscription === 'string') {
        subscriptionId = lineSubscription;
      } else if (lineSubscription && typeof lineSubscription === 'object') {
        subscriptionId = (lineSubscription as Stripe.Subscription).id;
      }
    }

    if (!subscriptionId) {
      logger.debug('STRIPE', 'No subscription on invoice, skipping', { invoiceId: invoice.id });
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.debug('STRIPE', 'No supabase_user_id in subscription metadata, skipping');
      return;
    }

    logger.info('STRIPE', 'Invoice paid', { invoiceId: invoice.id, userId });
  }

  /**
   * Handles failed invoice payment.
   * IMMEDIATELY downgrades to Free tier on payment failure.
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) return;

    await membershipService.downgradeToFree(userId, 'Payment failed');

    logger.warn('STRIPE', 'Invoice payment failed - user downgraded', {
      invoiceId: invoice.id,
      userId,
    });
  }
}

export const webhookService = new WebhookService();
