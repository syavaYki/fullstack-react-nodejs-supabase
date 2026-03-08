export interface MembershipTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  stripe_product_id: string | null;
  trial_days: number;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  tier_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  started_at: string;
  cancelled_at: string | null;
  cancel_at_period_end: boolean;
  billing_cycle: 'monthly' | 'yearly' | null;
  has_used_trial: boolean;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_current_period_end: string | null;
  last_synced_at: string | null;
  sync_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTierWithFeatures {
  tier_name: string;
  tier_display_name: string;
  membership_status: string;
  stripe_status: string | null;
  trial_ends_at: string | null;
  features: Record<string, string>;
}

export interface TrialStatus {
  is_on_trial: boolean;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  days_remaining: number;
  has_used_trial: boolean;
  can_start_trial: boolean;
}
