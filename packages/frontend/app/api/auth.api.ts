/**
 * Auth API
 * Backend auth-related endpoints
 * Note: Sign in/up/out use Supabase client directly
 * These are for additional auth features
 */

import { apiClient } from './client';
import type { UserProfile } from '../types';

/**
 * Get current user info from backend
 */
export async function getMe() {
  return apiClient.get<{
    user: {
      id: string;
      email: string;
    };
    profile: UserProfile | null;
    isAdmin: boolean;
    adminRole?: string;
  }>('/api/auth/me');
}

/**
 * Request password reset (via backend for additional logic)
 */
export async function forgotPassword(email: string) {
  return apiClient.post<{ message: string }>('/api/auth/forgot-password', {
    email,
  });
}

/**
 * Reset password with token
 */
export async function resetPassword(password: string, token: string) {
  return apiClient.post<{ message: string }>('/api/auth/reset-password', {
    password,
    token,
  });
}
