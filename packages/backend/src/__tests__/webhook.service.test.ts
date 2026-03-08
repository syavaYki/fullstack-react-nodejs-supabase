/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars */
/**
 * @file webhook.service.test.ts
 * @description Tests for WebhookService — Stripe webhook signature verification,
 * event dispatching, handler logic, idempotency, and error handling.
 *
 * Pattern: vi.hoisted() + vi.mock() with .ts extensions for hoisted mock paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// ============================================
// HOISTED MOCKS
// ============================================

const mocks = vi.hoisted(() => {
  // Chainable query builder for supabaseAdmin.from(...)
  const createQueryBuilder = () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    // Make everything chainable except terminal methods
    for (const key of Object.keys(builder)) {
      if (key !== 'single') {
        builder[key].mockReturnValue(builder);
      }
    }
    return builder;
  };

  const queryBuilder = createQueryBuilder();

  return {
    stripe: {
      webhooks: {
        constructEvent: vi.fn(),
      },
      subscriptions: {
        retrieve: vi.fn(),
      },
    },
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
    },
    queryBuilder,
    createQueryBuilder,
    membershipService: {
      downgradeToFree: vi.fn().mockResolvedValue(undefined),
    },
    stripeService: {
      syncSubscriptionToDatabase: vi.fn().mockResolvedValue(undefined),
      markTrialUsed: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// ============================================
// MODULE MOCKS
// ============================================

vi.mock('../config/stripe.ts', () => ({
  stripe: mocks.stripe,
  STRIPE_WEBHOOK_SECRET: mocks.STRIPE_WEBHOOK_SECRET,
}));

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock('../services/membership.service.ts', () => ({
  membershipService: mocks.membershipService,
}));

vi.mock('../services/stripe.service.ts', () => ({
  stripeService: mocks.stripeService,
}));

vi.mock('../utils/logger.ts', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

// ============================================
// IMPORT UNDER TEST
// ============================================

import { WebhookService } from '../services/webhook.service.ts';
import {
  createMockEvent,
  createMockCheckoutSession,
  createMockSubscription,
  createMockInvoice,
} from './mocks/index.ts';

// ============================================
// HELPERS
// ============================================

/**
 * Creates a fresh chainable query builder and wires supabaseAdmin.from()
 * to return it. Optionally sets insert/update terminal results.
 */
