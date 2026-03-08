/**
 * @file env.ts
 * @description Zod-validated environment variables for the frontend.
 */

import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().default(''),
  VITE_SUPABASE_ANON_KEY: z.string().default(''),
  VITE_BACKEND_URL: z.string().default('http://localhost:3001'),
});

function getEnvSource(): Record<string, string | undefined> {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env as unknown as Record<string, string | undefined>;
  }
  return process.env as Record<string, string | undefined>;
}

const result = envSchema.safeParse(getEnvSource());

if (!result.success) {
  console.warn('⚠  Frontend env validation failed:', result.error.format());
}

const parsed = result.success ? result.data : envSchema.parse({});

if (!parsed.VITE_SUPABASE_URL || !parsed.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '⚠  Missing: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY — auth features will not work.'
  );
}

export const env = parsed;
