/**
 * @file auth.service.test.ts
 * @description Tests for AuthService — register, login, logout, refreshToken,
 *   forgotPassword, resetPassword.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Uses .ts extensions in vi.mock paths (test files are excluded from tsconfig).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock values so they are available inside the vi.mock factory
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const signUp = vi.fn();
  const signInWithPassword = vi.fn();
  const refreshSession = vi.fn();
  const resetPasswordForEmail = vi.fn();
  const adminSignOut = vi.fn();
  const updateUser = vi.fn();
  const createSupabaseClientWithAuth = vi.fn();

  return {
    supabaseClient: {
      auth: {
        signUp,
        signInWithPassword,
        refreshSession,
        resetPasswordForEmail,
      },
    },
    supabaseAdmin: {
      auth: {
        admin: {
          signOut: adminSignOut,
        },
      },
    },
    createSupabaseClientWithAuth,
    // Keep a reference to updateUser so tests can configure it
    updateUser,
  };
});

// ---------------------------------------------------------------------------
// Mock external modules
// ---------------------------------------------------------------------------
vi.mock('../config/supabase.ts', () => ({
  supabaseClient: mocks.supabaseClient,
  supabaseAdmin: mocks.supabaseAdmin,
  createSupabaseClientWithAuth: mocks.createSupabaseClientWithAuth,
}));

vi.mock('../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are configured
// ---------------------------------------------------------------------------
import { authService } from '../services/auth.service.ts';
import { ApiError } from '../middleware/error.middleware.ts';
import { createMockAuthUser, createMockSession, createMockAuthResponse } from './mocks/index.ts';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: createSupabaseClientWithAuth returns a client whose
    // auth.updateUser is wired to our hoisted mock
    mocks.createSupabaseClientWithAuth.mockReturnValue({
      auth: { updateUser: mocks.updateUser },
    });
  });

  // -----------------------------------------------------------------------
  // register
  // -----------------------------------------------------------------------
  describe('register', () => {
    it('should return user and session on success', async () => {
      const mockUser = createMockAuthUser();
      const mockSession = createMockSession();
      mocks.supabaseClient.auth.signUp.mockResolvedValue(
        createMockAuthResponse(mockUser, mockSession)
      );

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        first_name: 'Test',
        last_name: 'User',
      });

      expect(result).toEqual({
        user: { id: mockUser.id, email: mockUser.email },
        session: {
          access_token: mockSession.access_token,
          refresh_token: mockSession.refresh_token,
          expires_in: mockSession.expires_in,
        },
      });

      expect(mocks.supabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
        options: {
          data: { first_name: 'Test', last_name: 'User' },
        },
      });
    });

    it('should throw ApiError on Supabase error', async () => {
      mocks.supabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      await expect(
        authService.register({
          email: 'taken@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(ApiError);

      await expect(
        authService.register({
          email: 'taken@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('User already registered');
    });

    it('should throw when no user/session returned', async () => {
      // Supabase returns no error, but user and session are null
      // (e.g. email confirmation required in some configurations)
      mocks.supabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(ApiError);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Registration failed');
    });
  });

  // -----------------------------------------------------------------------
  // login
  // -----------------------------------------------------------------------
  describe('login', () => {
    it('should return user and session on success', async () => {
      const mockUser = createMockAuthUser();
      const mockSession = createMockSession();
      mocks.supabaseClient.auth.signInWithPassword.mockResolvedValue(
        createMockAuthResponse(mockUser, mockSession)
      );

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result).toEqual({
        user: { id: mockUser.id, email: mockUser.email },
        session: {
          access_token: mockSession.access_token,
          refresh_token: mockSession.refresh_token,
          expires_in: mockSession.expires_in,
        },
      });

      expect(mocks.supabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });
    });

    it('should throw 401 on invalid credentials', async () => {
      mocks.supabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      try {
        await authService.login({
          email: 'wrong@example.com',
          password: 'WrongPassword',
        });
        expect.fail('Expected login to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(401);
        expect((err as ApiError).message).toBe('Invalid email or password');
      }
    });

    it('should throw when no user/session returned', async () => {
      mocks.supabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      try {
        await authService.login({
          email: 'test@example.com',
          password: 'Password123!',
        });
        expect.fail('Expected login to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(401);
        expect((err as ApiError).message).toBe('Login failed');
      }
    });
  });

  // -----------------------------------------------------------------------
  // logout
  // -----------------------------------------------------------------------
  describe('logout', () => {
    it('should call supabaseAdmin.auth.admin.signOut (NOT supabaseClient)', async () => {
      mocks.supabaseAdmin.auth.admin.signOut.mockResolvedValue({ error: null });

      await authService.logout('mock-access-token-123');

      // Verify the admin client was used — this is the critical check
      expect(mocks.supabaseAdmin.auth.admin.signOut).toHaveBeenCalledWith(
        'mock-access-token-123',
        'local'
      );
    });

    it('should not throw when signOut has error (just logs warning)', async () => {
      mocks.supabaseAdmin.auth.admin.signOut.mockResolvedValue({
        error: { message: 'Token already expired' },
      });

      // Should resolve without throwing
      await expect(authService.logout('expired-token')).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // refreshToken
  // -----------------------------------------------------------------------
  describe('refreshToken', () => {
    it('should return new session', async () => {
      const mockUser = createMockAuthUser();
      const mockSession = createMockSession({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
      mocks.supabaseClient.auth.refreshSession.mockResolvedValue(
        createMockAuthResponse(mockUser, mockSession)
      );

      const result = await authService.refreshToken('old-refresh-token');

      expect(result).toEqual({
        user: { id: mockUser.id, email: mockUser.email },
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: mockSession.expires_in,
        },
      });

      expect(mocks.supabaseClient.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token',
      });
    });

    it('should throw 401 on invalid token', async () => {
      mocks.supabaseClient.auth.refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid refresh token' },
      });

      try {
        await authService.refreshToken('bad-refresh-token');
        expect.fail('Expected refreshToken to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(401);
        expect((err as ApiError).message).toBe('Invalid or expired refresh token');
      }
    });
  });

  // -----------------------------------------------------------------------
  // forgotPassword
  // -----------------------------------------------------------------------
  describe('forgotPassword', () => {
    it('should not throw even on error (does not reveal email existence)', async () => {
      mocks.supabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: 'Email rate limit exceeded' },
      });

      // The method should silently succeed regardless of errors
      await expect(
        authService.forgotPassword('unknown@example.com', 'https://app.test/reset')
      ).resolves.toBeUndefined();

      expect(mocks.supabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'unknown@example.com',
        { redirectTo: 'https://app.test/reset' }
      );
    });

    it('should call resetPasswordForEmail with correct arguments on success', async () => {
      mocks.supabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      await authService.forgotPassword('user@example.com', 'https://app.test/reset-password');

      expect(mocks.supabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        { redirectTo: 'https://app.test/reset-password' }
      );
    });
  });

  // -----------------------------------------------------------------------
  // resetPassword
  // -----------------------------------------------------------------------
  describe('resetPassword', () => {
    it('should call createSupabaseClientWithAuth with the access token', async () => {
      mocks.updateUser.mockResolvedValue({ data: { user: createMockAuthUser() }, error: null });

      await authService.resetPassword('user-access-token-xyz', 'NewPassword456!');

      expect(mocks.createSupabaseClientWithAuth).toHaveBeenCalledWith('user-access-token-xyz');
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'NewPassword456!' });
    });

    it('should throw ApiError on update failure', async () => {
      mocks.updateUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Password too weak' },
      });

      try {
        await authService.resetPassword('user-access-token', 'weak');
        expect.fail('Expected resetPassword to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(400);
        expect((err as ApiError).message).toBe('Failed to reset password');
      }
    });
  });
});
