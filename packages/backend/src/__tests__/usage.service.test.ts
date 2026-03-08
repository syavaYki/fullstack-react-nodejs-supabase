/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars */
/**
 * @file usage.service.test.ts
 * @description Tests for UsageService — tracks feature usage and enforces limits.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Mocks: supabaseAdmin (config/supabase) and membershipService (services/membership.service).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks — available inside vi.mock factories
// ============================================

const mocks = vi.hoisted(() => {
  // Chainable query builder for supabaseAdmin.from(...)
  const createQueryBuilder = () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      eq: vi.fn(),
      lt: vi.fn(),
      in: vi.fn(),
      single: vi.fn(),
    };

    // All methods except terminal ones return the builder for chaining
    for (const key of Object.keys(builder)) {
      if (key !== 'single') {
        builder[key].mockReturnValue(builder);
      }
    }

    // Default single resolves to null
    builder.single.mockResolvedValue({ data: null, error: null });

    return builder;
  };

  const queryBuilder = createQueryBuilder();

  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn(),
    },
    queryBuilder,
    createQueryBuilder,
    membershipService: {
      getTierFeatures: vi.fn(),
      getAllFeatures: vi.fn(),
      getUserMembership: vi.fn(),
      getUserTierWithFeatures: vi.fn(),
      userHasFeature: vi.fn(),
    },
  };
});

// ============================================
// vi.mock — uses .ts extensions (test files excluded from tsconfig)
// ============================================

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock('../services/membership.service.ts', () => ({
  membershipService: mocks.membershipService,
}));

// ============================================
// Import the service under test
// ============================================

import { UsageService } from '../services/usage.service.ts';

// ============================================
// Test Data Factories
// ============================================

function makeFeature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feature-uuid-limit',
    key: 'example_limit',
    name: 'Example Limit Feature',
    description: null,
    feature_type: 'limit',
    default_value: '10',
    is_active: true,
    status: 'active',
    sort_order: 1,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTierFeature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tf-uuid-1',
    tier_id: 'tier-uuid-123',
    feature_id: 'feature-uuid-limit',
    value: 10,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeUsageTracking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'usage-uuid-1',
    user_id: 'user-uuid-123',
    feature_key: 'example_limit',
    current_usage: 3,
    usage_limit: 10,
    period_start: new Date().toISOString(),
    period_end: null,
    period_type: 'monthly',
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('UsageService', () => {
  let service: UsageService;
  const userId = 'user-uuid-123';
  const featureKey = 'example_limit';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsageService();

    // Reset the query builder so each test starts fresh
    const qb = mocks.createQueryBuilder();
    Object.assign(mocks.queryBuilder, qb);
    mocks.supabaseAdmin.from.mockReturnValue(mocks.queryBuilder);
  });

  // ------------------------------------------
  // incrementUsage
  // ------------------------------------------

  describe('incrementUsage', () => {
    it('should return usage result on successful RPC call', async () => {
      // RPC returns new_usage and at_limit
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ new_usage: 4, at_limit: false }],
        error: null,
      });

      // getUsage is called internally to fetch the limit for remaining calculation.
      // Mock checkAndResetPeriod query (first from('usage_tracking') call inside getUsage)
      const usageRecord = makeUsageTracking({ current_usage: 4, usage_limit: 10 });

      // We need from() to return different builders for different call sequences.
      // checkAndResetPeriod calls from('usage_tracking')...single() first,
      // then getUsage calls from('usage_tracking')...single() second.
      const checkResetBuilder = mocks.createQueryBuilder();
      checkResetBuilder.single.mockResolvedValue({
        data: { id: 'usage-uuid-1', period_end: null, period_type: 'lifetime' },
        error: null,
      });

      const getUsageBuilder = mocks.createQueryBuilder();
      getUsageBuilder.single.mockResolvedValue({
        data: usageRecord,
        error: null,
      });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder)
        .mockReturnValueOnce(getUsageBuilder);

      // getAllFeatures is called inside getUsage
      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit', name: 'Example Limit Feature' }),
      ]);

      const result = await service.incrementUsage(userId, featureKey, 1);

      expect(result).toEqual({
        success: true,
        current_usage: 4,
        usage_limit: 10,
        remaining: 6,
        is_exceeded: false,
      });

      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('check_reset_and_increment_usage', {
        p_user_id: userId,
        p_feature_key: featureKey,
      });
    });

    it('should retry ONCE when RPC returns empty data', async () => {
      // First RPC call returns empty data (no usage record exists)
      mocks.supabaseAdmin.rpc
        .mockResolvedValueOnce({ data: [], error: null })
        // Second RPC call (after initialization) succeeds
        .mockResolvedValueOnce({
          data: [{ new_usage: 1, at_limit: false }],
          error: null,
        });

      // getUserMembership for initialization
      mocks.membershipService.getUserMembership.mockResolvedValue({
        tier_id: 'tier-uuid-123',
      });

      // getTierFeatures and getAllFeatures for initializeUsage
      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feature-uuid-limit', value: 10 }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit', feature_type: 'limit' }),
      ]);

      // initializeUsage calls from('usage_tracking').upsert(...)
      const upsertBuilder = mocks.createQueryBuilder();
      // upsert is chainable and doesn't call single — the builder itself resolves
      // Actually upsert returns { error } directly since it's the terminal call in initializeUsage
      mocks.supabaseAdmin.from.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      // After retry succeeds, getUsage is called for the remaining calculation
      // checkAndResetPeriod query
      const checkResetBuilder2 = mocks.createQueryBuilder();
      checkResetBuilder2.single.mockResolvedValue({
        data: { id: 'usage-uuid-1', period_end: null, period_type: 'lifetime' },
        error: null,
      });

      // getUsage main query
      const getUsageBuilder2 = mocks.createQueryBuilder();
      getUsageBuilder2.single.mockResolvedValue({
        data: makeUsageTracking({ current_usage: 1, usage_limit: 10 }),
        error: null,
      });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder2)
        .mockReturnValueOnce(getUsageBuilder2);

      const result = await service.incrementUsage(userId, featureKey, 1);

      expect(result.success).toBe(true);
      expect(result.current_usage).toBe(1);
      // RPC was called twice: once with empty result, once after init
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledTimes(2);
      expect(mocks.membershipService.getUserMembership).toHaveBeenCalledWith(userId);
    });

    it('should throw error after max retries to prevent infinite recursion', async () => {
      // Both RPC calls return empty data
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: [], error: null });

      // getUserMembership for initialization attempt
      mocks.membershipService.getUserMembership.mockResolvedValue({
        tier_id: 'tier-uuid-123',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feature-uuid-limit', value: 10 }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit', feature_type: 'limit' }),
      ]);

      // initializeUsage upsert
      mocks.supabaseAdmin.from.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      await expect(service.incrementUsage(userId, featureKey, 1, 0)).rejects.toThrow(
        'Failed to increment usage after initialization'
      );
    });

    it('should throw on RPC error', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'database connection failed' },
      });

      await expect(service.incrementUsage(userId, featureKey)).rejects.toThrow(
        'Failed to increment usage: database connection failed'
      );
    });
  });

  // ------------------------------------------
  // canUseFeature
  // ------------------------------------------

  describe('canUseFeature', () => {
    /**
     * Helper: set up the getUsage flow mocks (checkAndResetPeriod + query + getAllFeatures).
     */
    function setupGetUsageMocks(usageRecord: ReturnType<typeof makeUsageTracking> | null) {
      // checkAndResetPeriod query
      const checkResetBuilder = mocks.createQueryBuilder();
      if (usageRecord) {
        checkResetBuilder.single.mockResolvedValue({
          data: {
            id: usageRecord.id,
            period_end: usageRecord.period_end,
            period_type: usageRecord.period_type,
          },
          error: null,
        });
      } else {
        checkResetBuilder.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'not found' },
        });
      }

      // getUsage main query
      const mainBuilder = mocks.createQueryBuilder();
      if (usageRecord) {
        mainBuilder.single.mockResolvedValue({ data: usageRecord, error: null });
      } else {
        mainBuilder.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'not found' },
        });
      }

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder)
        .mockReturnValueOnce(mainBuilder);

      // getAllFeatures is called in getUsage when there's a record
      if (usageRecord) {
        mocks.membershipService.getAllFeatures.mockResolvedValue([
          makeFeature({ key: usageRecord.feature_key }),
        ]);
      }
    }

    it('should return true when under limit', async () => {
      const usageRecord = makeUsageTracking({ current_usage: 3, usage_limit: 10 });
      setupGetUsageMocks(usageRecord);

      const result = await service.canUseFeature(userId, featureKey);

      expect(result).toBe(true);
    });

    it('should return false when at or over limit', async () => {
      const usageRecord = makeUsageTracking({ current_usage: 10, usage_limit: 10 });
      setupGetUsageMocks(usageRecord);

      const result = await service.canUseFeature(userId, featureKey);

      expect(result).toBe(false);
    });

    it('should return true when limit is -1 (unlimited)', async () => {
      const usageRecord = makeUsageTracking({ current_usage: 999, usage_limit: -1 });
      setupGetUsageMocks(usageRecord);

      const result = await service.canUseFeature(userId, featureKey);

      expect(result).toBe(true);
    });

    it('should delegate to membershipService when no usage record exists', async () => {
      setupGetUsageMocks(null);
      mocks.membershipService.userHasFeature.mockResolvedValue(true);

      const result = await service.canUseFeature(userId, featureKey);

      expect(result).toBe(true);
      expect(mocks.membershipService.userHasFeature).toHaveBeenCalledWith(userId, featureKey);
    });
  });

  // ------------------------------------------
  // initializeUsage
  // ------------------------------------------

  describe('initializeUsage', () => {
    it('should upsert usage records for limit-type features', async () => {
      const limitFeature = makeFeature({
        id: 'feat-limit-1',
        key: 'example_limit',
        feature_type: 'limit',
      });
      const booleanFeature = makeFeature({
        id: 'feat-bool-1',
        key: 'example_boolean',
        feature_type: 'boolean',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-limit-1', value: 10 }),
        makeTierFeature({ feature_id: 'feat-bool-1', value: 'true' }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([limitFeature, booleanFeature]);

      // Only the limit feature should trigger an upsert
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce({ upsert: upsertMock });

      await service.initializeUsage(userId, 'tier-uuid-123');

      // Upsert should have been called once (only for limit feature, not boolean)
      expect(upsertMock).toHaveBeenCalledTimes(1);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          feature_key: 'example_limit',
          current_usage: 0,
          usage_limit: 10,
          period_type: 'monthly',
        }),
        { onConflict: 'user_id,feature_key' }
      );
    });

    it('should throw an error when upsert fails', async () => {
      const limitFeature = makeFeature({
        id: 'feat-limit-1',
        key: 'example_limit',
        feature_type: 'limit',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-limit-1', value: 5 }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([limitFeature]);

      const upsertMock = vi.fn().mockResolvedValue({
        error: { message: 'unique constraint violation' },
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce({ upsert: upsertMock });

      await expect(service.initializeUsage(userId, 'tier-uuid-123')).rejects.toThrow(
        'Failed to initialize usage for example_limit'
      );
    });
  });

  // ------------------------------------------
  // getUsage
  // ------------------------------------------

  describe('getUsage', () => {
    it('should return null when no record exists (PGRST116 error)', async () => {
      // checkAndResetPeriod: no record found
      const checkResetBuilder = mocks.createQueryBuilder();
      checkResetBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      // Main getUsage query: PGRST116
      const mainBuilder = mocks.createQueryBuilder();
      mainBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder)
        .mockReturnValueOnce(mainBuilder);

      const result = await service.getUsage(userId, featureKey);

      expect(result).toBeNull();
    });

    it('should return a FeatureUsage object when record exists', async () => {
      const usageRecord = makeUsageTracking({
        current_usage: 5,
        usage_limit: 20,
        period_type: 'monthly',
        period_end: null,
      });

      // checkAndResetPeriod
      const checkResetBuilder = mocks.createQueryBuilder();
      checkResetBuilder.single.mockResolvedValue({
        data: { id: usageRecord.id, period_end: null, period_type: 'lifetime' },
        error: null,
      });

      // Main query
      const mainBuilder = mocks.createQueryBuilder();
      mainBuilder.single.mockResolvedValue({ data: usageRecord, error: null });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder)
        .mockReturnValueOnce(mainBuilder);

      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit', name: 'Example Limit Feature' }),
      ]);

      const result = await service.getUsage(userId, featureKey);

      expect(result).not.toBeNull();
      expect(result!.feature_key).toBe('example_limit');
      expect(result!.feature_name).toBe('Example Limit Feature');
      expect(result!.current_usage).toBe(5);
      expect(result!.usage_limit).toBe(20);
      expect(result!.percentage_used).toBe(25);
      expect(result!.is_exceeded).toBe(false);
    });

    it('should throw on non-PGRST116 database errors', async () => {
      // checkAndResetPeriod: no record
      const checkResetBuilder = mocks.createQueryBuilder();
      checkResetBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      // Main query: unexpected error
      const mainBuilder = mocks.createQueryBuilder();
      mainBuilder.single.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder)
        .mockReturnValueOnce(mainBuilder);

      await expect(service.getUsage(userId, featureKey)).rejects.toThrow('relation does not exist');
    });
  });

  // ------------------------------------------
  // getAllUsage
  // ------------------------------------------

  describe('getAllUsage', () => {
    it('should return summary with feature usages', async () => {
      mocks.membershipService.getUserTierWithFeatures.mockResolvedValue({
        tier_name: 'premium',
        tier_display_name: 'Premium',
        membership_status: 'active',
        stripe_status: null,
        trial_ends_at: null,
        features: { example_limit: '10' },
      });

      const usageRecords = [
        makeUsageTracking({
          feature_key: 'example_limit',
          current_usage: 7,
          usage_limit: 10,
          period_type: 'monthly',
          period_end: '2026-04-01T00:00:00Z',
        }),
      ];

      // from('usage_tracking').select('*').eq('user_id', userId) returns array
      const listBuilder = mocks.createQueryBuilder();
      // The getAllUsage query does NOT call .single() -- the chain resolves via .then()
      // Supabase returns data after eq() without single(), so we use the builder's implicit resolve.
      // The pattern: from().select().eq() should resolve with { data, error }.
      // We make eq() resolve as the terminal:
      listBuilder.eq.mockResolvedValue({ data: usageRecords, error: null });

      mocks.supabaseAdmin.from.mockReturnValueOnce(listBuilder);

      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit', name: 'Example Limit Feature' }),
      ]);

      const result = await service.getAllUsage(userId);

      expect(result.user_id).toBe(userId);
      expect(result.tier_name).toBe('premium');
      expect(result.features).toHaveLength(1);
      expect(result.features[0]).toEqual(
        expect.objectContaining({
          feature_key: 'example_limit',
          feature_name: 'Example Limit Feature',
          current_usage: 7,
          usage_limit: 10,
          percentage_used: 70,
          period_type: 'monthly',
          is_exceeded: false,
        })
      );
    });

    it('should return unknown tier name when getUserTierWithFeatures returns null', async () => {
      mocks.membershipService.getUserTierWithFeatures.mockResolvedValue(null);

      const listBuilder = mocks.createQueryBuilder();
      listBuilder.eq.mockResolvedValue({ data: [], error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(listBuilder);

      mocks.membershipService.getAllFeatures.mockResolvedValue([]);

      const result = await service.getAllUsage(userId);

      expect(result.tier_name).toBe('unknown');
      expect(result.features).toHaveLength(0);
    });

    it('should throw when the usage query errors', async () => {
      mocks.membershipService.getUserTierWithFeatures.mockResolvedValue({
        tier_name: 'free',
        tier_display_name: 'Free',
        membership_status: 'active',
        stripe_status: null,
        trial_ends_at: null,
        features: {},
      });

      const listBuilder = mocks.createQueryBuilder();
      listBuilder.eq.mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(listBuilder);

      await expect(service.getAllUsage(userId)).rejects.toThrow('connection refused');
    });
  });

  // ------------------------------------------
  // updateLimitsForTier
  // ------------------------------------------

  describe('updateLimitsForTier', () => {
    it('should update usage_limit for limit-type features', async () => {
      const limitFeature = makeFeature({
        id: 'feat-limit-upd',
        key: 'example_limit',
        feature_type: 'limit',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-limit-upd', value: 50 }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([limitFeature]);

      // update().eq().eq() chain — the final .eq() is terminal and resolves
      const updateBuilder = mocks.createQueryBuilder();
      updateBuilder.eq.mockReturnValueOnce(updateBuilder); // first .eq('user_id', ...)
      updateBuilder.eq.mockResolvedValueOnce({ data: null, error: null }); // second .eq('feature_key', ...)
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder);

      await service.updateLimitsForTier(userId, 'tier-uuid-123');

      expect(updateBuilder.update).toHaveBeenCalledWith({ usage_limit: 50 });
    });

    it('should skip non-limit features', async () => {
      const boolFeature = makeFeature({
        id: 'feat-bool-skip',
        key: 'example_boolean',
        feature_type: 'boolean',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-bool-skip', value: 'true' }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([boolFeature]);

      await service.updateLimitsForTier(userId, 'tier-uuid-123');

      // from() should not have been called for update because boolean feature is skipped
      expect(mocks.supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it('should call initializeUsage on update error (fallback)', async () => {
      const limitFeature = makeFeature({
        id: 'feat-limit-err',
        key: 'example_limit',
        feature_type: 'limit',
      });

      // First call: getTierFeatures/getAllFeatures for updateLimitsForTier
      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-limit-err', value: 25 }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([limitFeature]);

      // The update call fails
      const updateBuilder = mocks.createQueryBuilder();
      updateBuilder.eq.mockReturnValueOnce(updateBuilder);
      updateBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: { message: 'row not found' },
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder);

      // initializeUsage will be called as fallback — it calls getTierFeatures, getAllFeatures, upsert
      // getTierFeatures and getAllFeatures are already mocked above and will return same values
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce({ upsert: upsertMock });

      await service.updateLimitsForTier(userId, 'tier-uuid-123');

      // initializeUsage should have been triggered
      expect(upsertMock).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // resetPeriodicUsage
  // ------------------------------------------

  describe('resetPeriodicUsage', () => {
    it('should reset expired daily/monthly records and return count', async () => {
      const expiredRecords = [
        { id: 'usage-1', feature_key: 'example_limit', period_type: 'monthly' },
        { id: 'usage-2', feature_key: 'daily_feature', period_type: 'daily' },
      ];

      // Select query: from().select().lt().in() — in() is terminal
      const selectBuilder = mocks.createQueryBuilder();
      selectBuilder.in.mockResolvedValue({ data: expiredRecords, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(selectBuilder);

      // Two update calls — one per record, each with from().update().eq()
      const updateBuilder1 = mocks.createQueryBuilder();
      updateBuilder1.eq.mockResolvedValue({ data: null, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder1);

      const updateBuilder2 = mocks.createQueryBuilder();
      updateBuilder2.eq.mockResolvedValue({ data: null, error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(updateBuilder2);

      const result = await service.resetPeriodicUsage();

      expect(result).toBe(2);
      expect(updateBuilder1.update).toHaveBeenCalledWith(
        expect.objectContaining({ current_usage: 0 })
      );
      expect(updateBuilder2.update).toHaveBeenCalledWith(
        expect.objectContaining({ current_usage: 0 })
      );
    });

    it('should return 0 when no records are expired', async () => {
      const selectBuilder = mocks.createQueryBuilder();
      selectBuilder.in.mockResolvedValue({ data: [], error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce(selectBuilder);

      const result = await service.resetPeriodicUsage();

      expect(result).toBe(0);
    });

    it('should throw on select error', async () => {
      const selectBuilder = mocks.createQueryBuilder();
      selectBuilder.in.mockResolvedValue({
        data: null,
        error: { message: 'select failed' },
      });
      mocks.supabaseAdmin.from.mockReturnValueOnce(selectBuilder);

      await expect(service.resetPeriodicUsage()).rejects.toThrow('select failed');
    });
  });

  // ------------------------------------------
  // checkAndResetPeriod (via getUsage)
  // ------------------------------------------

  describe('checkAndResetPeriod (via getUsage)', () => {
    it('should reset usage when period has expired', async () => {
      const pastDate = new Date(Date.now() - 86400 * 1000).toISOString(); // yesterday

      // checkAndResetPeriod: finds a record with expired period_end
      const checkResetBuilder = mocks.createQueryBuilder();
      checkResetBuilder.single.mockResolvedValue({
        data: { id: 'usage-expired', period_end: pastDate, period_type: 'monthly' },
        error: null,
      });

      // checkAndResetPeriod issues an update to reset: from().update().eq()
      const resetUpdateBuilder = mocks.createQueryBuilder();
      resetUpdateBuilder.eq.mockResolvedValue({ data: null, error: null });

      // Main getUsage query after reset
      const mainBuilder = mocks.createQueryBuilder();
      const usageRecord = makeUsageTracking({
        current_usage: 0,
        usage_limit: 10,
        period_type: 'monthly',
      });
      mainBuilder.single.mockResolvedValue({ data: usageRecord, error: null });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder) // checkAndResetPeriod select
        .mockReturnValueOnce(resetUpdateBuilder) // checkAndResetPeriod update
        .mockReturnValueOnce(mainBuilder); // getUsage main query

      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit' }),
      ]);

      const result = await service.getUsage(userId, featureKey);

      expect(result).not.toBeNull();
      expect(resetUpdateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ current_usage: 0 })
      );
    });

    it('should not reset when period_type is lifetime', async () => {
      // checkAndResetPeriod: record with lifetime period — should skip reset
      const checkResetBuilder = mocks.createQueryBuilder();
      checkResetBuilder.single.mockResolvedValue({
        data: { id: 'usage-lifetime', period_end: null, period_type: 'lifetime' },
        error: null,
      });

      // Main getUsage query (no reset update in between)
      const mainBuilder = mocks.createQueryBuilder();
      const usageRecord = makeUsageTracking({
        current_usage: 5,
        usage_limit: 10,
        period_type: 'lifetime',
        period_end: null,
      });
      mainBuilder.single.mockResolvedValue({ data: usageRecord, error: null });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder)
        .mockReturnValueOnce(mainBuilder);

      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit' }),
      ]);

      const result = await service.getUsage(userId, featureKey);

      expect(result).not.toBeNull();
      expect(result!.current_usage).toBe(5);
      // Only 2 from() calls: checkAndResetPeriod select + getUsage main query
      // No update call in between
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledTimes(2);
    });

    it('should not reset when period_end is null', async () => {
      // checkAndResetPeriod: record with null period_end — should skip reset
      const checkResetBuilder = mocks.createQueryBuilder();
      checkResetBuilder.single.mockResolvedValue({
        data: { id: 'usage-no-end', period_end: null, period_type: 'monthly' },
        error: null,
      });

      // Main getUsage query
      const mainBuilder = mocks.createQueryBuilder();
      const usageRecord = makeUsageTracking({
        current_usage: 3,
        usage_limit: 10,
        period_type: 'monthly',
        period_end: null,
      });
      mainBuilder.single.mockResolvedValue({ data: usageRecord, error: null });

      mocks.supabaseAdmin.from
        .mockReturnValueOnce(checkResetBuilder)
        .mockReturnValueOnce(mainBuilder);

      mocks.membershipService.getAllFeatures.mockResolvedValue([
        makeFeature({ key: 'example_limit' }),
      ]);

      const result = await service.getUsage(userId, featureKey);

      expect(result).not.toBeNull();
      expect(result!.current_usage).toBe(3);
      // Only 2 from() calls — no update
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledTimes(2);
    });
  });

  // ------------------------------------------
  // parseLimit (via initializeUsage)
  // ------------------------------------------

  describe('parseLimit (via initializeUsage)', () => {
    it('should parse string numbers', async () => {
      const limitFeature = makeFeature({
        id: 'feat-parse-str',
        key: 'example_limit',
        feature_type: 'limit',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-parse-str', value: '42' }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([limitFeature]);

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce({ upsert: upsertMock });

      await service.initializeUsage(userId, 'tier-uuid-123');

      expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ usage_limit: 42 }), {
        onConflict: 'user_id,feature_key',
      });
    });

    it('should handle -1 (unlimited)', async () => {
      const limitFeature = makeFeature({
        id: 'feat-parse-neg',
        key: 'example_limit',
        feature_type: 'limit',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-parse-neg', value: -1 }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([limitFeature]);

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce({ upsert: upsertMock });

      await service.initializeUsage(userId, 'tier-uuid-123');

      expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ usage_limit: -1 }), {
        onConflict: 'user_id,feature_key',
      });
    });

    it('should default non-numeric strings to 0', async () => {
      const limitFeature = makeFeature({
        id: 'feat-parse-nan',
        key: 'example_limit',
        feature_type: 'limit',
      });

      mocks.membershipService.getTierFeatures.mockResolvedValue([
        makeTierFeature({ feature_id: 'feat-parse-nan', value: 'not_a_number' }),
      ]);
      mocks.membershipService.getAllFeatures.mockResolvedValue([limitFeature]);

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mocks.supabaseAdmin.from.mockReturnValueOnce({ upsert: upsertMock });

      await service.initializeUsage(userId, 'tier-uuid-123');

      expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ usage_limit: 0 }), {
        onConflict: 'user_id,feature_key',
      });
    });
  });
});
