import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { membershipService } from '../services/membership.service.js';
import { trialService } from '../services/trial.service.js';
import { usageService } from '../services/usage.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// ============================================
// PUBLIC ENDPOINTS (no authentication required)
// ============================================

/**
 * @swagger
 * /api/membership/public/tiers-with-features:
 *   get:
 *     summary: Get all tiers with their features (PUBLIC - no auth required)
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: All tiers with their features
 */
router.get(
  '/public/tiers-with-features',
  asyncHandler(async (req: Request, res: Response) => {
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
 * @swagger
 * /api/membership/tiers:
 *   get:
 *     summary: Get all available membership tiers
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: List of membership tiers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MembershipTier'
 */
router.get(
  '/tiers',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tiers = await membershipService.getTiers(req.accessToken);

    res.json({
      success: true,
      data: tiers,
    });
  })
);

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
 *         description: Tier features
 *       404:
 *         description: Tier not found
 */
router.get(
  '/tiers/:tierId/features',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { tierId } = req.params;
    const features = await membershipService.getTierFeatures(tierId, req.accessToken);

    res.json({
      success: true,
      data: features,
    });
  })
);

/**
 * @swagger
 * /api/membership:
 *   get:
 *     summary: Get current user's membership
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: User membership details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserMembership'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Membership not found
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const membership = await membershipService.getUserMembership(req.user.id, req.accessToken);

    res.json({
      success: true,
      data: membership,
    });
  })
);

/**
 * @swagger
 * /api/membership/features:
 *   get:
 *     summary: Get current user's tier with features
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: User's tier and features
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/features',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const tierWithFeatures = await membershipService.getUserTierWithFeatures(req.user.id);

    res.json({
      success: true,
      data: tierWithFeatures,
    });
  })
);

/**
 * @swagger
 * /api/membership/check-feature/{featureKey}:
 *   get:
 *     summary: Check if current user has a specific feature
 *     tags: [Membership]
 *     parameters:
 *       - in: path
 *         name: featureKey
 *         required: true
 *         schema:
 *           type: string
 *         description: The feature key to check (e.g., "advanced_analytics")
 *     responses:
 *       200:
 *         description: Feature check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     has_feature:
 *                       type: boolean
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/check-feature/:featureKey',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { featureKey } = req.params;
    const hasFeature = await membershipService.userHasFeature(req.user.id, featureKey);

    res.json({
      success: true,
      data: { has_feature: hasFeature },
    });
  })
);

/**
 * @swagger
 * /api/membership/feature-limit/{featureKey}:
 *   get:
 *     summary: Get the limit value for a specific feature
 *     tags: [Membership]
 *     parameters:
 *       - in: path
 *         name: featureKey
 *         required: true
 *         schema:
 *           type: string
 *         description: The feature key to get limit for (e.g., "max_projects")
 *     responses:
 *       200:
 *         description: Feature limit value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       description: -1 means unlimited
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/feature-limit/:featureKey',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { featureKey } = req.params;
    const limit = await membershipService.getFeatureLimit(req.user.id, featureKey);

    res.json({
      success: true,
      data: { limit },
    });
  })
);

// ============================================
// TRIAL MANAGEMENT
// ============================================

/**
 * @swagger
 * /api/membership/trial/status:
 *   get:
 *     summary: Get current user's trial status
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Trial status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     is_on_trial:
 *                       type: boolean
 *                     trial_starts_at:
 *                       type: string
 *                       format: date-time
 *                     trial_ends_at:
 *                       type: string
 *                       format: date-time
 *                     days_remaining:
 *                       type: integer
 *                     has_used_trial:
 *                       type: boolean
 *                     can_start_trial:
 *                       type: boolean
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/trial/status',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const status = await trialService.getTrialStatus(req.user.id);

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * @swagger
 * /api/membership/trial/start:
 *   post:
 *     summary: Start a 14-day trial
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Trial started
 *       400:
 *         description: Not eligible for trial
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/trial/start',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const membership = await trialService.startTrial(req.user.id);

    res.json({
      success: true,
      data: membership,
      message: 'Trial started successfully. You have 14 days to explore all Pro features.',
    });
  })
);

// Validation schema for trial conversion
const convertTrialSchema = z.object({
  tier_id: z.string().uuid(),
  billing_cycle: z.enum(['monthly', 'yearly']),
});

// Validation schema for tier change (without payment)
const changeTierSchema = z.object({
  tier_id: z.string().uuid(),
  billing_cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

/**
 * @swagger
 * /api/membership/trial/convert:
 *   post:
 *     summary: Convert trial to paid subscription
 *     description: This endpoint is typically called after a successful Stripe checkout
 *     tags: [Membership]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tier_id, billing_cycle]
 *             properties:
 *               tier_id:
 *                 type: string
 *                 format: uuid
 *               billing_cycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *     responses:
 *       200:
 *         description: Trial converted to paid
 *       400:
 *         description: Invalid input or not on trial
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/trial/convert',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { tier_id, billing_cycle } = convertTrialSchema.parse(req.body);
    const membership = await trialService.convertTrialToPaid(req.user.id, tier_id, billing_cycle);

    res.json({
      success: true,
      data: membership,
      message: 'Successfully upgraded to paid plan',
    });
  })
);

// ============================================
// TIER CHANGE (WITHOUT PAYMENT - FOR TESTING)
// ============================================

/**
 * @swagger
 * /api/membership/change-tier:
 *   post:
 *     summary: Change membership tier without payment (development/testing)
 *     description: Directly changes the user's tier without going through Stripe checkout. Useful for testing and development.
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
 *                 description: The ID of the tier to change to
 *               billing_cycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 default: monthly
 *     responses:
 *       200:
 *         description: Tier changed successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Tier not found
 */
router.post(
  '/change-tier',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { tier_id, billing_cycle } = changeTierSchema.parse(req.body);
    const membership = await membershipService.changeTier(req.user.id, tier_id, billing_cycle);

    res.json({
      success: true,
      data: membership,
      message: `Successfully changed to ${membership.tier.display_name} tier`,
    });
  })
);

// ============================================
// USAGE TRACKING
// ============================================

/**
 * @swagger
 * /api/membership/usage:
 *   get:
 *     summary: Get all usage for current user
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Usage summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                     tier_name:
 *                       type: string
 *                     features:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           feature_key:
 *                             type: string
 *                           feature_name:
 *                             type: string
 *                           current_usage:
 *                             type: integer
 *                           usage_limit:
 *                             type: integer
 *                             description: -1 means unlimited
 *                           percentage_used:
 *                             type: number
 *                           period_type:
 *                             type: string
 *                             enum: [daily, monthly, lifetime, none]
 *                           is_exceeded:
 *                             type: boolean
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/usage',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const usage = await usageService.getAllUsage(req.user.id);

    res.json({
      success: true,
      data: usage,
    });
  })
);

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
 *         description: The feature key to check usage for
 *     responses:
 *       200:
 *         description: Feature usage details
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: No usage tracking for this feature
 */
router.get(
  '/usage/:featureKey',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { featureKey } = req.params;
    const usage = await usageService.getUsage(req.user.id, featureKey);

    if (!usage) {
      res.status(404).json({
        success: false,
        error: 'No usage tracking found for this feature',
      });
      return;
    }

    res.json({
      success: true,
      data: usage,
    });
  })
);

export default router;
