# Phase 3: Frontend — Theme, Auth, Dashboard, Landing, Billing UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete React Router v7 SPA frontend with MUI theming, Supabase auth, protected dashboard (profile, membership, billing), public landing page with DB-fetched pricing, and upgrade prompts.

**Architecture:** React Router v7 in SPA mode (`ssr: false`). MUI v6 with module augmentation for custom theme colors. Supabase browser client for auth state via `onAuthStateChange`. API client with `credentials: 'include'` for cookie-based auth to the Express backend. All data fetching via `useEffect` hooks (no server loaders). Feature gating drives upgrade prompts via typed error classes.

**Tech Stack:** React 19, React Router 7, MUI 6, Emotion, Supabase (`@supabase/ssr`), Zod, TypeScript, Vite 6

---

## Prerequisites

- **Phase 1 and Phase 2 must be complete and verified.** Backend starts, auth works, billing routes respond, Stripe webhooks process correctly.
- All backend files compile without errors.

---

## Token Substitution Table

Same tokens as Phase 1 — see Phase 1 document for the full table. Additional frontend-specific tokens:

| Token                 | Purpose                | Example                         |
| --------------------- | ---------------------- | ------------------------------- |
| `{{PRIMARY_COLOR}}`   | MUI primary.main hex   | `#6366f1`                       |
| `{{SECONDARY_COLOR}}` | MUI secondary.main hex | `#14b8a6`                       |
| `{{FONT_FAMILY}}`     | Typography fontFamily  | `"Inter", "Roboto", sans-serif` |

---

## What This Phase Produces

~48 files in `packages/frontend/`:

**Scaffold (4):** `package.json`, `tsconfig.json`, `vite.config.ts`, `react-router.config.ts`
**Config & Lib (3):** `config/env.ts`, `lib/supabase.client.ts`, `lib/sitemap.ts`
**Theme (1):** `theme/index.ts`
**Types (11):** `api.ts`, `common.ts`, `user.ts`, `membership.ts`, `billing.ts`, `features.ts`, `usage.ts`, `trial.ts`, `contact.ts`, `navigation.types.ts`, `index.ts`
**API (9):** `client.ts`, `errors.ts`, `auth.api.ts`, `billing.api.ts`, `membership.api.ts`, `profile.api.ts`, `contact.api.ts`, `newsletter.api.ts`, `index.ts`
**Context (1):** `AuthContext.tsx`
**Utils (4):** `formatting.ts`, `navigation.tsx`, `features.ts`, `index.ts`
**Constants (3):** `featureKeys.ts`, `upgradeMessages.ts`, `index.ts`
**Root & Entry (3):** `root.tsx`, `entry.client.tsx`, `routes.ts`
**Layout Routes (3):** `_layout.tsx`, `_protected.tsx`, `_protected-with-layout.tsx`
**Layout Components (3):** `Header.tsx`, `Footer.tsx`, `DashboardLayout.tsx`
**Auth Pages (5):** `auth.login.tsx`, `auth.register.tsx`, `auth.logout.tsx`, `auth.forgot-password.tsx`, `auth.reset-password.tsx`
**Dashboard (5):** `dashboard.tsx`, `dashboard._index.tsx`, `dashboard.profile.tsx`, `dashboard.membership.tsx`, `dashboard.billing.tsx`
**Landing (5):** `_index.tsx`, `HeroSection.tsx`, `FeaturesSection.tsx`, `PricingSection.tsx`, `CTASection.tsx`
**Dialogs (1):** `UpgradeDialog.tsx`

---

## Implementation

### Step 3.1: Frontend Scaffold

#### File: `packages/frontend/package.json`

```json
{
  "name": "@{{PROJECT_SLUG}}/frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "typecheck": "react-router typegen && tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@emotion/react": "^11.13.5",
    "@emotion/styled": "^11.13.5",
    "@mui/icons-material": "^6.3.0",
    "@mui/material": "^6.3.0",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "isbot": "^5.1.17",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.1.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@react-router/dev": "^7.1.1",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.0",
    "vite-tsconfig-paths": "^5.1.4"
  }
}
```

#### File: `packages/frontend/tsconfig.json`

```json
{
  "include": ["**/*.ts", "**/*.tsx", ".react-router/types/**/*"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "~/*": ["./app/*"]
    },
    "rootDirs": [".", "./.react-router/types"]
  }
}
```

#### File: `packages/frontend/vite.config.ts`

```typescript
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  ssr: {
    noExternal: [
      '@mui/material',
      '@mui/icons-material',
      '@mui/system',
      '@mui/utils',
      '@mui/styled-engine',
    ],
  },
  build: {
    minify: 'esbuild',
  },
});
```

#### File: `packages/frontend/react-router.config.ts`

```typescript
import type { Config } from '@react-router/dev/config';

export default {
  ssr: false,
} satisfies Config;
```

---

### Step 3.2: Config & Lib

#### File: `packages/frontend/app/config/env.ts`

```typescript
/**
 * @file env.ts
 * @description Zod-validated environment variables for the frontend.
 */

import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_BACKEND_URL: z.string().url(),
});

function getEnvSource(): Record<string, string | undefined> {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env as unknown as Record<string, string | undefined>;
  }
  return process.env as Record<string, string | undefined>;
}

export const env = envSchema.parse(getEnvSource());
```

#### File: `packages/frontend/app/lib/supabase.client.ts`

```typescript
/**
 * @file supabase.client.ts
 * @description Singleton Supabase browser client and auth helper functions.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { env } from '~/config/env';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/** Get or create the singleton Supabase browser client */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  }
  return browserClient;
}

/** Sign in with email and password */
export async function signIn(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  return client.auth.signInWithPassword({ email, password });
}

/** Sign up with email and password */
export async function signUp(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  return client.auth.signUp({ email, password });
}

/** Sign out the current user */
export async function signOut() {
  const client = getSupabaseBrowserClient();
  return client.auth.signOut();
}

/** Send password reset email */
export async function resetPassword(email: string) {
  const client = getSupabaseBrowserClient();
  return client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
}

/** Update password (after reset) */
export async function updatePassword(password: string) {
  const client = getSupabaseBrowserClient();
  return client.auth.updateUser({ password });
}

/** Get the current session */
export async function getSession(): Promise<Session | null> {
  const client = getSupabaseBrowserClient();
  const { data } = await client.auth.getSession();
  return data.session;
}

/** Get the current user */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseBrowserClient();
  const { data } = await client.auth.getUser();
  return data.user;
}

/** Subscribe to auth state changes */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const client = getSupabaseBrowserClient();
  return client.auth.onAuthStateChange(callback);
}
```

#### File: `packages/frontend/app/lib/sitemap.ts`

```typescript
/**
 * @file sitemap.ts
 * @description Centralized route path constants.
 */

export const SITE_MAP = {
  home: '/',
  login: '/auth/login',
  register: '/auth/register',
  logout: '/auth/logout',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  dashboard: '/dashboard',
  profile: '/dashboard/profile',
  membership: '/dashboard/membership',
  billing: '/dashboard/billing',
  contact: '/contact',
  pricing: '/#pricing',
} as const;
```

---

### Step 3.3: Theme

#### File: `packages/frontend/app/theme/index.ts`

