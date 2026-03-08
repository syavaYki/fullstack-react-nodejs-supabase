/**
 * @swagger
 * tags:
 *   name: Billing
 *   description: Stripe billing, subscriptions, and payment management
 */

/**
 * @swagger
 * /api/billing/create-checkout-session:
 *   post:
 *     summary: Create a Stripe Checkout session to upgrade membership
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tier_id, billing_cycle, success_url, cancel_url]
 *             properties:
 *               tier_id:
 *                 type: string
 *                 format: uuid
 *               billing_cycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               success_url:
 *                 type: string
 *                 format: uri
 *                 example: https://app.example.com/checkout/success
 *               cancel_url:
 *                 type: string
 *                 format: uri
 *                 example: https://app.example.com/pricing
 *               skip_trial:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Checkout URL (or portal URL if subscription already active)
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
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/billing/create-portal-session:
 *   post:
 *     summary: Create a Stripe Customer Portal session for subscription management
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Portal URL
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
 *                         portal_url:
 *                           type: string
 *                           format: uri
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/billing/payment-history:
 *   get:
 *     summary: Get payment history from Stripe
 *     tags: [Billing]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of payments to return
 *     responses:
 *       200:
 *         description: Array of payment records
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/billing/subscription-status:
 *   get:
 *     summary: Get current subscription status with optional Stripe sync
 *     tags: [Billing]
 *     parameters:
 *       - in: query
 *         name: force
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Force a fresh sync from Stripe (bypasses 24h cache)
 *     responses:
 *       200:
 *         description: Current subscription/membership state
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/billing/start-pro-trial:
 *   post:
 *     summary: Start a Pro trial via Stripe Checkout
 *     tags: [Billing]
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
 * /api/billing/webhook:
 *   post:
 *     summary: Stripe webhook receiver
 *     tags: [Billing]
 *     description: Receives Stripe webhook events. Requires raw body and valid Stripe-Signature header.
 *     security: []
 *     parameters:
 *       - in: header
 *         name: stripe-signature
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received
 *       400:
 *         description: Invalid signature or missing header
 */

import { Router, Response, Request } from 'express';
import { stripeService } from '../services/stripe.service.js';
import { webhookService } from '../services/webhook.service.js';
import { membershipService } from '../services/membership.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import { asyncHandler, ApiError } from '../middleware/error.middleware.js';
import { RequestWithUser } from '../types/index.js';
import { env } from '../config/env.js';
import { checkoutSchema } from '../validation/index.js';

const router = Router();

/**
 * POST /create-checkout-session
 * Creates a Stripe Checkout session for upgrading membership.
 */
router.post(
  '/create-checkout-session',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const input = checkoutSchema.parse(req.body);

    try {
      const checkoutUrl = await stripeService.createCheckoutSession(
        req.user.id,
        req.user.email!,
        input.tier_id,
        input.billing_cycle,
        input.success_url,
        input.cancel_url,
        input.skip_trial ?? false
      );

      res.json({
        success: true,
        data: { checkout_url: checkoutUrl },
      });
    } catch (error) {
      if (error instanceof ApiError && error.message === 'ACTIVE_SUBSCRIPTION_EXISTS') {
        const portalUrl = await stripeService.createPortalSession(req.user.id);
        res.json({
          success: true,
          data: {
            portal_url: portalUrl,
            message:
              'You already have an active subscription. Use the billing portal to manage it.',
          },
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * POST /create-portal-session
 * Creates a Stripe customer portal session for subscription management.
 */
router.post(
  '/create-portal-session',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const portalUrl = await stripeService.createPortalSession(req.user.id);

    res.json({
      success: true,
      data: { portal_url: portalUrl },
    });
  })
);

/**
 * GET /payment-history
 * Returns payment history fetched directly from Stripe API.
 */
router.get(
  '/payment-history',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const payments = await stripeService.getPaymentHistory(req.user.id, limit);

    res.json({
      success: true,
      data: payments,
    });
  })
);

/**
 * GET /subscription-status
 * Returns current subscription status with fresh sync from Stripe.
 */
router.get(
  '/subscription-status',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const forceSync = req.query.force === 'true';
    const membership = await membershipService.syncFromStripe(req.user.id, forceSync);

    res.json({
      success: true,
      data: membership,
    });
  })
);

/**
 * POST /start-pro-trial
 * Start a trial via Stripe Checkout for the top-tier plan.
 */
router.post(
  '/start-pro-trial',
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
    });
  })
);

/**
 * POST /webhook
 * Stripe webhook endpoint. Raw body needed for signature verification.
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
      return;
    }

    const event = webhookService.verifyWebhookSignature(req.body, signature);
    await webhookService.processEvent(event);

    res.json({ received: true });
  })
);

export default router;
