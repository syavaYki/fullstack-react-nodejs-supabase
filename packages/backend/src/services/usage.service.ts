import { supabaseAdmin } from '../config/supabase.js';
import {
  UsageTracking,
  FeatureUsage,
  UsageResult,
  UsageSummary,
  PeriodType,
} from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { membershipService } from './membership.service.js';

/**
 * Mapping of feature keys to their reset period types.
 * - 'daily': Resets at end of each day (UTC)
 * - 'monthly': Resets at end of each month (UTC)
 * - 'lifetime': Never resets, cumulative usage
 * - 'none': No usage tracking (boolean features)
 */
const FEATURE_PERIOD_MAP: Record<string, PeriodType> = {
  team_collaboration: 'lifetime',
  api_integrations: 'lifetime',
  cloud_storage: 'lifetime',
  ai_assistant: 'daily',
  analytics_dashboard: 'none',
};

/**
 * Service for tracking feature usage and enforcing limits.
 * Manages usage counters, period resets, and limit validation for tiered features.
 * Uses atomic database operations to prevent race conditions.
 */
export class UsageService {
  /**
   * Initializes usage tracking records for a user based on their tier's features.
   * Creates or resets usage_tracking records for all limit-type features.
   * Called when a user changes tiers or on first access.
   *
   * @param userId - The Supabase user ID
   * @param tierId - The UUID of the user's current tier
   * @throws {ApiError} 500 if database operation fails
   */
  async initializeUsage(userId: string, tierId: string): Promise<void> {
    // Get tier features
    const tierFeatures = await membershipService.getTierFeatures(tierId);

    // Get all features
    const features = await membershipService.getAllFeatures();

    for (const tierFeature of tierFeatures) {
      const feature = features.find((f) => f.id === tierFeature.feature_id);
      if (!feature || feature.feature_type !== 'limit') {
        continue;
      }

      const periodType = FEATURE_PERIOD_MAP[feature.key] || 'lifetime';
      const limit = this.parseLimit(tierFeature.value);

      // Calculate period end based on period type
      let periodEnd: Date | null = null;
      if (periodType === 'daily') {
        periodEnd = this.getEndOfDay();
      } else if (periodType === 'monthly') {
        periodEnd = this.getEndOfMonth();
      }

      // Upsert usage tracking record
      const { error } = await supabaseAdmin.from('usage_tracking').upsert(
        {
          user_id: userId,
          feature_key: feature.key,
          current_usage: 0, // Reset on tier change? Or keep existing?
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
   * Preserves current usage counts but updates the limits to match the new tier.
   * Falls back to full initialization if records don't exist.
   *
   * @param userId - The Supabase user ID
   * @param tierId - The UUID of the new tier
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

      // Update only the limit, keep current usage
      const { error } = await supabaseAdmin
        .from('usage_tracking')
        .update({ usage_limit: limit })
        .eq('user_id', userId)
        .eq('feature_key', feature.key);

      if (error) {
        // If record doesn't exist, create it
        await this.initializeUsage(userId, tierId);
        return;
      }
    }
  }

  /**
   * Checks if a user can use a feature based on their current usage.
   * Returns true if usage is below limit or if feature is unlimited (-1).
   *
   * @param userId - The Supabase user ID
   * @param featureKey - The feature key to check
   * @returns True if user can use the feature, false if limit exceeded
   */
  async canUseFeature(userId: string, featureKey: string): Promise<boolean> {
    const usage = await this.getUsage(userId, featureKey);

    if (!usage) {
      // No tracking record - check if user has the feature at all
      return membershipService.userHasFeature(userId, featureKey);
    }

    // -1 means unlimited
    if (usage.usage_limit === -1) {
      return true;
    }

    return usage.current_usage < usage.usage_limit;
  }

  /**
   * Increment usage for a feature using atomic database operation.
   * This prevents race conditions when multiple concurrent requests
   * try to increment the same feature's usage.
   */
  async incrementUsage(
    userId: string,
    featureKey: string,
    amount: number = 1
  ): Promise<UsageResult> {
    // Use atomic RPC function that handles period reset and increment in one transaction
    const { data, error } = await supabaseAdmin.rpc('check_reset_and_increment_usage', {
      p_user_id: userId,
      p_feature_key: featureKey,
      p_amount: amount,
    });

    if (error) {
      throw new ApiError(500, `Failed to increment usage: ${error.message}`);
    }

    // Handle case where no usage record exists
    if (!data || data.length === 0 || !data[0].success) {
      // No record exists - need to initialize
      const membership = await membershipService.getUserMembership(userId);
      await this.initializeUsage(userId, membership.tier_id);

      // Try again after initialization
      return this.incrementUsage(userId, featureKey, amount);
    }

    const result = data[0];

    return {
      success: true,
      current_usage: result.current_usage,
      usage_limit: result.usage_limit,
      remaining: result.remaining,
      is_exceeded: result.is_exceeded,
    };
  }

  /**
   * Retrieves current usage statistics for a specific feature.
   * Automatically resets the period if it has ended before returning data.
   *
   * @param userId - The Supabase user ID
   * @param featureKey - The feature key to get usage for
   * @returns Feature usage details including current/limit/percentage, or null if not tracked
   * @throws {ApiError} 500 if database query fails
   */
  async getUsage(userId: string, featureKey: string): Promise<FeatureUsage | null> {
    // Check and reset if period has ended
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

    // Get feature name
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
   * Retrieves usage statistics for all tracked features for a user.
   * Returns a summary including the user's tier name and all feature usage.
   *
   * @param userId - The Supabase user ID
   * @returns Usage summary with tier name and array of feature usage
   * @throws {ApiError} 500 if database query fails
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
   * Intended to be called by a cron job (e.g., daily at midnight UTC).
   * Only affects records with 'daily' or 'monthly' period types.
   *
   * @returns Number of records that were reset
   * @throws {ApiError} 500 if database operation fails
   */
  async resetPeriodicUsage(): Promise<number> {
    const now = new Date();

    // Find records where period_end has passed
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
      let newPeriodEnd: Date;
      if (record.period_type === 'daily') {
        newPeriodEnd = this.getEndOfDay();
      } else {
        newPeriodEnd = this.getEndOfMonth();
      }

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
   * Called before returning usage data to ensure accurate counts.
   * Skips reset for 'lifetime' and 'none' period types.
   *
   * @param userId - The Supabase user ID
   * @param featureKey - The feature key to check
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
      let newPeriodEnd: Date;
      if (data.period_type === 'daily') {
        newPeriodEnd = this.getEndOfDay();
      } else {
        newPeriodEnd = this.getEndOfMonth();
      }

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
   * Handles both numeric and string representations.
   *
   * @param value - The value from JSONB (number or string)
   * @returns Parsed number, or 0 if unparseable
   */
  private parseLimit(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Calculates the end of the current day in UTC.
   *
   * @returns Date object set to 23:59:59.999 UTC of today
   */
  private getEndOfDay(): Date {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return endOfDay;
  }

  /**
   * Calculates the end of the current month in UTC.
   *
   * @returns Date object set to 23:59:59.999 UTC of the last day of the month
   */
  private getEndOfMonth(): Date {
    const now = new Date();
    const endOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999);
    return endOfMonth;
  }
}

export const usageService = new UsageService();
