import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * Middleware that requires an authenticated user to be present on the request.
 * Use this after authMiddleware to ensure req.user is defined.
 *
 * @example
 * // Use in route definition:
 * router.get('/profile', authMiddleware, requireUser, asyncHandler(async (req, res) => {
 *   // req.user is guaranteed to be defined here
 *   const profile = await getProfile(req.user.id);
 * }));
 *
 * @param req - Express request with optional user
 * @param res - Express response
 * @param next - Express next function
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

/**
 * Type guard helper to assert user is present.
 * Use when you need TypeScript to narrow the type within a handler.
 *
 * @example
 * if (!assertUser(req, res)) return;
 * // req.user is now guaranteed to be defined
 *
 * @param req - Express request with optional user
 * @param res - Express response
 * @returns true if user exists, false if response was sent
 */
export function assertUser(
  req: AuthenticatedRequest,
  res: Response
): req is AuthenticatedRequest & { user: NonNullable<AuthenticatedRequest['user']> } {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return false;
  }
  return true;
}
