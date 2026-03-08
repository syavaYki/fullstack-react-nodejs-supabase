import { supabaseAdmin } from '../config/supabase.js';
import { UsageTracking, FeatureUsage, UsageResult, UsageSummary } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { membershipService } from './membership.service.js';
import { FEATURE_PERIOD_MAP } from '../constants/index.js';
import { getEndOfDay, getEndOfMonth } from '../utils/index.js';

/**
 * Service for tracking feature usage and enforcing limits.
 * Uses atomic database operations to prevent race conditions.
 */
export class UsageService {
  /**
   * Initializes usage tracking records for a user based on their tier's features.
   */
  async initializeUsage(userId: string, tierId: string): Promise<void> {
    const tierFeatures = await membershipService.getTierFeatures(tierId);
    const features = await membershipService.getAllFeatures();

    for (const tierFeature of tierFeatures) {
      const feature = features.find((f) => f.id === tierFeature.feature_id);
      if (!feature || feature.feature_type !== 'limit') {
        continue;
      }

      const periodType = FEATURE_PERIOD_MAP[feature.key] || 'lifetime';
      const limit = this.parseLimit(tierFeature.value);

      let periodEnd: Date | null = null;
      if (periodType === 'daily') {
        periodEnd = getEndOfDay();
      } else if (periodType === 'monthly') {
        periodEnd = getEndOfMonth();
      }

      const { error } = await supabaseAdmin.from('usage_tracking').upsert(
        {
          user_id: userId,
          feature_key: feature.key,
          current_usage: 0,
          usage_limit: limit,
          period_type: periodType,
          period_start: new Date().toISOString(),
          period_end: periodEnd?.toISOString() || null,
        },
        {
          onConflict: 'user_id,feature_key',
        }
      );

      if (error) {
        throw new ApiError(500, `Failed to initialize usage for ${feature.key}: ${error.message}`);
      }
    }
  }

  /**
   * Updates usage limits when a user changes tiers.
   */
  async updateLimitsForTier(userId: string, tierId: string): Promise<void> {
    const tierFeatures = await membershipService.getTierFeatures(tierId);
    const features = await membershipService.getAllFeatures();

    for (const tierFeature of tierFeatures) {
      const feature = features.find((f) => f.id === tierFeature.feature_id);
      if (!feature || feature.feature_type !== 'limit') {
        continue;
      }

      const limit = this.parseLimit(tierFeature.value);

      const { error } = await supabaseAdmin
        .from('usage_tracking')
        .update({ usage_limit: limit })
        .eq('user_id', userId)
        .eq('feature_key', feature.key);

      if (error) {
        await this.initializeUsage(userId, tierId);
        return;
      }
    }
  }

  /**
   * Checks if a user can use a feature based on their current usage.
   */
  async canUseFeature(userId: string, featureKey: string): Promise<boolean> {
    const usage = await this.getUsage(userId, featureKey);

    if (!usage) {
      return membershipService.userHasFeature(userId, featureKey);
    }

    if (usage.usage_limit === -1) {
      return true;
    }

    return usage.current_usage < usage.usage_limit;
  }

  /**
   * Increment usage using atomic database operation.
   * The DB function returns (new_usage, at_limit). We derive the rest.
   */
  async incrementUsage(
    userId: string,
    featureKey: string,
    amount: number = 1,
    _retryCount: number = 0
  ): Promise<UsageResult> {
    const MAX_RETRIES = 1;

    const { data, error } = await supabaseAdmin.rpc('check_reset_and_increment_usage', {
      p_user_id: userId,
      p_feature_key: featureKey,
    });

    if (error) {
      throw new ApiError(500, `Failed to increment usage: ${error.message}`);
    }

    if (!data || data.length === 0) {
      if (_retryCount >= MAX_RETRIES) {
        throw new ApiError(500, 'Failed to increment usage after initialization');
      }
      const membership = await membershipService.getUserMembership(userId);
      await this.initializeUsage(userId, membership.tier_id);
      return this.incrementUsage(userId, featureKey, amount, _retryCount + 1);
    }

    const result = data[0];
    const newUsage = result.new_usage ?? 0;
    const atLimit = result.at_limit ?? false;

    // Fetch the current limit to calculate remaining
    const usage = await this.getUsage(userId, featureKey);
    const usageLimit = usage?.usage_limit ?? 0;

    return {
      success: true,
      current_usage: newUsage,
      usage_limit: usageLimit,
      remaining: usageLimit === -1 ? -1 : Math.max(0, usageLimit - newUsage),
      is_exceeded: atLimit,
    };
  }

