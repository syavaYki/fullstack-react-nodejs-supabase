import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import {
  MembershipTier,
  Membership,
  Feature,
  TierFeatureWithDetails,
  UserTierWithFeatures,
} from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { stripeService } from './stripe.service.js';
import { logger } from '../utils/logger.js';

/**
 * Service for managing membership tiers, user memberships, and feature access.
 */
export class MembershipService {
  /**
   * Retrieves all membership tiers ordered by sort_order.
   */
  async getTiers(accessToken?: string): Promise<MembershipTier[]> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client.from('membership_tiers').select('*').order('sort_order');

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as MembershipTier[];
  }

  /**
   * Retrieves a specific membership tier by its UUID.
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
   * Retrieves a membership tier by its unique name (e.g., 'free', 'premium').
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
   */
  async getTierFeatures(tierId: string, accessToken?: string): Promise<TierFeatureWithDetails[]> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('tier_features')
      .select(`*, feature:features(*)`)
      .eq('tier_id', tierId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as TierFeatureWithDetails[];
  }

  /**
   * Retrieves all active features defined in the system.
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
   * Uses atomic database function to prevent race conditions.
   */
  async changeTier(
    userId: string,
    tierId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<Membership & { tier: MembershipTier }> {
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

  // ============================================
  // Stripe-as-truth sync methods
  // ============================================

  /**
   * Syncs membership data from Stripe subscription.
   * Uses 24-hour cache to avoid excessive Stripe API calls.
   *
   * ARCHITECTURE: Absence of Stripe subscription = Free tier.
   */
  async syncFromStripe(
    userId: string,
    forceSync: boolean = false
  ): Promise<Membership & { tier: MembershipTier }> {
    const membership = await this.getUserMembership(userId);

    if (!forceSync && membership.sync_expires_at) {
      const expiresAt = new Date(membership.sync_expires_at);
      if (expiresAt > new Date()) {
        return membership;
      }
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      await this.updateMembership(userId, {
        last_synced_at: new Date().toISOString(),
        sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      return this.getUserMembership(userId);
    }

    try {
      const latestSubscription = await stripeService.getLatestActiveSubscription(
        profile.stripe_customer_id
      );

      if (latestSubscription) {
        await stripeService.syncSubscriptionToDatabase(userId, latestSubscription);
      } else {
        const freeTier = await this.getTierByName('free');
        if (membership.tier_id !== freeTier.id) {
          await this.downgradeToFree(userId, 'No active Stripe subscription');
        } else {
          await this.updateMembership(userId, {
            last_synced_at: new Date().toISOString(),
            sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      return this.getUserMembership(userId);
    } catch (error) {
      logger.logError('STRIPE', 'Error syncing from Stripe', error);
      await this.updateMembership(userId, {
        last_synced_at: new Date().toISOString(),
        sync_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      throw new ApiError(500, 'Failed to sync subscription from Stripe');
    }
  }

  /**
   * Downgrades a user to the Free tier.
   */
  async downgradeToFree(userId: string, reason?: string): Promise<void> {
    const freeTier = await this.getTierByName('free');

    if (reason) {
      logger.info('MEMBERSHIP', 'Downgrading user to Free tier', { userId, reason });
    }

    const { error } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: freeTier.id,
        status: 'active',
        stripe_subscription_id: null,
        stripe_price_id: null,
        stripe_status: null,
        stripe_current_period_end: null,
        cancel_at_period_end: false,
        billing_cycle: null,
        last_synced_at: new Date().toISOString(),
        sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('MEMBERSHIP', 'Error downgrading to Free tier', {
        error: error.message,
        userId,
      });
      throw new ApiError(500, 'Failed to downgrade to Free tier');
    }
  }
}

export const membershipService = new MembershipService();
