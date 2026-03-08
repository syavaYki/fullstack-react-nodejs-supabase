import { z } from 'zod';
import { emailSchema } from './common.schemas.js';

export const contactSubmissionSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  email: emailSchema,
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

export const newsletterSubscribeSchema = z.object({
  email: emailSchema,
  source: z.string().max(50).default('website'),
});
