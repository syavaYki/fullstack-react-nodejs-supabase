# Phase 1: Foundation — Monorepo Scaffold + Database + Backend Core

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a production-ready Express.js + Supabase + Stripe monorepo with auth, profiles, membership tiers, feature gating, usage tracking, and database migrations.

**Architecture:** npm workspaces monorepo. Express backend with layered middleware (auth → membership → usage). Supabase for PostgreSQL + Auth. Stripe for billing. All inputs validated with Zod.

**Tech Stack:** Node.js, Express, TypeScript, Supabase (@supabase/supabase-js, @supabase/ssr), Stripe, Zod, swagger-jsdoc

---

## Token Substitution Table

Before writing any file, replace all `{{TOKENS}}` with your project values:

| Token                      | Purpose                     | Example      |
| -------------------------- | --------------------------- | ------------ |
| `{{PROJECT_NAME}}`         | npm package name, directory | `my-saas`    |
| `{{PROJECT_DISPLAY_NAME}}` | UI headings, meta titles    | `My SaaS`    |
| `{{PROJECT_SLUG}}`         | npm scope prefix            | `my-saas`    |
| `{{DOMAIN}}`               | CORS origins, URLs          | `myapp.com`  |
| `{{TIER_1_NAME}}`          | Free tier internal name     | `free`       |
| `{{TIER_1_DISPLAY}}`       | Free tier display name      | `Starter`    |
| `{{TIER_2_NAME}}`          | Mid tier internal name      | `premium`    |
| `{{TIER_2_DISPLAY}}`       | Mid tier display name       | `Pro`        |
| `{{TIER_2_PRICE_MONTHLY}}` | Mid tier monthly price      | `19.99`      |
| `{{TIER_2_PRICE_YEARLY}}`  | Mid tier yearly price       | `199.99`     |
| `{{TIER_3_NAME}}`          | Top tier internal name      | `pro`        |
| `{{TIER_3_DISPLAY}}`       | Top tier display name       | `Enterprise` |
| `{{TIER_3_PRICE_MONTHLY}}` | Top tier monthly price      | `49.99`      |
| `{{TIER_3_PRICE_YEARLY}}`  | Top tier yearly price       | `499.99`     |

---

## What This Phase Produces

~49 files across root, backend, and database:

**Root (3):** `package.json`, `.env.example`, `.gitignore`
**Backend scaffold (2):** `packages/backend/package.json`, `packages/backend/tsconfig.json`
**Config (4):** `env.ts`, `supabase.ts`, `stripe.ts`, `swagger.ts`
**Types (8):** `shared.types.ts`, `profile.types.ts`, `membership.types.ts`, `billing.types.ts`, `usage.types.ts`, `auth.types.ts`, `contact.types.ts`, `index.ts`
**Utils (6):** `logger.ts`, `response.utils.ts`, `pagination.utils.ts`, `date.utils.ts`, `rpc.utils.ts`, `index.ts`
**Constants (2):** `feature.constants.ts`, `index.ts`
**Validation (6):** `common.schemas.ts`, `auth.schemas.ts`, `profile.schemas.ts`, `billing.schemas.ts`, `contact.schemas.ts`, `index.ts`
**Middleware (6):** `error.middleware.ts`, `auth.middleware.ts`, `requireUser.middleware.ts`, `membership.middleware.ts`, `usage.middleware.ts`, `rateLimit.middleware.ts`
**Services (2):** `auth.service.ts`, `profile.service.ts`
**Routes (3):** `auth.routes.ts`, `profile.routes.ts`, `index.ts`
**Entry (1):** `index.ts`
**Database (6):** `000_cleanup_all.sql` through `005_seed_data.sql`

---

## Implementation

### Step 1.1: Root Monorepo Scaffold

#### File: `package.json`

```json
{
  "name": "{{PROJECT_NAME}}",
  "version": "1.0.0",
  "private": true,
  "description": "{{PROJECT_DISPLAY_NAME}} — Full-stack SaaS with Express, React, Supabase, and Stripe",
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:backend": "npm run dev --workspace=@{{PROJECT_SLUG}}/backend",
    "build:backend": "npm run build --workspace=@{{PROJECT_SLUG}}/backend",
    "start:backend": "npm run start --workspace=@{{PROJECT_SLUG}}/backend",
    "dev:frontend": "npm run dev --workspace=@{{PROJECT_SLUG}}/frontend",
    "build:frontend": "npm run build --workspace=@{{PROJECT_SLUG}}/frontend",
    "start:frontend": "npm run start --workspace=@{{PROJECT_SLUG}}/frontend",
    "typecheck:backend": "npm run typecheck --workspace=@{{PROJECT_SLUG}}/backend",
    "typecheck:frontend": "npm run typecheck --workspace=@{{PROJECT_SLUG}}/frontend",
    "typecheck": "npm run typecheck:backend && npm run typecheck:frontend",
    "dev": "npm run dev:backend & npm run dev:frontend",
    "lint": "eslint \"packages/backend/src\" \"packages/frontend/app\" --ext .ts,.tsx,.js,.cjs",
    "lint:fix": "eslint \"packages/backend/src\" \"packages/frontend/app\" --ext .ts,.tsx,.js,.cjs --fix",
    "format": "prettier --write \"packages/*/src/**/*.{ts,tsx,js,json}\"",
    "format:check": "prettier --check \"packages/*/src/**/*.{ts,tsx,js,json}\""
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0"
  }
}
```

#### File: `.gitignore`

```
# Dependencies
node_modules/
.pnp/
.pnp.js

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local
.env.production

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Logs
logs/
*.log
npm-debug.log*

# Testing
coverage/
.nyc_output/

# Temporary files
temp/
tmp/
*.tmp

# OS files
Thumbs.db
.DS_Store

# Supabase
.supabase/
```

#### File: `.env.example`

```bash
# ============================================
# {{PROJECT_DISPLAY_NAME}} — Environment Variables
# Copy to .env and fill in your values
# ============================================

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

### Step 1.2: Backend Package Scaffold

#### File: `packages/backend/package.json`

```json
{
  "name": "@{{PROJECT_SLUG}}/backend",
  "version": "1.0.0",
  "private": true,
  "description": "{{PROJECT_DISPLAY_NAME}} Express backend with Supabase and Stripe",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.47.12",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "stripe": "^14.10.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/morgan": "^1.9.9",
    "@types/node": "^20.10.0",
    "@types/supertest": "^6.0.3",
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-express": "^4.1.6",
    "@vitest/coverage-v8": "^2.1.9",
    "supertest": "^7.2.2",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^2.1.0"
  }
}
```

#### File: `packages/backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

---

### Step 1.3: Backend Config

#### File: `packages/backend/src/config/env.ts`

Zod-validated environment variables. App crashes at startup if any required var is missing.

```typescript
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().optional(),

  // URLs
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation failed:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
```

#### File: `packages/backend/src/config/supabase.ts`

Three client pattern: anon (RLS-respecting), admin (service_role bypass), per-request (cookie-based SSR auth).

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Request, Response } from 'express';
import { env } from './env.js';

/** Anon client — respects RLS policies */
export const supabaseClient: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

/** Admin client — bypasses RLS (service_role key) */
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

