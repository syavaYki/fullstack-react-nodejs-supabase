/**
 * Membership API
 * Membership, tiers, features, trial, and usage endpoints
 */

import { apiClient } from './client';
import type {
  MembershipTier,
  Membership,
  UserTierWithFeatures,
  TrialStatus,
  UsageSummary,
  TierFeatureWithDetails,
} from '../types';

// ============================================
// PUBLIC ENDPOINTS (no authentication required)
// ============================================

/**
 * Tier with features included
 */
export type TierWithFeatures = MembershipTier & {
  features: TierFeatureWithDetails[];
};

/**
 * Get all tiers with their features (PUBLIC - no auth required)
 */
export async function getPublicTiersWithFeatures() {
  return apiClient.get<TierWithFeatures[]>('/api/membership/public/tiers-with-features');
}

// ============================================
// TIERS
// ============================================

/**
 * Get all available membership tiers
 */
export async function getTiers() {
  return apiClient.get<MembershipTier[]>('/api/membership/tiers');
}

/**
 * Get a specific tier by ID
 */
export async function getTier(tierId: string) {
  return apiClient.get<MembershipTier>(`/api/membership/tiers/${tierId}`);
}

// ============================================
// MEMBERSHIP
// ============================================

/**
 * Get current user's membership
 */
export async function getMembership() {
  return apiClient.get<Membership & { tier: MembershipTier }>('/api/membership');
}

/**
 * Get current user's tier with features
 */
export async function getFeatures() {
  return apiClient.get<UserTierWithFeatures>('/api/membership/features');
}

/**
 * Check if user has access to a specific feature
 */
export async function checkFeature(featureKey: string) {
  return apiClient.get<{
    has_access: boolean;
    feature_value: unknown;
    usage?: {
      current: number;
      limit: number;
      remaining: number;
    };
  }>(`/api/membership/check-feature/${featureKey}`);
}

// ============================================
// TRIAL
// ============================================

/**
 * Get current trial status
 */
export async function getTrialStatus() {
  return apiClient.get<TrialStatus>('/api/membership/trial/status');
}

/**
 * Start a free trial
 */
export async function startTrial() {
  return apiClient.post<{ membership: Membership; message: string }>('/api/membership/trial/start');
}

// ============================================
// USAGE
// ============================================

/**
 * Get current user's usage summary
 */
export async function getUsage() {
  return apiClient.get<UsageSummary>('/api/membership/usage');
}

/**
 * Increment usage for a specific feature
 */
export async function incrementUsage(featureKey: string, amount = 1) {
  return apiClient.post<{
    success: boolean;
    current_usage: number;
    usage_limit: number;
    remaining: number;
  }>(`/api/membership/usage/${featureKey}/increment`, { amount });
}

// ============================================
// TIER CHANGE (WITHOUT PAYMENT)
// ============================================

/**
 * Change tier directly without payment (for testing/development)
 */
export async function changeTier(tierId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
  return apiClient.post<Membership & { tier: MembershipTier }>('/api/membership/change-tier', {
    tier_id: tierId,
    billing_cycle: billingCycle,
  });
}
