import { Router, Response } from 'express';
import { z } from 'zod';
import { profileService } from '../services/profile.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All profile routes require authentication
router.use(authMiddleware);

// Lenient URL validation - accepts URLs with or without protocol
const lenientUrl = z
  .string()
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (val === null || val === undefined) return true;
      // Add https:// if no protocol provided
      const urlToTest = val.match(/^https?:\/\//) ? val : `https://${val}`;
      try {
        new URL(urlToTest);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid URL' }
  );

// Validation schema for profile updates
// Note: full_name is computed from first_name + last_name, cannot be updated directly
const updateProfileSchema = z.object({
  first_name: z.string().max(50).optional().nullable(),
  last_name: z.string().max(50).optional().nullable(),
  avatar_url: lenientUrl,
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  website: lenientUrl,
});

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Profile not found
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const profile = await profileService.getProfile(req.user.id, req.accessToken);

    res.json({
      success: true,
      data: profile,
    });
  })
);

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update current user's profile
 *     description: Update profile fields. Note that full_name is computed from first_name + last_name.
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 maxLength: 50
 *               last_name:
 *                 type: string
 *                 maxLength: 50
 *               avatar_url:
 *                 type: string
 *                 format: uri
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               company:
 *                 type: string
 *                 maxLength: 100
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               website:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Updated profile
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
router.put(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const input = updateProfileSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.user.id, input, req.accessToken);

    res.json({
      success: true,
      data: profile,
    });
  })
);

/**
 * @swagger
 * /api/profile:
 *   delete:
 *     summary: Delete current user's account
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Account deleted
 *       401:
 *         description: Not authenticated
 */
router.delete(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    await profileService.deleteProfile(req.user.id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  })
);

export default router;