```typescript
/**
 * @file theme/index.ts
 * @description MUI theme with module augmentation for custom palette colors.
 *
 * Uses {{PRIMARY_COLOR}} and {{SECONDARY_COLOR}} tokens.
 * Replace placeholder hex values with your brand colors.
 */

import { createTheme } from '@mui/material/styles';

// ─── Module Augmentation ───────────────────────────────────
// Extend MUI's palette to include custom colors.
declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
    neutral: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
    neutral?: PaletteOptions['primary'];
  }
}

// Allow custom colors on Button
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    accent: true;
    neutral: true;
  }
}

// Allow custom colors on Chip
declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    accent: true;
    neutral: true;
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: '{{PRIMARY_COLOR}}',
    },
    secondary: {
      main: '{{SECONDARY_COLOR}}',
    },
    accent: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#ffffff',
    },
    neutral: {
      main: '#64748b',
      light: '#94a3b8',
      dark: '#475569',
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '{{FONT_FAMILY}}',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
  },
});

export default theme;
```

---

### Step 3.4: Types

#### File: `packages/frontend/app/types/api.ts`

```typescript
/**
 * @file api.ts
 * @description Standard API response wrapper type.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
}
```

#### File: `packages/frontend/app/types/common.ts`

```typescript
/**
 * @file common.ts
 * @description Shared enums and basic types used across the frontend.
 */

export type BillingCycle = 'monthly' | 'yearly';
export type PeriodType = 'daily' | 'monthly' | 'lifetime' | 'none';
```

#### File: `packages/frontend/app/types/user.ts`

```typescript
/**
 * @file user.ts
 * @description User profile types. Simplified for the SaaS template.
 */

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}
```

#### File: `packages/frontend/app/types/membership.ts`

```typescript
/**
 * @file membership.ts
 * @description Membership and tier types.
 */

export type MembershipStatus = 'active' | 'cancelled' | 'past_due' | 'incomplete';

export interface Membership {
  id: string;
  user_id: string;
  tier_id: string;
  tier_name: string;
  membership_status: MembershipStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  is_default: boolean;
  sort_order: number;
}

export interface TierWithFeatures extends MembershipTier {
  features: Array<{
    key: string;
    name: string;
    description: string | null;
    feature_type: string;
    value: string;
  }>;
}
```

#### File: `packages/frontend/app/types/billing.ts`

```typescript
/**
 * @file billing.ts
 * @description Billing and payment types.
 */

export interface PaymentHistory {
  id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  invoice_url: string | null;
  created_at: string;
}

export interface CreateCheckoutInput {
  tier_id: string;
  billing_cycle: 'monthly' | 'yearly';
  success_url?: string;
  cancel_url?: string;
}

export interface UserTierWithFeatures {
  tier_name: string;
  tier_display_name: string;
  membership_status: MembershipStatus;
  stripe_status: string | null;
  trial_ends_at: string | null;
  features: Record<string, string>;
}

type MembershipStatus = 'active' | 'cancelled' | 'past_due' | 'incomplete';
```

#### File: `packages/frontend/app/types/features.ts`

```typescript
/**
 * @file features.ts
 * @description Feature definition types.
 */

export type FeatureType = 'boolean' | 'limit' | 'enum';
export type FeatureStatus = 'active' | 'future' | 'development';

export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  feature_type: FeatureType;
  default_value: unknown;
  is_active: boolean;
  status: FeatureStatus;
  sort_order: number;
}

export interface TierFeature {
  id: string;
  tier_id: string;
  feature_id: string;
  value: string;
}

export interface TierFeatureWithDetails extends TierFeature {
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  feature_type: FeatureType;
}
```

#### File: `packages/frontend/app/types/usage.ts`

```typescript
/**
 * @file usage.ts
 * @description Usage tracking types.
 */

export interface UsageTracking {
  id: string;
  user_id: string;
  feature_key: string;
  usage_count: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureUsage {
  feature_key: string;
  feature_name: string;
  feature_type: string;
  current_usage: number;
  usage_limit: number;
  period_type: string;
  period_start: string | null;
  period_end: string | null;
  is_unlimited: boolean;
}

export interface UsageResult {
  allowed: boolean;
  current_usage: number;
  usage_limit: number;
  remaining: number;
}

export interface UsageSummary {
  features: FeatureUsage[];
}
```

#### File: `packages/frontend/app/types/trial.ts`

```typescript
/**
 * @file trial.ts
 * @description Trial status types.
 */

export interface TrialStatus {
  is_trial: boolean;
  trial_ends_at: string | null;
  days_remaining: number | null;
  has_been_trialed: boolean;
}

export interface ConvertTrialInput {
  tier_id: string;
  billing_cycle: 'monthly' | 'yearly';
}
```

#### File: `packages/frontend/app/types/contact.ts`

```typescript
/**
 * @file contact.ts
 * @description Contact form types.
 */

export interface ContactSubmissionInput {
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
}
```

#### File: `packages/frontend/app/types/navigation.types.ts`

```typescript
/**
 * @file navigation.types.ts
 * @description Navigation component types.
 */

export interface NavItemBase {
  label: string;
  requiresAuth?: boolean;
}

export interface NavButtonItem extends NavItemBase {
  type: 'button';
  path: string;
}

export interface NavDropdownChild {
  label: string;
  path: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface NavDropdownItem extends NavItemBase {
  type: 'dropdown';
  children: NavDropdownChild[];
}

export type NavItem = NavButtonItem | NavDropdownItem;
```

#### File: `packages/frontend/app/types/index.ts`

```typescript
/**
 * @file index.ts
 * @description Barrel export for all frontend types.
 */

export type { ApiResponse } from './api';
export type { BillingCycle, PeriodType } from './common';
export type { UserProfile, UpdateProfileInput } from './user';
export type { MembershipStatus, Membership, MembershipTier, TierWithFeatures } from './membership';
export type { PaymentHistory, CreateCheckoutInput, UserTierWithFeatures } from './billing';
export type {
  FeatureType,
  FeatureStatus,
  Feature,
  TierFeature,
  TierFeatureWithDetails,
} from './features';
export type { UsageTracking, FeatureUsage, UsageResult, UsageSummary } from './usage';
export type { TrialStatus, ConvertTrialInput } from './trial';
export type { ContactSubmissionInput } from './contact';
export type {
  NavItemBase,
  NavButtonItem,
  NavDropdownChild,
  NavDropdownItem,
  NavItem,
} from './navigation.types';
```

---

### Step 3.5: API Layer

#### File: `packages/frontend/app/api/client.ts`

```typescript
/**
 * @file client.ts
 * @description Base fetch wrapper with typed methods for the backend API.
 * Uses credentials: 'include' for cookie-based auth.
 */

import type { ApiResponse } from '~/types';
import { env } from '~/config/env';

const BASE_URL = env.VITE_BACKEND_URL;

async function baseFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    ...options.headers,
  };

  // Only set Content-Type for JSON bodies (not FormData)
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    if (!response.ok) {
      return { success: false, error: `Request failed with status ${response.status}` };
    }
    return { success: true } as ApiResponse<T>;
  }

  const data: ApiResponse<T> = await response.json();
  return data;
}

export const apiClient = {
  get: <T>(endpoint: string) => baseFetch<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    baseFetch<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    baseFetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    baseFetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  del: <T>(endpoint: string) => baseFetch<T>(endpoint, { method: 'DELETE' }),
};
```

#### File: `packages/frontend/app/api/errors.ts`

