/**
 * API Client
 * Wrapper around fetch for making requests to the backend API
 * Handles cookie-based authentication
 */

import type { ApiResponse } from '../types';

// Get backend URL from environment
const BACKEND_URL =
  typeof window !== 'undefined' ? import.meta.env.VITE_BACKEND_URL : process.env.VITE_BACKEND_URL;

/**
 * Base fetch function with common configuration
 */
async function baseFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${BACKEND_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // CRITICAL: Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return data;
}

/**
 * GET request
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return baseFetch<T>(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export async function post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return baseFetch<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request
 */
export async function put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return baseFetch<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request
 */
export async function patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return baseFetch<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export async function del<T>(endpoint: string): Promise<ApiResponse<T>> {
  return baseFetch<T>(endpoint, { method: 'DELETE' });
}

/**
 * API client object with all methods
 */
export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
};

export default apiClient;
