import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { User } from '@supabase/supabase-js';

/**
 * Guard middleware: returns 401 if req.user is not set.
 * Must be used after authMiddleware.
 */
export function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }
  next();
}

/** Type guard helper for req.user in route handlers */
export function assertUser(user: unknown): asserts user is User {
  if (!user || typeof user !== 'object' || !('id' in user)) {
    throw new Error('User not authenticated');
  }
}
