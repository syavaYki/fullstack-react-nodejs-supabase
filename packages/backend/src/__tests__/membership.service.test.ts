/**
 * @file membership.service.test.ts
 * @description Tests for MembershipService — manages tiers, user memberships,
 *   feature access, tier changes, Stripe sync, and downgrades.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Mocks: supabaseAdmin, createSupabaseClientWithAuth (config/supabase),
 *        stripeService (services/stripe.service), logger (utils/logger).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks — available inside vi.mock factories
// ============================================

const mocks = vi.hoisted(() => {
  /**
   * Creates a fresh chainable query builder mimicking Supabase's fluent API.
   * All non-terminal methods return the builder for chaining;
   * terminal methods (single) resolve with { data, error }.
   */
  const createQueryBuilder = () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      neq: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      single: vi.fn(),
    };

    // Chainable: all methods except terminal ones return the builder
    for (const key of Object.keys(builder)) {
      if (key !== 'single') {
        builder[key].mockReturnValue(builder);
      }
    }

    // Default terminal resolution
    builder.single.mockResolvedValue({ data: null, error: null });

    return builder;
  };

  const queryBuilder = createQueryBuilder();

  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn(),
    },
    createSupabaseClientWithAuth: vi.fn(),
    queryBuilder,
    createQueryBuilder,
    stripeService: {
      getLatestActiveSubscription: vi.fn(),
      syncSubscriptionToDatabase: vi.fn(),
    },
  };
});

// ============================================
// vi.mock — uses .ts extensions (test files excluded from tsconfig)
// ============================================

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
  createSupabaseClientWithAuth: mocks.createSupabaseClientWithAuth,
}));

vi.mock('../services/stripe.service.ts', () => ({
  stripeService: mocks.stripeService,
}));

