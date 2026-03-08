import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { createSupabaseReqResClient, supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Auth middleware: validates JWT and sets req.user.
 * 1. Tries cookie-based auth (browser sessions via @supabase/ssr)
 * 2. Falls back to Authorization: Bearer token (API clients)
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Strategy 1: Cookie-based auth (browser sessions)
    const supabaseReqRes = createSupabaseReqResClient(req, res);
    const { data: cookieData } = await supabaseReqRes.auth.getUser();

    if (cookieData?.user) {
      req.user = cookieData.user;
      const { data: sessionData } = await supabaseReqRes.auth.getSession();
      req.accessToken = sessionData?.session?.access_token;
      return next();
    }

    // Strategy 2: Bearer token (API clients, mobile)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: tokenData, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !tokenData?.user) {
        logger.debug('AUTH', 'Bearer token invalid', { error: error?.message });
        return next(); // Continue without auth — route can decide if auth is required
      }

      req.user = tokenData.user;
      req.accessToken = token;
      return next();
    }

    // No auth credentials found — continue without user
    next();
  } catch (error) {
    logger.logError('AUTH', 'Auth middleware error', error);
    res.status(503).json({ success: false, error: 'Authentication service unavailable' });
  }
}

/**
 * Optional auth — same as authMiddleware but explicitly signals
 * that the route works with or without authentication.
 */
export const optionalAuthMiddleware = authMiddleware;