```typescript
/**
 * @file errors.ts
 * @description Typed error classes for usage limits and feature gates.
 *
 * Use instanceof checks (never string matching) to handle these errors.
 */

export interface LimitExceededInfo {
  featureKey: string;
  currentUsage: number;
  usageLimit: number;
}

/** Thrown when user exceeds a usage limit (HTTP 429 with USAGE_LIMIT_EXCEEDED code) */
export class UsageLimitExceededError extends Error {
  public info: LimitExceededInfo;

  constructor(info: LimitExceededInfo) {
    super(`Usage limit exceeded for ${info.featureKey}`);
    this.name = 'UsageLimitExceededError';
    this.info = info;
  }
}

/** Thrown when user lacks a feature (HTTP 403 with FEATURE_NOT_AVAILABLE code) */
export class FeatureNotAvailableError extends Error {
  public featureKey: string;

  constructor(featureKey: string) {
    super(`Feature ${featureKey} not available on your plan`);
    this.name = 'FeatureNotAvailableError';
    this.featureKey = featureKey;
  }
}

/**
 * Check an API response for limit/feature errors and throw typed errors.
 * Call this in API functions that may trigger usage or feature gates.
 */
export function checkLimitExceeded(response: {
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}): void {
  if (response.success) return;

  const details = response.details as Record<string, unknown> | undefined;
  if (!details?.code) return;

  if (details.code === 'USAGE_LIMIT_EXCEEDED') {
    throw new UsageLimitExceededError({
      featureKey: details.feature_key as string,
      currentUsage: details.current_usage as number,
      usageLimit: details.usage_limit as number,
    });
  }

  if (details.code === 'FEATURE_NOT_AVAILABLE') {
    throw new FeatureNotAvailableError(details.feature_key as string);
  }
}
```

#### File: `packages/frontend/app/api/auth.api.ts`

```typescript
/**
 * @file auth.api.ts
 * @description Auth API calls to the backend.
 */

import { apiClient } from './client';
import type { UserProfile } from '~/types';

/** Get the currently authenticated user's profile and admin status */
export async function getMe() {
  return apiClient.get<{ profile: UserProfile; isAdmin: boolean }>('/api/auth/me');
}

/** Request a password reset email */
export async function forgotPassword(email: string) {
  return apiClient.post('/api/auth/forgot-password', { email });
}

/** Reset password with a token */
export async function resetPassword(password: string, token: string) {
  return apiClient.post('/api/auth/reset-password', { password, token });
}
```

#### File: `packages/frontend/app/api/billing.api.ts`

```typescript
/**
 * @file billing.api.ts
 * @description Stripe billing API calls.
 */

import { apiClient } from './client';
import type { PaymentHistory, CreateCheckoutInput } from '~/types';

/** Create a Stripe Checkout session */
export async function createCheckoutSession(input: CreateCheckoutInput) {
  return apiClient.post<{ url: string }>('/api/billing/checkout', input);
}

/** Create a Stripe Customer Portal session */
export async function createPortalSession() {
  return apiClient.post<{ url: string }>('/api/billing/portal');
}

/** Get payment history */
export async function getPaymentHistory() {
  return apiClient.get<PaymentHistory[]>('/api/billing/history');
}

/** Force a membership sync from Stripe (used after sign-in) */
export async function forceSyncFromStripe() {
  return apiClient.post('/api/billing/sync');
}

/** Redirect to Stripe Checkout */
export async function redirectToCheckout(input: CreateCheckoutInput) {
  const res = await createCheckoutSession(input);
  if (res.success && res.data?.url) {
    window.location.href = res.data.url;
  }
  return res;
}

/** Redirect to Stripe Customer Portal */
export async function redirectToPortal() {
  const res = await createPortalSession();
  if (res.success && res.data?.url) {
    window.location.href = res.data.url;
  }
  return res;
}
```

#### File: `packages/frontend/app/api/membership.api.ts`

```typescript
/**
 * @file membership.api.ts
 * @description Membership, tier, and usage API calls.
 */

import { apiClient } from './client';
import type {
  TierWithFeatures,
  Membership,
  FeatureUsage,
  TrialStatus,
  UsageSummary,
} from '~/types';

/** Get all tiers with features (public, no auth required) */
export async function getPublicTiersWithFeatures() {
  return apiClient.get<TierWithFeatures[]>('/api/membership/tiers/public');
}

/** Get all tiers (authenticated) */
export async function getTiers() {
  return apiClient.get<TierWithFeatures[]>('/api/membership/tiers');
}

/** Get current user's membership */
export async function getMembership() {
  return apiClient.get<Membership>('/api/membership');
}

/** Check if user has a specific feature */
export async function checkFeature(featureKey: string) {
  return apiClient.get<{ has_feature: boolean; value?: string }>(
    `/api/membership/features/${featureKey}`
  );
}

/** Get trial status */
export async function getTrialStatus() {
  return apiClient.get<TrialStatus>('/api/membership/trial');
}

/** Get usage for a specific feature */
export async function getUsage(featureKey: string) {
  return apiClient.get<FeatureUsage>(`/api/membership/usage/${featureKey}`);
}

/** Get usage summary for all features */
export async function getUsageSummary() {
  return apiClient.get<UsageSummary>('/api/membership/usage');
}
```

#### File: `packages/frontend/app/api/profile.api.ts`

```typescript
/**
 * @file profile.api.ts
 * @description User profile API calls.
 */

import { apiClient } from './client';
import type { UserProfile, UpdateProfileInput } from '~/types';

/** Get the current user's profile */
export async function getProfile() {
  return apiClient.get<UserProfile>('/api/profile');
}

/** Update the current user's profile */
export async function updateProfile(input: UpdateProfileInput) {
  return apiClient.put<UserProfile>('/api/profile', input);
}
```

#### File: `packages/frontend/app/api/contact.api.ts`

```typescript
/**
 * @file contact.api.ts
 * @description Contact form API calls.
 */

import { apiClient } from './client';
import type { ContactSubmissionInput } from '~/types';

/** Submit a contact form (public, rate-limited) */
export async function submitContactForm(input: ContactSubmissionInput) {
  return apiClient.post('/api/contact', input);
}
```

#### File: `packages/frontend/app/api/newsletter.api.ts`

```typescript
/**
 * @file newsletter.api.ts
 * @description Newsletter subscription API calls.
 */

import { apiClient } from './client';

/** Subscribe an email to the newsletter (public) */
export async function subscribeToNewsletter(email: string) {
  return apiClient.post('/api/newsletter/subscribe', { email });
}
```

#### File: `packages/frontend/app/api/index.ts`

```typescript
/**
 * @file index.ts
 * @description Barrel export for all API modules.
 */

export { apiClient } from './client';
export { UsageLimitExceededError, FeatureNotAvailableError, checkLimitExceeded } from './errors';
export type { LimitExceededInfo } from './errors';
export { getMe, forgotPassword, resetPassword as apiResetPassword } from './auth.api';
export {
  createCheckoutSession,
  createPortalSession,
  getPaymentHistory,
  forceSyncFromStripe,
  redirectToCheckout,
  redirectToPortal,
} from './billing.api';
export {
  getPublicTiersWithFeatures,
  getTiers,
  getMembership,
  checkFeature,
  getTrialStatus,
  getUsage,
  getUsageSummary,
} from './membership.api';
export { getProfile, updateProfile } from './profile.api';
export { submitContactForm } from './contact.api';
export { subscribeToNewsletter } from './newsletter.api';
```

---

### Step 3.6: Auth Context

#### File: `packages/frontend/app/contexts/AuthContext.tsx`

