import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { stripeService } from '../services/stripe.service.js';
import { webhookService } from '../services/webhook.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Validation schema for checkout
const checkoutSchema = z.object({
  tier_id: z.string().uuid(),
  billing_cycle: z.enum(['monthly', 'yearly']),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

/**
 * @swagger
 * /api/billing/create-checkout-session:
 *   post:
 *     summary: Create a Stripe checkout session for upgrading membership
 *     tags: [Billing]
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
 *                 description: The ID of the tier to upgrade to
 *               billing_cycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               success_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect after successful payment
 *               cancel_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect if user cancels
 *     responses:
 *       200:
 *         description: Checkout session created
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
 *                     checkout_url:
 *                       type: string
 *                       format: uri
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/create-checkout-session',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const input = checkoutSchema.parse(req.body);

    const checkoutUrl = await stripeService.createCheckoutSession(
      req.user.id,
      req.user.email!,
      input.tier_id,
      input.billing_cycle,
      input.success_url,
      input.cancel_url
    );

    res.json({
      success: true,
      data: { checkout_url: checkoutUrl },
    });
  })
);

/**
 * @swagger
 * /api/billing/create-portal-session:
 *   post:
 *     summary: Create a Stripe customer portal session
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Portal session created
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
 *                     portal_url:
 *                       type: string
 *                       format: uri
 *       400:
 *         description: No active subscription
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/create-portal-session',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const portalUrl = await stripeService.createPortalSession(req.user.id);

    res.json({
      success: true,
      data: { portal_url: portalUrl },
    });
  })
);

/**
 * @swagger
 * /api/billing/payment-history:
 *   get:
 *     summary: Get user's payment history
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Payment history
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       amount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       status:
 *                         type: string
 *                       paid_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/payment-history',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const payments = await stripeService.getPaymentHistory(req.user.id);

    res.json({
      success: true,
      data: payments,
    });
  })
);

/**
 * @swagger
 * /api/billing/webhook:
 *   post:
 *     summary: Stripe webhook endpoint
 *     tags: [Billing]
 *     security: []
 *     description: This endpoint receives webhook events from Stripe. Do not call directly.
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid webhook signature
 */
router.post(
  '/webhook',
  // Raw body is needed for signature verification
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
      return;
    }

    // Verify and construct event
    const event = webhookService.verifyWebhookSignature(req.body, signature);

    // Process the event
    await webhookService.processEvent(event);

    res.json({ received: true });
  })
);

export default router;
