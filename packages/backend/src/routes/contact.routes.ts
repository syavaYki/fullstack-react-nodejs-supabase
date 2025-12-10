import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { contactService } from '../services/contact.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { contactFormRateLimit } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Validation schema
const contactSubmissionSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit contact form
 *     description: Public endpoint to submit a contact form. Rate limited to 5 requests per 15 minutes per IP.
 *     tags: [Contact]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email, subject, message]
 *             properties:
 *               first_name:
 *                 type: string
 *                 maxLength: 50
 *               last_name:
 *                 type: string
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *     responses:
 *       200:
 *         description: Contact form submitted successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  contactFormRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const input = contactSubmissionSchema.parse(req.body);

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    const submission = await contactService.createSubmission(input, ipAddress, userAgent);

    // Send notification email asynchronously
    contactService.sendNotificationEmail(submission).catch((err) => {
      console.error('Failed to send contact notification email:', err);
    });

    res.json({
      success: true,
      message: "Thank you for your message. We'll get back to you soon!",
    });
  })
);

export default router;