```typescript
/**
 * @file AuthContext.tsx
 * @description Auth state management with Supabase onAuthStateChange.
 *
 * Key pattern: After sign-in, fires forceSyncFromStripe() to ensure
 * membership state is current (handles Stripe webhook race conditions).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import * as supabaseClient from '~/lib/supabase.client';
import { forceSyncFromStripe } from '~/api/billing.api';
import { getMe } from '~/api/auth.api';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    supabaseClient.getSession().then((sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabaseClient.onAuthStateChange(
      (_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabaseClient.signIn(email, password);
    if (error) return { error: error.message };

    // Sync membership from Stripe after sign-in (fire-and-forget)
    forceSyncFromStripe().catch(() => {});

    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabaseClient.signUp(email, password);
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await supabaseClient.getCurrentUser();
    setUser(currentUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [user, session, isLoading, signIn, signUp, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

---

### Step 3.7: Utils

#### File: `packages/frontend/app/utils/formatting.ts`

```typescript
/**
 * @file formatting.ts
 * @description Common formatting utilities.
 */

/** Format cents to currency string (e.g., 1999 → "$19.99") */
export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

/** Format ISO date string to localized date */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Capitalize first letter of a string */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

#### File: `packages/frontend/app/utils/navigation.tsx`

```typescript
/**
 * @file navigation.tsx
 * @description Bridge component connecting MUI's component prop with React Router's Link.
 *
 * Usage: <Button component={RouterLink} to="/dashboard">Dashboard</Button>
 */

import { forwardRef } from 'react';
import { Link as RRLink, type LinkProps as RRLinkProps } from 'react-router';

/** Check if a path matches the current location (exact or prefix) */
export function isActivePath(currentPath: string, targetPath: string): boolean {
  if (targetPath === '/') return currentPath === '/';
  return currentPath === targetPath || currentPath.startsWith(targetPath + '/');
}

/**
 * RouterLink - forwardRef wrapper around React Router's Link for MUI compatibility.
 * Pass as `component={RouterLink}` to any MUI component that accepts `component` prop.
 */
export const RouterLink = forwardRef<HTMLAnchorElement, RRLinkProps>((props, ref) => (
  <RRLink ref={ref} {...props} />
));
RouterLink.displayName = 'RouterLink';

/** Alias for convenience */
export const MuiLink = RouterLink;
```

#### File: `packages/frontend/app/utils/features.ts`

```typescript
/**
 * @file features.ts
 * @description Feature display utilities for tier comparison and feature lists.
 */

import type { TierFeatureWithDetails } from '~/types';

/** Check if a tier feature is effectively "available" (true or non-zero limit) */
export function isFeatureAvailable(tf: TierFeatureWithDetails): boolean {
  if (tf.feature_type === 'boolean') return tf.value === 'true';
  if (tf.feature_type === 'limit') return tf.value !== '0';
  return !!tf.value;
}

/** Format a feature value for display (e.g., "true" → "✓", "-1" → "Unlimited") */
export function formatFeatureDisplay(tf: TierFeatureWithDetails): string {
  if (tf.feature_type === 'boolean') {
    return tf.value === 'true' ? '✓' : '✗';
  }
  if (tf.feature_type === 'limit') {
    const num = parseInt(tf.value, 10);
    if (num === -1) return 'Unlimited';
    return num.toLocaleString();
  }
  return tf.value || '—';
}

/** Format just the value portion (for progress bars, etc.) */
export function formatFeatureValue(tf: TierFeatureWithDetails): string {
  if (tf.feature_type === 'limit') {
    const num = parseInt(tf.value, 10);
    if (num === -1) return 'Unlimited';
    return num.toString();
  }
  return tf.value;
}
```

#### File: `packages/frontend/app/utils/index.ts`

```typescript
export { formatPrice, formatDate, capitalize } from './formatting';
export { isActivePath, RouterLink, MuiLink } from './navigation';
export { isFeatureAvailable, formatFeatureDisplay, formatFeatureValue } from './features';
```

---

### Step 3.8: Constants

#### File: `packages/frontend/app/constants/featureKeys.ts`

```typescript
/**
 * @file featureKeys.ts
 * @description Feature key constants matching the backend features table.
 *
 * Must stay in sync with packages/backend/src/constants/feature.constants.ts
 */

export const FEATURE_KEYS = {
  EXAMPLE_BOOLEAN: 'example_boolean',
  EXAMPLE_LIMIT: 'example_limit',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];
```

#### File: `packages/frontend/app/constants/upgradeMessages.ts`

```typescript
/**
 * @file upgradeMessages.ts
 * @description Display names and descriptions shown in UpgradeDialog.
 *
 * Every feature that can trigger an upgrade prompt should have entries here.
 */

import { FEATURE_KEYS } from './featureKeys';

/** User-friendly display name per feature key */
export const FEATURE_NAMES: Record<string, string> = {
  [FEATURE_KEYS.EXAMPLE_BOOLEAN]: 'Example Feature',
  [FEATURE_KEYS.EXAMPLE_LIMIT]: 'Example Usage',
  [FEATURE_KEYS.PRIORITY_SUPPORT]: 'Priority Support',
};

/** Description shown in UpgradeDialog body per feature key */
export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  [FEATURE_KEYS.EXAMPLE_BOOLEAN]:
    'This feature is available on higher tiers. Upgrade to unlock it.',
  [FEATURE_KEYS.EXAMPLE_LIMIT]: "You've reached your usage limit. Upgrade to increase your limit.",
  [FEATURE_KEYS.PRIORITY_SUPPORT]:
    'Get faster support response times. Upgrade to unlock priority support.',
};
```

#### File: `packages/frontend/app/constants/index.ts`

```typescript
export { FEATURE_KEYS, type FeatureKey } from './featureKeys';
export { FEATURE_NAMES, FEATURE_DESCRIPTIONS } from './upgradeMessages';
```

---

### Step 3.9: Root, Entry & Routes

#### File: `packages/frontend/app/root.tsx`

```typescript
/**
 * @file root.tsx
 * @description App root — ThemeProvider + AuthProvider wrapping.
 */

import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigation } from 'react-router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import theme from '~/theme';
import { AuthProvider } from '~/contexts/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigation = useNavigation();
  const isNavigating = navigation.state === 'loading';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        {isNavigating && (
          <LinearProgress
            sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
          />
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Outlet />
        </Box>
      </AuthProvider>
    </ThemeProvider>
  );
}

export function ErrorBoundary() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 4,
          textAlign: 'center',
        }}
      >
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Please try refreshing the page.</p>
        <a href="/">Go Home</a>
      </Box>
    </ThemeProvider>
  );
}
```

#### File: `packages/frontend/app/entry.client.tsx`

```typescript
/**
 * @file entry.client.tsx
 * @description Client entry point for React Router v7 SPA.
 */

import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
```

#### File: `packages/frontend/app/routes.ts`

```typescript
/**
 * @file routes.ts
 * @description Route configuration for React Router v7.
 */

import { type RouteConfig, route, layout, index, prefix } from '@react-router/dev/routes';

export default [
  // Public layout (Header + Footer)
  layout('routes/_layout.tsx', [
    index('routes/_index.tsx'),
    route('contact', 'routes/contact.tsx'),
  ]),

  // Auth routes (no layout)
  ...prefix('auth', [
    route('login', 'routes/auth.login.tsx'),
    route('register', 'routes/auth.register.tsx'),
    route('logout', 'routes/auth.logout.tsx'),
    route('forgot-password', 'routes/auth.forgot-password.tsx'),
    route('reset-password', 'routes/auth.reset-password.tsx'),
  ]),

  // Protected routes with layout (Header + Footer + auth guard)
  layout('routes/_protected-with-layout.tsx', [
    // Dashboard has its own sub-layout (sidebar)
    layout('routes/dashboard.tsx', [
      ...prefix('dashboard', [
        index('routes/dashboard._index.tsx'),
        route('profile', 'routes/dashboard.profile.tsx'),
        route('membership', 'routes/dashboard.membership.tsx'),
        route('billing', 'routes/dashboard.billing.tsx'),
      ]),
    ]),
  ]),
] satisfies RouteConfig;
```

