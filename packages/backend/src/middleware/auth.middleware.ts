import { Response, NextFunction } from 'express';
import { supabaseAdmin, createSupabaseReqResClient } from '../config/supabase.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * Middleware to verify Supabase auth via cookies or Bearer token
 *
 * Authentication Priority:
 * 1. Cookies (browser clients) - uses @supabase/ssr for auto-refresh
 * 2. Authorization header (API clients) - Bearer token
 *
 * Cookie-based auth automatically refreshes expired tokens and sets
 * new cookies on the response.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try cookie-based auth first (browser clients)
    // This uses @supabase/ssr which automatically handles token refresh
    const supabase = createSupabaseReqResClient(req, res);
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();

    if (cookieUser && !cookieError) {
      req.user = cookieUser;
      // Get the session for the access token
      const { data: { session } } = await supabase.auth.getSession();
      req.accessToken = session?.access_token;
      return next();
    }

    // 2. Fallback to Authorization header (API clients)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (data.user && !error) {
        req.user = data.user;
        req.accessToken = token;
        return next();
      }
    }

    // No valid authentication found
    res.status(401).json({
      success: false,
      error: 'Not authenticated',
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no auth, just attaches user if present
 * Useful for routes that work with or without authentication
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try cookie-based auth first
    const supabase = createSupabaseReqResClient(req, res);
    const { data: { user: cookieUser } } = await supabase.auth.getUser();

    if (cookieUser) {
      req.user = cookieUser;
      const { data: { session } } = await supabase.auth.getSession();
      req.accessToken = session?.access_token;
      return next();
    }

    // 2. Fallback to Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data } = await supabaseAdmin.auth.getUser(token);

      if (data.user) {
        req.user = data.user;
        req.accessToken = token;
      }
    }

    // Continue regardless of auth status
    next();
  } catch {
    // Continue without user on error
    next();
  }
}