  /**
   * Retrieves current usage for a specific feature.
   */
  async getUsage(userId: string, featureKey: string): Promise<FeatureUsage | null> {
    await this.checkAndResetPeriod(userId, featureKey);

    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new ApiError(500, error.message);
    }

    const usageTracking = data as UsageTracking;
    const features = await membershipService.getAllFeatures();
    const feature = features.find((f) => f.key === featureKey);

    const isUnlimited = usageTracking.usage_limit === -1;
    const percentageUsed = isUnlimited
      ? null
      : Math.min(100, Math.round((usageTracking.current_usage / usageTracking.usage_limit) * 100));

    return {
      feature_key: usageTracking.feature_key,
      feature_name: feature?.name || featureKey,
      current_usage: usageTracking.current_usage,
      usage_limit: usageTracking.usage_limit,
      percentage_used: percentageUsed,
      period_type: usageTracking.period_type,
      period_resets_at: usageTracking.period_end,
      is_exceeded: !isUnlimited && usageTracking.current_usage >= usageTracking.usage_limit,
    };
  }

  /**
   * Retrieves usage for all tracked features for a user.
   */
  async getAllUsage(userId: string): Promise<UsageSummary> {
    const tierWithFeatures = await membershipService.getUserTierWithFeatures(userId);

    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    const features = await membershipService.getAllFeatures();
    const usageList = data as UsageTracking[];

    const featureUsages: FeatureUsage[] = usageList.map((usage) => {
      const feature = features.find((f) => f.key === usage.feature_key);
      const isUnlimited = usage.usage_limit === -1;
      const percentageUsed = isUnlimited
        ? null
        : Math.min(100, Math.round((usage.current_usage / usage.usage_limit) * 100));

      return {
        feature_key: usage.feature_key,
        feature_name: feature?.name || usage.feature_key,
        current_usage: usage.current_usage,
        usage_limit: usage.usage_limit,
        percentage_used: percentageUsed,
        period_type: usage.period_type,
        period_resets_at: usage.period_end,
        is_exceeded: !isUnlimited && usage.current_usage >= usage.usage_limit,
      };
    });

    return {
      user_id: userId,
      tier_name: tierWithFeatures?.tier_name || 'unknown',
      features: featureUsages,
    };
  }

  /**
   * Resets usage counters for all expired periods.
   */
  async resetPeriodicUsage(): Promise<number> {
    const now = new Date();

    const { data: expiredRecords, error: selectError } = await supabaseAdmin
      .from('usage_tracking')
      .select('id, feature_key, period_type')
      .lt('period_end', now.toISOString())
      .in('period_type', ['daily', 'monthly']);

    if (selectError) {
      throw new ApiError(500, selectError.message);
    }

    if (!expiredRecords || expiredRecords.length === 0) {
      return 0;
    }

    let resetCount = 0;

    for (const record of expiredRecords) {
      const newPeriodEnd = record.period_type === 'daily' ? getEndOfDay() : getEndOfMonth();

      const { error: updateError } = await supabaseAdmin
        .from('usage_tracking')
        .update({
          current_usage: 0,
          period_start: now.toISOString(),
          period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', record.id);

      if (!updateError) {
        resetCount++;
      }
    }

    return resetCount;
  }

  /**
   * Checks if a usage period has ended and resets if necessary.
   */
  private async checkAndResetPeriod(userId: string, featureKey: string): Promise<void> {
    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('id, period_end, period_type')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .single();

    if (error || !data) {
      return;
    }

    if (!data.period_end || data.period_type === 'lifetime' || data.period_type === 'none') {
      return;
    }

    const periodEnd = new Date(data.period_end);
    const now = new Date();

    if (now > periodEnd) {
      const newPeriodEnd = data.period_type === 'daily' ? getEndOfDay() : getEndOfMonth();

      await supabaseAdmin
        .from('usage_tracking')
        .update({
          current_usage: 0,
          period_start: now.toISOString(),
          period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', data.id);
    }
  }

  /**
   * Parses a limit value from JSONB storage into a number.
   */
  private parseLimit(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }
}

export const usageService = new UsageService();
