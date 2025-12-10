import { supabaseAdmin } from '../config/supabase.js';
import { TrialStatus, Membership, BillingCycle } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

/** Default trial duration in days */
const TRIAL_DURATION_DAYS = 14;

/**
 * Service for managing user trial periods.
 * Handles trial status checks, starting trials, expiration, and conversion to paid plans.
 * Uses atomic operations to prevent race conditions on expiration.
 */
export class TrialService {
  /**
   * Retrieves the current trial status for a user.
   * This is a read-only operation - it does NOT auto-expire trials to avoid race conditions.
   * Use expireTrials() cron job or checkAndExpireTrial() for explicit expiration.
   *
   * @param userId - The Supabase user ID
   * @returns Trial status including days remaining, eligibility, and expiration state
   * @throws {ApiError} 500 if database query fails
   */
  async getTrialStatus(userId: string): Promise<TrialStatus> {
    const { data: membership, error } = await supabaseAdmin
      .from('memberships')
      .select('status, trial_starts_at, trial_ends_at, has_used_trial')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    const trialEndsAt = membership.trial_ends_at ? new Date(membership.trial_ends_at) : null;
    const now = new Date();

    // Check if trial has expired (comparing dates properly)
    const isTrialExpired = trialEndsAt ? now > trialEndsAt : false;

    // User is on trial only if status is 'trial' AND trial hasn't expired
    const isOnTrial = membership.status === 'trial' && !isTrialExpired;

    // Note: We do NOT auto-expire here to avoid race conditions.
    // The cron job handles expiration, or call checkAndExpireTrial() explicitly.

    let daysRemaining = 0;
    if (isOnTrial && trialEndsAt) {
      daysRemaining = Math.max(
        0,
        Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
    }

    const canStartTrial = !membership.has_used_trial && membership.status !== 'trial';

    return {
      is_on_trial: isOnTrial,
      trial_starts_at: membership.trial_starts_at,
      trial_ends_at: membership.trial_ends_at,
      days_remaining: daysRemaining,
      has_used_trial: membership.has_used_trial,
      can_start_trial: canStartTrial,
      // Include expired flag so client can handle appropriately
      is_expired: membership.status === 'trial' && isTrialExpired,
    };
  }

  /**
   * Check and expire a user's trial if it has ended.
   * Uses conditional update to prevent race conditions - only updates if status is still 'trial'.
   * Returns true if trial was expired, false if already expired or not on trial.
   */
  async checkAndExpireTrial(userId: string): Promise<boolean> {
    // Get the free tier for downgrade
    const { data: freeTier, error: tierError } = await supabaseAdmin
      .from('membership_tiers')
      .select('id')
      .eq('name', 'free')
      .single();

    if (tierError || !freeTier) {
      console.error('Failed to find free tier for trial expiration:', tierError);
      return false;
    }

    const now = new Date().toISOString();

    // Atomic conditional update: only update if status is 'trial' AND trial has ended
    // This prevents race conditions - if another request already expired, this will match 0 rows
    const { data, error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: freeTier.id,
        status: 'active',
      })
      .eq('user_id', userId)
      .eq('status', 'trial')
      .lt('trial_ends_at', now)
      .select('id');

    if (updateError) {
      console.error('Failed to expire trial for user:', userId, updateError);
      return false;
    }

    // Return true if a row was updated
    return data !== null && data.length > 0;
  }