/** Create a client with a specific user's JWT for RLS-aware queries */
export function createSupabaseClientWithAuth(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/**
 * Create an SSR-compatible client from Express req/res.
 * Reads/writes auth cookies for browser-based sessions.
 */
export function createSupabaseReqResClient(req: Request, res: Response): SupabaseClient {
  // Extract cookie domain for cross-subdomain sharing
  const frontendUrl = new URL(env.FRONTEND_URL);
  const hostParts = frontendUrl.hostname.split('.');
  const cookieDomain =
    hostParts.length > 2 ? `.${hostParts.slice(-2).join('.')}` : frontendUrl.hostname;

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () =>
        Object.entries(req.cookies || {}).map(([name, value]) => ({
          name,
          value: value as string,
        })),
      setAll: (cookies: { name: string; value: string; options?: CookieOptions }[]) => {
        cookies.forEach(({ name, value, options }) => {
          res.cookie(name, value, {
            ...options,
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: env.NODE_ENV === 'production' ? cookieDomain : undefined,
            path: '/',
          });
        });
      },
    },
  });
}
```

#### File: `packages/backend/src/config/stripe.ts`

```typescript
import Stripe from 'stripe';
import { env } from './env.js';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
```

#### File: `packages/backend/src/config/swagger.ts`

```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '{{PROJECT_DISPLAY_NAME}} API',
      version: '1.0.0',
      description: 'Express API with Supabase Auth, Memberships, and Stripe Billing',
    },
    servers: [
      {
        url: env.BACKEND_URL,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Supabase access token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            full_name: { type: 'string' },
            avatar_url: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            bio: { type: 'string' },
            website: { type: 'string' },
            stripe_customer_id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

---

### Step 1.4: TypeScript Types

#### File: `packages/backend/src/types/shared.types.ts`

```typescript
import { Request } from 'express';
import { User } from '@supabase/supabase-js';

/** Express Request extended with authenticated user info */
export interface AuthenticatedRequest extends Request {
  user?: User;
  accessToken?: string;
}

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Paginated API response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### File: `packages/backend/src/types/auth.types.ts`

```typescript
export interface RegisterInput {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
```

#### File: `packages/backend/src/types/profile.types.ts`

```typescript
export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  company: string | null;
  bio: string | null;
  website: string | null;
  stripe_customer_id: string | null;
  profile_completeness: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  company?: string;
  bio?: string;
  website?: string;
}
```

#### File: `packages/backend/src/types/membership.types.ts`

```typescript
export interface MembershipTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  stripe_product_id: string | null;
  trial_days: number;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  tier_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  started_at: string;
  cancelled_at: string | null;
  cancel_at_period_end: boolean;
  billing_cycle: 'monthly' | 'yearly' | null;
  has_used_trial: boolean;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  stripe_current_period_end: string | null;
  last_synced_at: string | null;
  sync_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTierWithFeatures {
  tier_name: string;
  tier_display_name: string;
  membership_status: string;
  stripe_status: string | null;
  trial_ends_at: string | null;
  features: Record<string, string>;
}

export interface TrialStatus {
  is_on_trial: boolean;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  days_remaining: number;
  has_used_trial: boolean;
  can_start_trial: boolean;
}
```

#### File: `packages/backend/src/types/billing.types.ts`

```typescript
export interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  created: number;
  description: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}
```

#### File: `packages/backend/src/types/usage.types.ts`

```typescript
export type PeriodType = 'daily' | 'monthly' | 'lifetime' | 'none';

export interface UsageTracking {
  id: string;
  user_id: string;
  feature_key: string;
  current_usage: number;
  usage_limit: number;
  period_start: string;
  period_end: string | null;
  period_type: PeriodType;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureUsage {
  feature_key: string;
  feature_name: string;
  current_usage: number;
  usage_limit: number;
  percentage_used: number;
  period_type: PeriodType;
  is_exceeded: boolean;
}
```

#### File: `packages/backend/src/types/contact.types.ts`

```typescript
export interface ContactSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  ip_address: string | null;
  created_at: string;
}
```

#### File: `packages/backend/src/types/index.ts`

```typescript
export * from './shared.types.js';
export * from './auth.types.js';
export * from './profile.types.js';
export * from './membership.types.js';
export * from './billing.types.js';
export * from './usage.types.js';
export * from './contact.types.js';
```

---

### Step 1.5: Utilities

#### File: `packages/backend/src/utils/logger.ts`

```typescript
import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'AUTH'
  | 'DB'
  | 'HTTP'
  | 'STRIPE'
  | 'SYSTEM'
  | 'MEMBERSHIP'
  | 'USAGE'
  | 'CONTACT';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const configuredLevel: LogLevel =
    (env.LOG_LEVEL as LogLevel) || (env.NODE_ENV === 'production' ? 'warn' : 'debug');
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel];
}

function formatLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>
): string {
  const timestamp = env.NODE_ENV === 'development' ? `[${new Date().toISOString()}] ` : '';
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp}[${level.toUpperCase()}] [${category}] ${message}${dataStr}`;
}

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    };
  }
  return { message: String(error) };
}

export const logger = {
  debug: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('debug')) console.log(formatLog('debug', category, message, data));
  },

  info: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('info')) console.log(formatLog('info', category, message, data));
  },

  warn: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('warn')) console.warn(formatLog('warn', category, message, data));
  },

  error: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('error')) console.error(formatLog('error', category, message, data));
  },

  logError: (category: LogCategory, message: string, error: unknown): void => {
    logger.error(category, message, formatError(error));
  },
};

export default logger;
```

#### File: `packages/backend/src/utils/response.utils.ts`

```typescript
/** Standard success response */
export function successResponse<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    ...(message && { message }),
  };
}

/** Standard error response */
export function errorResponse(error: string, details?: Record<string, unknown>) {
  return {
    success: false as const,
    error,
    ...(details && { details }),
  };
}

/** Paginated response */
export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number; totalPages: number },
  message?: string
) {
  return {
    success: true as const,
    data,
    pagination,
    ...(message && { message }),
  };
}

/** Simple message response (no data) */
export function messageResponse(message: string) {
  return {
    success: true as const,
    message,
  };
}

/** Created response (201) */
export function createdResponse<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    ...(message && { message }),
  };
}

/** Deleted response */
export function deletedResponse(message = 'Resource deleted successfully') {
  return {
    success: true as const,
    message,
  };
}
```

#### File: `packages/backend/src/utils/pagination.utils.ts`

```typescript
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function normalizePaginationOptions(
  options?: PaginationOptions
): Required<PaginationOptions> {
  const page = Math.max(1, options?.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, options?.limit ?? DEFAULT_LIMIT));
  return { page, limit };
}

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function createPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  options?: PaginationOptions
): PaginatedResult<T> {
  const { page, limit } = normalizePaginationOptions(options);
  return {
    data,
    pagination: createPaginationMeta(total, page, limit),
  };
}
```

#### File: `packages/backend/src/utils/date.utils.ts`

```typescript
/** Get end of current day in UTC */
export function getEndOfDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );
}

/** Get end of current month in UTC */
export function getEndOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/** Check if a date has passed */
export function isExpired(date: string | Date | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}

/** Add days to a date */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Safe ISO string conversion */
export function toISOString(date: Date | string | null): string | null {
  if (!date) return null;
  return new Date(date).toISOString();
}

/** Parse date string safely */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}
```

#### File: `packages/backend/src/utils/rpc.utils.ts`