function resetQueryBuilder(opts?: {
  insertResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
}) {
  const qb = mocks.createQueryBuilder();

  // Default insert resolves to success (no-op)
  qb.insert.mockImplementation(() => {
    const result = opts?.insertResult ?? { data: null, error: null };
    return {
      ...qb,
      then: vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve(result)),
    };
  });

  // Default update resolves to success (no-op)
  if (opts?.updateResult) {
    qb.update.mockImplementation(() => {
      const chainable = { ...qb };
      chainable.eq = vi.fn().mockResolvedValue(opts.updateResult);
      return chainable;
    });
  }

  mocks.supabaseAdmin.from.mockReturnValue(qb);
  return qb;
}

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookService();

    // Default: supabaseAdmin.from() returns a chainable builder that succeeds
    const qb = mocks.createQueryBuilder();
    // For insert calls (logWebhookEvent), resolve immediately with no error
    qb.insert.mockResolvedValue({ data: null, error: null });
    // For update calls (markEventProcessed), return chainable builder
    qb.update.mockReturnValue(qb);
    qb.eq.mockResolvedValue({ data: null, error: null });
    mocks.supabaseAdmin.from.mockReturnValue(qb);
  });

  // ============================================
  // verifyWebhookSignature
  // ============================================

  describe('verifyWebhookSignature', () => {
    it('should verify and return event on valid signature', () => {
      const mockEvent = createMockEvent('checkout.session.completed', {
        id: 'cs_test_valid',
      });

      mocks.stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const payload = Buffer.from(JSON.stringify(mockEvent));
      const signature = 't=123456,v1=valid_signature';

      const result = service.verifyWebhookSignature(payload, signature);

      expect(result).toBe(mockEvent);
      expect(mocks.stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        mocks.STRIPE_WEBHOOK_SECRET
      );
    });

    it('should throw ApiError with status 400 on invalid signature', () => {
      mocks.stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const payload = Buffer.from('invalid');
      const signature = 'bad_sig';

      expect(() => service.verifyWebhookSignature(payload, signature)).toThrow(
        expect.objectContaining({
          statusCode: 400,
          message: 'Webhook signature verification failed',
        })
      );
    });
  });

  // ============================================
  // processEvent
  // ============================================

  describe('processEvent', () => {
    it('should record event in stripe_webhook_events table', async () => {
      const event = createMockEvent('test.event', { id: 'obj_123' });

      await service.processEvent(event);

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('stripe_webhook_events');
      // The insert call should include the event id, type, payload, and processed=false
      const fromCalls = mocks.supabaseAdmin.from.mock.calls;
      const webhookEventCalls = fromCalls.filter(
        (call: string[]) => call[0] === 'stripe_webhook_events'
      );
      expect(webhookEventCalls.length).toBeGreaterThan(0);
    });

    it('should skip already-processed events gracefully (idempotency via unique constraint)', async () => {
      // Simulate a unique constraint violation (error code 23505)
      const qb = mocks.createQueryBuilder();
      qb.insert.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });
      qb.update.mockReturnValue(qb);
      qb.eq.mockResolvedValue({ data: null, error: null });
      mocks.supabaseAdmin.from.mockReturnValue(qb);

      const event = createMockEvent('test.event', { id: 'obj_duplicate' });

      // Should not throw despite the 23505 error
      await expect(service.processEvent(event)).resolves.not.toThrow();
    });

    it('checkout.session.completed should sync subscription', async () => {
      const session = createMockCheckoutSession({
        metadata: {
          supabase_user_id: 'user-uuid-123',
          tier_id: 'tier-uuid-123',
          billing_cycle: 'monthly',
        },
        subscription: 'sub_checkout_test',
        customer: 'cus_test123',
      });

      const event = createMockEvent(
        'checkout.session.completed',
        session as unknown as Record<string, unknown>
      );

      const mockSubscription = createMockSubscription({ id: 'sub_checkout_test' });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      // The update for user_profiles (stripe_customer_id) needs its own chainable builder
      const qb = mocks.createQueryBuilder();
      qb.insert.mockResolvedValue({ data: null, error: null });
      qb.update.mockReturnValue(qb);
      qb.eq.mockReturnValue(qb);
      qb.is.mockResolvedValue({ data: null, error: null });
      mocks.supabaseAdmin.from.mockReturnValue(qb);

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_checkout_test');
      expect(mocks.stripeService.syncSubscriptionToDatabase).toHaveBeenCalledWith(
        'user-uuid-123',
        mockSubscription
      );
    });

    it('customer.subscription.updated should sync subscription', async () => {
      const subscription = createMockSubscription({
        id: 'sub_updated_test',
        status: 'active',
        metadata: { supabase_user_id: 'user-uuid-456', tier_id: 'tier-uuid-456' },
      });

      const event = createMockEvent(
        'customer.subscription.updated',
        subscription as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.stripeService.syncSubscriptionToDatabase).toHaveBeenCalledWith(
        'user-uuid-456',
        expect.objectContaining({ id: 'sub_updated_test' })
      );
    });

    it('customer.subscription.updated with trialing status should mark trial used', async () => {
      const subscription = createMockSubscription({
        id: 'sub_trial_test',
        status: 'trialing',
        metadata: { supabase_user_id: 'user-uuid-trial', tier_id: 'tier-uuid-123' },
      });

      const event = createMockEvent(
        'customer.subscription.updated',
        subscription as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.stripeService.syncSubscriptionToDatabase).toHaveBeenCalledWith(
        'user-uuid-trial',
        expect.objectContaining({ status: 'trialing' })
      );
      expect(mocks.stripeService.markTrialUsed).toHaveBeenCalledWith('user-uuid-trial');
    });

    it('customer.subscription.created should sync subscription (same handler as updated)', async () => {
      const subscription = createMockSubscription({
        id: 'sub_created_test',
        status: 'active',
        metadata: { supabase_user_id: 'user-uuid-789', tier_id: 'tier-uuid-789' },
      });

      const event = createMockEvent(
        'customer.subscription.created',
        subscription as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.stripeService.syncSubscriptionToDatabase).toHaveBeenCalledWith(
        'user-uuid-789',
        expect.objectContaining({ id: 'sub_created_test' })
      );
    });

    it('invoice.payment_failed should retrieve subscription and downgrade to free', async () => {
      const invoice = createMockInvoice({
        id: 'in_failed_test',
        subscription: 'sub_failed_test',
      });

      const event = createMockEvent(
        'invoice.payment_failed',
        invoice as unknown as Record<string, unknown>
      );

      const mockSubscription = createMockSubscription({
        id: 'sub_failed_test',
        metadata: { supabase_user_id: 'user-uuid-failed' },
      });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_failed_test');
      expect(mocks.membershipService.downgradeToFree).toHaveBeenCalledWith(
        'user-uuid-failed',
        'Payment failed'
      );
    });

    it('invoice.payment_failed should do nothing when invoice has no subscription', async () => {
      const invoice = createMockInvoice({
        id: 'in_no_sub',
        subscription: null as unknown as string,
      });

      const event = createMockEvent(
        'invoice.payment_failed',
        invoice as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(mocks.membershipService.downgradeToFree).not.toHaveBeenCalled();
    });

    it('customer.subscription.deleted should downgrade to free tier', async () => {
      const subscription = createMockSubscription({
        id: 'sub_deleted_test',
        status: 'canceled',
        metadata: { supabase_user_id: 'user-uuid-deleted' },
        trial_end: null,
      });

      const event = createMockEvent(
        'customer.subscription.deleted',
        subscription as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.membershipService.downgradeToFree).toHaveBeenCalledWith(
        'user-uuid-deleted',
        'Subscription ended'
      );
    });

    it('customer.subscription.deleted with trial should downgrade with trial-ended reason', async () => {
      const subscription = createMockSubscription({
        id: 'sub_trial_deleted',
        status: 'trialing',
        metadata: { supabase_user_id: 'user-uuid-trial-deleted' },
        trial_end: Math.floor(Date.now() / 1000) + 86400,
      });

      const event = createMockEvent(
        'customer.subscription.deleted',
        subscription as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.membershipService.downgradeToFree).toHaveBeenCalledWith(
        'user-uuid-trial-deleted',
        'Trial ended without payment'
      );
    });

    it('should handle unknown event types gracefully without throwing', async () => {
      const event = createMockEvent('unknown.event.type', { id: 'obj_unknown' });

      await expect(service.processEvent(event)).resolves.not.toThrow();

      // Should not call any handler service methods
      expect(mocks.stripeService.syncSubscriptionToDatabase).not.toHaveBeenCalled();
      expect(mocks.membershipService.downgradeToFree).not.toHaveBeenCalled();
    });

    it('should mark event as processed after successful handling', async () => {
      const event = createMockEvent('test.unhandled.event', { id: 'obj_mark' });

      await service.processEvent(event);

      // Verify markEventProcessed was called: update on stripe_webhook_events
      const fromCalls = mocks.supabaseAdmin.from.mock.calls;
      const webhookUpdateCalls = fromCalls.filter(
        (call: string[]) => call[0] === 'stripe_webhook_events'
      );
      // At least 2 calls: one for insert (logWebhookEvent), one for update (markEventProcessed)
      expect(webhookUpdateCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should mark event as processed with error message when handler throws', async () => {
      const subscription = createMockSubscription({
        id: 'sub_error_test',
        metadata: { supabase_user_id: 'user-uuid-error' },
      });

      const event = createMockEvent(
        'customer.subscription.updated',
        subscription as unknown as Record<string, unknown>
      );

      const syncError = new Error('Sync failed');
      mocks.stripeService.syncSubscriptionToDatabase.mockRejectedValueOnce(syncError);

      await expect(service.processEvent(event)).rejects.toThrow('Sync failed');

      // markEventProcessed should still be called (with error message)
      // It updates stripe_webhook_events with processed=true and error_message
      const fromCalls = mocks.supabaseAdmin.from.mock.calls;
      const webhookCalls = fromCalls.filter(
        (call: string[]) => call[0] === 'stripe_webhook_events'
      );
      // Should have at least 2 calls: insert + update (with error)
      expect(webhookCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('checkout.session.completed should skip when missing userId metadata', async () => {
      const session = createMockCheckoutSession({
        metadata: {},
        subscription: 'sub_no_user',
        customer: 'cus_test123',
      });

      const event = createMockEvent(
        'checkout.session.completed',
        session as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      // Should not attempt to sync because userId is missing
      expect(mocks.stripeService.syncSubscriptionToDatabase).not.toHaveBeenCalled();
    });

    it('customer.subscription.updated should skip when missing userId metadata', async () => {
      const subscription = createMockSubscription({
        id: 'sub_no_metadata',
        metadata: {},
      });

      const event = createMockEvent(
        'customer.subscription.updated',
        subscription as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.stripeService.syncSubscriptionToDatabase).not.toHaveBeenCalled();
    });

    it('customer.subscription.deleted should skip when missing userId metadata', async () => {
      const subscription = createMockSubscription({
        id: 'sub_deleted_no_user',
        metadata: {},
      });

      const event = createMockEvent(
        'customer.subscription.deleted',
        subscription as unknown as Record<string, unknown>
      );

      await service.processEvent(event);

      expect(mocks.membershipService.downgradeToFree).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // logWebhookEvent
  // ============================================

  describe('logWebhookEvent', () => {
    it('should insert event with correct shape into stripe_webhook_events', async () => {
      const qb = mocks.createQueryBuilder();
      qb.insert.mockResolvedValue({ data: null, error: null });
      mocks.supabaseAdmin.from.mockReturnValue(qb);

      const event = createMockEvent('test.log', { id: 'log_obj' });

      await service.logWebhookEvent(event);

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('stripe_webhook_events');
      expect(qb.insert).toHaveBeenCalledWith({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event,
        processed: false,
      });
    });
  });

  // ============================================
  // markEventProcessed
  // ============================================

  describe('markEventProcessed', () => {
    it('should update the event record to processed=true', async () => {
      const qb = mocks.createQueryBuilder();
      qb.update.mockReturnValue(qb);
      qb.eq.mockResolvedValue({ data: null, error: null });
      mocks.supabaseAdmin.from.mockReturnValue(qb);

      await service.markEventProcessed('evt_mark_123');

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('stripe_webhook_events');
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: true,
          error_message: null,
        })
      );
      expect(qb.eq).toHaveBeenCalledWith('stripe_event_id', 'evt_mark_123');
    });

    it('should include error_message when provided', async () => {
      const qb = mocks.createQueryBuilder();
      qb.update.mockReturnValue(qb);
      qb.eq.mockResolvedValue({ data: null, error: null });
      mocks.supabaseAdmin.from.mockReturnValue(qb);

      await service.markEventProcessed('evt_err_123', 'Something went wrong');

      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: true,
          error_message: 'Something went wrong',
        })
      );
    });
  });

  // ============================================
  // handleTrialWillEnd (via processEvent)
  // ============================================

  describe('handleTrialWillEnd', () => {
    it('should process trial_will_end event with trial end date', async () => {
      const trialEndTimestamp = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60; // 3 days from now
      const subscription = createMockSubscription({
        id: 'sub_trial_will_end',
        status: 'trialing',
        metadata: { supabase_user_id: 'user-trial-end', tier_id: 'tier-uuid-123' },
        trial_end: trialEndTimestamp,
        default_payment_method: 'pm_test123',
      });

      const event = createMockEvent(
        'customer.subscription.trial_will_end',
        subscription as unknown as Record<string, unknown>
      );

      await expect(service.processEvent(event)).resolves.not.toThrow();

      // Should NOT call sync or downgrade — this handler only logs
      expect(mocks.stripeService.syncSubscriptionToDatabase).not.toHaveBeenCalled();
      expect(mocks.membershipService.downgradeToFree).not.toHaveBeenCalled();
    });

    it('should handle trial_will_end when trial_end is null (default 3 days)', async () => {
      const subscription = createMockSubscription({
        id: 'sub_trial_null_end',
        status: 'trialing',
        metadata: { supabase_user_id: 'user-trial-null', tier_id: 'tier-uuid-123' },
        trial_end: null,
        default_payment_method: null,
      });

      const event = createMockEvent(
        'customer.subscription.trial_will_end',
        subscription as unknown as Record<string, unknown>
      );

      await expect(service.processEvent(event)).resolves.not.toThrow();
    });

    it('should skip when missing userId metadata', async () => {
      const subscription = createMockSubscription({
        id: 'sub_trial_no_user',
        status: 'trialing',
        metadata: {},
        trial_end: Math.floor(Date.now() / 1000) + 86400,
      });

      const event = createMockEvent(
        'customer.subscription.trial_will_end',
        subscription as unknown as Record<string, unknown>
      );

      await expect(service.processEvent(event)).resolves.not.toThrow();

      // Nothing should happen since there's no userId
      expect(mocks.stripeService.syncSubscriptionToDatabase).not.toHaveBeenCalled();
      expect(mocks.membershipService.downgradeToFree).not.toHaveBeenCalled();
    });

    it('should note hasPaymentMethod status', async () => {
      // With payment method
      const subWithPM = createMockSubscription({
        id: 'sub_with_pm',
        status: 'trialing',
        metadata: { supabase_user_id: 'user-pm-true', tier_id: 'tier-uuid-123' },
        trial_end: Math.floor(Date.now() / 1000) + 2 * 86400,
        default_payment_method: 'pm_abc',
      });

      const eventWithPM = createMockEvent(
        'customer.subscription.trial_will_end',
        subWithPM as unknown as Record<string, unknown>
      );

      await expect(service.processEvent(eventWithPM)).resolves.not.toThrow();

      // Without payment method
      const subNoPM = createMockSubscription({
        id: 'sub_no_pm',
        status: 'trialing',
        metadata: { supabase_user_id: 'user-pm-false', tier_id: 'tier-uuid-123' },
        trial_end: Math.floor(Date.now() / 1000) + 2 * 86400,
        default_payment_method: null,
      });

      const eventNoPM = createMockEvent(
        'customer.subscription.trial_will_end',
        subNoPM as unknown as Record<string, unknown>
      );

      await expect(service.processEvent(eventNoPM)).resolves.not.toThrow();
    });
  });

  // ============================================
  // handleInvoicePaid (via processEvent)
  // ============================================

  describe('handleInvoicePaid', () => {
    it('should process invoice.paid with string subscription id', async () => {
      const invoice = createMockInvoice({
        id: 'in_paid_string',
        subscription: 'sub_from_string',
      });

      const event = createMockEvent('invoice.paid', invoice as unknown as Record<string, unknown>);

      const mockSubscription = createMockSubscription({
        id: 'sub_from_string',
        metadata: { supabase_user_id: 'user-invoice-paid' },
      });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_from_string');
    });

    it('should process invoice.paid with object subscription', async () => {
      const invoice = createMockInvoice({
        id: 'in_obj_sub',
        subscription: { id: 'sub_from_object' } as any,
      });

      const event = createMockEvent('invoice.paid', invoice as unknown as Record<string, unknown>);

      const mockSubscription = createMockSubscription({
        id: 'sub_from_object',
        metadata: { supabase_user_id: 'user-obj-sub' },
      });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_from_object');
    });

    it('should extract subscription from invoice lines when no direct subscription', async () => {
      const invoice = createMockInvoice({
        id: 'in_from_lines',
        subscription: null as any,
        lines: { data: [{ subscription: 'sub_from_line' }] } as any,
      });

      const event = createMockEvent('invoice.paid', invoice as unknown as Record<string, unknown>);

      const mockSubscription = createMockSubscription({
        id: 'sub_from_line',
        metadata: { supabase_user_id: 'user-from-line' },
      });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_from_line');
    });

    it('should skip when no subscription can be found', async () => {
      const invoice = createMockInvoice({
        id: 'in_no_sub_at_all',
        subscription: null as any,
        lines: { data: [] } as any,
      });

      const event = createMockEvent('invoice.paid', invoice as unknown as Record<string, unknown>);

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it('should skip when subscription has no userId metadata', async () => {
      const invoice = createMockInvoice({
        id: 'in_no_user_meta',
        subscription: 'sub_no_user',
      });

      const event = createMockEvent('invoice.paid', invoice as unknown as Record<string, unknown>);

      const mockSubscription = createMockSubscription({
        id: 'sub_no_user',
        metadata: {},
      });
      mocks.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      await service.processEvent(event);

      expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_no_user');
      // Should not throw, just logs and returns
    });
  });
});
