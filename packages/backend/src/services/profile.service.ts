import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import { UserProfile, UpdateProfileInput } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

class ProfileService {
  /** Get user profile (uses admin client for service-level access) */
  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new ApiError(404, 'Profile not found');
    }

    return data as UserProfile;
  }

  /**
   * Update user profile.
   * Uses the user's own token for RLS-aware updates.
   */
  async updateProfile(
    userId: string,
    accessToken: string,
    input: UpdateProfileInput
  ): Promise<UserProfile> {
    const client = createSupabaseClientWithAuth(accessToken);

    const { data, error } = await client
      .from('user_profiles')
      .update(input)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('DB', 'Profile update failed', { error: error.message, userId });
      throw new ApiError(400, 'Failed to update profile');
    }

    return data as UserProfile;
  }

  /** Delete user profile (admin operation) */
  async deleteProfile(userId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('user_profiles').delete().eq('id', userId);

    if (error) {
      logger.error('DB', 'Profile delete failed', { error: error.message, userId });
      throw new ApiError(500, 'Failed to delete profile');
    }
  }

  /** Get Stripe customer ID for a user */
  async getStripeCustomerId(userId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    return data?.stripe_customer_id ?? null;
  }

  /** Set Stripe customer ID for a user */
  async setStripeCustomerId(userId: string, customerId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);

    if (error) {
      logger.error('DB', 'Failed to set stripe_customer_id', { error: error.message, userId });
    }
  }
}

export const profileService = new ProfileService();