```typescript
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from './logger.js';

/** Custom error for RPC failures */
export class RpcError extends Error {
  constructor(
    message: string,
    public code: string,
    public functionName: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/**
 * Call a Supabase RPC function and return the raw data.
 * Throws RpcError on failure.
 */
export async function callRpc<T>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(functionName, params);

  if (error) {
    logger.error('DB', `RPC ${functionName} failed`, { error: error.message });
    throw new RpcError(error.message, error.code || 'RPC_ERROR', functionName, error.details);
  }

  return data as T;
}

/** Call RPC and return the first result, or null */
export async function callRpcSingle<T>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const data = await callRpc<T[]>(functionName, params);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/** Call RPC and return an array (guaranteed) */
export async function callRpcMany<T>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const data = await callRpc<T[]>(functionName, params);
  return Array.isArray(data) ? data : [];
}
```

#### File: `packages/backend/src/utils/index.ts`

```typescript
export * from './logger.js';
export * from './response.utils.js';
export * from './pagination.utils.js';
export * from './date.utils.js';
export * from './rpc.utils.js';
```

---

### Step 1.6: Constants

#### File: `packages/backend/src/constants/feature.constants.ts`

```typescript
import { PeriodType } from '../types/index.js';

/**
 * Centralized feature key constants.
 * Values must match the `key` column in the `features` database table.
 */
export const FEATURE_KEYS = {
  EXAMPLE_BOOLEAN: 'example_boolean',
  EXAMPLE_LIMIT: 'example_limit',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

/** Union type of all valid feature key values */
export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Mapping of collection feature keys to their database table names.
 * Used by enforceCollectionLimit to count actual items in the table.
 * Add entries here when you have limit-type features that track DB rows.
 */
export const COLLECTION_TABLE_MAP: Record<string, string> = {
  // Example: [FEATURE_KEYS.EXAMPLE_LIMIT]: 'user_items',
};

/**
 * Mapping of feature keys to their usage reset period types.
 * - 'daily': Resets at end of each day (UTC)
 * - 'monthly': Resets at end of each month (UTC)
 * - 'lifetime': Never resets, cumulative
 * - 'none': No usage tracking (boolean features)
 */
export const FEATURE_PERIOD_MAP: Record<string, PeriodType> = {
  example_boolean: 'none',
  example_limit: 'monthly',
  priority_support: 'none',
};
```

#### File: `packages/backend/src/constants/index.ts`

```typescript
export * from './feature.constants.js';
```

---

### Step 1.7: Validation Schemas

#### File: `packages/backend/src/validation/common.schemas.ts`

```typescript
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
```

#### File: `packages/backend/src/validation/auth.schemas.ts`

```typescript
import { z } from 'zod';
import { emailSchema } from './common.schemas.js';

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});
```

#### File: `packages/backend/src/validation/profile.schemas.ts`

```typescript
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
```

#### File: `packages/backend/src/validation/billing.schemas.ts`

```typescript
import { z } from 'zod';
import { uuidSchema } from './common.schemas.js';

export const checkoutSchema = z.object({
  tier_id: uuidSchema,
  billing_cycle: z.enum(['monthly', 'yearly']),
});

export const convertTrialSchema = z.object({
  tier_id: uuidSchema,
  billing_cycle: z.enum(['monthly', 'yearly']),
});
```

#### File: `packages/backend/src/validation/contact.schemas.ts`

```typescript
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
```

#### File: `packages/backend/src/validation/index.ts`

```typescript
export * from './common.schemas.js';
export * from './auth.schemas.js';
export * from './profile.schemas.js';
export * from './billing.schemas.js';
export * from './contact.schemas.js';
```

---

### Step 1.8: Middleware

#### File: `packages/backend/src/middleware/error.middleware.ts`

Three-tier error handling: ApiError class + asyncHandler wrapper + errorHandler middleware.

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

/** Custom API error with HTTP status code */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wraps async route handlers to catch errors and pass to errorHandler.
 * Generic Req parameter allows typed request extensions.
 */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}

/** Global error handler — must be registered last */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Known API errors → custom status
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Unknown errors → 500
  logger.logError('SYSTEM', 'Unhandled error', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

/** 404 handler for unmatched routes */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
}
```

#### File: `packages/backend/src/middleware/auth.middleware.ts`

Cookie-first auth with Bearer token fallback.

```typescript
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { createSupabaseReqResClient, supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Auth middleware: validates JWT and sets req.user.
 * 1. Tries cookie-based auth (browser sessions via @supabase/ssr)
 * 2. Falls back to Authorization: Bearer token (API clients)
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Strategy 1: Cookie-based auth (browser sessions)
    const supabaseReqRes = createSupabaseReqResClient(req, res);
    const { data: cookieData } = await supabaseReqRes.auth.getUser();

    if (cookieData?.user) {
      req.user = cookieData.user;
      const { data: sessionData } = await supabaseReqRes.auth.getSession();
      req.accessToken = sessionData?.session?.access_token;
      return next();
    }

    // Strategy 2: Bearer token (API clients, mobile)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: tokenData, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !tokenData?.user) {
        logger.debug('AUTH', 'Bearer token invalid', { error: error?.message });
        return next(); // Continue without auth — route can decide if auth is required
      }

      req.user = tokenData.user;
      req.accessToken = token;
      return next();
    }

    // No auth credentials found — continue without user
    next();
  } catch (error) {
    logger.logError('AUTH', 'Auth middleware error', error);
    next(); // Don't block request — let route decide
  }
}

/**
 * Optional auth — same as authMiddleware but explicitly signals
 * that the route works with or without authentication.
 */
export const optionalAuthMiddleware = authMiddleware;
```

#### File: `packages/backend/src/middleware/requireUser.middleware.ts`

```typescript
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { User } from '@supabase/supabase-js';

/**
 * Guard middleware: returns 401 if req.user is not set.
 * Must be used after authMiddleware.
 */
export function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }
  next();
}

/** Type guard helper for req.user in route handlers */
export function assertUser(user: unknown): asserts user is User {
  if (!user || typeof user !== 'object' || !('id' in user)) {
    throw new Error('User not authenticated');
  }
}
```

#### File: `packages/backend/src/middleware/membership.middleware.ts`

```typescript
import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AuthenticatedRequest, UserTierWithFeatures } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface MembershipRequest extends AuthenticatedRequest {
  membership?: UserTierWithFeatures;
}

/** Attaches membership info to request via get_user_tier_with_features RPC */
export async function membershipMiddleware(
  req: MembershipRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { data, error } = await supabaseAdmin.rpc('get_user_tier_with_features', {
      p_user_id: req.user.id,
    });

    if (error) {
      logger.error('MEMBERSHIP', 'Error fetching membership', { error: error.message });
      res.status(500).json({ success: false, error: 'Failed to fetch membership information' });
      return;
    }

    if (data && data.length > 0) {
      req.membership = data[0] as UserTierWithFeatures;
    }

    next();
  } catch (error) {
    logger.logError('MEMBERSHIP', 'Membership middleware error', error);
    res.status(500).json({ success: false, error: 'Failed to verify membership' });
  }
}

