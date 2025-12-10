/**
 * Frontend Types
 * Duplicated from backend/src/types/index.ts
 * Keep in sync with backend types when making changes
 */

// Database types
export type MembershipStatus = 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due';

export type BillingCycle = 'monthly' | 'yearly';
export type FeatureType = 'boolean' | 'limit' | 'enum';
export type PeriodType = 'daily' | 'monthly' | 'lifetime' | 'none';
export type AdminRole = 'admin' | 'super_admin';

// User Profile
export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  company: string | null;
  bio: string | null;
  website: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

// Membership Tier
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
  updated_at: string;
}

// Membership
export interface Membership {
  id: string;
  user_id: string;
  tier_id: string;
  status: MembershipStatus;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  cancel_at_period_end: boolean;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  has_used_trial: boolean;
  billing_cycle: BillingCycle | null;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_latest_invoice_id: string | null;
  stripe_latest_invoice_status: string | null;
  last_payment_at: string | null;
  last_payment_amount: number | null;
  last_payment_currency: string;
  next_billing_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Feature
export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  feature_type: FeatureType;
  default_value: unknown;
  is_active: boolean;
  created_at: string;
}

// Tier Feature
export interface TierFeature {
  id: string;
  tier_id: string;
  feature_id: string;
  value: unknown;
  created_at: string;
}

export interface TierFeatureWithDetails extends TierFeature {
  feature?: Feature;
}

// Payment History
export interface PaymentHistory {
  id: string;
  user_id: string;
  membership_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  stripe_subscription_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
  invoice_url: string | null;
  receipt_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: Array<{ message: string; path?: string[] }>;
}

// Auth types
export interface RegisterInput {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Profile update input
export interface UpdateProfileInput {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  company?: string | null;
  bio?: string | null;
  website?: string | null;
}

// Billing types
export interface CreateCheckoutInput {
  tier_id: string;
  billing_cycle: BillingCycle;
  success_url?: string;
  cancel_url?: string;
}

// User tier with features
export interface UserTierWithFeatures {
  tier_name: string;
  tier_display_name: string;
  membership_status: MembershipStatus;
  features: Record<string, unknown>;
}

// Trial types
export interface TrialStatus {
  is_on_trial: boolean;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  days_remaining: number;
  has_used_trial: boolean;
  can_start_trial: boolean;
}

export interface ConvertTrialInput {
  tier_id: string;
  billing_cycle: BillingCycle;
}

// Usage Tracking
export interface UsageTracking {
  id: string;
  user_id: string;
  feature_key: string;
  current_usage: number;
  usage_limit: number;
  period_start: string;
  period_end: string | null;
  period_type: PeriodType;
  last_used_at: string | null;
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

export interface UsageResult {
  success: boolean;
  current_usage: number;
  usage_limit: number;
  remaining: number;
  is_exceeded: boolean;
}

export interface UsageSummary {
  user_id: string;
  tier_name: string;
  features: FeatureUsage[];
}

// Admin types
export interface AdminUser {
  id: string;
  user_id: string;
  role: AdminRole;
  created_at: string;
  created_by: string | null;
}

export interface CreateTierInput {
  name: string;
  display_name: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;
  stripe_product_id?: string;
  trial_days?: number;
  sort_order?: number;
}

export interface UpdateTierInput {
  name?: string;
  display_name?: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;
  stripe_product_id?: string;
  trial_days?: number;
  sort_order?: number;
  is_active?: boolean;
  is_default?: boolean;
}

export interface CreateFeatureInput {
  key: string;
  name: string;
  description?: string;
  feature_type: FeatureType;
  default_value?: unknown;
}

export interface UpdateFeatureInput {
  key?: string;
  name?: string;
  description?: string;
  feature_type?: FeatureType;
  default_value?: unknown;
  is_active?: boolean;
}

export interface SetTierFeatureInput {
  feature_id: string;
  value: unknown;
}

// Contact types
export interface ContactSubmissionInput {
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
}
