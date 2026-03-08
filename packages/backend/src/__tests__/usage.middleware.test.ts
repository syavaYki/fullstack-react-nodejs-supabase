/* eslint-disable @typescript-eslint/ban-types */
/**
 * @file usage.middleware.test.ts
 * @description Tests for usage middleware (enforceLimit, checkUsageQuota, enforceCollectionLimit).
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Each test uses createMockRequest/Response/Next from mock factories.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock values so they're available in vi.mock factory
const mocks = vi.hoisted(() => {
  const selectMock = vi.fn();
  const eqMock = vi.fn();

  // Chainable query builder: from(table).select(...).eq(...)
  selectMock.mockReturnValue({ eq: eqMock });
  eqMock.mockResolvedValue({ count: 5, error: null });

  return {
    supabaseAdmin: {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue({ select: selectMock }),
    },
    selectMock,
    eqMock,
  };
});

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
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

vi.mock('../constants/index.ts', () => ({
  COLLECTION_TABLE_MAP: {
    max_projects: 'projects',
    max_teams: 'teams',
  } as Record<string, string>,
}));

import {
  enforceLimit,
  checkUsageQuota,
  enforceCollectionLimit,
} from '../middleware/usage.middleware.ts';
import { createMockRequest, createMockResponse, createMockNext } from './mocks/index.ts';

// ============================================
// enforceLimit
// ============================================

describe('enforceLimit middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();

    // Re-establish chainable mock after clearAllMocks
    mocks.selectMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.supabaseAdmin.from.mockReturnValue({ select: mocks.selectMock });
  });

  it('should return 401 when no user is present', async () => {
    mockReq = createMockRequest({ user: null });

    const middleware = enforceLimit('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Authentication required',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when feature is not available (empty data)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: [], error: null });

    const middleware = enforceLimit('unknown_feature');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Feature not available on your plan',
        code: 'FEATURE_NOT_AVAILABLE',
        feature_key: 'unknown_feature',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when feature data is null', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });

    const middleware = enforceLimit('unknown_feature');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FEATURE_NOT_AVAILABLE',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 429 when usage is at the limit', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10, current_usage: 10 }],
      error: null,
    });

    const middleware = enforceLimit('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Usage limit exceeded',
        code: 'USAGE_LIMIT_EXCEEDED',
        feature_key: 'example_limit',
        current_usage: 10,
        usage_limit: 10,
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 429 when usage exceeds the limit', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 5, current_usage: 7 }],
      error: null,
    });

    const middleware = enforceLimit('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when usage is under the limit', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10, current_usage: 3 }],
      error: null,
    });

    const middleware = enforceLimit('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next() when usage_limit is -1 (unlimited)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: -1, current_usage: 9999 }],
      error: null,
    });

    const middleware = enforceLimit('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should register res.on("finish") listener for auto-increment', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10, current_usage: 3 }],
      error: null,
    });

    const middleware = enforceLimit('example_limit', true);
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should auto-increment usage on 2xx response via finish listener', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10, current_usage: 3 }],
      error: null,
    });

    const finishCallbacks: Function[] = [];
    mockRes.on = vi.fn().mockImplementation((event: string, cb: Function) => {
      if (event === 'finish') finishCallbacks.push(cb);
    });

    const middleware = enforceLimit('example_limit', true);
    await middleware(mockReq as any, mockRes as any, mockNext);

    // Simulate a successful response
    mockRes.statusCode = 200;

    // The increment RPC should resolve
    mocks.supabaseAdmin.rpc.mockResolvedValue({ error: null });

    await finishCallbacks[0]?.();

    // The second rpc call is for the increment
    expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith(
      'check_reset_and_increment_usage',
      expect.objectContaining({
        p_user_id: 'user-uuid-123',
        p_feature_key: 'example_limit',
      })
    );
  });

  it('should NOT call increment RPC on non-2xx response', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10, current_usage: 3 }],
      error: null,
    });

    const finishCallbacks: Function[] = [];
    mockRes.on = vi.fn().mockImplementation((event: string, cb: Function) => {
      if (event === 'finish') finishCallbacks.push(cb);
    });

    const middleware = enforceLimit('example_limit', true);
    await middleware(mockReq as any, mockRes as any, mockNext);

    // Reset the rpc mock call count after the initial get_feature_limit call
    mocks.supabaseAdmin.rpc.mockClear();

    // Simulate a failed response
    mockRes.statusCode = 400;
    await finishCallbacks[0]?.();

    // The increment RPC should NOT have been called
    expect(mocks.supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('should return 500 on exception (fail-closed)', async () => {
    mocks.supabaseAdmin.rpc.mockRejectedValue(new Error('Connection lost'));

    const middleware = enforceLimit('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Failed to check usage limit',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});

// ============================================
// checkUsageQuota
// ============================================

describe('checkUsageQuota middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();

    mocks.selectMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.supabaseAdmin.from.mockReturnValue({ select: mocks.selectMock });
  });

  it('should call next() when under the limit (same as enforceLimit)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10, current_usage: 2 }],
      error: null,
    });

    const middleware = checkUsageQuota('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should NOT register res.on("finish") listener (no auto-increment)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10, current_usage: 2 }],
      error: null,
    });

    const middleware = checkUsageQuota('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.on).not.toHaveBeenCalled();
  });

  it('should return 429 when at the limit', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 5, current_usage: 5 }],
      error: null,
    });

    const middleware = checkUsageQuota('example_limit');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'USAGE_LIMIT_EXCEEDED',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });
});

// ============================================
// enforceCollectionLimit
// ============================================

describe('enforceCollectionLimit middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();

    // Re-establish chainable mock after clearAllMocks
    mocks.selectMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.supabaseAdmin.from.mockReturnValue({ select: mocks.selectMock });
  });

  it('should return 401 when no user is present', async () => {
    mockReq = createMockRequest({ user: null });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Authentication required',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when featureKey has no mapped table', async () => {
    const middleware = enforceCollectionLimit('unmapped_feature');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mocks.supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('should return 403 when feature is not available (empty data)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: [], error: null });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Feature not available on your plan',
        code: 'FEATURE_NOT_AVAILABLE',
        feature_key: 'max_projects',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when feature data is null', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when usage_limit is -1 (unlimited)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: -1 }],
      error: null,
    });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // Should NOT query the collection table
    expect(mocks.supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('should return 429 when at the collection limit', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 5 }],
      error: null,
    });
    mocks.eqMock.mockResolvedValue({ count: 5, error: null });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Collection limit reached',
        code: 'USAGE_LIMIT_EXCEEDED',
        feature_key: 'max_projects',
        current_usage: 5,
        usage_limit: 5,
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 429 when over the collection limit', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 3 }],
      error: null,
    });
    mocks.eqMock.mockResolvedValue({ count: 7, error: null });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when under the collection limit', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10 }],
      error: null,
    });
    mocks.eqMock.mockResolvedValue({ count: 3, error: null });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should query the correct table from COLLECTION_TABLE_MAP', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10 }],
      error: null,
    });
    mocks.eqMock.mockResolvedValue({ count: 2, error: null });

    const middleware = enforceCollectionLimit('max_teams');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('teams');
    expect(mocks.selectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(mocks.eqMock).toHaveBeenCalledWith('user_id', 'user-uuid-123');
  });

  it('should return 503 on DB error counting collection (fail-closed)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 10 }],
      error: null,
    });
    mocks.eqMock.mockResolvedValue({
      count: null,
      error: { message: 'Table not found' },
    });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Usage service temporarily unavailable',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 503 on exception (fail-closed)', async () => {
    mocks.supabaseAdmin.rpc.mockRejectedValue(new Error('Network timeout'));

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Usage service temporarily unavailable',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should treat null count as 0 (under limit)', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: [{ usage_limit: 5 }],
      error: null,
    });
    mocks.eqMock.mockResolvedValue({ count: null, error: null });

    const middleware = enforceCollectionLimit('max_projects');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
