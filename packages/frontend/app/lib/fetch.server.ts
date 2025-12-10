/**
 * Server-side fetch utilities for React Router loaders/actions
 * These manually forward cookies since server-side fetch doesn't have browser cookie jar
 */

import type { ApiResponse } from '~/types';

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface ServerFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
}

/**
 * Server-side fetch with cookie forwarding
 * Extracts cookies from incoming request and forwards to backend
 * Supports all HTTP methods for use in loaders and actions
 */
export async function serverFetch<T>(
  endpoint: string,
  request: Request,
  options: ServerFetchOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body } = options;
  const cookieHeader = request.headers.get('Cookie');

  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return await response.json();
  } catch (error) {
    console.error('[ServerFetch] Error:', endpoint, error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Fetch with cookie forwarding for server-side loaders (GET only)
 * Extracts cookies from incoming request and forwards to backend
 */
export async function fetchWithCookies<T>(endpoint: string, request: Request): Promise<T | null> {
  const result = await serverFetch<T>(endpoint, request);
  return result.success ? (result.data ?? null) : null;
}
