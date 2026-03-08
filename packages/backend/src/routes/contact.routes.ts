/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Contact form submission (public, rate-limited)
 */

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a contact form message
 *     tags: [Contact]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Smith
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               subject:
 *                 type: string
 *                 example: Question about pricing
 *               message:
 *                 type: string
 *                 example: I'd like to learn more about the Pro plan.
 *     responses:
 *       200:
 *         description: Message received
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */

import { Router, Request, Response } from 'express';
import { contactService } from '../services/contact.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { contactFormRateLimit } from '../middleware/rateLimit.middleware.js';
import { contactSubmissionSchema } from '../validation/index.js';

const router = Router();

/**
 * POST / - Submit contact form
 * Public, rate limited.
 */
router.post(
  '/',
  contactFormRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const input = contactSubmissionSchema.parse(req.body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    await contactService.createSubmission(input, ipAddress, userAgent);

    res.json({
      success: true,
      message: "Thank you for your message. We'll get back to you soon!",
    });
  })
);

export default router;
