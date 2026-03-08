import { z } from 'zod';
import { env } from '../config/env.js';

export const emailSchema = z.string().email('Invalid email address').trim().toLowerCase();

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const lenientUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      try {
        new URL(val.startsWith('http') ? val : `https://${val}`);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid URL format' }
  )
  .optional();

/** Ensures redirect URLs only go to our frontend */
export const safeRedirectUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        const frontendOrigin = new URL(env.FRONTEND_URL);
        return parsed.origin === frontendOrigin.origin;
      } catch {
        return false;
      }
    },
    { message: 'Redirect URL must be on the same origin' }
  );

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const stringArraySchema = z.preprocess(
  (val) =>
    typeof val === 'string'
      ? val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : val,
  z.array(z.string())
);