  /**
   * Expires a single user's trial and downgrades them to the free tier.
   * Only updates if the user's status is still 'trial'.
   * Used for targeted expiration of individual users.
   *
   * @param userId - The Supabase user ID
   */
  async expireSingleTrial(userId: string): Promise<void> {
    // Get the free tier for downgrade
    const { data: freeTier, error: tierError } = await supabaseAdmin
      .from('membership_tiers')
      .select('id')
      .eq('name', 'free')
      .single();

    if (tierError || !freeTier) {
      console.error('Failed to find free tier for trial expiration:', tierError);
      return;
    }

    // Downgrade user to free tier
    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: freeTier.id,
        status: 'active',
      })
      .eq('user_id', userId)
      .eq('status', 'trial');

    if (updateError) {
      console.error('Failed to expire trial for user:', userId, updateError);
    }
  }

  /**
   * Checks if a user is eligible to start a trial.
   * Users can only use the trial once.
   *
   * @param userId - The Supabase user ID
   * @returns True if user can start a trial, false if already used or on trial
   */
  async canStartTrial(userId: string): Promise<boolean> {
    const status = await this.getTrialStatus(userId);
    return status.can_start_trial;
  }

  /**
   * Starts a trial period for a user.
   * Sets the user's membership to the trial tier for TRIAL_DURATION_DAYS.
   * Marks has_used_trial to prevent future trials.
   *
   * @param userId - The Supabase user ID
   * @returns The updated membership with trial status
   * @throws {ApiError} 400 if user is not eligible for trial
   * @throws {ApiError} 500 if trial tier not found or database error
   */
  async startTrial(userId: string): Promise<Membership> {
    // Check eligibility
    const canStart = await this.canStartTrial(userId);
    if (!canStart) {
      throw new ApiError(400, 'User is not eligible for trial. Trial may have been used already.');
    }

    // Get trial tier
    const { data: trialTier, error: tierError } = await supabaseAdmin
      .from('membership_tiers')
      .select('id')
      .eq('name', 'trial')
      .single();

    if (tierError || !trialTier) {
      throw new ApiError(500, 'Trial tier not found');
    }

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

    // Update membership to trial
    const { data: membership, error } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: trialTier.id,
        status: 'trial',
        trial_starts_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        has_used_trial: true,
        started_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return membership as Membership;
  }

  /**
   * Bulk expires all trials that have ended.
   * Intended to be called by a cron job (e.g., hourly or daily).
   * Downgrades all expired trial users to the free tier.
   *
   * @returns Number of trials that were expired
   * @throws {ApiError} 500 if free tier not found or database error
   */
  async expireTrials(): Promise<number> {
    const now = new Date().toISOString();

    // Get the free tier for downgrade
    const { data: freeTier, error: tierError } = await supabaseAdmin
      .from('membership_tiers')
      .select('id')
      .eq('name', 'free')
      .single();

    if (tierError || !freeTier) {
      throw new ApiError(500, 'Free tier not found');
    }

    // Find and expire all trials that have ended
    const { data: expiredTrials, error: selectError } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id')
      .eq('status', 'trial')
      .lt('trial_ends_at', now);

    if (selectError) {
      throw new ApiError(500, selectError.message);
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      return 0;
    }

    // Downgrade all expired trials to free tier
    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: freeTier.id,
        status: 'active',
      })
      .eq('status', 'trial')
      .lt('trial_ends_at', now);

    if (updateError) {
      throw new ApiError(500, updateError.message);
    }

    return expiredTrials.length;
  }

  /**
   * Converts a user's trial membership to a paid subscription.
   * Called after successful Stripe checkout during a trial period.
   * Validates that user is on trial and target tier is a paid tier.
   *
   * @param userId - The Supabase user ID
   * @param tierId - The UUID of the paid tier to convert to
   * @param billingCycle - The billing cycle ('monthly' or 'yearly')
   * @param stripeData - Optional Stripe subscription details
   * @returns The updated membership with active status
   * @throws {ApiError} 400 if user is not on trial or target tier is invalid
   * @throws {ApiError} 404 if tier not found
   * @throws {ApiError} 500 if database error
   */
  async convertTrialToPaid(
    userId: string,
    tierId: string,
    billingCycle: BillingCycle,
    stripeData?: {
      stripe_subscription_id: string;
      stripe_price_id: string;
      current_period_start: Date;
      current_period_end: Date;
    }
  ): Promise<Membership> {
    // Verify user is on trial
    const { data: currentMembership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .select('status')
      .eq('user_id', userId)
      .single();

    if (membershipError) {
      throw new ApiError(500, membershipError.message);
    }

    if (currentMembership.status !== 'trial') {
      throw new ApiError(400, 'User is not on trial');
    }

    // Verify target tier exists and is not trial/free
    const { data: tier, error: tierError } = await supabaseAdmin
      .from('membership_tiers')
      .select('name')
      .eq('id', tierId)
      .single();

    if (tierError || !tier) {
      throw new ApiError(404, 'Tier not found');
    }

    if (tier.name === 'trial' || tier.name === 'free') {
      throw new ApiError(400, 'Cannot convert trial to free or trial tier');
    }

    const now = new Date();
    const updateData: Partial<Membership> = {
      tier_id: tierId,
      status: 'active',
      billing_cycle: billingCycle,
      started_at: now.toISOString(),
    };

    if (stripeData) {
      updateData.stripe_subscription_id = stripeData.stripe_subscription_id;
      updateData.stripe_price_id = stripeData.stripe_price_id;
      updateData.current_period_start = stripeData.current_period_start.toISOString();
      updateData.current_period_end = stripeData.current_period_end.toISOString();
    }

    const { data: membership, error } = await supabaseAdmin
      .from('memberships')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return membership as Membership;
  }
}

export const trialService = new TrialService();
