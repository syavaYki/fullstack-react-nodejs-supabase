import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.middleware.js';

// Simple in-memory rate limiter
// For production with multiple instances, consider Redis-based solution
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown',
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

      return next();
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > maxRequests) {
      throw new ApiError(429, message);
    }

    next();
  };
}

/**
 * Pre-configured rate limiter for contact form
 * 10 submissions per IP per 15 minutes
 */
export const contactFormRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many contact form submissions. Please try again in 15 minutes.',
});

/**
 * Pre-configured rate limiter for user registration
 * 5 attempts per IP per 15 minutes to prevent mass account creation
 */
export const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many registration attempts. Please try again in 15 minutes.',
});

/**
 * Pre-configured rate limiter for login attempts
 * 10 attempts per IP per 15 minutes to prevent brute force attacks
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

/**
 * Pre-configured rate limiter for password reset requests
 * 3 attempts per IP per 15 minutes to prevent abuse
 */
export const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
  message: 'Too many password reset requests. Please try again in 15 minutes.',
});
