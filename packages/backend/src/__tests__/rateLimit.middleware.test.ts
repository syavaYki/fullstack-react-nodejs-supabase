/**
 * @file rateLimit.middleware.test.ts
 * @description Tests for the in-memory rate limiter middleware (createRateLimit).
 *
 * No external mocks needed -- the rate limiter is a pure in-memory middleware
 * with no database or external dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimit } from '../middleware/rateLimit.middleware.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockReq(ip = '127.0.0.1'): any {
  return { ip, headers: {}, socket: { remoteAddress: ip } };
}

function createMockRes(): any {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('createRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests under the rate limit', () => {
    const limiter = createRateLimit({ windowMs: 60_000, max: 3 });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // Make 3 requests (at the limit, but not over)
    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should block requests over the rate limit with 429', () => {
    const limiter = createRateLimit({
      windowMs: 60_000,
      max: 2,
      message: 'Rate limit exceeded',
    });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // Make 2 allowed requests
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);

    // 3rd request should be blocked
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2); // still 2, not 3
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Rate limit exceeded',
    });
  });

  it('should use default message when none is provided', () => {
    const limiter = createRateLimit({ windowMs: 60_000, max: 1 });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // First request passes
    limiter(req, res, next);
    // Second request is blocked
    limiter(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Too many requests, please try again later',
    });
  });

  it('should track different IPs separately', () => {
    const limiter = createRateLimit({ windowMs: 60_000, max: 1 });
    const next = vi.fn();

    // IP 1: first request passes
    const req1 = createMockReq('192.168.1.1');
    const res1 = createMockRes();
    limiter(req1, res1, next);
    expect(next).toHaveBeenCalledTimes(1);

    // IP 2: first request passes (separate counter)
    const req2 = createMockReq('192.168.1.2');
    const res2 = createMockRes();
    limiter(req2, res2, next);
    expect(next).toHaveBeenCalledTimes(2);

    // IP 1: second request is blocked
    const res1b = createMockRes();
    limiter(req1, res1b, next);
    expect(next).toHaveBeenCalledTimes(2); // still 2
    expect(res1b.status).toHaveBeenCalledWith(429);

    // IP 2: second request is also blocked
    const res2b = createMockRes();
    limiter(req2, res2b, next);
    expect(next).toHaveBeenCalledTimes(2); // still 2
    expect(res2b.status).toHaveBeenCalledWith(429);
  });

  it('should reset after the time window expires', () => {
    const windowMs = 60_000;
    const limiter = createRateLimit({ windowMs, max: 1 });
    const req = createMockReq();
    const next = vi.fn();

    // First request passes
    const res1 = createMockRes();
    limiter(req, res1, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second request is blocked
    const res2 = createMockRes();
    limiter(req, res2, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res2.status).toHaveBeenCalledWith(429);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // After window expires, request should pass again
    const res3 = createMockRes();
    limiter(req, res3, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res3.status).not.toHaveBeenCalled();
  });

  it('should not reset before the time window expires', () => {
    const windowMs = 60_000;
    const limiter = createRateLimit({ windowMs, max: 1 });
    const req = createMockReq();
    const next = vi.fn();

    // First request passes
    const res1 = createMockRes();
    limiter(req, res1, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Advance time but NOT past the window
    vi.advanceTimersByTime(windowMs - 1);

    // Should still be blocked
    const res2 = createMockRes();
    limiter(req, res2, next);
    expect(next).toHaveBeenCalledTimes(1); // still blocked
    expect(res2.status).toHaveBeenCalledWith(429);
  });

  it('should use req.socket.remoteAddress as fallback when req.ip is undefined', () => {
    const limiter = createRateLimit({ windowMs: 60_000, max: 1 });
    const req = { ip: undefined, headers: {}, socket: { remoteAddress: '10.0.0.1' } } as any;
    const res = createMockRes();
    const next = vi.fn();

    // First request passes
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second request from same remoteAddress should be blocked
    const res2 = createMockRes();
    limiter(req, res2, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res2.status).toHaveBeenCalledWith(429);
  });

  it('should block all subsequent requests once rate limit is exceeded', () => {
    const limiter = createRateLimit({ windowMs: 60_000, max: 2 });
    const req = createMockReq();
    const next = vi.fn();

    // Use up the limit
    limiter(req, createMockRes(), next);
    limiter(req, createMockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);

    // Multiple subsequent requests should all be blocked
    for (let i = 0; i < 5; i++) {
      const res = createMockRes();
      limiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    }
    expect(next).toHaveBeenCalledTimes(2); // still only 2
  });
});
