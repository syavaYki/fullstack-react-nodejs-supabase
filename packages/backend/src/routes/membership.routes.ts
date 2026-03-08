/**
 * @swagger
 * tags:
 *   name: Membership
 *   description: Membership tiers, features, usage tracking, and trial management
 */

/**
 * @swagger
 * /api/membership/public/tiers-with-features:
 *   get:
 *     summary: Get all membership tiers with their features (public, no auth required)
 *     tags: [Membership]
 *     security: []
 *     responses:
 *       200:
 *         description: List of tiers with nested features — used for pricing page
 */

/**
 * @swagger
 * /api/membership/tiers:
 *   get:
 *     summary: Get all membership tiers
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Array of membership tiers
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/tiers/{tierId}/features:
 *   get:
 *     summary: Get features for a specific tier
 *     tags: [Membership]
 *     parameters:
 *       - in: path
 *         name: tierId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Array of features for the tier
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership:
 *   get:
 *     summary: Get current user's membership
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Current user membership data including tier and billing info
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/features:
 *   get:
 *     summary: Get current user's tier with all features
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Tier info with aggregated features
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/check-feature/{featureKey}:
 *   get:
 *     summary: Check if current user has access to a specific feature
 *     tags: [Membership]
 *     parameters:
 *       - in: path
 *         name: featureKey
 *         required: true
 *         schema:
 *           type: string
 *           example: advanced_analytics
 *     responses:
 *       200:
 *         description: Feature access check result
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         has_feature:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/feature-limit/{featureKey}:
 *   get:
 *     summary: Get the usage limit for a specific feature
 *     tags: [Membership]
 *     parameters:
 *       - in: path
 *         name: featureKey
 *         required: true
 *         schema:
 *           type: string
 *           example: api_calls
 *     responses:
 *       200:
 *         description: Feature limit value
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/trial/status:
 *   get:
 *     summary: Get current user's trial status (fetched live from Stripe)
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Trial status
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         is_on_trial:
 *                           type: boolean
 *                         trial_starts_at:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         trial_ends_at:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         days_remaining:
 *                           type: integer
 *                         has_used_trial:
 *                           type: boolean
 *                         can_start_trial:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/trial/start:
 *   post:
 *     summary: Start a Pro trial via Stripe Checkout
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Stripe Checkout URL to begin the trial
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         checkout_url:
 *                           type: string
 *                           format: uri
 *       400:
 *         description: Trial already used or active subscription exists
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/change-tier:
 *   post:
 *     summary: Change membership tier without payment (development only)
 *     tags: [Membership]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tier_id]
 *             properties:
 *               tier_id:
 *                 type: string
 *                 format: uuid
 *               billing_cycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 default: monthly
 *     responses:
 *       200:
 *         description: Tier changed successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/usage:
 *   get:
 *     summary: Get all usage tracking data for current user
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Array of usage records per feature
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/membership/usage/{featureKey}:
 *   get:
 *     summary: Get usage for a specific feature
 *     tags: [Membership]
 *     parameters:
 *       - in: path
 *         name: featureKey
 *         required: true
 *         schema:
 *           type: string
 *           example: api_calls
 *     responses:
 *       200:
 *         description: Usage record for the feature
 *       404:
 *         description: No usage tracking found for this feature
 *       401:
 *         description: Unauthorized
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { membershipService } from '../services/membership.service.js';
import { stripeService } from '../services/stripe.service.js';
import { usageService } from '../services/usage.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import { asyncHandler, ApiError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, RequestWithUser } from '../types/index.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================
// PUBLIC ENDPOINTS (no authentication required)
// ============================================

/**
 * GET /public/tiers-with-features
 * Returns all tiers with their features. Used for pricing page.
 */
router.get(
  '/public/tiers-with-features',
  asyncHandler(async (_req: Request, res: Response) => {
    const tiers = await membershipService.getTiers();
    const tiersWithFeatures = await Promise.all(
      tiers.map(async (tier) => ({
        ...tier,
        features: await membershipService.getTierFeatures(tier.id),
      }))
    );
    res.json({ success: true, data: tiersWithFeatures });
  })
);

// ============================================
// AUTHENTICATED ENDPOINTS
// ============================================

/**
 * GET /tiers - All membership tiers
 */
router.get(
  '/tiers',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tiers = await membershipService.getTiers(req.accessToken);
    res.json({ success: true, data: tiers });
  })
);

/**
 * GET /tiers/:tierId/features - Features for a specific tier
 */
router.get(
  '/tiers/:tierId/features',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { tierId } = req.params;
    const features = await membershipService.getTierFeatures(tierId, req.accessToken);
    res.json({ success: true, data: features });
  })
);

/**
 * GET / - Current user's membership
 */
router.get(
  '/',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const membership = await membershipService.getUserMembership(req.user.id, req.accessToken);
    res.json({ success: true, data: membership });
  })
);

/**
 * GET /features - Current user's tier with features
 */
router.get(
  '/features',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const tierWithFeatures = await membershipService.getUserTierWithFeatures(req.user.id);
    res.json({ success: true, data: tierWithFeatures });
  })
);

/**
 * GET /check-feature/:featureKey - Check if user has a specific feature
 */
