/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and session management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: securepassword123
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: securepassword123
 *     responses:
 *       200:
 *         description: Login successful — sets session cookie
 *       400:
 *         description: Invalid credentials
 *       429:
 *         description: Rate limit exceeded
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and revoke session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using a refresh token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: New tokens returned
 *       400:
 *         description: Invalid or expired refresh token
 */

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset email
 *     tags: [Auth]
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
 *         description: Reset link sent (always returns success to avoid email enumeration)
 *       429:
 *         description: Rate limit exceeded
 */

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using a valid access token from the reset link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: newSecurePassword123
 *     responses:
 *       200:
 *         description: Password reset successful
 *       401:
 *         description: Unauthorized — missing or invalid token
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current user profile
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
 *                         profile:
 *                           $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import {
  registerRateLimit,
  loginRateLimit,
  forgotPasswordRateLimit,
} from '../middleware/rateLimit.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from '../validation/index.js';
import { authService } from '../services/auth.service.js';
import { profileService } from '../services/profile.service.js';
import { successResponse, errorResponse } from '../utils/index.js';
import { env } from '../config/env.js';

const router = Router();

/** POST /auth/register */
router.post(
  '/register',
  registerRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(successResponse(result, 'Registration successful'));
  })
);

/** POST /auth/login */
router.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(successResponse(result, 'Login successful'));
  })
);

/** POST /auth/logout */
router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.accessToken) {
      await authService.logout(req.accessToken);
    }
    res.json(successResponse(null, 'Logged out successfully'));
  })
);

/** POST /auth/refresh */
router.post(
  '/refresh',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refresh_token } = refreshTokenSchema.parse(req.body);
    const result = await authService.refreshToken(refresh_token);
    res.json(successResponse(result));
  })
);

/** POST /auth/forgot-password */
router.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const redirectTo = `${env.FRONTEND_URL}/reset-password`;
    await authService.forgotPassword(email, redirectTo);
    // Always return success (don't reveal if email exists)
    res.json(successResponse(null, 'If an account exists, a reset link has been sent'));
  })
);

/** POST /auth/reset-password */
router.post(
  '/reset-password',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = resetPasswordSchema.parse(req.body);
    if (!req.accessToken) {
      res.status(401).json(errorResponse('Access token required'));
      return;
    }
    await authService.resetPassword(req.accessToken, password);
    res.json(successResponse(null, 'Password reset successful'));
  })
);

/** GET /auth/me — get current user profile + membership */
router.get(
  '/me',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await profileService.getProfile(req.user!.id);
    res.json(successResponse({ profile }));
  })
);

export default router;
