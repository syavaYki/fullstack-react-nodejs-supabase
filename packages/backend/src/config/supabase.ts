import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Request, Response } from 'express';
import { env } from './env.js';

// Lazy-initialized clients — created on first access so the server can start
// without Supabase credentials (features will fail at request time).
let _supabaseClient: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

/** Anon client — respects RLS policies */
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
}

/** Admin client — bypasses RLS (service_role key) */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabaseAdmin;
}

// Backwards-compatible exports — lazy getters
export const supabaseClient: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** Create a client with a specific user's JWT for RLS-aware queries */
export function createSupabaseClientWithAuth(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/**
 * Create an SSR-compatible client from Express req/res.
 * Reads/writes auth cookies for browser-based sessions.
 */
export function createSupabaseReqResClient(req: Request, res: Response): SupabaseClient {
  // Extract cookie domain for cross-subdomain sharing
  const frontendUrl = new URL(env.FRONTEND_URL);
  const hostParts = frontendUrl.hostname.split('.');
  const cookieDomain =
    hostParts.length > 2 ? `.${hostParts.slice(-2).join('.')}` : frontendUrl.hostname;

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () =>
        Object.entries(req.cookies || {}).map(([name, value]) => ({
          name,
          value: value as string,
        })),
      setAll: (cookies: { name: string; value: string; options?: CookieOptions }[]) => {
        cookies.forEach(({ name, value, options }) => {
          res.cookie(name, value, {
            ...options,
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: env.NODE_ENV === 'production' ? cookieDomain : undefined,
            path: '/',
          });
        });
      },
    },
  });
}
