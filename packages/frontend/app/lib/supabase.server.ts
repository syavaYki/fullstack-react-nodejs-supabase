/**
 * Supabase Server Client
 * Used in React Router loaders and actions for SSR
 */

import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from '@supabase/ssr';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client for server-side use in loaders/actions
 * Handles cookie-based authentication
 */
export function createSupabaseServerClient(request: Request) {
  const headers = new Headers();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = parseCookieHeader(request.headers.get('Cookie') ?? '');
        // Filter out cookies with undefined values
        return cookies.filter((c): c is { name: string; value: string } => c.value !== undefined);
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(
          ({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            headers.append('Set-Cookie', serializeCookieHeader(name, value, options));
          }
        );
      },
    },
  });

  return { supabase, headers };
}

/**
 * Gets the current user session from a request
 * Returns null if not authenticated
 */
export async function getSession(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error.message);
    return { session: null, headers };
  }

  return { session, headers };
}

/**
 * Gets the current user from a request
 * Returns null if not authenticated
 */
export async function getUser(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting user:', error.message);
    return { user: null, headers };
  }

  return { user, headers };
}

/**
 * Requires authentication in a loader/action
 * Throws redirect to login if not authenticated
 */
export async function requireAuth(request: Request) {
  const { session, headers } = await getSession(request);

  if (!session) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw new Response(null, {
      status: 302,
      headers: {
        ...Object.fromEntries(headers.entries()),
        Location: `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  return { session, headers };
}