/** Factory: require user's tier to be in allowedTiers list */
export function requireTier(...allowedTiers: string[]) {
  return async (req: MembershipRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.membership) {
      res.status(403).json({ success: false, error: 'Membership information not available' });
      return;
    }

    if (!allowedTiers.includes(req.membership.tier_name)) {
      res.status(403).json({
        success: false,
        error: `This feature requires one of the following tiers: ${allowedTiers.join(', ')}`,
      });
      return;
    }

    if (req.membership.membership_status !== 'active') {
      res.status(403).json({ success: false, error: 'Your membership is not active' });
      return;
    }

    // Belt-and-suspenders trial expiry check
    if (req.membership.stripe_status === 'trialing' && req.membership.trial_ends_at) {
      if (new Date() > new Date(req.membership.trial_ends_at)) {
        res.status(403).json({
          success: false,
          error: 'Your trial has expired. Please upgrade to continue.',
        });
        return;
      }
    }

    next();
  };
}

/** Factory: require a specific feature via user_has_feature RPC */
export function requireFeature(featureKey: string) {
  return async (req: MembershipRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { data, error } = await supabaseAdmin.rpc('user_has_feature', {
      p_user_id: req.user.id,
      p_feature_key: featureKey,
    });

    if (error) {
      logger.error('MEMBERSHIP', 'Error checking feature', { error: error.message, featureKey });
      res.status(500).json({ success: false, error: 'Failed to verify feature access' });
      return;
    }

    if (!data) {
      res.status(403).json({
        success: false,
        error: `Feature ${featureKey} not available on your plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature_key: featureKey,
        upgrade_url: '/pricing',
      });
      return;
    }

    next();
  };
}

export type { MembershipRequest };
```

#### File: `packages/backend/src/middleware/usage.middleware.ts`

```typescript
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { COLLECTION_TABLE_MAP } from '../constants/index.js';
import { logger } from '../utils/logger.js';

/**
 * Factory: enforce usage limit for a feature.
 * - Checks if user can use the feature (under limit)
 * - If autoIncrement=true, increments usage AFTER response succeeds (res.on('finish'))
 * - Returns 429 with machine-readable error on limit exceeded
 */
export function enforceLimit(featureKey: string, autoIncrement = true) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    try {
      // Check current limit
      const { data: limitData } = await supabaseAdmin.rpc('get_feature_limit', {
        p_user_id: req.user.id,
        p_feature_key: featureKey,
      });

      if (!limitData || limitData.length === 0) {
        res.status(403).json({
          success: false,
          error: 'Feature not available on your plan',
          code: 'FEATURE_NOT_AVAILABLE',
          feature_key: featureKey,
        });
        return;
      }

      const { usage_limit, current_usage } = limitData[0];

      // -1 means unlimited
      if (usage_limit !== -1 && current_usage >= usage_limit) {
        res.status(429).json({
          success: false,
          error: 'Usage limit exceeded',
          code: 'USAGE_LIMIT_EXCEEDED',
          feature_key: featureKey,
          current_usage,
          usage_limit,
        });
        return;
      }

      // Post-response increment: only if the route succeeds (2xx)
      if (autoIncrement) {
        const userId = req.user.id;
        res.on('finish', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            supabaseAdmin
              .rpc('check_reset_and_increment_usage', {
                p_user_id: userId,
                p_feature_key: featureKey,
              })
              .then(({ error }) => {
                if (error) {
                  logger.error('USAGE', 'Failed to increment usage', {
                    error: error.message,
                    featureKey,
                    userId,
                  });
                }
              });
          }
        });
      }

      next();
    } catch (error) {
      logger.logError('USAGE', 'enforceLimit error', error);
      res.status(500).json({ success: false, error: 'Failed to check usage limit' });
    }
  };
}

/** Read-only limit check (no increment) */
export function checkUsageQuota(featureKey: string) {
  return enforceLimit(featureKey, false);
}

/**
 * Enforce collection-based limits by counting actual DB rows.
 * Uses COLLECTION_TABLE_MAP to look up the table name.
 */
export function enforceCollectionLimit(featureKey: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const tableName = COLLECTION_TABLE_MAP[featureKey];
    if (!tableName) {
      logger.warn('USAGE', `No collection table mapped for feature: ${featureKey}`);
      return next();
    }

    try {
      // Get the feature limit
      const { data: limitData } = await supabaseAdmin.rpc('get_feature_limit', {
        p_user_id: req.user.id,
        p_feature_key: featureKey,
      });

      if (!limitData || limitData.length === 0) {
        res.status(403).json({
          success: false,
          error: 'Feature not available on your plan',
          code: 'FEATURE_NOT_AVAILABLE',
          feature_key: featureKey,
        });
        return;
      }

      const { usage_limit } = limitData[0];

      // -1 means unlimited
      if (usage_limit === -1) return next();

      // Count actual rows in the collection table
      const { count, error } = await supabaseAdmin
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

      if (error) {
        logger.error('USAGE', 'Error counting collection', { error: error.message, tableName });
        return next(); // Fail open — don't block on count errors
      }

      const currentCount = count ?? 0;
      if (currentCount >= usage_limit) {
        res.status(429).json({
          success: false,
          error: 'Collection limit reached',
          code: 'USAGE_LIMIT_EXCEEDED',
          feature_key: featureKey,
          current_usage: currentCount,
          usage_limit,
        });
        return;
      }

      next();
    } catch (error) {
      logger.logError('USAGE', 'enforceCollectionLimit error', error);
      next(); // Fail open
    }
  };
}
```

#### File: `packages/backend/src/middleware/rateLimit.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter.
 * For production, use Redis-backed rate limiting.
 */
export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later' } = options;
  const store = new Map<string, RateLimitEntry>();

  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) store.delete(key);
    }
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      res.status(429).json({ success: false, error: message });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters
export const contactFormRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many contact form submissions. Please try again later.',
});

export const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again later.',
});

export const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

export const forgotPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many password reset requests. Please try again later.',
});
```

---

### Step 1.9: Services

#### File: `packages/backend/src/services/auth.service.ts`

```typescript
import { supabaseClient } from '../config/supabase.js';
import { RegisterInput, LoginInput, AuthResponse } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, first_name, last_name } = input;

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { first_name, last_name },
      },
    });

    if (error) {
      logger.error('AUTH', 'Registration failed', { error: error.message });
      throw new ApiError(400, error.message);
    }

    if (!data.user || !data.session) {
      throw new ApiError(400, 'Registration failed — please try again');
    }

    return {
      user: { id: data.user.id, email: data.user.email! },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error('AUTH', 'Login failed', { error: error.message });
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!data.user || !data.session) {
      throw new ApiError(401, 'Login failed');
    }

    return {
      user: { id: data.user.id, email: data.user.email! },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  async logout(accessToken: string): Promise<void> {
    // Supabase admin can revoke any session
    const { error } = await supabaseClient.auth.admin.signOut(accessToken, 'local');
    if (error) {
      logger.warn('AUTH', 'Logout error', { error: error.message });
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.user || !data.session) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    return {
      user: { id: data.user.id, email: data.user.email! },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  async forgotPassword(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      logger.error('AUTH', 'Forgot password error', { error: error.message });
      // Don't reveal if email exists
    }
  }

  async resetPassword(accessToken: string, newPassword: string): Promise<void> {
    // Create a client with the user's token to update their password
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const { error } = await client.auth.updateUser({ password: newPassword });

    if (error) {
      logger.error('AUTH', 'Reset password error', { error: error.message });
      throw new ApiError(400, error.message);
    }
  }
}

export const authService = new AuthService();
```

#### File: `packages/backend/src/services/profile.service.ts`

```typescript
import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import { UserProfile, UpdateProfileInput } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

class ProfileService {
  /** Get user profile (uses admin client for service-level access) */
  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new ApiError(404, 'Profile not found');
    }

    return data as UserProfile;
  }

  /**
   * Update user profile.
   * Uses the user's own token for RLS-aware updates.
   */
  async updateProfile(
    userId: string,
    accessToken: string,
    input: UpdateProfileInput
  ): Promise<UserProfile> {
    const client = createSupabaseClientWithAuth(accessToken);

    const { data, error } = await client
      .from('user_profiles')
      .update(input)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('DB', 'Profile update failed', { error: error.message, userId });
      throw new ApiError(400, 'Failed to update profile');
    }

    return data as UserProfile;
  }

  /** Delete user profile (admin operation) */
  async deleteProfile(userId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('user_profiles').delete().eq('id', userId);

    if (error) {
      logger.error('DB', 'Profile delete failed', { error: error.message, userId });
      throw new ApiError(500, 'Failed to delete profile');
    }
  }

  /** Get Stripe customer ID for a user */
  async getStripeCustomerId(userId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    return data?.stripe_customer_id ?? null;
  }

  /** Set Stripe customer ID for a user */
  async setStripeCustomerId(userId: string, customerId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);

    if (error) {
      logger.error('DB', 'Failed to set stripe_customer_id', { error: error.message, userId });
    }
  }
}

