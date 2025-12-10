/**
 * Profile API
 * User profile management endpoints
 */

import { apiClient } from './client';
import type { UserProfile, UpdateProfileInput } from '../types';

/**
 * Get current user's profile
 */
export async function getProfile() {
  return apiClient.get<UserProfile>('/api/profile');
}

/**
 * Update current user's profile
 */
export async function updateProfile(data: UpdateProfileInput) {
  return apiClient.put<UserProfile>('/api/profile', data);
}

/**
 * Delete current user's profile and account
 */
export async function deleteProfile() {
  return apiClient.delete<{ message: string }>('/api/profile');
}
