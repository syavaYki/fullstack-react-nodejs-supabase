import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter.
 * For production, use Redis-backed rate limiting.
 */
export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later' } = options;
  const store = new Map<string, RateLimitEntry>();

  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) store.delete(key);
    }
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      res.status(429).json({ success: false, error: message });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters
export const contactFormRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many contact form submissions. Please try again later.',
});

export const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again later.',
});

export const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

export const forgotPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many password reset requests. Please try again later.',
});

export const bugReportRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many bug reports. Please try again in 15 minutes.',
});

/** Alias for createRateLimit — matches Phase 2 naming convention */
export const rateLimit = createRateLimit;
