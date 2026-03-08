import { z } from 'zod';

export const bugReportSchema = z.object({
  name: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be less than 5000 characters'),
  page_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

export type BugReportSchemaInput = z.infer<typeof bugReportSchema>;
