/**
 * @file auth.middleware.test.ts
 * @description Tests for auth middleware (authMiddleware, optionalAuthMiddleware).
 *
 * The middleware:
 * 1. Tries cookie-based auth via createSupabaseReqResClient(req, res) then auth.getUser()
 * 2. Falls back to Authorization: Bearer header using supabaseAdmin.auth.getUser(token)
 * 3. On exceptions, returns 503 (fail-closed)
 * 4. Sets req.user and req.accessToken on success
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Uses .ts extensions in mock paths (not .js) for Vitest compatibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock values so they're available in vi.mock factory
const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockGetSession = vi.fn();
  const mockReqResClient = {
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  };

  const mockAdminGetUser = vi.fn();
  const mockSupabaseAdmin = {
    auth: {
      getUser: mockAdminGetUser,
    },
  };

  const mockCreateSupabaseReqResClient = vi.fn().mockReturnValue(mockReqResClient);

  return {
    mockGetUser,
    mockGetSession,
    mockReqResClient,
    mockAdminGetUser,
    mockSupabaseAdmin,
    mockCreateSupabaseReqResClient,
  };
});

// Mock the supabase config module
vi.mock('../config/supabase.ts', () => ({
  createSupabaseReqResClient: mocks.mockCreateSupabaseReqResClient,
  supabaseAdmin: mocks.mockSupabaseAdmin,
}));

// Mock the logger to suppress output during tests
vi.mock('../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.ts';

describe('authMiddleware', () => {
  let req: any;
  let res: any;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { headers: {}, cookies: {} } as any;
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    next = vi.fn();
  });

  // ============================================
  // COOKIE-BASED AUTH (Strategy 1)
  // ============================================

  it('should set req.user from cookie-based auth when valid', async () => {
    const mockUser = {
      id: 'user-uuid-123',
      email: 'test@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    };
    mocks.mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mocks.mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'cookie-access-token-abc' } },
      error: null,
    });

    await authMiddleware(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledTimes(1);
    // Should not attempt Bearer token fallback
    expect(mocks.mockAdminGetUser).not.toHaveBeenCalled();
  });

  it('should set req.accessToken from cookie-based session', async () => {
    const mockUser = { id: 'user-uuid-456', email: 'user@test.com' };
    const accessToken = 'session-access-token-xyz';
    mocks.mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mocks.mockGetSession.mockResolvedValue({
      data: { session: { access_token: accessToken } },
      error: null,
    });

    await authMiddleware(req, res, next);

    expect(req.accessToken).toBe(accessToken);
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should handle cookie auth returning no session gracefully', async () => {
    const mockUser = { id: 'user-uuid-789', email: 'nosession@test.com' };
    mocks.mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mocks.mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await authMiddleware(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(req.accessToken).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  // ============================================
  // BEARER TOKEN FALLBACK (Strategy 2)
  // ============================================

  it('should fall back to Bearer token when no cookie auth', async () => {
    // Cookie auth returns no user
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const bearerUser = { id: 'bearer-user-123', email: 'bearer@test.com' };
    mocks.mockAdminGetUser.mockResolvedValue({
      data: { user: bearerUser },
      error: null,
    });

    req.headers = { authorization: 'Bearer valid-token-abc123' };

    await authMiddleware(req, res, next);

    expect(mocks.mockAdminGetUser).toHaveBeenCalledWith('valid-token-abc123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should set req.user from Bearer token', async () => {
    // Cookie auth returns no user
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const bearerUser = {
      id: 'bearer-user-456',
      email: 'apiuser@test.com',
      role: 'authenticated',
    };
    mocks.mockAdminGetUser.mockResolvedValue({
      data: { user: bearerUser },
      error: null,
    });

    req.headers = { authorization: 'Bearer my-api-token' };

    await authMiddleware(req, res, next);

    expect(req.user).toEqual(bearerUser);
    expect(req.accessToken).toBe('my-api-token');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should continue without user when Bearer token is invalid', async () => {
    // Cookie auth returns no user
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    mocks.mockAdminGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token', status: 401 },
    });

    req.headers = { authorization: 'Bearer expired-or-bad-token' };

    await authMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(req.accessToken).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    // Should not return an error response -- let the route decide
    expect(res.status).not.toHaveBeenCalled();
  });

  // ============================================
  // NO AUTH CREDENTIALS
  // ============================================

  it('should continue without user when no auth credentials', async () => {
    // Cookie auth returns no user
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    // No Authorization header set on req
    await authMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(req.accessToken).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should handle missing Authorization header gracefully', async () => {
    // Cookie auth returns no user (data is null)
    mocks.mockGetUser.mockResolvedValue({
      data: null,
      error: { message: 'no cookie' },
    });

    // No authorization header at all
    req.headers = {};

    await authMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(req.accessToken).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(mocks.mockAdminGetUser).not.toHaveBeenCalled();
  });

  it('should ignore Authorization header that does not start with Bearer', async () => {
    // Cookie auth returns no user
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    req.headers = { authorization: 'Basic dXNlcjpwYXNzd29yZA==' };

    await authMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(mocks.mockAdminGetUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  // ============================================
  // FAIL-CLOSED (503 on exceptions)
  // ============================================

  it('should return 503 when auth service throws (fail-closed)', async () => {
    mocks.mockCreateSupabaseReqResClient.mockImplementation(() => {
      throw new Error('Supabase connection failed');
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication service unavailable',
    });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('should return 503 when cookie getUser rejects with exception', async () => {
    // Restore the factory so createSupabaseReqResClient returns a client
    mocks.mockCreateSupabaseReqResClient.mockReturnValue(mocks.mockReqResClient);

    mocks.mockGetUser.mockRejectedValue(new Error('Network timeout'));

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication service unavailable',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 503 when admin getUser rejects during Bearer fallback', async () => {
    // Cookie auth returns no user (triggers Bearer fallback)
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    mocks.mockAdminGetUser.mockRejectedValue(new Error('Admin client crashed'));

    req.headers = { authorization: 'Bearer some-token' };

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication service unavailable',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ============================================
  // MISC / EDGE CASES
  // ============================================

  it('should call createSupabaseReqResClient with req and res', async () => {
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await authMiddleware(req, res, next);

    expect(mocks.mockCreateSupabaseReqResClient).toHaveBeenCalledWith(req, res);
  });

  it('should not call getSession when cookie user is null', async () => {
    mocks.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await authMiddleware(req, res, next);

    expect(mocks.mockGetSession).not.toHaveBeenCalled();
  });
});

describe('optionalAuthMiddleware', () => {
  it('should be the same function as authMiddleware', () => {
    expect(optionalAuthMiddleware).toBe(authMiddleware);
  });
});