vi.mock('../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

// ============================================
// Import the class under test AFTER mocks are configured
// ============================================

import { MembershipService } from '../services/membership.service.ts';
import { ApiError } from '../middleware/error.middleware.ts';

// ============================================
// Test Data Factories
// ============================================

function makeTier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tier-uuid-premium',
    name: 'premium',
    display_name: 'Premium',
    description: 'Premium tier',
    price_monthly: 29,
    price_yearly: 290,
    stripe_price_id_monthly: 'price_monthly_123',
    stripe_price_id_yearly: 'price_yearly_123',
    stripe_product_id: 'prod_123',
    trial_days: 14,
    is_active: true,
    is_default: false,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFreeTier(overrides: Record<string, unknown> = {}) {
  return makeTier({
    id: 'tier-uuid-free',
    name: 'free',
    display_name: 'Free',
    description: 'Free tier',
    price_monthly: 0,
    price_yearly: 0,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: null,
    stripe_product_id: null,
    trial_days: 0,
    is_default: true,
    sort_order: 0,
    ...overrides,
  });
}

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership-uuid-123',
    user_id: 'user-uuid-123',
    tier_id: 'tier-uuid-premium',
    status: 'active',
    started_at: '2026-01-01T00:00:00Z',
    cancelled_at: null,
    cancel_at_period_end: false,
    billing_cycle: 'monthly',
    has_used_trial: false,
    trial_starts_at: null,
    trial_ends_at: null,
    stripe_subscription_id: 'sub_test123',
    stripe_price_id: 'price_test123',
    stripe_status: 'active',
    current_period_start: null,
    current_period_end: null,
    stripe_current_period_end: null,
    last_synced_at: null,
    sync_expires_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMembershipWithTier(overrides: Record<string, unknown> = {}) {
  const membership = makeMembership(overrides);
  return {
    ...membership,
    tier: makeTier(),
  };
}

function makeFeature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feature-uuid-123',
    key: 'example_limit',
    name: 'Example Limit Feature',
    description: 'An example limit feature',
    feature_type: 'limit',
    default_value: '5',
    is_active: true,
    status: 'active',
    sort_order: 10,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTierFeatureWithDetails(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tf-uuid-1',
    tier_id: 'tier-uuid-premium',
    feature_id: 'feature-uuid-123',
    value: 10,
    created_at: '2026-01-01T00:00:00Z',
    feature: makeFeature(),
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('MembershipService', () => {
  let service: MembershipService;
  const userId = 'user-uuid-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MembershipService();

    // Reset the query builder so each test starts fresh
    const qb = mocks.createQueryBuilder();
    Object.assign(mocks.queryBuilder, qb);
    mocks.supabaseAdmin.from.mockReturnValue(mocks.queryBuilder);
  });

  // ------------------------------------------
  // getTiers
  // ------------------------------------------

  describe('getTiers', () => {
    it('should return all tiers ordered by sort_order', async () => {
      const tiers = [
        makeFreeTier(),
        makeTier({ id: 'tier-uuid-premium', sort_order: 2 }),
        makeTier({ id: 'tier-uuid-pro', name: 'pro', sort_order: 3 }),
      ];

      // from('membership_tiers').select('*').order('sort_order') is chainable
      // The chain terminates implicitly (no .single()), so we make order() resolve
      mocks.queryBuilder.order.mockResolvedValue({ data: tiers, error: null });

      const result = await service.getTiers();

      expect(result).toEqual(tiers);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('membership_tiers');
      expect(mocks.queryBuilder.select).toHaveBeenCalledWith('*');
      expect(mocks.queryBuilder.order).toHaveBeenCalledWith('sort_order');
    });

    it('should use auth client when accessToken is provided', async () => {
      const tiers = [makeFreeTier()];
      const authQueryBuilder = mocks.createQueryBuilder();
      authQueryBuilder.order.mockResolvedValue({ data: tiers, error: null });

      const mockAuthClient = { from: vi.fn().mockReturnValue(authQueryBuilder) };
      mocks.createSupabaseClientWithAuth.mockReturnValue(mockAuthClient);

      const result = await service.getTiers('user-access-token');

      expect(mocks.createSupabaseClientWithAuth).toHaveBeenCalledWith('user-access-token');
      expect(mockAuthClient.from).toHaveBeenCalledWith('membership_tiers');
      expect(result).toEqual(tiers);
    });

    it('should throw ApiError 500 on database error', async () => {
      mocks.queryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(service.getTiers()).rejects.toThrow(ApiError);
      await expect(service.getTiers()).rejects.toThrow('connection refused');
    });
  });

  // ------------------------------------------
  // getTierById
  // ------------------------------------------

  describe('getTierById', () => {
    it('should return specific tier', async () => {
      const tier = makeTier();
      mocks.queryBuilder.single.mockResolvedValue({ data: tier, error: null });

      const result = await service.getTierById('tier-uuid-premium');

      expect(result).toEqual(tier);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('membership_tiers');
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('id', 'tier-uuid-premium');
    });

    it('should throw 404 for non-existent tier (PGRST116)', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
        },
      });

      try {
        await service.getTierById('nonexistent-tier');
        expect.fail('Expected getTierById to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).message).toBe('Tier not found');
      }
    });

    it('should throw 500 for non-PGRST116 errors', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      try {
        await service.getTierById('tier-uuid-premium');
        expect.fail('Expected getTierById to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
        expect((err as ApiError).message).toBe('relation does not exist');
      }
    });
  });

  // ------------------------------------------
  // getTierByName
  // ------------------------------------------

  describe('getTierByName', () => {
    it('should return tier by name', async () => {
      const tier = makeTier({ name: 'premium' });
      mocks.queryBuilder.single.mockResolvedValue({ data: tier, error: null });

      const result = await service.getTierByName('premium');

      expect(result).toEqual(tier);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('membership_tiers');
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('name', 'premium');
    });

    it('should throw 404 when tier name not found (PGRST116)', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      try {
        await service.getTierByName('nonexistent');
        expect.fail('Expected getTierByName to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).message).toBe('Tier not found');
      }
    });
  });

  // ------------------------------------------
  // getUserMembership
  // ------------------------------------------

  describe('getUserMembership', () => {
    it('should return membership with tier data', async () => {
      const membershipWithTier = makeMembershipWithTier();
      mocks.queryBuilder.single.mockResolvedValue({ data: membershipWithTier, error: null });

      const result = await service.getUserMembership(userId);

      expect(result).toEqual(membershipWithTier);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('memberships');
      expect(mocks.queryBuilder.select).toHaveBeenCalledWith('*, tier:membership_tiers(*)');
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should throw 404 when not found', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      try {
        await service.getUserMembership(userId);
        expect.fail('Expected getUserMembership to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).message).toBe('Membership not found');
      }
    });

    it('should use auth client when accessToken is provided', async () => {
      const membershipWithTier = makeMembershipWithTier();
      const authQueryBuilder = mocks.createQueryBuilder();
      authQueryBuilder.single.mockResolvedValue({ data: membershipWithTier, error: null });

      const mockAuthClient = { from: vi.fn().mockReturnValue(authQueryBuilder) };
      mocks.createSupabaseClientWithAuth.mockReturnValue(mockAuthClient);

      const result = await service.getUserMembership(userId, 'user-access-token');

      expect(mocks.createSupabaseClientWithAuth).toHaveBeenCalledWith('user-access-token');
      expect(mockAuthClient.from).toHaveBeenCalledWith('memberships');
      expect(result).toEqual(membershipWithTier);
    });
  });

  // ------------------------------------------
  // getUserTierWithFeatures
  // ------------------------------------------

  describe('getUserTierWithFeatures', () => {
    it('should return tier with features from RPC', async () => {
      const tierWithFeatures = {
        tier_name: 'premium',
        tier_display_name: 'Premium',
        membership_status: 'active',
        stripe_status: 'active',
        trial_ends_at: null,
        features: { example_limit: '10', advanced_analytics: 'true' },
      };

      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [tierWithFeatures],
        error: null,
      });

      const result = await service.getUserTierWithFeatures(userId);

      expect(result).toEqual(tierWithFeatures);
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('get_user_tier_with_features', {
        p_user_id: userId,
      });
    });

    it('should return null when no data', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.getUserTierWithFeatures(userId);

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getUserTierWithFeatures(userId);

      expect(result).toBeNull();
    });

    it('should throw ApiError 500 on RPC error', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'function does not exist' },
      });

      await expect(service.getUserTierWithFeatures(userId)).rejects.toThrow(
        'function does not exist'
      );
    });
  });

  // ------------------------------------------
  // getTierFeatures
  // ------------------------------------------

  describe('getTierFeatures', () => {
    it('should return features for tier', async () => {
      const features = [
        makeTierFeatureWithDetails(),
        makeTierFeatureWithDetails({
          id: 'tf-uuid-2',
          feature_id: 'feature-uuid-456',
          value: true,
          feature: makeFeature({
            id: 'feature-uuid-456',
            key: 'analytics',
            feature_type: 'boolean',
          }),
        }),
      ];

      // from('tier_features').select('*, feature:features(*)').eq('tier_id', tierId)
      // Terminal: eq() resolves (no .single())
      mocks.queryBuilder.eq.mockResolvedValue({ data: features, error: null });

      const result = await service.getTierFeatures('tier-uuid-premium');

      expect(result).toEqual(features);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('tier_features');
      expect(mocks.queryBuilder.select).toHaveBeenCalledWith('*, feature:features(*)');
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('tier_id', 'tier-uuid-premium');
    });

    it('should throw ApiError 500 on database error', async () => {
      mocks.queryBuilder.eq.mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      });

      await expect(service.getTierFeatures('tier-uuid-premium')).rejects.toThrow(
        'permission denied'
      );
    });
  });

  // ------------------------------------------
  // getAllFeatures
  // ------------------------------------------

  describe('getAllFeatures', () => {
    it('should return all active features', async () => {
      const features = [
        makeFeature({ key: 'feature_a' }),
        makeFeature({ key: 'feature_b', id: 'feature-uuid-456' }),
      ];

      // from('features').select('*').eq('is_active', true) is terminal at eq()
      mocks.queryBuilder.eq.mockResolvedValue({ data: features, error: null });

      const result = await service.getAllFeatures();

      expect(result).toEqual(features);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('features');
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  // ------------------------------------------
  // userHasFeature
  // ------------------------------------------

  describe('userHasFeature', () => {
    it('should return true when RPC returns truthy data', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: true, error: null });

      const result = await service.userHasFeature(userId, 'advanced_analytics');

      expect(result).toBe(true);
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('user_has_feature', {
        p_user_id: userId,
        p_feature_key: 'advanced_analytics',
      });
    });

    it('should return false when RPC returns falsy data', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: false, error: null });

      const result = await service.userHasFeature(userId, 'premium_only_feature');

      expect(result).toBe(false);
    });

    it('should throw ApiError 500 on RPC error', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      await expect(service.userHasFeature(userId, 'some_feature')).rejects.toThrow('RPC error');
    });
  });

  // ------------------------------------------
  // getFeatureLimit
  // ------------------------------------------

  describe('getFeatureLimit', () => {
    it('should return numeric limit from RPC', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: 50, error: null });

      const result = await service.getFeatureLimit(userId, 'api_calls');

      expect(result).toBe(50);
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('get_feature_limit', {
        p_user_id: userId,
        p_feature_key: 'api_calls',
      });
    });

    it('should return -1 for unlimited features', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: -1, error: null });

      const result = await service.getFeatureLimit(userId, 'unlimited_feature');

      expect(result).toBe(-1);
    });

    it('should return 0 when feature not available', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: 0, error: null });

      const result = await service.getFeatureLimit(userId, 'unavailable_feature');

      expect(result).toBe(0);
    });
  });

  // ------------------------------------------
  // updateMembership
  // ------------------------------------------

  describe('updateMembership', () => {
    it('should update membership with partial data', async () => {
      const updated = makeMembership({ status: 'cancelled', cancelled_at: '2026-03-06T00:00:00Z' });
      mocks.queryBuilder.single.mockResolvedValue({ data: updated, error: null });

      const result = await service.updateMembership(userId, {
        status: 'cancelled',
        cancelled_at: '2026-03-06T00:00:00Z',
      } as any);

      expect(result).toEqual(updated);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('memberships');
      expect(mocks.queryBuilder.update).toHaveBeenCalledWith({
        status: 'cancelled',
        cancelled_at: '2026-03-06T00:00:00Z',
      });
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should throw ApiError 500 on database error', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'update failed' },
      });

      await expect(service.updateMembership(userId, { status: 'active' } as any)).rejects.toThrow(
        'update failed'
      );
    });
  });

  // ------------------------------------------
  // changeTier
  // ------------------------------------------

  describe('changeTier', () => {
    it('should call RPC and return updated membership', async () => {
      // First call: RPC change_user_tier succeeds
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ success: true }],
        error: null,
      });

      // Second call: fetch the updated membership with tier data
      const updatedMembership = makeMembershipWithTier({ tier_id: 'tier-uuid-pro' });
      const fetchBuilder = mocks.createQueryBuilder();
      fetchBuilder.single.mockResolvedValue({ data: updatedMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(fetchBuilder);

      const result = await service.changeTier(userId, 'tier-uuid-pro', 'yearly');

      expect(result).toEqual(updatedMembership);
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('change_user_tier', {
        p_user_id: userId,
        p_tier_id: 'tier-uuid-pro',
        p_billing_cycle: 'yearly',
      });
    });

    it('should default billingCycle to monthly', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ success: true }],
        error: null,
      });

      const updatedMembership = makeMembershipWithTier();
      const fetchBuilder = mocks.createQueryBuilder();
      fetchBuilder.single.mockResolvedValue({ data: updatedMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(fetchBuilder);

      await service.changeTier(userId, 'tier-uuid-premium');

      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('change_user_tier', {
        p_user_id: userId,
        p_tier_id: 'tier-uuid-premium',
        p_billing_cycle: 'monthly',
      });
    });

    it('should throw when RPC returns error', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'could not execute function' },
      });

      try {
        await service.changeTier(userId, 'tier-uuid-pro');
        expect.fail('Expected changeTier to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
        expect((err as ApiError).message).toBe('Failed to change tier: could not execute function');
      }
    });

    it('should throw 400 when RPC returns unsuccessful result', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ success: false, error_message: 'Tier does not exist' }],
        error: null,
      });

      try {
        await service.changeTier(userId, 'bad-tier-id');
        expect.fail('Expected changeTier to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(400);
        expect((err as ApiError).message).toBe('Tier does not exist');
      }
    });

    it('should throw 400 with default message when RPC returns empty result', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      try {
        await service.changeTier(userId, 'tier-uuid-pro');
        expect.fail('Expected changeTier to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(400);
        expect((err as ApiError).message).toBe('Unknown error changing tier');
      }
    });
  });

  // ------------------------------------------
  // upgradeMembership
  // ------------------------------------------

  describe('upgradeMembership', () => {
    it('should update membership with Stripe data', async () => {
      const now = new Date();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const updated = makeMembership({
        tier_id: 'tier-uuid-pro',
        status: 'active',
        stripe_subscription_id: 'sub_new123',
      });
      mocks.queryBuilder.single.mockResolvedValue({ data: updated, error: null });

      const stripeData = {
        stripe_subscription_id: 'sub_new123',
        stripe_price_id: 'price_pro_monthly',
        billing_cycle: 'monthly' as const,
        current_period_start: now,
        current_period_end: periodEnd,
      };

      const result = await service.upgradeMembership(userId, 'tier-uuid-pro', stripeData);

      expect(result).toEqual(updated);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('memberships');
      expect(mocks.queryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tier_id: 'tier-uuid-pro',
          status: 'active',
          stripe_subscription_id: 'sub_new123',
          stripe_price_id: 'price_pro_monthly',
          billing_cycle: 'monthly',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
      );
    });
  });

  // ------------------------------------------
  // syncFromStripe
  // ------------------------------------------

  describe('syncFromStripe', () => {
    it('should use cache when not expired', async () => {
      // sync_expires_at is in the future
      const futureExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const cachedMembership = makeMembershipWithTier({
        sync_expires_at: futureExpiry,
        last_synced_at: new Date().toISOString(),
      });

      // getUserMembership call
      mocks.queryBuilder.single.mockResolvedValue({ data: cachedMembership, error: null });

      const result = await service.syncFromStripe(userId);

      expect(result).toEqual(cachedMembership);
      // Should NOT have called stripeService since cache is valid
      expect(mocks.stripeService.getLatestActiveSubscription).not.toHaveBeenCalled();
      expect(mocks.stripeService.syncSubscriptionToDatabase).not.toHaveBeenCalled();
    });

    it('should sync when cache expired', async () => {
      // Expired cache
      const pastExpiry = new Date(Date.now() - 1000).toISOString();
      const staleMembership = makeMembershipWithTier({
        sync_expires_at: pastExpiry,
        tier_id: 'tier-uuid-premium',
      });

      // First getUserMembership call: returns stale data
      const firstBuilder = mocks.createQueryBuilder();
      firstBuilder.single.mockResolvedValue({ data: staleMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(firstBuilder);

      // Profile fetch for stripe_customer_id
      const profileBuilder = mocks.createQueryBuilder();
      profileBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_test123' },
        error: null,
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(profileBuilder);

      // Stripe returns an active subscription
      const mockSubscription = { id: 'sub_test123', status: 'active' };
      mocks.stripeService.getLatestActiveSubscription.mockResolvedValue(mockSubscription);
      mocks.stripeService.syncSubscriptionToDatabase.mockResolvedValue(undefined);

      // Final getUserMembership call after sync
      const freshMembership = makeMembershipWithTier({
        sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        last_synced_at: new Date().toISOString(),
      });
      const finalBuilder = mocks.createQueryBuilder();
      finalBuilder.single.mockResolvedValue({ data: freshMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(finalBuilder);

      const result = await service.syncFromStripe(userId);

      expect(result).toEqual(freshMembership);
      expect(mocks.stripeService.getLatestActiveSubscription).toHaveBeenCalledWith('cus_test123');
      expect(mocks.stripeService.syncSubscriptionToDatabase).toHaveBeenCalledWith(
        userId,
        mockSubscription
      );
    });

    it('should force sync even when cache is valid', async () => {
      const futureExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const cachedMembership = makeMembershipWithTier({
        sync_expires_at: futureExpiry,
      });

      // First getUserMembership call
      const firstBuilder = mocks.createQueryBuilder();
      firstBuilder.single.mockResolvedValue({ data: cachedMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(firstBuilder);

      // Profile fetch
      const profileBuilder = mocks.createQueryBuilder();
      profileBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_test123' },
        error: null,
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(profileBuilder);

      const mockSubscription = { id: 'sub_test123', status: 'active' };
      mocks.stripeService.getLatestActiveSubscription.mockResolvedValue(mockSubscription);
      mocks.stripeService.syncSubscriptionToDatabase.mockResolvedValue(undefined);

      // Final getUserMembership
      const freshMembership = makeMembershipWithTier();
      const finalBuilder = mocks.createQueryBuilder();
      finalBuilder.single.mockResolvedValue({ data: freshMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(finalBuilder);

      await service.syncFromStripe(userId, true);

      // Should have synced despite valid cache since forceSync is true
      expect(mocks.stripeService.getLatestActiveSubscription).toHaveBeenCalled();
    });

    it('should update sync timestamps when no stripe_customer_id exists', async () => {
      const membershipNoStripe = makeMembershipWithTier({
        sync_expires_at: null,
        stripe_subscription_id: null,
      });

      // First getUserMembership
      const firstBuilder = mocks.createQueryBuilder();
      firstBuilder.single.mockResolvedValue({ data: membershipNoStripe, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(firstBuilder);

      // Profile fetch: no stripe_customer_id
      const profileBuilder = mocks.createQueryBuilder();
      profileBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: null },
        error: null,
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(profileBuilder);

      // updateMembership call: from('memberships').update(...).eq().select().single()
      const updateBuilder = mocks.createQueryBuilder();
      updateBuilder.single.mockResolvedValue({
        data: makeMembership({ last_synced_at: new Date().toISOString() }),
        error: null,
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder);

      // Final getUserMembership
      const freshMembership = makeMembershipWithTier();
      const finalBuilder = mocks.createQueryBuilder();
      finalBuilder.single.mockResolvedValue({ data: freshMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(finalBuilder);

      const result = await service.syncFromStripe(userId);

      expect(result).toEqual(freshMembership);
      // Should NOT have called Stripe at all since there's no customer ID
      expect(mocks.stripeService.getLatestActiveSubscription).not.toHaveBeenCalled();
    });

    it('should throw ApiError 500 when Stripe sync fails', async () => {
      const staleMembership = makeMembershipWithTier({ sync_expires_at: null });

      // First getUserMembership
      const firstBuilder = mocks.createQueryBuilder();
      firstBuilder.single.mockResolvedValue({ data: staleMembership, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(firstBuilder);

      // Profile fetch
      const profileBuilder = mocks.createQueryBuilder();
      profileBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_test123' },
        error: null,
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(profileBuilder);

      // Stripe throws an error
      mocks.stripeService.getLatestActiveSubscription.mockRejectedValue(
        new Error('Stripe API unreachable')
      );

      // updateMembership for the 1-hour cache on error
      const errorUpdateBuilder = mocks.createQueryBuilder();
      errorUpdateBuilder.single.mockResolvedValue({
        data: makeMembership(),
        error: null,
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(errorUpdateBuilder);

      await expect(service.syncFromStripe(userId)).rejects.toThrow(
        'Failed to sync subscription from Stripe'
      );
    });
  });

  // ------------------------------------------
  // downgradeToFree
  // ------------------------------------------

  describe('downgradeToFree', () => {
    it('should update membership to free tier', async () => {
      const freeTier = makeFreeTier();

      // getTierByName('free') call: from('membership_tiers').select('*').eq('name', 'free').single()
      const tierBuilder = mocks.createQueryBuilder();
      tierBuilder.single.mockResolvedValue({ data: freeTier, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(tierBuilder);

      // Update call: from('memberships').update({...}).eq('user_id', userId)
      // This chain does NOT call .single() — eq is the terminal returning { error }
      const updateBuilder = mocks.createQueryBuilder();
      updateBuilder.eq.mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder);

      await service.downgradeToFree(userId, 'No active subscription');

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tier_id: freeTier.id,
          status: 'active',
          stripe_subscription_id: null,
          stripe_price_id: null,
          stripe_status: null,
          stripe_current_period_end: null,
          cancel_at_period_end: false,
          billing_cycle: null,
        })
      );
    });

    it('should not log reason when none is provided', async () => {
      const freeTier = makeFreeTier();
      const { logger } = await import('../utils/logger.ts');

      const tierBuilder = mocks.createQueryBuilder();
      tierBuilder.single.mockResolvedValue({ data: freeTier, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(tierBuilder);

      const updateBuilder = mocks.createQueryBuilder();
      updateBuilder.eq.mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder);

      await service.downgradeToFree(userId);

      // logger.info should NOT be called with the downgrade message when no reason
      expect(logger.info).not.toHaveBeenCalledWith(
        'MEMBERSHIP',
        'Downgrading user to Free tier',
        expect.anything()
      );
    });

    it('should log reason when provided', async () => {
      const freeTier = makeFreeTier();
      const { logger } = await import('../utils/logger.ts');

      const tierBuilder = mocks.createQueryBuilder();
      tierBuilder.single.mockResolvedValue({ data: freeTier, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(tierBuilder);

      const updateBuilder = mocks.createQueryBuilder();
      updateBuilder.eq.mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder);

      await service.downgradeToFree(userId, 'Subscription cancelled');

      expect(logger.info).toHaveBeenCalledWith('MEMBERSHIP', 'Downgrading user to Free tier', {
        userId,
        reason: 'Subscription cancelled',
      });
    });

    it('should throw ApiError 500 when update fails', async () => {
      const freeTier = makeFreeTier();

      const tierBuilder = mocks.createQueryBuilder();
      tierBuilder.single.mockResolvedValue({ data: freeTier, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(tierBuilder);

      const updateBuilder = mocks.createQueryBuilder();
      updateBuilder.eq.mockResolvedValue({ error: { message: 'update failed' } });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder);

      try {
        await service.downgradeToFree(userId);
        expect.fail('Expected downgradeToFree to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
        expect((err as ApiError).message).toBe('Failed to downgrade to Free tier');
      }
    });
  });
});
