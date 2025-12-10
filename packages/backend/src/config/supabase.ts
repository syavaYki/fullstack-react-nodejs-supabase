import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, CookieOptions } from '@supabase/ssr';
import { Request, Response } from 'express';
import { env } from './env.js';

/**
 * Get the parent domain for cookie sharing across subdomains
 * e.g., "https://project-template.podolskiy.dev" -> ".podolskiy.dev"
 */
function getParentDomain(): string {
  try {
    const url = new URL(env.FRONTEND_URL);
    const parts = url.hostname.split('.');
    if (parts.length >= 2) {
      return '.' + parts.slice(-2).join('.');
    }
    return url.hostname;
  } catch {
    return '';
  }
}

const cookieDomain = getParentDomain();

// Client for user-context operations (uses anon key, respects RLS)
export const supabaseClient: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create a client with user's JWT for RLS-protected queries
export function createSupabaseClientWithAuth(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Create a Supabase client with cookie context for request/response
 * Used for cookie-based authentication - reads cookies from request
 * and sets refreshed cookies on response automatically
 */
export function createSupabaseReqResClient(req: Request, res: Response) {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => {
        // Parse cookies from request
        const cookies = req.cookies || {};
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value: value as string,
        }));
      },
      setAll: (cookies: { name: string; value: string; options?: CookieOptions }[]) => {
        // Set cookies on response (for token refresh)
        cookies.forEach(({ name, value, options }) => {
          res.cookie(name, value, {
            ...options,
            // Set domain for cross-subdomain cookie sharing
            domain: cookieDomain,
            // Ensure secure cookies in production
            secure: env.NODE_ENV === 'production',
            // httpOnly for auth cookies
            httpOnly: true,
            // SameSite=None required for cross-origin cookies
            sameSite: 'none',
          });
        });
      },
    },
  });
}