export const profileService = new ProfileService();
```

---

### Step 1.10: Routes

#### File: `packages/backend/src/routes/auth.routes.ts`

```typescript
import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import {
  registerRateLimit,
  loginRateLimit,
  forgotPasswordRateLimit,
} from '../middleware/rateLimit.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from '../validation/index.js';
import { authService } from '../services/auth.service.js';
import { profileService } from '../services/profile.service.js';
import { successResponse, errorResponse } from '../utils/index.js';
import { env } from '../config/env.js';

const router = Router();

/** POST /auth/register */
router.post(
  '/register',
  registerRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(successResponse(result, 'Registration successful'));
  })
);

/** POST /auth/login */
router.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(successResponse(result, 'Login successful'));
  })
);

/** POST /auth/logout */
router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.accessToken) {
      await authService.logout(req.accessToken);
    }
    res.json(successResponse(null, 'Logged out successfully'));
  })
);

/** POST /auth/refresh */
router.post(
  '/refresh',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refresh_token } = refreshTokenSchema.parse(req.body);
    const result = await authService.refreshToken(refresh_token);
    res.json(successResponse(result));
  })
);

/** POST /auth/forgot-password */
router.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const redirectTo = `${env.FRONTEND_URL}/reset-password`;
    await authService.forgotPassword(email, redirectTo);
    // Always return success (don't reveal if email exists)
    res.json(successResponse(null, 'If an account exists, a reset link has been sent'));
  })
);

/** POST /auth/reset-password */
router.post(
  '/reset-password',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { password } = resetPasswordSchema.parse(req.body);
    if (!req.accessToken) {
      res.status(401).json(errorResponse('Access token required'));
      return;
    }
    await authService.resetPassword(req.accessToken, password);
    res.json(successResponse(null, 'Password reset successful'));
  })
);

/** GET /auth/me — get current user profile + membership */
router.get(
  '/me',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await profileService.getProfile(req.user!.id);
    res.json(successResponse({ profile }));
  })
);

export default router;
```

#### File: `packages/backend/src/routes/profile.routes.ts`

```typescript
import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import { updateProfileSchema } from '../validation/index.js';
import { profileService } from '../services/profile.service.js';
import { successResponse, deletedResponse } from '../utils/index.js';

const router = Router();

// All profile routes require authentication
router.use(authMiddleware, requireUser);

/** GET /profile */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const profile = await profileService.getProfile(req.user!.id);
    res.json(successResponse(profile));
  })
);

/** PUT /profile */
router.put(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = updateProfileSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.user!.id, req.accessToken!, input);
    res.json(successResponse(profile, 'Profile updated'));
  })
);

/** DELETE /profile */
router.delete(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await profileService.deleteProfile(req.user!.id);
    res.json(deletedResponse('Profile deleted'));
  })
);

export default router;
```

#### File: `packages/backend/src/routes/index.ts`

```typescript
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';

const router = Router();

// Authentication routes — public (no auth required for most)
router.use('/auth', authRoutes);

