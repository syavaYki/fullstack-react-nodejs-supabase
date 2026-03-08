import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().optional(),

  // URLs
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().default('http://localhost:3001'),

  // Supabase
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  // Stripe
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),

  // Hostinger SMTP
  HOSTINGER_SMTP_HOST: z.string().default('smtp.hostinger.com'),
  HOSTINGER_SMTP_PORT: z.string().default('465'),
  HOSTINGER_SMTP_SECURE: z.string().default('true'),
  HOSTINGER_SMTP_USER: z.string().default(''),
  HOSTINGER_SMTP_PASSWORD: z.string().default(''),
  HOSTINGER_FROM_EMAIL: z.string().default(''),
  HOSTINGER_FROM_NAME: z.string().default(''),

  // Email
  CONTACT_NOTIFICATION_EMAIL: z.string().default(''),
});

const parsed = envSchema.parse(process.env);

// Check for missing service credentials and warn
const missing: Record<string, string[]> = {};

const supabaseVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const stripeVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;

for (const key of supabaseVars) {
  if (!parsed[key]) (missing['Supabase'] ??= []).push(key);
}
for (const key of stripeVars) {
  if (!parsed[key]) (missing['Stripe'] ??= []).push(key);
}

if (Object.keys(missing).length > 0) {
  console.warn('\n⚠  Missing environment variables:');
  for (const [group, vars] of Object.entries(missing)) {
    console.warn(`   ${group}: ${vars.join(', ')}`);
  }
  console.warn(
    '   Server starting anyway — features requiring these services will fail at request time.\n'
  );
}

export const env = parsed;
export type Env = z.infer<typeof envSchema>;
