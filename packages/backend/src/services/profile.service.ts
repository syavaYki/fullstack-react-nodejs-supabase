import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import { UserProfile, UpdateProfileInput } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

export class ProfileService {
  /**
   * Get user profile by ID
   */
  async getProfile(userId: string, accessToken?: string): Promise<UserProfile> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Profile not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as UserProfile;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    accessToken?: string
  ): Promise<UserProfile> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('user_profiles')
      .update(input)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as UserProfile;
  }

  /**
   * Delete user profile and account
   */
  async deleteProfile(userId: string): Promise<void> {
    // Delete user from auth (this will cascade to profile due to ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      throw new ApiError(500, error.message);
    }
  }

  /**
   * Get user's Stripe customer ID
   */
  async getStripeCustomerId(userId: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new ApiError(500, error.message);
    }

    return data?.stripe_customer_id || null;
  }

  /**
   * Set user's Stripe customer ID
   */
  async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', userId);

    if (error) {
      throw new ApiError(500, error.message);
    }
  }
}

export const profileService = new ProfileService();
