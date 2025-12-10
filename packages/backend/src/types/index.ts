import { Request } from 'express';
import { User } from '@supabase/supabase-js';

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  user?: User;
  accessToken?: string;
}

// Database types
export type MembershipStatus = 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due';
export type BillingCycle = 'monthly' | 'yearly';
export type FeatureType = 'boolean' | 'limit' | 'enum';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null; // Computed column (first_name + last_name)
  avatar_url: string | null;
  phone: string | null;
  company: string | null;
  bio: string | null;
  website: string | null;
  stripe_customer_id: string | null; // Stripe customer ID moved here
  created_at: string;
  updated_at: string;
}

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
  // stripe_customer_id moved to user_profiles
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

// Keep alias for backwards compatibility
export type UserMembership = Membership;

// Separate Feature definition table
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

// Join table for tier features
export interface TierFeature {
  id: string;
  tier_id: string;
  feature_id: string;
  value: unknown;
  created_at: string;
}

// Extended tier feature with feature details (for joins)
export interface TierFeatureWithDetails extends TierFeature {
  feature?: Feature;
}

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

export interface StripeWebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
}

// Profile update input
// Note: full_name is computed, cannot be updated directly
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
  trial_ends_at: string | null;
  features: Record<string, unknown>;
}

// ============================================
// TRIAL MANAGEMENT TYPES
// ============================================

export interface TrialStatus {
  is_on_trial: boolean;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  days_remaining: number;
  has_used_trial: boolean;
  can_start_trial: boolean;
  is_expired?: boolean; // True if trial period has ended but status not yet updated
}

export interface ConvertTrialInput {
  tier_id: string;
  billing_cycle: BillingCycle;
}

// ============================================
// USAGE TRACKING TYPES
// ============================================

export type PeriodType = 'daily' | 'monthly' | 'lifetime' | 'none';

export interface UsageTracking {
  id: string;
  user_id: string;
  feature_key: string;
  current_usage: number;
  usage_limit: number; // -1 = unlimited
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
  usage_limit: number; // -1 = unlimited
  percentage_used: number | null; // 0-100, null if unlimited
  period_type: PeriodType;
  period_resets_at: string | null;
  is_exceeded: boolean;
}

export interface UsageResult {
  success: boolean;
  current_usage: number;
  usage_limit: number;
  remaining: number; // -1 if unlimited
  is_exceeded: boolean;
}

export interface UsageSummary {
  user_id: string;
  tier_name: string;
  features: FeatureUsage[];
}

// ============================================
// ADMIN TYPES
// ============================================

export type AdminRole = 'admin' | 'super_admin';

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

// Extend AuthenticatedRequest to include admin flag
export interface AdminRequest extends AuthenticatedRequest {
  isAdmin?: boolean;
  adminRole?: AdminRole;
}

// ============================================
// CONTACT SUBMISSION TYPES
// ============================================

export type ContactSubmissionStatus = 'new' | 'read' | 'replied' | 'archived';

export interface ContactSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
  ip_address: string | null;
  user_agent: string | null;
  status: ContactSubmissionStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateContactSubmissionInput {
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
}