---

### Step 3.10: Layout Routes

#### File: `packages/frontend/app/routes/_layout.tsx`

```typescript
/**
 * @file _layout.tsx
 * @description Public layout wrapper — Header + content + Footer.
 */

import { Outlet } from 'react-router';
import Box from '@mui/material/Box';
import Header from '~/components/layout/Header';
import Footer from '~/components/layout/Footer';

export default function PublicLayout() {
  return (
    <>
      <Header />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </>
  );
}
```

#### File: `packages/frontend/app/routes/_protected.tsx`

```typescript
/**
 * @file _protected.tsx
 * @description Auth guard layout — redirects to login if not authenticated.
 * SPA-mode: uses AuthContext instead of server loader.
 */

import { Outlet, Navigate, useLocation } from 'react-router';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '~/contexts/AuthContext';
import { SITE_MAP } from '~/lib/sitemap';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`${SITE_MAP.login}?redirectTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return <Outlet />;
}
```

#### File: `packages/frontend/app/routes/_protected-with-layout.tsx`

```typescript
/**
 * @file _protected-with-layout.tsx
 * @description Protected route with Header + Footer wrapping.
 */

import { Outlet, Navigate, useLocation } from 'react-router';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '~/contexts/AuthContext';
import { SITE_MAP } from '~/lib/sitemap';
import Header from '~/components/layout/Header';
import Footer from '~/components/layout/Footer';

export default function ProtectedWithLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`${SITE_MAP.login}?redirectTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return (
    <>
      <Header />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </>
  );
}
```

---

### Step 3.11: Layout Components

#### File: `packages/frontend/app/components/layout/Header.tsx`

```typescript
/**
 * @file Header.tsx
 * @description App header with nav links, auth buttons, and mobile drawer.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '~/contexts/AuthContext';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

const NAV_LINKS = [
  { label: 'Home', path: SITE_MAP.home },
  { label: 'Pricing', path: SITE_MAP.pricing },
  { label: 'Contact', path: SITE_MAP.contact },
];

export default function Header() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  return (
    <>
      <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar>
          {/* Logo */}
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ textDecoration: 'none', color: 'primary.main', fontWeight: 700, mr: 4 }}
          >
            {{PROJECT_DISPLAY_NAME}}
          </Typography>

          {/* Desktop Nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, flex: 1 }}>
            {NAV_LINKS.map((link) => (
              <Button
                key={link.path}
                component={RouterLink}
                to={link.path}
                color="inherit"
                size="small"
              >
                {link.label}
              </Button>
            ))}
          </Box>

          {/* Desktop Auth */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            {isAuthenticated ? (
              <>
                <Button
                  component={RouterLink}
                  to={SITE_MAP.dashboard}
                  variant="outlined"
                  size="small"
                  startIcon={<DashboardIcon />}
                >
                  Dashboard
                </Button>
                <Button
                  component={RouterLink}
                  to={SITE_MAP.logout}
                  size="small"
                  color="inherit"
                  startIcon={<LogoutIcon />}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button component={RouterLink} to={SITE_MAP.login} color="inherit" size="small">
                  Login
                </Button>
                <Button
                  component={RouterLink}
                  to={SITE_MAP.register}
                  variant="contained"
                  size="small"
                >
                  Sign Up
                </Button>
              </>
            )}
          </Box>

          {/* Mobile Hamburger */}
          <IconButton
            sx={{ display: { md: 'none' }, ml: 'auto' }}
            onClick={handleDrawerToggle}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={handleDrawerToggle}>
        <Box sx={{ width: 250 }} onClick={handleDrawerToggle}>
          <List>
            {NAV_LINKS.map((link) => (
              <ListItem key={link.path} disablePadding>
                <ListItemButton onClick={() => navigate(link.path)}>
                  <ListItemText primary={link.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          <List>
            {isAuthenticated ? (
              <>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate(SITE_MAP.dashboard)}>
                    <ListItemText primary="Dashboard" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate(SITE_MAP.logout)}>
                    <ListItemText primary="Logout" />
                  </ListItemButton>
                </ListItem>
              </>
            ) : (
              <>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate(SITE_MAP.login)}>
                    <ListItemText primary="Login" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate(SITE_MAP.register)}>
                    <ListItemText primary="Sign Up" />
                  </ListItemButton>
                </ListItem>
              </>
            )}
          </List>
        </Box>
      </Drawer>
    </>
  );
}
```

#### File: `packages/frontend/app/components/layout/Footer.tsx`

```typescript
/**
 * @file Footer.tsx
 * @description App footer with nav links and copyright.
 */

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{ bgcolor: 'grey.100', borderTop: 1, borderColor: 'divider', py: 6, mt: 'auto' }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="h6" fontWeight={700} color="primary" gutterBottom>
              {{PROJECT_DISPLAY_NAME}}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your go-to platform for managing your SaaS needs.
            </Typography>
          </Grid>

          {/* Quick Links */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Quick Links
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Link component={RouterLink} to={SITE_MAP.home} color="text.secondary" underline="hover">
                Home
              </Link>
              <Link component={RouterLink} to={SITE_MAP.pricing} color="text.secondary" underline="hover">
                Pricing
              </Link>
              <Link component={RouterLink} to={SITE_MAP.contact} color="text.secondary" underline="hover">
                Contact
              </Link>
            </Box>
          </Grid>

          {/* Account */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Account
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Link component={RouterLink} to={SITE_MAP.login} color="text.secondary" underline="hover">
                Login
              </Link>
              <Link component={RouterLink} to={SITE_MAP.register} color="text.secondary" underline="hover">
                Sign Up
              </Link>
              <Link component={RouterLink} to={SITE_MAP.dashboard} color="text.secondary" underline="hover">
                Dashboard
              </Link>
            </Box>
          </Grid>
        </Grid>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          &copy; {new Date().getFullYear()} {{PROJECT_DISPLAY_NAME}}. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}
```

#### File: `packages/frontend/app/components/dashboard/DashboardLayout.tsx`

```typescript
/**
 * @file DashboardLayout.tsx
 * @description Dashboard layout with sidebar navigation.
 * Desktop: permanent sidebar (240px). Mobile: temporary drawer via hamburger.
 */

import { useState } from 'react';
import { useLocation } from 'react-router';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import PaymentIcon from '@mui/icons-material/Payment';
import { RouterLink } from '~/utils/navigation';
import { isActivePath } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

const DRAWER_WIDTH = 240;

const MENU_ITEMS = [
  { label: 'Overview', path: SITE_MAP.dashboard, icon: <HomeIcon /> },
  { label: 'Profile', path: SITE_MAP.profile, icon: <PersonIcon /> },
  { label: 'Membership', path: SITE_MAP.membership, icon: <CardMembershipIcon /> },
  { label: 'Billing', path: SITE_MAP.billing, icon: <PaymentIcon /> },
];

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const drawerContent = (
    <Box sx={{ pt: 2 }}>
      <Typography variant="h6" sx={{ px: 2, pb: 2, fontWeight: 700, color: 'primary.main' }}>
        Dashboard
      </Typography>
      <List>
        {MENU_ITEMS.map((item) => {
          const active = isActivePath(location.pathname, item.path);
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={active}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': { color: 'inherit' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Mobile App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { md: 'none' },
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" color="text.primary">
            Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            minHeight: 'calc(100vh - 64px)',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          p: 3,
          mt: { xs: '56px', md: 0 },
          minHeight: { md: 'calc(100vh - 64px)' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
```

