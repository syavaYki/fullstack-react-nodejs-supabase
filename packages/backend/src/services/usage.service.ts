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

// Feature to period type mapping
const FEATURE_PERIOD_MAP: Record<string, PeriodType> = {
  team_collaboration: 'lifetime',
  api_integrations: 'lifetime',
  cloud_storage: 'lifetime',
  ai_assistant: 'daily', // If this becomes a limit-based feature
  analytics_dashboard: 'none', // Boolean access only
};

export class UsageService {
  /**
   * Initialize usage tracking for a user based on their tier
   * Called when user changes tiers
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
   * Update limits when tier changes (keeps current usage, updates limits)
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
   * Check if user can use a feature (not exceeded limit)
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
   * Increment usage for a feature
   */
  async incrementUsage(userId: string, featureKey: string, amount: number = 1): Promise<UsageResult> {
    // First check and reset if period has ended
    await this.checkAndResetPeriod(userId, featureKey);

    // Get current usage
    const { data: current, error: selectError } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        // No record exists - need to initialize
        const membership = await membershipService.getUserMembership(userId);
        await this.initializeUsage(userId, membership.tier_id);

        // Try again
        return this.incrementUsage(userId, featureKey, amount);
      }
      throw new ApiError(500, selectError.message);
    }

    const usageTracking = current as UsageTracking;
    const newUsage = usageTracking.current_usage + amount;
    const isUnlimited = usageTracking.usage_limit === -1;
    const isExceeded = !isUnlimited && newUsage > usageTracking.usage_limit;

    // Update usage
    const { error: updateError } = await supabaseAdmin
      .from('usage_tracking')
      .update({
        current_usage: newUsage,
        last_used_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('feature_key', featureKey);

    if (updateError) {
      throw new ApiError(500, updateError.message);
    }

    return {
      success: true,
      current_usage: newUsage,
      usage_limit: usageTracking.usage_limit,
      remaining: isUnlimited ? -1 : Math.max(0, usageTracking.usage_limit - newUsage),
      is_exceeded: isExceeded,
    };
  }

  /**
   * Get current usage for a specific feature
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
   * Get all usage for a user
   */
  async getAllUsage(userId: string): Promise<UsageSummary> {
    const membership = await membershipService.getUserMembership(userId);
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
   * Reset periodic usage (for cron job)
   * Returns number of records reset
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
   * Check and reset period if it has ended for a specific user/feature
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
   * Parse limit value from JSONB
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
   * Get end of current day (UTC)
   */
  private getEndOfDay(): Date {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return endOfDay;
  }

  /**
   * Get end of current month (UTC)
   */
  private getEndOfMonth(): Date {
    const now = new Date();
    const endOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999);
    return endOfMonth;
  }
}

export const usageService = new UsageService();