// User profile routes — authenticated
router.use('/profile', profileRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
```

---

### Step 1.11: App Entry Point

#### File: `packages/backend/src/index.ts`

Express app assembly with documented middleware order.

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();

// ============================================
// MIDDLEWARE ORDER (matters!)
// ============================================

// 1. Security headers
app.use(helmet());

// 2. CORS
const allowedOrigins = [env.FRONTEND_URL];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Cookie parser (for Supabase SSR auth)
app.use(cookieParser());

// 4. Body parsers
// NOTE: If you add Stripe webhooks, register their raw-body route BEFORE this
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// 5. Request logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 6. API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 7. API routes
app.use('/api', routes);

// 8. Error handling (must be LAST)
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  logger.info('SYSTEM', `Server started on port ${PORT}`, {
    environment: env.NODE_ENV,
    docs: `${env.BACKEND_URL}/api-docs`,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SYSTEM', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SYSTEM', 'SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
```

---

### Step 1.12: Database Migrations

#### File: `supabase/migrations/000_cleanup_all.sql`

Idempotent cleanup for dev resets. Drops everything in correct dependency order.

```sql
-- ============================================
-- 000_cleanup_all.sql
-- Idempotent cleanup: drops everything for fresh reset
-- Safe to re-run (all DROP IF EXISTS)
-- ============================================

-- 1. Drop triggers (depend on functions + tables)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_membership_change ON public.memberships;
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
DROP TRIGGER IF EXISTS set_updated_at_memberships ON public.memberships;
DROP TRIGGER IF EXISTS set_updated_at_usage_tracking ON public.usage_tracking;
DROP TRIGGER IF EXISTS set_updated_at_contact_submissions ON public.contact_submissions;

-- 2. Drop views (depend on tables)
DROP VIEW IF EXISTS public.user_membership_details CASCADE;
DROP VIEW IF EXISTS public.tier_comparison CASCADE;
DROP VIEW IF EXISTS public.v_features_with_tiers CASCADE;
DROP VIEW IF EXISTS public.v_features_overview CASCADE;
DROP VIEW IF EXISTS public.v_membership_tiers_overview CASCADE;
DROP VIEW IF EXISTS public.v_users_membership_details CASCADE;
DROP VIEW IF EXISTS public.v_usage_tracking_details CASCADE;
DROP VIEW IF EXISTS public.v_tier_features_matrix CASCADE;
DROP VIEW IF EXISTS public.v_membership_audit_details CASCADE;
DROP VIEW IF EXISTS public.v_stripe_webhook_events_summary CASCADE;
DROP VIEW IF EXISTS public.v_contact_submissions_overview CASCADE;
DROP VIEW IF EXISTS public.v_dashboard_stats CASCADE;

-- 3. Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.log_membership_change() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_tier_with_features(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_feature(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_feature_limit(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_tier_features(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_usage(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.reset_usage_if_expired(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_reset_and_increment_usage(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.change_user_tier(UUID, UUID) CASCADE;

-- 4. Drop tables (children first, parents last)
DROP TABLE IF EXISTS public.usage_tracking CASCADE;
DROP TABLE IF EXISTS public.tier_features CASCADE;
DROP TABLE IF EXISTS public.features CASCADE;
DROP TABLE IF EXISTS public.membership_audit_log CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.membership_tiers CASCADE;
DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.contact_submissions CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
```

#### File: `supabase/migrations/001_schema.sql`

```sql
-- ============================================
-- 001_schema.sql
-- Core tables for {{PROJECT_DISPLAY_NAME}}
-- ============================================

-- ============================================
-- USER PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        CASE
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
            WHEN first_name IS NOT NULL THEN first_name
            WHEN last_name IS NOT NULL THEN last_name
            ELSE NULL
        END
    ) STORED,
    avatar_url TEXT,
    phone TEXT,
    company TEXT,
    bio TEXT,
    website TEXT,
    stripe_customer_id TEXT UNIQUE,
    profile_completeness INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe ON public.user_profiles(stripe_customer_id);

-- ============================================
-- MEMBERSHIP TIERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.membership_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    stripe_product_id TEXT,
    trial_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- MEMBERSHIPS (user <-> tier)
-- ============================================
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.membership_tiers(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
    has_used_trial BOOLEAN DEFAULT false,
    trial_starts_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    stripe_subscription_id TEXT UNIQUE,
    stripe_status TEXT,
    stripe_current_period_end TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    sync_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tier ON public.memberships(tier_id);
CREATE INDEX IF NOT EXISTS idx_memberships_stripe ON public.memberships(stripe_subscription_id);

-- ============================================
-- FEATURES
-- ============================================
CREATE TABLE IF NOT EXISTS public.features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    feature_type TEXT NOT NULL CHECK (feature_type IN ('boolean', 'limit', 'enum')),
    default_value TEXT DEFAULT 'false',
    is_active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'development', 'future')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- TIER FEATURES (tier <-> feature assignments)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tier_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id UUID NOT NULL REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
    value TEXT NOT NULL DEFAULT 'false',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tier_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_tier_features_tier ON public.tier_features(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_feature ON public.tier_features(feature_id);

-- ============================================
-- USAGE TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    current_usage INTEGER DEFAULT 0,
    usage_limit INTEGER DEFAULT 0,
    period_start TIMESTAMPTZ DEFAULT NOW(),
    period_end TIMESTAMPTZ,
    period_type TEXT DEFAULT 'none' CHECK (period_type IN ('daily', 'monthly', 'lifetime', 'none')),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON public.usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_feature ON public.usage_tracking(feature_key);

-- ============================================
-- STRIPE WEBHOOK EVENTS (idempotency)
-- ============================================
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON public.stripe_webhook_events(stripe_event_id);

-- ============================================
-- ADMIN USERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id)
);

-- ============================================
-- MEMBERSHIP AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.membership_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID REFERENCES public.memberships(id),
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    old_tier_id UUID REFERENCES public.membership_tiers(id),
    new_tier_id UUID REFERENCES public.membership_tiers(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.membership_audit_log(user_id);

-- ============================================
-- CONTACT SUBMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'website',
    subscribed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    unsubscribed_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON public.newsletter_subscribers(email);
```

#### File: `supabase/migrations/002_functions_triggers.sql`

```sql
-- ============================================
-- 002_functions_triggers.sql
-- Database functions and triggers
-- ============================================

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at_user_profiles
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_memberships
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_usage_tracking
    BEFORE UPDATE ON public.usage_tracking
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- MEMBERSHIP AUDIT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.log_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.membership_audit_log (
        membership_id, user_id, action,
        old_status, new_status,
        old_tier_id, new_tier_id,
        metadata
    ) VALUES (
        NEW.id, NEW.user_id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'created'
            WHEN OLD.tier_id != NEW.tier_id THEN 'tier_changed'
            WHEN OLD.status != NEW.status THEN 'status_changed'
            ELSE 'updated'
        END,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.tier_id ELSE NULL END,
        NEW.tier_id,
        jsonb_build_object(
            'stripe_status', NEW.stripe_status,
            'billing_cycle', NEW.billing_cycle,
            'stripe_subscription_id', NEW.stripe_subscription_id
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_membership_change
    AFTER INSERT OR UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.log_membership_change();

-- ============================================
-- AUTO-PROVISION ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tier_id UUID;
BEGIN
    -- Get the default (free) tier
    SELECT id INTO default_tier_id
    FROM public.membership_tiers
    WHERE is_default = true
    LIMIT 1;

    -- Create user profile
    INSERT INTO public.user_profiles (id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );

    -- Create default membership
    IF default_tier_id IS NOT NULL THEN
        INSERT INTO public.memberships (user_id, tier_id, status)
        VALUES (NEW.id, default_tier_id, 'active');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- MEMBERSHIP / FEATURE QUERY FUNCTIONS
-- ============================================

-- Get user's tier with all resolved features
CREATE OR REPLACE FUNCTION public.get_user_tier_with_features(p_user_id UUID)
RETURNS TABLE (
    tier_name TEXT,
    tier_display_name TEXT,
    membership_status TEXT,
    stripe_status TEXT,
    trial_ends_at TIMESTAMPTZ,
    features JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mt.name,
        mt.display_name,
        m.status,
        m.stripe_status,
        m.trial_ends_at,
        COALESCE(
            jsonb_object_agg(f.key, tf.value) FILTER (WHERE f.key IS NOT NULL),
            '{}'::jsonb
        )
    FROM public.memberships m
    JOIN public.membership_tiers mt ON m.tier_id = mt.id
    LEFT JOIN public.tier_features tf ON tf.tier_id = mt.id
    LEFT JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
    GROUP BY mt.name, mt.display_name, m.status, m.stripe_status, m.trial_ends_at;
END;
$$;

-- Check if user has a specific feature (returns true/false)
CREATE OR REPLACE FUNCTION public.user_has_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    feature_value TEXT;
BEGIN
    SELECT tf.value INTO feature_value
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id
      AND f.key = p_feature_key
      AND m.status = 'active';

    IF feature_value IS NULL THEN
        RETURN false;
    END IF;

    -- Boolean: 'true'/'false'
    -- Limit: any positive number or -1 (unlimited) means has feature
    IF feature_value = 'true' THEN RETURN true; END IF;
    IF feature_value = 'false' OR feature_value = '0' THEN RETURN false; END IF;

    -- Numeric (limit feature): has access if limit > 0 or -1
    RETURN true;
END;
$$;

-- Get feature limit details for a user
CREATE OR REPLACE FUNCTION public.get_feature_limit(p_user_id UUID, p_feature_key TEXT)
RETURNS TABLE (
    usage_limit INTEGER,
    current_usage INTEGER,
    period_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(tf.value::INTEGER, 0) AS usage_limit,
        COALESCE(ut.current_usage, 0) AS current_usage,
        COALESCE(ut.period_type, 'none')::TEXT AS period_type
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    LEFT JOIN public.usage_tracking ut ON ut.user_id = m.user_id AND ut.feature_key = f.key
    WHERE m.user_id = p_user_id
      AND f.key = p_feature_key
      AND m.status = 'active';
END;
$$;

-- Get all features for a tier
CREATE OR REPLACE FUNCTION public.get_tier_features(p_tier_id UUID)
RETURNS TABLE (
    feature_key TEXT,
    feature_name TEXT,
    feature_type TEXT,
    value TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT f.key, f.name, f.feature_type, tf.value
    FROM public.tier_features tf
    JOIN public.features f ON f.id = tf.feature_id
    WHERE tf.tier_id = p_tier_id
    ORDER BY f.sort_order;
END;
$$;

-- ============================================
-- USAGE TRACKING FUNCTIONS (ATOMIC)
-- ============================================

-- Simple increment
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_feature_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.usage_tracking (user_id, feature_key, current_usage, last_used_at)
    VALUES (p_user_id, p_feature_key, 1, NOW())
    ON CONFLICT (user_id, feature_key)
    DO UPDATE SET
        current_usage = usage_tracking.current_usage + 1,
        last_used_at = NOW();
END;
$$;

-- Reset usage if period has expired
CREATE OR REPLACE FUNCTION public.reset_usage_if_expired(p_user_id UUID, p_feature_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.usage_tracking
    SET current_usage = 0,
        period_start = NOW(),
        period_end = CASE period_type
            WHEN 'daily' THEN (NOW() AT TIME ZONE 'UTC')::DATE + INTERVAL '1 day' - INTERVAL '1 second'
            WHEN 'monthly' THEN (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second')
            ELSE period_end
        END
    WHERE user_id = p_user_id
      AND feature_key = p_feature_key
      AND period_end IS NOT NULL
      AND period_end < NOW();
END;
$$;

-- Atomic check-reset-and-increment with FOR UPDATE lock
CREATE OR REPLACE FUNCTION public.check_reset_and_increment_usage(p_user_id UUID, p_feature_key TEXT)
RETURNS TABLE (new_usage INTEGER, at_limit BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_limit INTEGER;
BEGIN
    -- Get feature limit from tier
    SELECT COALESCE(tf.value::INTEGER, 0) INTO v_limit
    FROM public.memberships m
    JOIN public.tier_features tf ON tf.tier_id = m.tier_id
    JOIN public.features f ON f.id = tf.feature_id
    WHERE m.user_id = p_user_id AND f.key = p_feature_key AND m.status = 'active';

    -- Upsert and lock the usage row
    INSERT INTO public.usage_tracking (user_id, feature_key, current_usage, usage_limit, period_type, period_start, period_end)
    VALUES (p_user_id, p_feature_key, 0, COALESCE(v_limit, 0), 'monthly', NOW(),
            DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second')
    ON CONFLICT (user_id, feature_key) DO NOTHING;

    -- Lock the row for atomic update
    SELECT * INTO v_record
    FROM public.usage_tracking
    WHERE user_id = p_user_id AND feature_key = p_feature_key
    FOR UPDATE;

    -- Reset if period expired
    IF v_record.period_end IS NOT NULL AND v_record.period_end < NOW() THEN
        UPDATE public.usage_tracking
        SET current_usage = 0,
            period_start = NOW(),
            period_end = CASE v_record.period_type
                WHEN 'daily' THEN (NOW() AT TIME ZONE 'UTC')::DATE + INTERVAL '1 day' - INTERVAL '1 second'
                WHEN 'monthly' THEN DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second'
                ELSE v_record.period_end
            END,
            usage_limit = COALESCE(v_limit, v_record.usage_limit)
        WHERE user_id = p_user_id AND feature_key = p_feature_key;

        v_record.current_usage := 0;
    END IF;

    -- Increment
    UPDATE public.usage_tracking
    SET current_usage = v_record.current_usage + 1,
        last_used_at = NOW(),
        usage_limit = COALESCE(v_limit, v_record.usage_limit)
    WHERE user_id = p_user_id AND feature_key = p_feature_key;

    new_usage := v_record.current_usage + 1;
    at_limit := (v_limit != -1 AND new_usage >= v_limit);
    RETURN NEXT;
END;
$$;

-- ============================================
-- TIER CHANGE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.change_user_tier(p_user_id UUID, p_new_tier_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate tier exists and is active
    IF NOT EXISTS (SELECT 1 FROM public.membership_tiers WHERE id = p_new_tier_id AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid or inactive tier';
    END IF;

    UPDATE public.memberships
    SET tier_id = p_new_tier_id
    WHERE user_id = p_user_id;
END;
$$;
```

#### File: `supabase/migrations/003_rls_policies.sql`

```sql
-- ============================================
-- 003_rls_policies.sql
-- Row Level Security policies
-- Pattern: user owns their data via (SELECT auth.uid()) = user_id
-- service_role has full access everywhere
-- ============================================

-- ============================================
-- USER PROFILES
-- ============================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Service role full access to profiles"
    ON public.user_profiles FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- MEMBERSHIP TIERS (public read for active tiers)
-- ============================================
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers"
    ON public.membership_tiers FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role full access to tiers"
    ON public.membership_tiers FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- MEMBERSHIPS
-- ============================================
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership"
    ON public.memberships FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role full access to memberships"
    ON public.memberships FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- FEATURES (public read for active features)
-- ============================================
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active features"
    ON public.features FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role full access to features"
    ON public.features FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- TIER FEATURES (public read)
-- ============================================
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tier features"
    ON public.tier_features FOR SELECT
    USING (true);

CREATE POLICY "Service role full access to tier features"
    ON public.tier_features FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- USAGE TRACKING
-- ============================================
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
    ON public.usage_tracking FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role full access to usage"
    ON public.usage_tracking FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- STRIPE WEBHOOK EVENTS (backend only)
-- ============================================
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to webhook events"
    ON public.stripe_webhook_events FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- ADMIN USERS
-- ============================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin users"
    ON public.admin_users FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role full access to admin users"
    ON public.admin_users FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- MEMBERSHIP AUDIT LOG (backend only)
-- ============================================
ALTER TABLE public.membership_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to audit log"
    ON public.membership_audit_log FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- CONTACT SUBMISSIONS (backend only)
-- ============================================
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to contact submissions"
    ON public.contact_submissions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- NEWSLETTER SUBSCRIBERS (backend only)
-- ============================================
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to newsletter"
    ON public.newsletter_subscribers FOR ALL
    USING (auth.role() = 'service_role');
```

#### File: `supabase/migrations/004_views.sql`

```sql
-- ============================================
-- 004_views.sql
-- User-facing and admin views
-- ============================================

-- User membership with tier details
CREATE OR REPLACE VIEW public.user_membership_details
WITH (security_invoker = true)
AS
SELECT
    m.id AS membership_id,
    m.user_id,
    up.email,
    up.first_name,
    up.last_name,
    up.full_name,
    up.stripe_customer_id,
    mt.id AS tier_id,
    mt.name AS tier_name,
    mt.display_name AS tier_display_name,
    mt.price_monthly,
    mt.price_yearly,
    m.status,
    m.billing_cycle,
    m.started_at,
    m.stripe_subscription_id,
    m.stripe_status,
    m.stripe_current_period_end,
    m.cancel_at_period_end,
    m.last_synced_at,
    m.sync_expires_at
FROM public.memberships m
JOIN public.user_profiles up ON up.id = m.user_id
JOIN public.membership_tiers mt ON mt.id = m.tier_id;

-- Tier comparison (for pricing page)
CREATE OR REPLACE VIEW public.tier_comparison AS
SELECT
    mt.id AS tier_id,
    mt.name,
    mt.display_name,
    mt.description,
    mt.price_monthly,
    mt.price_yearly,
    mt.trial_days,
    mt.sort_order,
    COALESCE(
        jsonb_object_agg(f.key, jsonb_build_object('name', f.name, 'value', tf.value, 'type', f.feature_type)),
        '{}'::jsonb
    ) AS features
FROM public.membership_tiers mt
LEFT JOIN public.tier_features tf ON tf.tier_id = mt.id
LEFT JOIN public.features f ON f.id = tf.feature_id
WHERE mt.is_active = true
GROUP BY mt.id, mt.name, mt.display_name, mt.description,
         mt.price_monthly, mt.price_yearly, mt.trial_days, mt.sort_order
ORDER BY mt.sort_order;

-- Admin: dashboard stats
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM public.user_profiles) AS total_users,
    (SELECT COUNT(*) FROM public.memberships WHERE status = 'active') AS active_memberships,
    (SELECT COUNT(*) FROM public.memberships WHERE stripe_status = 'trialing') AS trialing_users,
    (SELECT COUNT(*) FROM public.admin_users) AS admin_users,
    (SELECT jsonb_object_agg(mt.name, COALESCE(counts.user_count, 0))
     FROM public.membership_tiers mt
     LEFT JOIN (
         SELECT tier_id, COUNT(*) AS user_count
         FROM public.memberships WHERE status = 'active'
         GROUP BY tier_id
     ) counts ON mt.id = counts.tier_id
    ) AS users_by_tier,
    (SELECT COUNT(*) FROM public.features WHERE is_active = true) AS active_features,
    (SELECT COUNT(*) FROM public.user_profiles WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_7d,
    (SELECT COUNT(*) FROM public.user_profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
    (SELECT COUNT(*) FROM public.contact_submissions WHERE status = 'new') AS pending_contacts,
    (SELECT COUNT(*) FROM public.stripe_webhook_events WHERE processed = false AND retry_count < 3) AS pending_webhooks;

REVOKE ALL ON public.v_dashboard_stats FROM anon, authenticated;
GRANT SELECT ON public.v_dashboard_stats TO service_role;
```

#### File: `supabase/migrations/005_seed_data.sql`

```sql
-- ============================================
-- 005_seed_data.sql
-- Seed data: tiers, features, and assignments
-- Idempotent: uses ON CONFLICT DO UPDATE
--
-- ARCHITECTURE NOTE:
-- - {{TIER_1_NAME}} tier has NO Stripe prices (absence of subscription = free)
-- - Only {{TIER_2_NAME}} and {{TIER_3_NAME}} have Stripe price IDs
-- - Trials managed by Stripe (trial_period_days on price)
-- ============================================

-- ============================================
-- MEMBERSHIP TIERS
-- ============================================
INSERT INTO public.membership_tiers
    (name, display_name, description, price_monthly, price_yearly, trial_days, is_active, is_default, sort_order)
VALUES
    ('{{TIER_1_NAME}}', '{{TIER_1_DISPLAY}}', 'Basic access with limited features. Perfect for getting started.', 0.00, 0.00, 0, true, true, 1),
    ('{{TIER_2_NAME}}', '{{TIER_2_DISPLAY}}', 'Enhanced features for power users.', {{TIER_2_PRICE_MONTHLY}}, {{TIER_2_PRICE_YEARLY}}, 7, true, false, 2),
    ('{{TIER_3_NAME}}', '{{TIER_3_DISPLAY}}', 'Full access with unlimited features and priority support.', {{TIER_3_PRICE_MONTHLY}}, {{TIER_3_PRICE_YEARLY}}, 7, true, false, 3);

-- ============================================
-- FEATURES
-- Customize these for your SaaS product
-- ============================================
INSERT INTO public.features (key, name, description, feature_type, default_value, is_active, status, sort_order) VALUES
    ('example_boolean', 'Example Boolean Feature',
     'An example boolean feature that is either on or off per tier.',
     'boolean', 'false', true, 'active', 10),
    ('example_limit', 'Example Limit Feature',
     'An example limit feature with usage tracking per tier.',
     'limit', '5', true, 'active', 20),
    ('priority_support', 'Priority Support',
     'Get faster response times from our support team.',
     'boolean', 'false', true, 'active', 30)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    feature_type = EXCLUDED.feature_type, default_value = EXCLUDED.default_value,
    is_active = EXCLUDED.is_active, status = EXCLUDED.status, sort_order = EXCLUDED.sort_order;

-- ============================================
-- TIER FEATURE ASSIGNMENTS
-- Values: boolean = 'true'/'false', limit = integer string (-1 = unlimited)
-- ============================================
DO $$
DECLARE
    tier1_id UUID;
    tier2_id UUID;
    tier3_id UUID;
BEGIN
    SELECT id INTO tier1_id FROM public.membership_tiers WHERE name = '{{TIER_1_NAME}}';
    SELECT id INTO tier2_id FROM public.membership_tiers WHERE name = '{{TIER_2_NAME}}';
    SELECT id INTO tier3_id FROM public.membership_tiers WHERE name = '{{TIER_3_NAME}}';

    IF tier1_id IS NULL THEN RAISE EXCEPTION '{{TIER_1_NAME}} tier not found'; END IF;
    IF tier2_id IS NULL THEN RAISE EXCEPTION '{{TIER_2_NAME}} tier not found'; END IF;
    IF tier3_id IS NULL THEN RAISE EXCEPTION '{{TIER_3_NAME}} tier not found'; END IF;

    -- example_boolean: tier1=false, tier2=true, tier3=true
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier1_id, id, 'false' FROM public.features WHERE key = 'example_boolean'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier2_id, id, 'true'  FROM public.features WHERE key = 'example_boolean'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier3_id, id, 'true'  FROM public.features WHERE key = 'example_boolean'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;

    -- example_limit: tier1=5, tier2=50, tier3=-1 (unlimited)
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier1_id, id, '5'  FROM public.features WHERE key = 'example_limit'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier2_id, id, '50' FROM public.features WHERE key = 'example_limit'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier3_id, id, '-1' FROM public.features WHERE key = 'example_limit'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;

    -- priority_support: tier1=false, tier2=false, tier3=true
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier1_id, id, 'false' FROM public.features WHERE key = 'priority_support'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier2_id, id, 'false' FROM public.features WHERE key = 'priority_support'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;
    INSERT INTO public.tier_features (tier_id, feature_id, value)
        SELECT tier3_id, id, 'true'  FROM public.features WHERE key = 'priority_support'
        ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value;

    RAISE NOTICE 'Seed data complete: 3 tiers, 3 features, all tier assignments configured';
END $$;
```

---

## Verification Checklist

1. **Install dependencies**: `npm install` from root succeeds
2. **TypeScript compiles**: `npm run typecheck:backend` passes with no errors
3. **Server starts**: `npm run dev:backend` boots without crash
4. **Health check**: `GET /api/health` returns `{ success: true, data: { status: "healthy" } }`
5. **Swagger docs**: `GET /api-docs` renders the Swagger UI
6. **Database migrations**: Run all 6 migration files in Supabase SQL editor (000 through 005)
7. **Registration flow**: `POST /api/auth/register` creates user + profile + membership via `handle_new_user()` trigger
8. **Login flow**: `POST /api/auth/login` returns access token
9. **Profile CRUD**: `GET /api/profile` returns user profile, `PUT /api/profile` updates it
10. **Tier data**: Verify 3 tiers exist in `membership_tiers` table with correct prices
11. **Feature data**: Verify 3 features exist in `features` table with correct assignments in `tier_features`