---

### Step 3.12: Auth Pages

#### File: `packages/frontend/app/routes/auth.login.tsx`

```typescript
/**
 * @file auth.login.tsx
 * @description Login page with email/password form.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { useAuth } from '~/contexts/AuthContext';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

export default function LoginPage() {
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || SITE_MAP.dashboard;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      navigate(redirectTo);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
          Sign In
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Welcome back! Sign in to your account.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </Box>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Link component={RouterLink} to={SITE_MAP.forgotPassword} variant="body2">
            Forgot password?
          </Link>
        </Box>
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Link component={RouterLink} to={SITE_MAP.register}>
              Sign up
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
```

#### File: `packages/frontend/app/routes/auth.register.tsx`

```typescript
/**
 * @file auth.register.tsx
 * @description Registration page with name, email, password form.
 */

import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { useAuth } from '~/contexts/AuthContext';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

export default function RegisterPage() {
  const { signUp, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={SITE_MAP.dashboard} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    const result = await signUp(email, password);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom fontWeight={700}>
            Check your email
          </Typography>
          <Typography color="text.secondary">
            We've sent a confirmation link to <strong>{email}</strong>.
            Click the link to activate your account.
          </Typography>
          <Button component={RouterLink} to={SITE_MAP.login} sx={{ mt: 3 }}>
            Back to Login
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
          Create Account
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Get started with your free account.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              fullWidth
            />
          </Box>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            helperText="Minimum 8 characters"
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
            {submitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </Box>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Already have an account?{' '}
            <Link component={RouterLink} to={SITE_MAP.login}>
              Sign in
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
```

#### File: `packages/frontend/app/routes/auth.logout.tsx`

```typescript
/**
 * @file auth.logout.tsx
 * @description Logout page — calls signOut and redirects to home.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useAuth } from '~/contexts/AuthContext';

export default function LogoutPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    signOut().then(() => navigate('/', { replace: true }));
  }, [signOut, navigate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">Signing out...</Typography>
    </Box>
  );
}
```

#### File: `packages/frontend/app/routes/auth.forgot-password.tsx`

```typescript
/**
 * @file auth.forgot-password.tsx
 * @description Forgot password page — sends reset email via Supabase.
 */

import { useState } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { resetPassword } from '~/lib/supabase.client';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const { error: err } = await resetPassword(email);
    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom fontWeight={700}>
            Check your email
          </Typography>
          <Typography color="text.secondary">
            If an account exists for <strong>{email}</strong>, we've sent a password reset link.
          </Typography>
          <Button component={RouterLink} to={SITE_MAP.login} sx={{ mt: 3 }}>
            Back to Login
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
          Reset Password
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Enter your email and we'll send you a reset link.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </Box>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Link component={RouterLink} to={SITE_MAP.login} variant="body2">
            Back to Login
          </Link>
        </Box>
      </Paper>
    </Container>
  );
}
```

#### File: `packages/frontend/app/routes/auth.reset-password.tsx`

```typescript
/**
 * @file auth.reset-password.tsx
 * @description Reset password page — user sets new password after clicking email link.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { updatePassword } from '~/lib/supabase.client';
import { SITE_MAP } from '~/lib/sitemap';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    const { error: err } = await updatePassword(password);

    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else {
      navigate(SITE_MAP.login, { replace: true });
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
          Set New Password
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            helperText="Minimum 8 characters"
          />
          <TextField
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
            {submitting ? 'Updating...' : 'Update Password'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
```

---

### Step 3.13: Dashboard Pages

#### File: `packages/frontend/app/routes/dashboard.tsx`

```typescript
/**
 * @file dashboard.tsx
 * @description Dashboard layout route — wraps child routes in DashboardLayout.
 */

import { Outlet } from 'react-router';
import DashboardLayout from '~/components/dashboard/DashboardLayout';

export default function DashboardRoute() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
```

#### File: `packages/frontend/app/routes/dashboard._index.tsx`

```typescript
/**
 * @file dashboard._index.tsx
 * @description Dashboard home — overview with usage stats and current plan.
 */

import { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import { getMembership, getUsageSummary } from '~/api';
import { RouterLink } from '~/utils/navigation';
import { capitalize } from '~/utils/formatting';
import { SITE_MAP } from '~/lib/sitemap';
import type { Membership, UsageSummary } from '~/types';

export default function DashboardHome() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMembership(), getUsageSummary()]).then(([memRes, usageRes]) => {
      if (memRes.success && memRes.data) setMembership(memRes.data);
      if (usageRes.success && usageRes.data) setUsage(usageRes.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} />
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={150} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Current Plan */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Current Plan
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {membership ? capitalize(membership.tier_name) : 'Free'}
              </Typography>
              <Chip
                label={membership?.membership_status || 'active'}
                color={membership?.membership_status === 'active' ? 'success' : 'warning'}
                size="small"
                sx={{ mt: 1 }}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  component={RouterLink}
                  to={SITE_MAP.membership}
                  variant="outlined"
                  size="small"
                >
                  Manage Plan
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Usage Stats */}
        {usage?.features.map((feature) => (
          <Grid key={feature.feature_key} size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {feature.feature_name}
                </Typography>
                {feature.is_unlimited ? (
                  <Typography variant="h5" fontWeight={700}>
                    Unlimited
                  </Typography>
                ) : (
                  <>
                    <Typography variant="h5" fontWeight={700}>
                      {feature.current_usage} / {feature.usage_limit}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(
                        (feature.current_usage / feature.usage_limit) * 100,
                        100
                      )}
                      sx={{ mt: 1, borderRadius: 1 }}
                    />
                  </>
                )}
                {feature.period_type !== 'none' && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Resets {feature.period_type}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
```

#### File: `packages/frontend/app/routes/dashboard.profile.tsx`

```typescript
/**
 * @file dashboard.profile.tsx
 * @description Profile editing page.
 */

import { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import { getProfile, updateProfile } from '~/api';
import type { UserProfile } from '~/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    getProfile().then((res) => {
      if (res.success && res.data) {
        const p = res.data;
        setProfile(p);
        setFirstName(p.first_name || '');
        setLastName(p.last_name || '');
        setPhone(p.phone || '');
        setBio(p.bio || '');
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    const res = await updateProfile({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      bio: bio || null,
    });

    if (res.success) {
      setMessage('Profile updated successfully');
      if (res.data) setProfile(res.data);
    } else {
      setError(res.error || 'Failed to update profile');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={150} height={40} />
        <Skeleton variant="rounded" height={300} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Profile
      </Typography>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
            />
          </Box>
          <TextField
            label="Email"
            value={profile?.email || ''}
            disabled
            fullWidth
            helperText="Email cannot be changed"
          />
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
          />
          <TextField
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
```

#### File: `packages/frontend/app/routes/dashboard.membership.tsx`

