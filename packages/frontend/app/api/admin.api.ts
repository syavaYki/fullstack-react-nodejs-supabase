/**
 * Admin API
 * Admin-only endpoints for managing tiers, features, and users
 */

import { apiClient } from './client';
import type {
  MembershipTier,
  Feature,
  CreateTierInput,
  UpdateTierInput,
  CreateFeatureInput,
  UpdateFeatureInput,
  SetTierFeatureInput,
  AdminUser,
  UserProfile,
  Membership,
} from '../types';

// ============================================
// TIERS
// ============================================

/**
 * Get all tiers (admin view - includes inactive)
 */
export async function getAdminTiers() {
  return apiClient.get<MembershipTier[]>('/api/admin/tiers');
}

/**
 * Create a new tier
 */
export async function createTier(input: CreateTierInput) {
  return apiClient.post<MembershipTier>('/api/admin/tiers', input);
}

/**
 * Update a tier
 */
export async function updateTier(tierId: string, input: UpdateTierInput) {
  return apiClient.put<MembershipTier>(`/api/admin/tiers/${tierId}`, input);
}

/**
 * Delete a tier
 */
export async function deleteTier(tierId: string) {
  return apiClient.delete<{ message: string }>(`/api/admin/tiers/${tierId}`);
}

/**
 * Set features for a tier
 */
export async function setTierFeatures(tierId: string, features: SetTierFeatureInput[]) {
  return apiClient.post<{ message: string }>(`/api/admin/tiers/${tierId}/features`, { features });
}

// ============================================
// FEATURES
// ============================================

/**
 * Get all features
 */
export async function getAdminFeatures() {
  return apiClient.get<Feature[]>('/api/admin/features');
}

/**
 * Create a new feature
 */
export async function createFeature(input: CreateFeatureInput) {
  return apiClient.post<Feature>('/api/admin/features', input);
}

/**
 * Update a feature
 */
export async function updateFeature(featureId: string, input: UpdateFeatureInput) {
  return apiClient.put<Feature>(`/api/admin/features/${featureId}`, input);
}

/**
 * Delete a feature
 */
export async function deleteFeature(featureId: string) {
  return apiClient.delete<{ message: string }>(`/api/admin/features/${featureId}`);
}

// ============================================
// USERS
// ============================================

/**
 * Get all users (paginated)
 */
export async function getAdminUsers(page = 1, limit = 20, search?: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.append('search', search);
  }
  return apiClient.get<{
    users: (UserProfile & { membership?: Membership })[];
    total: number;
    page: number;
    limit: number;
  }>(`/api/admin/users?${params.toString()}`);
}

/**
 * Get a specific user by ID
 */
export async function getAdminUser(userId: string) {
  return apiClient.get<UserProfile & { membership?: Membership }>(`/api/admin/users/${userId}`);
}

/**
 * Update a user's membership
 */
export async function updateUserMembership(userId: string, tierId: string, status?: string) {
  return apiClient.put<Membership>(`/api/admin/users/${userId}/membership`, {
    tier_id: tierId,
    status,
  });
}

// ============================================
// ADMIN USERS
// ============================================

/**
 * Get all admin users
 */
export async function getAdminAdmins() {
  return apiClient.get<(AdminUser & { profile?: UserProfile })[]>('/api/admin/admins');
}

/**
 * Grant admin role to a user
 */
export async function grantAdmin(userId: string, role: 'admin' | 'super_admin') {
  return apiClient.post<AdminUser>('/api/admin/admins', { user_id: userId, role });
}

/**
 * Revoke admin role from a user
 */
export async function revokeAdmin(adminId: string) {
  return apiClient.delete<{ message: string }>(`/api/admin/admins/${adminId}`);
}
