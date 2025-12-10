import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import {
  MembershipTier,
  Membership,
  Feature,
  TierFeatureWithDetails,
  UserTierWithFeatures,
} from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * Service for managing membership tiers, user memberships, and feature access.
 * Handles tier queries, membership CRUD, and feature checks via database functions.
 */
export class MembershipService {
  /**
   * Retrieves all active membership tiers ordered by sort_order.
   * Used to display available plans to users.
   *
   * @param accessToken - Optional access token for RLS-compliant queries
   * @returns Array of active membership tiers
   * @throws {ApiError} 500 if database query fails
   */
  async getTiers(accessToken?: string): Promise<MembershipTier[]> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('membership_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as MembershipTier[];
  }

  /**
   * Retrieves a specific membership tier by its UUID.
   *
   * @param tierId - The UUID of the tier
   * @returns The membership tier details
   * @throws {ApiError} 404 if tier not found
   * @throws {ApiError} 500 if database query fails
   */
  async getTierById(tierId: string): Promise<MembershipTier> {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .eq('id', tierId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Tier not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as MembershipTier;
  }

  /**
   * Retrieves a membership tier by its unique name (e.g., 'free', 'premium', 'pro').
   *
   * @param name - The tier name (lowercase, e.g., 'free', 'trial', 'premium')
   * @returns The membership tier details
   * @throws {ApiError} 404 if tier not found
   * @throws {ApiError} 500 if database query fails
   */
  async getTierByName(name: string): Promise<MembershipTier> {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Tier not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as MembershipTier;
  }

  /**
   * Retrieves a user's current membership with full tier details.
   * Includes joined tier data for display purposes.
   *
   * @param userId - The Supabase user ID
   * @param accessToken - Optional access token for RLS-compliant queries
   * @returns Membership with nested tier object
   * @throws {ApiError} 404 if membership not found
   * @throws {ApiError} 500 if database query fails
   */
  async getUserMembership(
    userId: string,
    accessToken?: string
  ): Promise<Membership & { tier: MembershipTier }> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('memberships')
      .select('*, tier:membership_tiers(*)')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Membership not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as Membership & { tier: MembershipTier };
  }

  /**
   * Retrieves a user's tier along with all associated features.
   * Uses a database function that aggregates features into a JSON object.
   *
   * @param userId - The Supabase user ID
   * @returns Tier info with features map, or null if user has no membership
   * @throws {ApiError} 500 if database function fails
   */
  async getUserTierWithFeatures(userId: string): Promise<UserTierWithFeatures | null> {
    const { data, error } = await supabaseAdmin.rpc('get_user_tier_with_features', {
      p_user_id: userId,
    });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data && data.length > 0 ? (data[0] as UserTierWithFeatures) : null;
  }

  /**
   * Retrieves all features assigned to a specific tier with full feature details.
   * Includes the feature definition via join for display and validation.
   *
   * @param tierId - The UUID of the membership tier
   * @param accessToken - Optional access token for RLS-compliant queries
   * @returns Array of tier features with nested feature definitions
   * @throws {ApiError} 500 if database query fails
   */
  async getTierFeatures(tierId: string, accessToken?: string): Promise<TierFeatureWithDetails[]> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('tier_features')
      .select(
        `
        *,
        feature:features(*)
      `
      )
      .eq('tier_id', tierId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as TierFeatureWithDetails[];
  }

  /**
   * Retrieves all active features defined in the system.
   * Features define capabilities that can be assigned to tiers.
   *
   * @returns Array of all active feature definitions
   * @throws {ApiError} 500 if database query fails
   */
  async getAllFeatures(): Promise<Feature[]> {
    const { data, error } = await supabaseAdmin.from('features').select('*').eq('is_active', true);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Feature[];
  }

  /**
   * Checks if a user has access to a specific feature based on their tier.
   * Uses database function that considers tier assignment and feature values.
   *
   * @param userId - The Supabase user ID
   * @param featureKey - The feature key to check (e.g., 'api_integrations')
   * @returns True if user has the feature enabled
   * @throws {ApiError} 500 if database function fails
   */
  async userHasFeature(userId: string, featureKey: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.rpc('user_has_feature', {
      p_user_id: userId,
      p_feature_key: featureKey,
    });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return Boolean(data);
  }

  /**
   * Retrieves the numeric limit for a feature based on user's tier.
   * Returns -1 for unlimited features, 0 if feature not available.
   *
   * @param userId - The Supabase user ID
   * @param featureKey - The feature key (e.g., 'team_members', 'api_calls')
   * @returns The limit value (-1 = unlimited, 0 = none, positive = limit)
   * @throws {ApiError} 500 if database function fails
   */
  async getFeatureLimit(userId: string, featureKey: string): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc('get_feature_limit', {
      p_user_id: userId,
      p_feature_key: featureKey,
    });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as number;
  }

  /**
   * Updates a user's membership with partial data.
   * Primarily used by admin operations and webhook handlers.
   *
   * @param userId - The Supabase user ID
   * @param updates - Partial membership data to update
   * @returns The updated membership
   * @throws {ApiError} 500 if database update fails
   */
  async updateMembership(userId: string, updates: Partial<Membership>): Promise<Membership> {
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Membership;
  }

  /**
   * Changes a user's tier directly without payment processing.
   * Intended for testing/development or admin overrides.
   * Uses atomic database function to prevent race conditions.
   *
   * @param userId - The Supabase user ID
   * @param tierId - The UUID of the target tier
   * @param billingCycle - The billing cycle ('monthly' or 'yearly'), defaults to 'monthly'
   * @returns The updated membership with tier details
   * @throws {ApiError} 400 if tier is invalid or inactive
   * @throws {ApiError} 500 if database operation fails
   */
  async changeTier(
    userId: string,
    tierId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<Membership & { tier: MembershipTier }> {
    // Use atomic RPC function that validates tier and updates membership in one transaction
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('change_user_tier', {
      p_user_id: userId,
      p_tier_id: tierId,
      p_billing_cycle: billingCycle,
    });

    if (rpcError) {
      throw new ApiError(500, `Failed to change tier: ${rpcError.message}`);
    }

    if (!rpcResult || rpcResult.length === 0 || !rpcResult[0].success) {
      const errorMsg = rpcResult?.[0]?.error_message || 'Unknown error changing tier';
      throw new ApiError(400, errorMsg);
    }

    // Fetch the updated membership with tier data
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .select('*, tier:membership_tiers(*)')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Membership & { tier: MembershipTier };
  }

  /**
   * Upgrades a user's membership after successful Stripe payment.
   * Called by webhook handler after checkout.session.completed event.
   * Note: stripe_customer_id is stored in user_profiles, not memberships.
   *
   * @param userId - The Supabase user ID
   * @param tierId - The UUID of the new tier
   * @param stripeData - Stripe subscription details from the webhook
   * @returns The updated membership
   * @throws {ApiError} 500 if database update fails
   */
  async upgradeMembership(
    userId: string,
    tierId: string,
    stripeData: {
      stripe_subscription_id: string;
      stripe_price_id: string;
      billing_cycle: 'monthly' | 'yearly';
      current_period_start: Date;
      current_period_end: Date;
    }
  ): Promise<Membership> {
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: tierId,
        status: 'active',
        stripe_subscription_id: stripeData.stripe_subscription_id,
        stripe_price_id: stripeData.stripe_price_id,
        billing_cycle: stripeData.billing_cycle,
        current_period_start: stripeData.current_period_start.toISOString(),
        current_period_end: stripeData.current_period_end.toISOString(),
        started_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Membership;
  }
}

export const membershipService = new MembershipService();