router.get(
  '/check-feature/:featureKey',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { featureKey } = req.params;
    const hasFeature = await membershipService.userHasFeature(req.user.id, featureKey);
    res.json({ success: true, data: { has_feature: hasFeature } });
  })
);

/**
 * GET /feature-limit/:featureKey - Get the limit value for a feature
 */
router.get(
  '/feature-limit/:featureKey',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { featureKey } = req.params;
    const limit = await membershipService.getFeatureLimit(req.user.id, featureKey);
    res.json({ success: true, data: { limit } });
  })
);

// ============================================
// TRIAL MANAGEMENT
// ============================================

/**
 * GET /trial/status - Get current user's trial status (from Stripe)
 */
router.get(
  '/trial/status',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const membership = await membershipService.getUserMembership(req.user.id);
    const hasUsedTrial = membership.has_used_trial ?? false;

    let isOnTrial = false;
    let trialStartsAt: string | null = null;
    let trialEndsAt: string | null = null;
    let daysRemaining = 0;

    try {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('id', req.user.id)
        .single();

      if (profile?.stripe_customer_id) {
        const subscription = await stripeService.getLatestActiveSubscription(
          profile.stripe_customer_id
        );

        if (subscription && subscription.status === 'trialing') {
          isOnTrial = true;

          if (subscription.trial_start) {
            trialStartsAt = new Date(subscription.trial_start * 1000).toISOString();
          }
          if (subscription.trial_end) {
            trialEndsAt = new Date(subscription.trial_end * 1000).toISOString();
            const trialEnd = new Date(subscription.trial_end * 1000);
            daysRemaining = Math.max(
              0,
              Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            );
          }
        }
      }
    } catch (error) {
      const isNoSuchCustomer = error instanceof Error && error.message.includes('No such customer');

      if (!isNoSuchCustomer) {
        logger.logError('STRIPE', 'Error fetching trial status from Stripe', error);
        isOnTrial = membership.stripe_status === 'trialing';
        trialStartsAt = membership.trial_starts_at;
        trialEndsAt = membership.trial_ends_at;
        if (isOnTrial && trialEndsAt) {
          const trialEnd = new Date(trialEndsAt);
          daysRemaining = Math.max(
            0,
            Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );
        }
      }
    }

    const canStartTrial = !hasUsedTrial && !isOnTrial;

    res.json({
      success: true,
      data: {
        is_on_trial: isOnTrial,
        trial_starts_at: trialStartsAt,
        trial_ends_at: trialEndsAt,
        days_remaining: daysRemaining,
        has_used_trial: hasUsedTrial,
        can_start_trial: canStartTrial,
      },
    });
  })
);

/**
 * POST /trial/start - Start trial via Stripe Checkout
 */
router.post(
  '/trial/start',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const hasUsedTrial = await stripeService.hasUserUsedTrial(req.user.id);
    if (hasUsedTrial) {
      throw new ApiError(400, 'TRIAL_ALREADY_USED');
    }

    const { hasActive } = await stripeService.userHasActiveSubscription(req.user.id);
    if (hasActive) {
      throw new ApiError(400, 'ACTIVE_SUBSCRIPTION_EXISTS');
    }

    const topTier = await membershipService.getTierByName('pro');

    if (!topTier.trial_days || topTier.trial_days <= 0) {
      throw new ApiError(400, 'Pro tier does not offer a trial');
    }

    const checkoutUrl = await stripeService.createCheckoutSession(
      req.user.id,
      req.user.email!,
      topTier.id,
      'monthly',
      `${env.FRONTEND_URL}/dashboard?trial=started`,
      `${env.FRONTEND_URL}/pricing?trial=cancelled`
    );

    res.json({
      success: true,
      data: { checkout_url: checkoutUrl },
      message: 'Redirecting to Stripe to start your trial. No payment required upfront.',
    });
  })
);

// ============================================
// TIER CHANGE (WITHOUT PAYMENT — FOR TESTING)
// ============================================

const changeTierSchema = z.object({
  tier_id: z.string().uuid(),
  billing_cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

/**
 * POST /change-tier - Change tier without payment (development/testing ONLY)
 */
if (env.NODE_ENV !== 'production') {
  router.post(
    '/change-tier',
    authMiddleware,
    requireUser,
    asyncHandler(async (req: RequestWithUser, res: Response) => {
      const { tier_id, billing_cycle } = changeTierSchema.parse(req.body);
      const membership = await membershipService.changeTier(req.user.id, tier_id, billing_cycle);

      res.json({
        success: true,
        data: membership,
        message: `Successfully changed to ${membership.tier.display_name} tier`,
      });
    })
  );
}

// ============================================
// USAGE TRACKING
// ============================================

/**
 * GET /usage - All usage for current user
 */
router.get(
  '/usage',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const usage = await usageService.getAllUsage(req.user.id);
    res.json({ success: true, data: usage });
  })
);

/**
 * GET /usage/:featureKey - Usage for a specific feature
 */
router.get(
  '/usage/:featureKey',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { featureKey } = req.params;
    const usage = await usageService.getUsage(req.user.id, featureKey);

    if (!usage) {
      res.status(404).json({
        success: false,
        error: 'No usage tracking found for this feature',
      });
      return;
    }

    res.json({ success: true, data: usage });
  })
);

export default router;
