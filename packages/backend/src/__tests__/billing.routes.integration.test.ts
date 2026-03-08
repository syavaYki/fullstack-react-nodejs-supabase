/**
 * @file billing.routes.integration.test.ts
 * @description HTTP integration tests for billing routes using supertest.
 *
 * Covers: checkout sessions, portal sessions, payment history,
 * subscription status, pro trial start, and Stripe webhooks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted runs before any imports)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  stripeService: {
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    getPaymentHistory: vi.fn(),
    hasUserUsedTrial: vi.fn(),
    userHasActiveSubscription: vi.fn(),
    getLatestActiveSubscription: vi.fn(),
  },
  webhookService: {
    verifyWebhookSignature: vi.fn(),
    processEvent: vi.fn(),
  },
  membershipService: {
    syncFromStripe: vi.fn(),
    getTierByName: vi.fn(),
  },
}));

vi.mock('../services/stripe.service.ts', () => ({ stripeService: mocks.stripeService }));
vi.mock('../services/webhook.service.ts', () => ({ webhookService: mocks.webhookService }));
vi.mock('../services/membership.service.ts', () => ({
  membershipService: mocks.membershipService,
}));

// Mock auth middleware to inject a fake user on every request
vi.mock('../middleware/auth.middleware.ts', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-123', email: 'test@example.com' };
    req.accessToken = 'mock-access-token';
    next();
  },
}));

vi.mock('../middleware/requireUser.middleware.ts', () => ({
  requireUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../config/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    PORT: '3001',
  },
}));

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
  supabaseClient: {},
  createSupabaseReqResClient: vi.fn(),
  createSupabaseClientWithAuth: vi.fn(),
}));

vi.mock('../utils/logger.ts', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), logError: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import billingRoutes from '../routes/billing.routes.ts';
import { ApiError } from '../middleware/error.middleware.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function createApp() {
  const app = express();
  // Webhook needs raw body — must be registered before express.json()
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use('/api/billing', billingRoutes);
  // Error handler matching the real error middleware behaviour
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Validation error' });
    } else {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  });
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Billing Routes — Integration', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  // ── POST /create-checkout-session ───────────────────────────────────────

  describe('POST /api/billing/create-checkout-session', () => {
    it('should return checkout_url on success', async () => {
      mocks.stripeService.createCheckoutSession.mockResolvedValue(
        'https://checkout.stripe.com/session_abc'
      );

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ tier_id: VALID_UUID, billing_cycle: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkout_url).toBe('https://checkout.stripe.com/session_abc');
      expect(mocks.stripeService.createCheckoutSession).toHaveBeenCalledWith(
        'user-uuid-123',
        'test@example.com',
        VALID_UUID,
        'monthly',
        undefined, // success_url
        undefined, // cancel_url
        false // skip_trial
      );
    });

    it('should return 400 for invalid tier_id', async () => {
      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ tier_id: 'not-a-uuid', billing_cycle: 'monthly' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should redirect to portal when ACTIVE_SUBSCRIPTION_EXISTS', async () => {
      mocks.stripeService.createCheckoutSession.mockRejectedValue(
        new ApiError(400, 'ACTIVE_SUBSCRIPTION_EXISTS')
      );
      mocks.stripeService.createPortalSession.mockResolvedValue(
        'https://billing.stripe.com/portal'
      );

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ tier_id: VALID_UUID, billing_cycle: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.portal_url).toBe('https://billing.stripe.com/portal');
      expect(res.body.data.message).toContain('already have an active subscription');
    });
  });

  // ── POST /create-portal-session ─────────────────────────────────────────

  describe('POST /api/billing/create-portal-session', () => {
    it('should return portal_url on success', async () => {
      mocks.stripeService.createPortalSession.mockResolvedValue(
        'https://billing.stripe.com/portal/xyz'
      );

      const res = await request(app).post('/api/billing/create-portal-session').send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.portal_url).toBe('https://billing.stripe.com/portal/xyz');
      expect(mocks.stripeService.createPortalSession).toHaveBeenCalledWith('user-uuid-123');
    });
  });

  // ── GET /payment-history ────────────────────────────────────────────────

  describe('GET /api/billing/payment-history', () => {
    it('should return payment list', async () => {
      const payments = [
        { id: 'pi_1', amount: 1999, status: 'succeeded' },
        { id: 'pi_2', amount: 999, status: 'succeeded' },
      ];
      mocks.stripeService.getPaymentHistory.mockResolvedValue(payments);

      const res = await request(app).get('/api/billing/payment-history');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(payments);
      expect(mocks.stripeService.getPaymentHistory).toHaveBeenCalledWith('user-uuid-123', 10);
    });

    it('should respect limit query param', async () => {
      mocks.stripeService.getPaymentHistory.mockResolvedValue([]);

      const res = await request(app).get('/api/billing/payment-history?limit=5');

      expect(res.status).toBe(200);
      expect(mocks.stripeService.getPaymentHistory).toHaveBeenCalledWith('user-uuid-123', 5);
    });
  });

  // ── GET /subscription-status ────────────────────────────────────────────

  describe('GET /api/billing/subscription-status', () => {
    it('should sync and return membership', async () => {
      const membership = { tier: 'premium', status: 'active' };
      mocks.membershipService.syncFromStripe.mockResolvedValue(membership);

      const res = await request(app).get('/api/billing/subscription-status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(membership);
      expect(mocks.membershipService.syncFromStripe).toHaveBeenCalledWith('user-uuid-123', false);
    });

    it('should force sync when force=true', async () => {
      const membership = { tier: 'pro', status: 'active' };
      mocks.membershipService.syncFromStripe.mockResolvedValue(membership);

      const res = await request(app).get('/api/billing/subscription-status?force=true');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(membership);
      expect(mocks.membershipService.syncFromStripe).toHaveBeenCalledWith('user-uuid-123', true);
    });
  });

  // ── POST /start-pro-trial ──────────────────────────────────────────────

  describe('POST /api/billing/start-pro-trial', () => {
    it('should return checkout_url on success', async () => {
      mocks.stripeService.hasUserUsedTrial.mockResolvedValue(false);
      mocks.stripeService.userHasActiveSubscription.mockResolvedValue({ hasActive: false });
      mocks.membershipService.getTierByName.mockResolvedValue({
        id: 'pro-tier-uuid',
        name: 'pro',
        trial_days: 14,
      });
      mocks.stripeService.createCheckoutSession.mockResolvedValue(
        'https://checkout.stripe.com/trial'
      );

      const res = await request(app).post('/api/billing/start-pro-trial').send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkout_url).toBe('https://checkout.stripe.com/trial');
      expect(mocks.stripeService.createCheckoutSession).toHaveBeenCalledWith(
        'user-uuid-123',
        'test@example.com',
        'pro-tier-uuid',
        'monthly',
        'http://localhost:5173/dashboard?trial=started',
        'http://localhost:5173/pricing?trial=cancelled'
      );
    });

    it('should return 400 when trial already used', async () => {
      mocks.stripeService.hasUserUsedTrial.mockResolvedValue(true);

      const res = await request(app).post('/api/billing/start-pro-trial').send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('TRIAL_ALREADY_USED');
    });

    it('should return 400 when active subscription exists', async () => {
      mocks.stripeService.hasUserUsedTrial.mockResolvedValue(false);
      mocks.stripeService.userHasActiveSubscription.mockResolvedValue({ hasActive: true });

      const res = await request(app).post('/api/billing/start-pro-trial').send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ACTIVE_SUBSCRIPTION_EXISTS');
    });
  });

  // ── POST /webhook ──────────────────────────────────────────────────────

  describe('POST /api/billing/webhook', () => {
    it('should return { received: true } on valid webhook', async () => {
      const event = { id: 'evt_test', type: 'test', data: { object: {} } };
      mocks.webhookService.verifyWebhookSignature.mockReturnValue(event);
      mocks.webhookService.processEvent.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 'test-sig')
        .set('Content-Type', 'application/json')
        .send(Buffer.from(JSON.stringify(event)));

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(mocks.webhookService.verifyWebhookSignature).toHaveBeenCalled();
      expect(mocks.webhookService.processEvent).toHaveBeenCalledWith(event);
    });

    it('should return 400 when stripe-signature header is missing', async () => {
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send(Buffer.from(JSON.stringify({ id: 'evt_no_sig' })));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Missing stripe-signature header');
    });
  });
});
