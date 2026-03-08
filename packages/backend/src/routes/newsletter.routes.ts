/**
 * @swagger
 * tags:
 *   name: Newsletter
 *   description: Newsletter subscription (public, rate-limited)
 */

/**
 * @swagger
 * /api/newsletter/subscribe:
 *   post:
 *     summary: Subscribe an email address to the newsletter
 *     tags: [Newsletter]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Subscribed successfully
 *       400:
 *         description: Invalid email
 *       429:
 *         description: Rate limit exceeded
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { newsletterService } from '../services/newsletter.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { createRateLimit } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Rate limit: 5 requests per 15 minutes per IP
const newsletterRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many subscription attempts. Please try again later.',
});

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
});

/**
 * POST /subscribe - Subscribe to newsletter
 * Public, rate limited.
 */
router.post(
  '/subscribe',
  newsletterRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = subscribeSchema.parse(req.body);
    await newsletterService.subscribe(email);

    res.json({
      success: true,
      message: "You're subscribed! Thanks for signing up.",
    });
  })
);

export default router;
