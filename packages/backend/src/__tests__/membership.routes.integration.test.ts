/**
 * @file membership.routes.integration.test.ts
 * @description HTTP integration tests for membership routes using supertest.
 *
 * Covers: public tiers, authenticated tier/feature queries, trial status,
 * trial start, change-tier (dev only), and usage tracking endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted runs before any imports)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  return {
    membershipService: {
      getTiers: vi.fn(),
      getTierFeatures: vi.fn(),
      getUserMembership: vi.fn(),
      getUserTierWithFeatures: vi.fn(),
      userHasFeature: vi.fn(),
      getFeatureLimit: vi.fn(),
      getTierByName: vi.fn(),
      changeTier: vi.fn(),
    },
    stripeService: {
      hasUserUsedTrial: vi.fn(),
      userHasActiveSubscription: vi.fn(),
      createCheckoutSession: vi.fn(),
      getLatestActiveSubscription: vi.fn(),
    },
    usageService: {
      getAllUsage: vi.fn(),
      getUsage: vi.fn(),
    },
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
    },
    queryBuilder,
  };
});

// ---------------------------------------------------------------------------
// Module mocks (use .ts extensions for vi.mock — vitest resolves via alias)
// ---------------------------------------------------------------------------

vi.mock('../services/membership.service.ts', () => ({
  membershipService: mocks.membershipService,
}));
vi.mock('../services/stripe.service.ts', () => ({ stripeService: mocks.stripeService }));
vi.mock('../services/usage.service.ts', () => ({ usageService: mocks.usageService }));

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
  supabaseAdmin: mocks.supabaseAdmin,
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

import membershipRoutes from '../routes/membership.routes.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/membership', membershipRoutes);
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

describe('Membership Routes — Integration', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the queryBuilder chain after clearing mocks
    mocks.queryBuilder.select.mockReturnThis();
    mocks.queryBuilder.eq.mockReturnThis();
    mocks.supabaseAdmin.from.mockReturnValue(mocks.queryBuilder);
    app = createApp();
  });

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  describe('GET /api/membership/public/tiers-with-features', () => {
    it('should return tiers with their features', async () => {
      const tiers = [
        { id: 'tier-1', name: 'free', display_name: 'Free' },
        { id: 'tier-2', name: 'pro', display_name: 'Pro' },
      ];
      const freeFeatures = [{ id: 'f1', feature_key: 'basic_access' }];
      const proFeatures = [{ id: 'f2', feature_key: 'advanced_access' }];

      mocks.membershipService.getTiers.mockResolvedValue(tiers);
      mocks.membershipService.getTierFeatures
        .mockResolvedValueOnce(freeFeatures)
        .mockResolvedValueOnce(proFeatures);

      const res = await request(app).get('/api/membership/public/tiers-with-features');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([
        { ...tiers[0], features: freeFeatures },
        { ...tiers[1], features: proFeatures },
      ]);
      // Public endpoint — no access token
      expect(mocks.membershipService.getTiers).toHaveBeenCalledWith();
    });

    it('should call getTierFeatures for each tier returned', async () => {
      const tiers = [
        { id: 'tier-a', name: 'trial', display_name: 'Trial' },
        { id: 'tier-b', name: 'premium', display_name: 'Premium' },
        { id: 'tier-c', name: 'pro', display_name: 'Pro' },
      ];

      mocks.membershipService.getTiers.mockResolvedValue(tiers);
      mocks.membershipService.getTierFeatures.mockResolvedValue([]);

      await request(app).get('/api/membership/public/tiers-with-features');

      expect(mocks.membershipService.getTierFeatures).toHaveBeenCalledTimes(3);
      expect(mocks.membershipService.getTierFeatures).toHaveBeenCalledWith('tier-a');
      expect(mocks.membershipService.getTierFeatures).toHaveBeenCalledWith('tier-b');
      expect(mocks.membershipService.getTierFeatures).toHaveBeenCalledWith('tier-c');
    });
  });

  // ── AUTHENTICATED ─────────────────────────────────────────────────────────

  describe('GET /api/membership/tiers', () => {
    it('should return tiers with access token', async () => {
      const tiers = [
        { id: 'tier-1', name: 'free', display_name: 'Free' },
        { id: 'tier-2', name: 'pro', display_name: 'Pro' },
      ];
      mocks.membershipService.getTiers.mockResolvedValue(tiers);

      const res = await request(app).get('/api/membership/tiers');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(tiers);
      expect(mocks.membershipService.getTiers).toHaveBeenCalledWith('mock-access-token');
    });
  });

  describe('GET /api/membership/tiers/:tierId/features', () => {
    it('should return features for a specific tier', async () => {
      const features = [
        { id: 'f1', feature_key: 'api_calls', feature_type: 'limit', value: '1000' },
      ];
      mocks.membershipService.getTierFeatures.mockResolvedValue(features);

      const res = await request(app).get(`/api/membership/tiers/${VALID_UUID}/features`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(features);
      expect(mocks.membershipService.getTierFeatures).toHaveBeenCalledWith(
        VALID_UUID,
        'mock-access-token'
      );
    });
  });

  describe('GET /api/membership/', () => {
    it('should return the current user membership', async () => {
      const membership = {
        id: 'mem-1',
        user_id: 'user-uuid-123',
        tier: { id: 'tier-1', name: 'free', display_name: 'Free' },
        status: 'active',
      };
      mocks.membershipService.getUserMembership.mockResolvedValue(membership);

      const res = await request(app).get('/api/membership/');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(membership);
      expect(mocks.membershipService.getUserMembership).toHaveBeenCalledWith(
        'user-uuid-123',
        'mock-access-token'
      );
    });
  });

  describe('GET /api/membership/features', () => {
    it('should return user tier with features', async () => {
      const tierWithFeatures = {
        tier: { id: 'tier-2', name: 'pro', display_name: 'Pro' },
        features: [{ id: 'f1', feature_key: 'api_calls', value: '5000' }],
      };
      mocks.membershipService.getUserTierWithFeatures.mockResolvedValue(tierWithFeatures);

      const res = await request(app).get('/api/membership/features');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(tierWithFeatures);
      expect(mocks.membershipService.getUserTierWithFeatures).toHaveBeenCalledWith('user-uuid-123');
    });
  });

  describe('GET /api/membership/check-feature/:featureKey', () => {
    it('should return has_feature: true when user has the feature', async () => {
      mocks.membershipService.userHasFeature.mockResolvedValue(true);

      const res = await request(app).get('/api/membership/check-feature/my_feature');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ has_feature: true });
      expect(mocks.membershipService.userHasFeature).toHaveBeenCalledWith(
        'user-uuid-123',
        'my_feature'
      );
    });

    it('should return has_feature: false when user lacks the feature', async () => {
      mocks.membershipService.userHasFeature.mockResolvedValue(false);

      const res = await request(app).get('/api/membership/check-feature/my_feature');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ has_feature: false });
    });
  });

  describe('GET /api/membership/feature-limit/:featureKey', () => {
    it('should return the limit value for a feature', async () => {
      mocks.membershipService.getFeatureLimit.mockResolvedValue(500);

      const res = await request(app).get('/api/membership/feature-limit/my_limit');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ limit: 500 });
      expect(mocks.membershipService.getFeatureLimit).toHaveBeenCalledWith(
        'user-uuid-123',
        'my_limit'
      );
    });
  });

  // ── TRIAL ─────────────────────────────────────────────────────────────────

  describe('GET /api/membership/trial/status', () => {
    it('should return trial status when user is not on trial', async () => {
      mocks.membershipService.getUserMembership.mockResolvedValue({
        has_used_trial: false,
        stripe_status: 'active',
        trial_starts_at: null,
        trial_ends_at: null,
      });
      mocks.queryBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_test' },
        error: null,
      });
      mocks.stripeService.getLatestActiveSubscription.mockResolvedValue({
        status: 'active',
        trial_start: null,
        trial_end: null,
      });

      const res = await request(app).get('/api/membership/trial/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_on_trial).toBe(false);
      expect(res.body.data.has_used_trial).toBe(false);
      expect(res.body.data.can_start_trial).toBe(true);
      expect(res.body.data.trial_starts_at).toBeNull();
      expect(res.body.data.trial_ends_at).toBeNull();
      expect(res.body.data.days_remaining).toBe(0);
    });

    it('should return trial status when user is on trial', async () => {
      const now = Math.floor(Date.now() / 1000);
      const trialStart = now - 86400; // 1 day ago
      const trialEnd = now + 7 * 86400; // 7 days from now

      mocks.membershipService.getUserMembership.mockResolvedValue({
        has_used_trial: true,
        stripe_status: 'trialing',
        trial_starts_at: null,
        trial_ends_at: null,
      });
      mocks.queryBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_trial' },
        error: null,
      });
      mocks.stripeService.getLatestActiveSubscription.mockResolvedValue({
        status: 'trialing',
        trial_start: trialStart,
        trial_end: trialEnd,
        default_payment_method: 'pm_test',
      });

      const res = await request(app).get('/api/membership/trial/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_on_trial).toBe(true);
      expect(res.body.data.has_used_trial).toBe(true);
      expect(res.body.data.can_start_trial).toBe(false);
      expect(res.body.data.trial_starts_at).toBe(new Date(trialStart * 1000).toISOString());
      expect(res.body.data.trial_ends_at).toBe(new Date(trialEnd * 1000).toISOString());
      expect(res.body.data.days_remaining).toBeGreaterThanOrEqual(7);
    });
  });

  describe('POST /api/membership/trial/start', () => {
    it('should return checkout_url on success', async () => {
      mocks.stripeService.hasUserUsedTrial.mockResolvedValue(false);
      mocks.stripeService.userHasActiveSubscription.mockResolvedValue({ hasActive: false });
      mocks.membershipService.getTierByName.mockResolvedValue({
        id: 'pro-tier-uuid',
        name: 'pro',
        trial_days: 14,
      });
      mocks.stripeService.createCheckoutSession.mockResolvedValue(
        'https://checkout.stripe.com/trial_session'
      );

      const res = await request(app).post('/api/membership/trial/start').send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkout_url).toBe('https://checkout.stripe.com/trial_session');
      expect(res.body.message).toContain('Redirecting to Stripe');
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

      const res = await request(app).post('/api/membership/trial/start').send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('TRIAL_ALREADY_USED');
    });

    it('should return 400 when active subscription exists', async () => {
      mocks.stripeService.hasUserUsedTrial.mockResolvedValue(false);
      mocks.stripeService.userHasActiveSubscription.mockResolvedValue({ hasActive: true });

      const res = await request(app).post('/api/membership/trial/start').send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ACTIVE_SUBSCRIPTION_EXISTS');
    });
  });

  // ── CHANGE TIER ───────────────────────────────────────────────────────────

  describe('POST /api/membership/change-tier', () => {
    it('should change tier and return updated membership (test env)', async () => {
      const updatedMembership = {
        id: 'mem-1',
        user_id: 'user-uuid-123',
        tier_id: VALID_UUID,
        tier: { id: VALID_UUID, name: 'premium', display_name: 'Premium' },
        billing_cycle: 'monthly',
      };
      mocks.membershipService.changeTier.mockResolvedValue(updatedMembership);

      const res = await request(app)
        .post('/api/membership/change-tier')
        .send({ tier_id: VALID_UUID, billing_cycle: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updatedMembership);
      expect(res.body.message).toBe('Successfully changed to Premium tier');
      expect(mocks.membershipService.changeTier).toHaveBeenCalledWith(
        'user-uuid-123',
        VALID_UUID,
        'monthly'
      );
    });

    it('should return 400 for invalid tier_id (not a uuid)', async () => {
      const res = await request(app)
        .post('/api/membership/change-tier')
        .send({ tier_id: 'not-a-uuid', billing_cycle: 'monthly' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.membershipService.changeTier).not.toHaveBeenCalled();
    });
  });

  // ── USAGE ─────────────────────────────────────────────────────────────────

  describe('GET /api/membership/usage', () => {
    it('should return all usage data for the user', async () => {
      const usageData = [
        { feature_key: 'api_calls', current_usage: 42, limit: 1000 },
        { feature_key: 'storage', current_usage: 256, limit: 5000 },
      ];
      mocks.usageService.getAllUsage.mockResolvedValue(usageData);

      const res = await request(app).get('/api/membership/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(usageData);
      expect(mocks.usageService.getAllUsage).toHaveBeenCalledWith('user-uuid-123');
    });
  });

  describe('GET /api/membership/usage/:featureKey', () => {
    it('should return usage for a specific feature', async () => {
      const usage = { feature_key: 'api_calls', current_usage: 42, limit: 1000 };
      mocks.usageService.getUsage.mockResolvedValue(usage);

      const res = await request(app).get('/api/membership/usage/api_calls');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(usage);
      expect(mocks.usageService.getUsage).toHaveBeenCalledWith('user-uuid-123', 'api_calls');
    });

    it('should return 404 when no usage tracking found', async () => {
      mocks.usageService.getUsage.mockResolvedValue(null);

      const res = await request(app).get('/api/membership/usage/unknown_feature');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No usage tracking found for this feature');
    });
  });
});
