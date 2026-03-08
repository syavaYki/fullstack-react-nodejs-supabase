/**
 * @file requireUser.middleware.test.ts
 * @description Tests for requireUser guard middleware and assertUser helper.
 *
 * The middleware:
 * 1. Checks if req.user is set (truthy)
 * 2. Returns 401 JSON response when req.user is missing
 * 3. Calls next() when req.user exists
 *
 * Also tests the assertUser type guard helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUser, assertUser } from '../middleware/requireUser.middleware.ts';

describe('requireUser', () => {
  let req: any;
  let res: any;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {} as any;
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    next = vi.fn();
  });

  // ============================================
  // SUCCESS: req.user exists
  // ============================================

  it('should call next() when req.user exists', () => {
    req.user = {
      id: 'user-uuid-123',
      email: 'test@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    };

    requireUser(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should not modify the response when req.user exists', () => {
    req.user = { id: 'user-uuid-456', email: 'another@example.com' };

    requireUser(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // ============================================
  // FAILURE: req.user is missing
  // ============================================

  it('should return 401 when req.user is undefined', () => {
    // req.user is not set (undefined by default)
    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when req.user is null', () => {
    req.user = null;

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should set correct error format in 401 response', () => {
    // req.user is undefined
    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    });
  });

  it('should not call next() when returning 401', () => {
    requireUser(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  // ============================================
  // EDGE CASES
  // ============================================

  it('should treat empty string user as falsy and return 401', () => {
    req.user = '';

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should treat zero user as falsy and return 401', () => {
    req.user = 0;

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('assertUser', () => {
  it('should not throw when given a valid user object with id', () => {
    const user = { id: 'user-uuid-789', email: 'valid@example.com' };

    expect(() => assertUser(user)).not.toThrow();
  });

  it('should throw when given null', () => {
    expect(() => assertUser(null)).toThrow('User not authenticated');
  });

  it('should throw when given undefined', () => {
    expect(() => assertUser(undefined)).toThrow('User not authenticated');
  });

  it('should throw when given an object without id', () => {
    const user = { email: 'no-id@example.com' };

    expect(() => assertUser(user)).toThrow('User not authenticated');
  });

  it('should throw when given a non-object value', () => {
    expect(() => assertUser('string-value')).toThrow('User not authenticated');
    expect(() => assertUser(42)).toThrow('User not authenticated');
  });
});
