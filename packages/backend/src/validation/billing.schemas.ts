import { z } from 'zod';
import { uuidSchema, safeRedirectUrlSchema } from './common.schemas.js';

export const checkoutSchema = z.object({
  tier_id: uuidSchema,
  billing_cycle: z.enum(['monthly', 'yearly']),
  success_url: safeRedirectUrlSchema.optional(),
  cancel_url: safeRedirectUrlSchema.optional(),
  skip_trial: z.boolean().optional(),
});

export const convertTrialSchema = z.object({
  tier_id: uuidSchema,
  billing_cycle: z.enum(['monthly', 'yearly']),
});