```typescript
/**
 * @file dashboard.membership.tsx
 * @description Membership management — current plan and available tiers.
 */

import { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { getMembership, getTiers, redirectToCheckout } from '~/api';
import { formatPrice, capitalize } from '~/utils/formatting';
import type { Membership, TierWithFeatures } from '~/types';

export default function MembershipPage() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [tiers, setTiers] = useState<TierWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMembership(), getTiers()]).then(([memRes, tiersRes]) => {
      if (memRes.success && memRes.data) setMembership(memRes.data);
      if (tiersRes.success && tiersRes.data) setTiers(tiersRes.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} />
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={300} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Membership
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Current plan: <strong>{membership ? capitalize(membership.tier_name) : 'Free'}</strong>
      </Typography>

      <Grid container spacing={3}>
        {tiers.map((tier) => {
          const isCurrent = membership?.tier_name === tier.name;
          return (
            <Grid key={tier.id} size={{ xs: 12, md: 4 }}>
              <Card
                variant={isCurrent ? 'elevation' : 'outlined'}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  ...(isCurrent && { borderColor: 'primary.main', borderWidth: 2, borderStyle: 'solid' }),
                }}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h5" fontWeight={700}>
                      {tier.display_name}
                    </Typography>
                    {isCurrent && <Chip label="Current" color="primary" size="small" />}
                  </Box>

                  {tier.price_monthly > 0 ? (
                    <Typography variant="h4" fontWeight={700} color="primary">
                      {formatPrice(tier.price_monthly * 100)}
                      <Typography component="span" variant="body2" color="text.secondary">
                        /mo
                      </Typography>
                    </Typography>
                  ) : (
                    <Typography variant="h4" fontWeight={700} color="primary">
                      Free
                    </Typography>
                  )}

                  {tier.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {tier.description}
                    </Typography>
                  )}

                  <List dense sx={{ mt: 2 }}>
                    {tier.features.map((f) => {
                      const enabled =
                        f.feature_type === 'boolean' ? f.value === 'true' : f.value !== '0';
                      return (
                        <ListItem key={f.key} disableGutters>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {enabled ? (
                              <CheckCircleIcon fontSize="small" color="success" />
                            ) : (
                              <CancelIcon fontSize="small" color="disabled" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={f.name}
                            secondary={
                              f.feature_type === 'limit'
                                ? parseInt(f.value) === -1
                                  ? 'Unlimited'
                                  : `Up to ${f.value}`
                                : undefined
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0 }}>
                  {isCurrent ? (
                    <Button disabled fullWidth variant="outlined">
                      Current Plan
                    </Button>
                  ) : tier.price_monthly > 0 ? (
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() =>
                        redirectToCheckout({ tier_id: tier.id, billing_cycle: 'monthly' })
                      }
                    >
                      Upgrade
                    </Button>
                  ) : (
                    <Button fullWidth variant="outlined" disabled>
                      Free Tier
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
```

#### File: `packages/frontend/app/routes/dashboard.billing.tsx`

```typescript
/**
 * @file dashboard.billing.tsx
 * @description Billing page — payment history and Stripe Portal access.
 */

import { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getPaymentHistory, redirectToPortal } from '~/api';
import { formatPrice, formatDate } from '~/utils/formatting';
import type { PaymentHistory } from '~/types';

export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentHistory().then((res) => {
      if (res.success && res.data) setPayments(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={150} height={40} />
        <Skeleton variant="rounded" height={300} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Billing
        </Typography>
        <Button variant="outlined" onClick={() => redirectToPortal()} startIcon={<OpenInNewIcon />}>
          Manage Subscription
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No payment history yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.created_at)}</TableCell>
                    <TableCell>{payment.description || '—'}</TableCell>
                    <TableCell align="right">
                      {formatPrice(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status}
                        color={payment.status === 'paid' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {payment.invoice_url && (
                        <Button
                          size="small"
                          href={payment.invoice_url}
                          target="_blank"
                          rel="noopener"
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
```

---

### Step 3.14: Landing Page

#### File: `packages/frontend/app/routes/_index.tsx`

```typescript
/**
 * @file _index.tsx
 * @description Landing page composing all sections.
 */

import HeroSection from '~/components/landing/HeroSection';
import FeaturesSection from '~/components/landing/FeaturesSection';
import PricingSection from '~/components/landing/PricingSection';
import CTASection from '~/components/landing/CTASection';

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <CTASection />
    </>
  );
}
```

#### File: `packages/frontend/app/components/landing/HeroSection.tsx`

```typescript
/**
 * @file HeroSection.tsx
 * @description Landing hero with headline, subtitle, and CTA buttons.
 */

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

export default function HeroSection() {
  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(20,184,166,0.08) 100%)',
        py: { xs: 8, md: 12 },
      }}
    >
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Typography variant="h2" fontWeight={700} sx={{ mb: 2 }}>
          Build Your SaaS{' '}
          <Typography component="span" variant="h2" fontWeight={700} color="primary">
            Faster
          </Typography>
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
          A production-ready foundation with auth, billing, feature gating, and a beautiful
          dashboard — so you can focus on what makes your product unique.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            component={RouterLink}
            to={SITE_MAP.register}
            variant="contained"
            size="large"
            sx={{ px: 4, py: 1.5 }}
          >
            Get Started Free
          </Button>
          <Button
            component={RouterLink}
            to={SITE_MAP.pricing}
            variant="outlined"
            size="large"
            sx={{ px: 4, py: 1.5 }}
          >
            View Pricing
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
```

#### File: `packages/frontend/app/components/landing/FeaturesSection.tsx`

```typescript
/**
 * @file FeaturesSection.tsx
 * @description Features grid showcasing product capabilities.
 */

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import PaymentIcon from '@mui/icons-material/Payment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TuneIcon from '@mui/icons-material/Tune';
import SupportIcon from '@mui/icons-material/Support';

const FEATURES = [
  {
    icon: <SecurityIcon sx={{ fontSize: 40 }} />,
    title: 'Secure Authentication',
    description: 'Enterprise-grade auth with Supabase. Email/password, magic links, and OAuth ready.',
  },
  {
    icon: <PaymentIcon sx={{ fontSize: 40 }} />,
    title: 'Stripe Billing',
    description: 'Subscriptions, checkout, customer portal, and webhook handling out of the box.',
  },
  {
    icon: <TuneIcon sx={{ fontSize: 40 }} />,
    title: 'Feature Gating',
    description: 'Boolean, limit, and enum features per tier. Usage tracking with auto-reset periods.',
  },
  {
    icon: <DashboardIcon sx={{ fontSize: 40 }} />,
    title: 'Dashboard Ready',
    description: 'Responsive dashboard with sidebar navigation, profile management, and billing.',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 40 }} />,
    title: 'Performance First',
    description: 'Vite-powered SPA with code splitting, MUI theming, and optimized bundle size.',
  },
  {
    icon: <SupportIcon sx={{ fontSize: 40 }} />,
    title: 'Production Patterns',
    description: 'Error handling, rate limiting, input validation, and security best practices baked in.',
  },
];

export default function FeaturesSection() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Typography variant="h3" fontWeight={700} align="center" gutterBottom>
          Everything You Need
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}
        >
          Skip months of boilerplate. Start with a complete, tested foundation.
        </Typography>

        <Grid container spacing={3}>
          {FEATURES.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
```

#### File: `packages/frontend/app/components/landing/PricingSection.tsx`

