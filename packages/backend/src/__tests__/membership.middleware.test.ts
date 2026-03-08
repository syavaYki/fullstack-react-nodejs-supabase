/**
 * @file membership.middleware.test.ts
 * @description Tests for membership middleware: membershipMiddleware, requireTier, requireFeature.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Each test uses createMockRequest/Response/Next from mock factories.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock values so they're available in vi.mock factory
const mocks = vi.hoisted(() => ({
  supabaseAdmin: {
    rpc: vi.fn(),
  },
}));

// Mock the supabase config module
vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

// Mock logger to suppress output and allow assertion
vi.mock('../utils/logger.ts', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), logError: vi.fn() },
}));

import {
  membershipMiddleware,
  requireTier,
  requireFeature,
} from '../middleware/membership.middleware.ts';
import { createMockRequest, createMockResponse, createMockNext } from './mocks/index.ts';

// ---------------------------------------------------------------------------
// membershipMiddleware
// ---------------------------------------------------------------------------
describe('membershipMiddleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  it('should return 401 when no user is present', async () => {
    mockReq = createMockRequest({ user: null });

    await membershipMiddleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Authentication required' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call RPC with the correct user id', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: [], error: null });

    await membershipMiddleware(mockReq as any, mockRes as any, mockNext);

    expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('get_user_tier_with_features', {
      p_user_id: (mockReq.user as any).id,
    });
  });

  it('should set req.membership when data is returned', async () => {
    const tierData = {
      tier_name: 'premium',
      membership_status: 'active',
      stripe_status: 'active',
      trial_ends_at: null,
    };
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: [tierData], error: null });

    await membershipMiddleware(mockReq as any, mockRes as any, mockNext);

    expect((mockReq as any).membership).toEqual(tierData);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not set req.membership when data is empty', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: [], error: null });

    await membershipMiddleware(mockReq as any, mockRes as any, mockNext);

    expect((mockReq as any).membership).toBeUndefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next() on success even without membership data', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });

    await membershipMiddleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 500 on RPC error', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    });

    await membershipMiddleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to fetch membership information' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 on unexpected exception', async () => {
    mocks.supabaseAdmin.rpc.mockRejectedValue(new Error('Network failure'));

    await membershipMiddleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to verify membership' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireTier
// ---------------------------------------------------------------------------
describe('requireTier middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  it('should return 403 when no membership is on the request', async () => {
    mockReq = createMockRequest(); // no membership property

    const middleware = requireTier('premium');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Membership information not available' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when tier is not in the allowed list', async () => {
    mockReq = createMockRequest({
      membership: {
        tier_name: 'free',
        membership_status: 'active',
        stripe_status: 'active',
        trial_ends_at: null,
      },
    });

    const middleware = requireTier('premium', 'pro');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'This feature requires one of the following tiers: premium, pro',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when membership status is not active', async () => {
    mockReq = createMockRequest({
      membership: {
        tier_name: 'premium',
        membership_status: 'cancelled',
        stripe_status: 'active',
        trial_ends_at: null,
      },
    });

    const middleware = requireTier('premium');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Your membership is not active' })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when trial has expired', async () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString(); // 1 day ago
    mockReq = createMockRequest({
      membership: {
        tier_name: 'premium',
        membership_status: 'active',
        stripe_status: 'trialing',
        trial_ends_at: pastDate,
      },
    });

    const middleware = requireTier('premium');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Your trial has expired. Please upgrade to continue.',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when tier is allowed and membership is active', async () => {
    mockReq = createMockRequest({
      membership: {
        tier_name: 'premium',
        membership_status: 'active',
        stripe_status: 'active',
        trial_ends_at: null,
      },
    });

    const middleware = requireTier('premium');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next() when trialing but trial has not expired', async () => {
    const futureDate = new Date(Date.now() + 86_400_000 * 7).toISOString(); // 7 days from now
    mockReq = createMockRequest({
      membership: {
        tier_name: 'premium',
        membership_status: 'active',
        stripe_status: 'trialing',
        trial_ends_at: futureDate,
      },
    });

    const middleware = requireTier('premium');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should accept any of multiple allowed tiers', async () => {
    mockReq = createMockRequest({
      membership: {
        tier_name: 'pro',
        membership_status: 'active',
        stripe_status: 'active',
        trial_ends_at: null,
      },
    });

    const middleware = requireTier('premium', 'pro');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireFeature
// ---------------------------------------------------------------------------
describe('requireFeature middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  it('should call next() when user has the feature', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: true, error: null });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user does not have the feature', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: false, error: null });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'FEATURE_NOT_AVAILABLE',
        feature_key: 'example_boolean',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when no user is present', async () => {
    mockReq = createMockRequest({ user: null });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'DB connection failed' },
    });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
