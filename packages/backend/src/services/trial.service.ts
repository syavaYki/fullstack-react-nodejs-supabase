import { supabaseAdmin } from '../config/supabase.js';
import { TrialStatus, Membership, BillingCycle } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

const TRIAL_DURATION_DAYS = 14;

export class TrialService {
  /**
   * Get trial status for a user
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

    const isOnTrial = membership.status === 'trial';
    const trialEndsAt = membership.trial_ends_at ? new Date(membership.trial_ends_at) : null;
    const now = new Date();

    let daysRemaining = 0;
    if (isOnTrial && trialEndsAt) {
      daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const canStartTrial = !membership.has_used_trial && membership.status !== 'trial';

    return {
      is_on_trial: isOnTrial,
      trial_starts_at: membership.trial_starts_at,
      trial_ends_at: membership.trial_ends_at,
      days_remaining: daysRemaining,
      has_used_trial: membership.has_used_trial,
      can_start_trial: canStartTrial,
    };
  }

  /**
   * Check if user can start a trial
   */
  async canStartTrial(userId: string): Promise<boolean> {
    const status = await this.getTrialStatus(userId);
    return status.can_start_trial;
  }

  /**
   * Start a trial for a user
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
   * Expire trials that have ended (for cron job)
   * Returns number of trials expired
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
   * Convert trial to paid subscription
   * This is typically called after a successful Stripe checkout
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
