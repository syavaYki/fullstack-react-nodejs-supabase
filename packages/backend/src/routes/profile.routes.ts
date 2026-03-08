/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: User profile management (all endpoints require authentication)
 */

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized
 *   put:
 *     summary: Update current user's profile
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
 *                 example: Jane
 *               last_name:
 *                 type: string
 *                 example: Smith
 *               phone:
 *                 type: string
 *                 example: "+15551234567"
 *               company:
 *                 type: string
 *                 example: Acme Corp
 *               bio:
 *                 type: string
 *                 example: Software engineer passionate about building great products
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: https://janesmith.dev
 *               avatar_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete current user's profile and account
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Profile deleted
 *       401:
 *         description: Unauthorized
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import { updateProfileSchema } from '../validation/index.js';
import { profileService } from '../services/profile.service.js';
import { successResponse, deletedResponse } from '../utils/index.js';

const router = Router();

// All profile routes require authentication
router.use(authMiddleware, requireUser);

/** GET /profile */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await profileService.getProfile(req.user!.id);
    res.json(successResponse(profile));
  })
);

/** PUT /profile */
router.put(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = updateProfileSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.user!.id, req.accessToken!, input);
    res.json(successResponse(profile, 'Profile updated'));
  })
);

/** DELETE /profile */
router.delete(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await profileService.deleteProfile(req.user!.id);
    res.json(deletedResponse('Profile deleted'));
  })
);

export default router;