```typescript
/**
 * @file PricingSection.tsx
 * @description Pricing section with DB-fetched tiers and monthly/yearly toggle.
 */

import { useState, useEffect } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getPublicTiersWithFeatures, redirectToCheckout } from '~/api';
import { formatPrice } from '~/utils/formatting';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';
import type { TierWithFeatures, BillingCycle } from '~/types';

export default function PricingSection() {
  const [tiers, setTiers] = useState<TierWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    getPublicTiersWithFeatures().then((res) => {
      if (res.success && res.data) setTiers(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <Box id="pricing" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'grey.50' }}>
      <Container maxWidth="lg">
        <Typography variant="h3" fontWeight={700} align="center" gutterBottom>
          Simple Pricing
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 4 }}
        >
          Choose the plan that fits your needs.
        </Typography>

        {/* Billing Cycle Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <ToggleButtonGroup
            value={cycle}
            exclusive
            onChange={(_, val) => val && setCycle(val)}
            size="small"
          >
            <ToggleButton value="monthly">Monthly</ToggleButton>
            <ToggleButton value="yearly">
              Yearly
              <Chip label="Save 15%" size="small" color="success" sx={{ ml: 1 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {loading ? (
          <Grid container spacing={3} justifyContent="center">
            {[1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, md: 4 }}>
                <Skeleton variant="rounded" height={400} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={3} justifyContent="center">
            {tiers.map((tier, index) => {
              const price = cycle === 'monthly' ? tier.price_monthly : tier.price_yearly;
              const isPopular = index === 1;

              return (
                <Grid key={tier.id} size={{ xs: 12, md: 4 }}>
                  <Card
                    variant={isPopular ? 'elevation' : 'outlined'}
                    elevation={isPopular ? 8 : 0}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      ...(isPopular && {
                        borderColor: 'primary.main',
                        borderWidth: 2,
                        borderStyle: 'solid',
                      }),
                    }}
                  >
                    {isPopular && (
                      <Chip
                        label="Most Popular"
                        color="primary"
                        size="small"
                        sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)' }}
                      />
                    )}
                    <CardContent sx={{ flex: 1, pt: isPopular ? 4 : 3 }}>
                      <Typography variant="h5" fontWeight={700} gutterBottom>
                        {tier.display_name}
                      </Typography>
                      {price > 0 ? (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="h3" fontWeight={700} color="primary" component="span">
                            {formatPrice(price * 100)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" component="span">
                            /{cycle === 'monthly' ? 'mo' : 'yr'}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="h3" fontWeight={700} color="primary" sx={{ mb: 2 }}>
                          Free
                        </Typography>
                      )}

                      {tier.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {tier.description}
                        </Typography>
                      )}

                      <List dense>
                        {tier.features.map((f) => {
                          const enabled =
                            f.feature_type === 'boolean'
                              ? f.value === 'true'
                              : f.value !== '0';
                          if (!enabled) return null;
                          return (
                            <ListItem key={f.key} disableGutters>
                              <ListItemIcon sx={{ minWidth: 28 }}>
                                <CheckCircleIcon fontSize="small" color="success" />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  f.feature_type === 'limit'
                                    ? `${parseInt(f.value) === -1 ? 'Unlimited' : f.value} ${f.name}`
                                    : f.name
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    </CardContent>

                    <CardActions sx={{ p: 2 }}>
                      {price > 0 ? (
                        <Button
                          fullWidth
                          variant={isPopular ? 'contained' : 'outlined'}
                          size="large"
                          onClick={() =>
                            redirectToCheckout({ tier_id: tier.id, billing_cycle: cycle })
                          }
                        >
                          Get Started
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="outlined"
                          size="large"
                          component={RouterLink}
                          to={SITE_MAP.register}
                        >
                          Sign Up Free
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
```

#### File: `packages/frontend/app/components/landing/CTASection.tsx`

```typescript
/**
 * @file CTASection.tsx
 * @description Final call-to-action section.
 */

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';

export default function CTASection() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Typography variant="h3" fontWeight={700} gutterBottom>
          Ready to Get Started?
        </Typography>
        <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
          Join thousands of users who trust {{PROJECT_DISPLAY_NAME}}.
          Start building today — no credit card required.
        </Typography>
        <Button
          component={RouterLink}
          to={SITE_MAP.register}
          variant="contained"
          size="large"
          sx={{
            bgcolor: 'white',
            color: 'primary.main',
            px: 4,
            py: 1.5,
            '&:hover': { bgcolor: 'grey.100' },
          }}
        >
          Create Free Account
        </Button>
      </Container>
    </Box>
  );
}
```

---

### Step 3.15: Contact Page

This is a placeholder that Phase 4 will flesh out with a full contact form.

#### File: `packages/frontend/app/routes/contact.tsx`

```typescript
/**
 * @file contact.tsx
 * @description Contact page placeholder. Phase 4 adds the full form.
 */

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export default function ContactPage() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h3" fontWeight={700} gutterBottom>
          Contact Us
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Have questions? We'd love to hear from you. Contact form coming soon.
        </Typography>
      </Box>
    </Container>
  );
}
```

---

### Step 3.16: UpgradeDialog

#### File: `packages/frontend/app/components/dialogs/UpgradeDialog.tsx`

```typescript
/**
 * @file UpgradeDialog.tsx
 * @description Shared dialog for upgrade prompts when a user hits a usage limit
 * or lacks a feature. Driven by feature keys from constants.
 *
 * Usage: <UpgradeDialog open={open} onClose={close} featureKey="example_limit" />
 */

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router';
import { FEATURE_NAMES, FEATURE_DESCRIPTIONS } from '~/constants';
import { SITE_MAP } from '~/lib/sitemap';

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  featureKey: string;
}

export default function UpgradeDialog({ open, onClose, featureKey }: UpgradeDialogProps) {
  const navigate = useNavigate();

  const featureName = FEATURE_NAMES[featureKey] || 'This Feature';
  const featureDescription =
    FEATURE_DESCRIPTIONS[featureKey] || 'Upgrade your plan to access this feature.';

  const handleViewPlans = () => {
    onClose();
    navigate(SITE_MAP.membership);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'warning.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockIcon sx={{ fontSize: 32, color: 'warning.dark' }} />
          </Box>
        </Box>
        <Typography variant="h6" fontWeight={700}>
          Upgrade to Access {featureName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography align="center" color="text.secondary">
          {featureDescription}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Maybe Later
        </Button>
        <Button onClick={handleViewPlans} variant="contained">
          View Plans
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

---

## Verification Checklist

1. **Install dependencies**: `npm install` from root succeeds (both backend and frontend packages resolve)
2. **TypeScript compiles**: `npm run typecheck:frontend` passes with no errors
3. **Dev server starts**: `npm run dev:frontend` boots Vite without crash
4. **Landing page renders**: Navigate to `http://localhost:5173` — Hero, Features, Pricing (fetched from API), and CTA sections visible
5. **Pricing section**: Tiers load from `/api/membership/tiers/public` and display with monthly/yearly toggle
6. **Auth flow — register**: Navigate to `/auth/register`, fill form, submit — success message appears
7. **Auth flow — login**: Navigate to `/auth/login`, sign in — redirects to `/dashboard`
8. **Protected routes**: Visiting `/dashboard` without auth redirects to `/auth/login?redirectTo=%2Fdashboard`
9. **Dashboard overview**: Shows current plan card and usage stats from API
10. **Dashboard profile**: Edit profile form loads and saves successfully
11. **Dashboard membership**: Tier cards display with features list and upgrade buttons
12. **Dashboard billing**: Payment history table renders (empty state or with data), "Manage Subscription" redirects to Stripe Portal
13. **Auth flow — logout**: `/auth/logout` signs out and redirects to home
14. **Password reset**: Forgot password sends email, reset password page accepts new password
15. **Mobile responsive**: Header collapses to hamburger menu, dashboard sidebar becomes temporary drawer
16. **Theme applied**: Primary color `{{PRIMARY_COLOR}}` and font family `{{FONT_FAMILY}}` visible across all pages
