import { z } from 'zod';
import { lenientUrlSchema } from './common.schemas.js';

export const updateProfileSchema = z
  .object({
    first_name: z.string().min(1).max(50).optional(),
    last_name: z.string().min(1).max(50).optional(),
    avatar_url: z.string().url().optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    company: z.string().max(100).optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    website: lenientUrlSchema,
  })
  .strict();
