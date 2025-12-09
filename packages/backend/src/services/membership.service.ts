import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import {
  MembershipTier,
  Membership,
  Feature,
  TierFeatureWithDetails,
  UserTierWithFeatures,
} from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

export class MembershipService {
  /**
   * Get all active membership tiers
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
   * Get a specific tier by ID
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
   * Get a tier by name
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
   * Get user's current membership
   */
  async getUserMembership(userId: string, accessToken?: string): Promise<Membership> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Membership not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as Membership;
  }

  /**
   * Get user's tier with features
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
   * Get features for a specific tier (with feature details from join)
   */
  async getTierFeatures(tierId: string, accessToken?: string): Promise<TierFeatureWithDetails[]> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('tier_features')
      .select(`
        *,
        feature:features(*)
      `)
      .eq('tier_id', tierId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as TierFeatureWithDetails[];
  }

  /**
   * Get all available features
   */
  async getAllFeatures(): Promise<Feature[]> {
    const { data, error } = await supabaseAdmin
      .from('features')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Feature[];
  }

  /**
   * Check if user has a specific feature
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
   * Get a feature limit value for user
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
   * Update user membership (admin/webhook use)
   */
  async updateMembership(
    userId: string,
    updates: Partial<Membership>
  ): Promise<Membership> {
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
   * Upgrade user to a new tier (used by webhook after successful payment)
   * Note: stripe_customer_id is stored in user_profiles, not memberships
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
