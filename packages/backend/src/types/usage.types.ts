export type PeriodType = 'daily' | 'monthly' | 'lifetime' | 'none';

export interface UsageTracking {
  id: string;
  user_id: string;
  feature_key: string;
  current_usage: number;
  usage_limit: number;
  period_start: string;
  period_end: string | null;
  period_type: PeriodType;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureUsage {
  feature_key: string;
  feature_name: string;
  current_usage: number;
  usage_limit: number;
  percentage_used: number | null;
  period_type: PeriodType;
  period_resets_at: string | null;
  is_exceeded: boolean;
}

/** Result from atomic usage increment operation */
export interface UsageResult {
  success: boolean;
  current_usage: number;
  usage_limit: number;
  remaining: number;
  is_exceeded: boolean;
}

/** Summary of all feature usage for a user */
export interface UsageSummary {
  user_id: string;
  tier_name: string;
  features: FeatureUsage[];
}
