import { Router, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  registerRateLimit,
  loginRateLimit,
  forgotPasswordRateLimit,
} from '../middleware/rateLimit.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createSupabaseReqResClient } from '../config/supabase.js';
import { env } from '../config/env.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  redirect_url: z.string().url().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6),
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     deprecated: true
 *     description: |
 *       **DEPRECATED**: For cookie-based auth, use the Supabase client directly in your frontend.
 *       This endpoint is kept for API clients that need Bearer token auth.
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
 *               password:
 *                 type: string
 *                 minLength: 6
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input
 */
router.post(
  '/register',
  registerRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     deprecated: true
 *     description: |
 *       **DEPRECATED**: For cookie-based auth, use the Supabase client directly in your frontend.
 *       This endpoint is kept for API clients that need Bearer token auth.
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and invalidate session
 *     tags: [Auth]
 *     deprecated: true
 *     description: |
 *       **DEPRECATED**: For cookie-based auth, use the Supabase client directly in your frontend.
 *       This endpoint is kept for API clients that need Bearer token auth.
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.accessToken) {
      await authService.logout(req.accessToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
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
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refresh_token } = refreshSchema.parse(req.body);
    const result = await authService.refreshToken(refresh_token);

    res.json({
      success: true,
      data: result,
    });
  })
);

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
 *               redirect_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Reset email sent
 */
router.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, redirect_url } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email, redirect_url);

    res.json({
      success: true,
      message: 'Password reset email sent',
    });
  })
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
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
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post(
  '/reset-password',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = resetPasswordSchema.parse(req.body);

    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    await authService.resetPassword(req.user.id, password);

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  })
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     description: |
 *       Returns the current authenticated user. Works with both cookie-based auth
 *       (browser clients) and Bearer token auth (API clients).
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: { user: req.user },
    });
  })
);

/**
 * @swagger
 * /api/auth/callback:
 *   get:
 *     summary: OAuth callback handler
 *     tags: [Auth]
 *     description: |
 *       Handles OAuth callback from Supabase. This endpoint is called after a user
 *       authenticates with an OAuth provider (Google, GitHub, etc.).
 *
 *       **Setup Required**: Add this URL to your Supabase project's redirect URLs:
 *       - Development: `http://localhost:3001/api/auth/callback`
 *       - Production: `https://your-domain.com/api/auth/callback`
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from OAuth provider
 *       - in: query
 *         name: next
 *         schema:
 *           type: string
 *         description: URL to redirect to after authentication (default is frontend URL)
 *     responses:
 *       302:
 *         description: Redirects to frontend with session cookie set
 *       400:
 *         description: Missing authorization code
 */
router.get(
  '/callback',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const code = req.query.code as string;
    const next = (req.query.next as string) || env.FRONTEND_URL;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Missing authorization code',
      });
      return;
    }

    // Create Supabase client with cookie context
    const supabase = createSupabaseReqResClient(req, res);

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('OAuth callback error:', error);
      // Redirect to frontend with error
      res.redirect(`${env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(error.message)}`);
      return;
    }

    // Session cookies are automatically set by createSupabaseReqResClient
    // Redirect to the next URL or frontend
    res.redirect(next);
  })
);

export default router;
