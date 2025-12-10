import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import { UserProfile, UpdateProfileInput } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * Service for managing user profiles.
 * Handles CRUD operations on the user_profiles table and Stripe customer ID management.
 */
export class ProfileService {
  /**
   * Retrieves a user's profile by their ID.
   * Uses the user's access token for RLS when available, otherwise uses admin client.
   *
   * @param userId - The Supabase user ID
   * @param accessToken - Optional access token for RLS-compliant queries
   * @returns The user's profile data
   * @throws {ApiError} 404 if profile not found
   * @throws {ApiError} 500 if database query fails
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
   * Updates a user's profile with the provided data.
   * Only updates fields that are included in the input object.
   *
   * @param userId - The Supabase user ID
   * @param input - Partial profile data to update (first_name, last_name, avatar_url, etc.)
   * @param accessToken - Optional access token for RLS-compliant queries
   * @returns The updated user profile
   * @throws {ApiError} 500 if database update fails
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
   * Deletes a user's account and all associated data.
   * Deletes the Supabase Auth user, which cascades to the profile
   * due to ON DELETE CASCADE constraint.
   *
   * @param userId - The Supabase user ID to delete
   * @throws {ApiError} 500 if deletion fails
   */
  async deleteProfile(userId: string): Promise<void> {
    // Delete user from auth (this will cascade to profile due to ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      throw new ApiError(500, error.message);
    }
  }

  /**
   * Retrieves a user's Stripe customer ID from their profile.
   * Returns null if the user doesn't have a Stripe customer ID yet.
   *
   * @param userId - The Supabase user ID
   * @returns The Stripe customer ID or null if not set
   * @throws {ApiError} 500 if database query fails
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
   * Sets or updates a user's Stripe customer ID in their profile.
   * Called after creating a Stripe customer for the user.
   *
   * @param userId - The Supabase user ID
   * @param stripeCustomerId - The Stripe customer ID (cus_xxx)
   * @throws {ApiError} 500 if database update fails
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
