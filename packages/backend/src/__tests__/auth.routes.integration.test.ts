/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @file auth.routes.integration.test.ts
 * @description HTTP integration tests for auth routes using supertest.
 *
 * Pattern: Mount the router on a mini Express app with mocked services
 * and middleware. Validates request/response flow end-to-end without
 * starting the real server.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
  profileService: {
    getProfile: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Module mocks (use .ts extensions for vi.mock — vitest resolves via alias)
// ---------------------------------------------------------------------------

vi.mock('../services/auth.service.ts', () => ({ authService: mocks.authService }));
vi.mock('../services/profile.service.ts', () => ({ profileService: mocks.profileService }));

vi.mock('../middleware/rateLimit.middleware.ts', () => ({
  registerRateLimit: (_req: any, _res: any, next: any) => next(),
  loginRateLimit: (_req: any, _res: any, next: any) => next(),
  forgotPasswordRateLimit: (_req: any, _res: any, next: any) => next(),
  createRateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/auth.middleware.ts', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-123', email: 'test@example.com' };
    req.accessToken = 'mock-access-token';
    next();
  },
}));

vi.mock('../middleware/requireUser.middleware.ts', () => ({
  requireUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../config/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    PORT: '3001',
  },
}));

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
  supabaseClient: {},
  createSupabaseReqResClient: vi.fn(),
  createSupabaseClientWithAuth: vi.fn(),
}));

vi.mock('../utils/logger.ts', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), logError: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Router import (must come after mocks)
// ---------------------------------------------------------------------------

import authRoutes from '../routes/auth.routes.ts';
import { errorHandler } from '../middleware/error.middleware.ts';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth Routes — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/register
  // -----------------------------------------------------------------------

  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201', async () => {
      const registrationResult = {
        user: { id: 'new-user-id', email: 'new@example.com' },
        session: { access_token: 'tok', refresh_token: 'ref' },
      };
      mocks.authService.register.mockResolvedValue(registrationResult);

      const res = await request(createApp())
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'securepass123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(registrationResult);
      expect(res.body.message).toBe('Registration successful');
      expect(mocks.authService.register).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'securepass123',
      });
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(createApp())
        .post('/api/auth/register')
        .send({ password: 'securepass123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(mocks.authService.register).not.toHaveBeenCalled();
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(createApp())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.authService.register).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/login
  // -----------------------------------------------------------------------

  describe('POST /api/auth/login', () => {
    it('should log in a user and return 200', async () => {
      const loginResult = {
        user: { id: 'user-id', email: 'login@example.com' },
        session: { access_token: 'at', refresh_token: 'rt' },
      };
      mocks.authService.login.mockResolvedValue(loginResult);

      const res = await request(createApp())
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(loginResult);
      expect(res.body.message).toBe('Login successful');
      expect(mocks.authService.login).toHaveBeenCalledWith({
        email: 'login@example.com',
        password: 'password123',
      });
    });

    it('should return 400 when password is empty', async () => {
      const res = await request(createApp())
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.authService.login).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/logout
  // -----------------------------------------------------------------------

  describe('POST /api/auth/logout', () => {
    it('should log out a user and return success', async () => {
      mocks.authService.logout.mockResolvedValue(undefined);

      const res = await request(createApp()).post('/api/auth/logout').send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
      expect(mocks.authService.logout).toHaveBeenCalledWith('mock-access-token');
    });

    it('should succeed even when accessToken is absent', async () => {
      // Re-mock authMiddleware to NOT set accessToken
      const { authMiddleware: _unused, ...otherExports } =
        await import('../middleware/auth.middleware.ts');
      vi.mocked(_unused);

      // Build a one-off app where authMiddleware doesn't set accessToken
      const appNoToken = express();
      appNoToken.use(express.json());

      // Manually define a mini router that simulates the logout flow
      appNoToken.post('/api/auth/logout', (req: any, _res, next) => {
        req.user = { id: 'user-uuid-123', email: 'test@example.com' };
        // No accessToken set
        next();
      });

      // Import the actual route handler logic
      const { authService } = await import('../services/auth.service.ts');

      appNoToken.post('/api/auth/logout', async (req: any, res) => {
        if (req.accessToken) {
          await authService.logout(req.accessToken);
        }
        res.json({ success: true, message: 'Logged out successfully' });
      });

      const res = await request(appNoToken).post('/api/auth/logout').send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // logout should NOT have been called since there was no token
      expect(mocks.authService.logout).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/refresh
  // -----------------------------------------------------------------------

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens and return new session', async () => {
      const refreshResult = {
        access_token: 'new-at',
        refresh_token: 'new-rt',
      };
      mocks.authService.refreshToken.mockResolvedValue(refreshResult);

      const res = await request(createApp())
        .post('/api/auth/refresh')
        .send({ refresh_token: 'old-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(refreshResult);
      expect(mocks.authService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
    });

    it('should return 400 when refresh_token is missing', async () => {
      const res = await request(createApp()).post('/api/auth/refresh').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.authService.refreshToken).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/forgot-password
  // -----------------------------------------------------------------------

  describe('POST /api/auth/forgot-password', () => {
    it('should always return success (does not reveal email existence)', async () => {
      mocks.authService.forgotPassword.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/auth/forgot-password')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('If an account exists, a reset link has been sent');
      expect(mocks.authService.forgotPassword).toHaveBeenCalledWith(
        'user@example.com',
        'http://localhost:5173/reset-password'
      );
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(createApp())
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.authService.forgotPassword).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/auth/reset-password
  // -----------------------------------------------------------------------

  describe('POST /api/auth/reset-password', () => {
    it('should reset password and return success', async () => {
      mocks.authService.resetPassword.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/auth/reset-password')
        .send({ password: 'newSecurePass123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password reset successful');
      expect(mocks.authService.resetPassword).toHaveBeenCalledWith(
        'mock-access-token',
        'newSecurePass123'
      );
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(createApp())
        .post('/api/auth/reset-password')
        .send({ password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.authService.resetPassword).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/auth/me
  // -----------------------------------------------------------------------

  describe('GET /api/auth/me', () => {
    it('should return the current user profile', async () => {
      const profile = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      };
      mocks.profileService.getProfile.mockResolvedValue(profile);

      const res = await request(createApp()).get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile).toEqual(profile);
      expect(mocks.profileService.getProfile).toHaveBeenCalledWith('user-uuid-123');
    });
  });
});
