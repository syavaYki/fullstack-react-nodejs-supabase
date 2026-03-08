# Phase 4: Testing & Polish — Contact Form, Newsletter, Tests, Documentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the frontend with a full contact form and newsletter integration, add backend test infrastructure with mock factories and example tests, and create project documentation.

**Architecture:** Test infrastructure uses Vitest with `vi.hoisted()` + `vi.mock()` for module mocking. Mock factories use the overrides spread pattern for customization. Each test file creates a fresh Express app in `beforeEach` for isolation. Contact form and newsletter connect to the Phase 2 backend endpoints.

**Tech Stack:** Vitest, vi.mock, Express (supertest optional), Supabase mock, Stripe mock

---

## Prerequisites

- **Phases 1, 2, and 3 must be complete and verified.** Backend runs with all routes, frontend renders with auth and dashboard working.
- All Phase 3 frontend files compile without errors.

---

## Token Substitution Table

Same tokens as Phase 1 — see Phase 1 document for the full table.

---

## What This Phase Produces

~17 new/updated files:

**Frontend (3):** `contact.tsx` (full form replacing placeholder), `NewsletterSection.tsx`, updated `_index.tsx`
**Test Config (1):** `packages/backend/vitest.config.ts`
**Test Mocks (3):** `__tests__/mocks/supabase.mock.ts`, `__tests__/mocks/stripe.mock.ts`, `__tests__/mocks/index.ts`
**Example Tests (5):** `auth.routes.test.ts`, `profile.routes.test.ts`, `membership.middleware.test.ts`, `contact.routes.test.ts`, `response.utils.test.ts`
**Documentation (3):** `.env.example` (comprehensive), `README.md`, `todo.md`
**Root Config (1):** Updated root `package.json` with test scripts

---

## Implementation

### Step 4.1: Contact Page (Full Form)

Replace the Phase 3 placeholder with a complete contact form.

#### File: `packages/frontend/app/routes/contact.tsx`

```typescript
/**
 * @file contact.tsx
 * @description Contact page with form submission to backend.
 */

import { useState } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import EmailIcon from '@mui/icons-material/Email';
import { submitContactForm } from '~/api';

export default function ContactPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const res = await submitContactForm({ first_name: firstName, last_name: lastName, email, subject, message });

    if (res.success) {
      setSuccess(true);
    } else {
      setError(res.error || 'Failed to send message. Please try again.');
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <EmailIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Message Sent!
          </Typography>
          <Typography color="text.secondary">
            Thanks for reaching out. We'll get back to you within 24 hours.
          </Typography>
          <Button onClick={() => { setSuccess(false); setFirstName(''); setLastName(''); setEmail(''); setSubject(''); setMessage(''); }} sx={{ mt: 3 }}>
            Send Another Message
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h3" fontWeight={700} align="center" gutterBottom>
        Contact Us
      </Typography>
      <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
        Have questions or feedback? We'd love to hear from you.
      </Typography>

      <Paper sx={{ p: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required fullWidth />
            </Grid>
          </Grid>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required fullWidth />
          <TextField label="Message" value={message} onChange={(e) => setMessage(e.target.value)} required fullWidth multiline rows={5} />
          <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
            {submitting ? 'Sending...' : 'Send Message'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
```

---

### Step 4.2: Newsletter Section

#### File: `packages/frontend/app/components/landing/NewsletterSection.tsx`

```typescript
/**
 * @file NewsletterSection.tsx
 * @description Newsletter signup section wired to the backend API.
 */

import { useState } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { subscribeToNewsletter } from '~/api';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const res = await subscribeToNewsletter(email);

    if (res.success) {
      setSuccess(true);
      setEmail('');
    } else {
      setError(res.error || 'Failed to subscribe. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: 'grey.50' }}>
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Stay Updated
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Get the latest news and updates delivered to your inbox.
        </Typography>

        {success ? (
          <Alert severity="success">You're subscribed! Check your inbox for confirmation.</Alert>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}
            >
              <TextField
                placeholder="Enter your email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                size="small"
                sx={{ flex: 1, maxWidth: 300 }}
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
}
```

#### Updated: `packages/frontend/app/routes/_index.tsx`

Add the newsletter section to the landing page. Replace the Phase 3 version:

```typescript
/**
 * @file _index.tsx
 * @description Landing page composing all sections.
 */

import HeroSection from '~/components/landing/HeroSection';
import FeaturesSection from '~/components/landing/FeaturesSection';
import PricingSection from '~/components/landing/PricingSection';
import NewsletterSection from '~/components/landing/NewsletterSection';
import CTASection from '~/components/landing/CTASection';

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <NewsletterSection />
      <CTASection />
    </>
  );
}
```

---

### Step 4.3: Test Configuration

#### File: `packages/backend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

---

### Step 4.4: Mock Factories

#### File: `packages/backend/src/__tests__/mocks/supabase.mock.ts`

```typescript
/**
 * @file supabase.mock.ts
 * @description Mock factories for Supabase entities and client.
 *
 * Pattern: Each factory accepts an `overrides` object spread into defaults.
 * The query builder mock supports Supabase's chainable fluent API.
 */

import { vi } from 'vitest';

// ============================================
// AUTH USER FACTORIES
// ============================================

export function createMockAuthUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-123',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    phone: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { first_name: 'Test', last_name: 'User' },
    ...overrides,
  };
}

export function createMockSession(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'mock-access-token-123',
    refresh_token: 'mock-refresh-token-123',
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user: createMockAuthUser(),
    ...overrides,
  };
}

// ============================================
// DATABASE ENTITY FACTORIES
// ============================================

export function createMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone: null,
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tier-uuid-123',
    name: '{{TIER_2_NAME}}',
    display_name: '{{TIER_2_DISPLAY}}',
    description: 'Mid-tier with advanced features',
    price_monthly: {{TIER_2_PRICE_MONTHLY}},
    price_yearly: {{TIER_2_PRICE_YEARLY}},
    stripe_price_id_monthly: 'price_monthly_test123',
    stripe_price_id_yearly: 'price_yearly_test123',
    stripe_product_id: 'prod_test123',
    is_active: true,
    is_default: false,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership-uuid-123',
    user_id: 'user-uuid-123',
    tier_id: 'tier-uuid-123',
    status: 'active',
    started_at: new Date().toISOString(),
    expires_at: null,
    billing_cycle: 'monthly',
    stripe_subscription_id: 'sub_test123',
    stripe_price_id: 'price_test123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockFeature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feature-uuid-123',
    key: 'example_limit',
    name: 'Example Limit Feature',
    description: 'An example limit feature',
    feature_type: 'limit',
    default_value: '5',
    is_active: true,
    status: 'active',
    sort_order: 10,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockUsageTracking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'usage-uuid-123',
    user_id: 'user-uuid-123',
    feature_key: 'example_limit',
    usage_count: 3,
    period_start: new Date().toISOString(),
    period_end: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockContactSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contact-uuid-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    subject: 'General Inquiry',
    message: 'This is a test message.',
    ip_address: null,
    user_agent: null,
    status: 'new',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockNewsletterSubscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: 'subscriber-uuid-123',
    email: 'subscriber@example.com',
    subscribed_at: new Date().toISOString(),
    unsubscribed_at: null,
    source: 'website',
    ...overrides,
  };
}

// ============================================
// RESPONSE HELPERS
// ============================================

export function createMockSupabaseResponse<T>(data: T | null, error: Error | null = null) {
  return {
    data,
    error,
    count: data ? (Array.isArray(data) ? data.length : 1) : 0,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK',
  };
}

export function createMockAuthResponse(
  user: ReturnType<typeof createMockAuthUser> | null = null,
  session: ReturnType<typeof createMockSession> | null = null,
  error: Error | null = null
) {
  return { data: { user, session }, error };
}

export function createMockSupabaseError(message: string, code = 'PGRST116') {
  return { message, code, details: '', hint: '' };
}

// ============================================
// CLIENT MOCK
// ============================================

/**
 * Chainable query builder mock simulating Supabase's fluent API.
 */
export function createMockQueryBuilder<T>(defaultData: T | null = null) {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    like: vi.fn(),
    ilike: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    single: vi.fn().mockResolvedValue(createMockSupabaseResponse(defaultData)),
    maybeSingle: vi.fn().mockResolvedValue(createMockSupabaseResponse(defaultData)),
    then: vi.fn().mockImplementation((resolve) => resolve(createMockSupabaseResponse(defaultData))),
  };

  // Make chainable methods return the builder
  Object.keys(mock).forEach((key) => {
    if (!['single', 'maybeSingle', 'then'].includes(key)) {
      mock[key].mockReturnValue(mock);
    }
  });

  return mock;
}

export function createMockSupabaseClient() {
  const queryBuilder = createMockQueryBuilder();
  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue(createMockSupabaseResponse(null)),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: createMockAuthUser() }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: createMockSession() }, error: null }),
      signUp: vi.fn().mockResolvedValue(createMockAuthResponse(createMockAuthUser(), createMockSession())),
      signInWithPassword: vi.fn().mockResolvedValue(createMockAuthResponse(createMockAuthUser(), createMockSession())),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

export function createMockSupabaseClients() {
  return {
    supabaseClient: createMockSupabaseClient(),
    supabaseAdmin: createMockSupabaseClient(),
  };
}

// ============================================
// EXPRESS MOCK HELPERS
// ============================================

export function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    user: createMockAuthUser(),
    accessToken: 'mock-access-token-123',
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ...overrides,
  };
}

export function createMockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    on: vi.fn(),
  };
}

export function createMockNext() {
  return vi.fn();
}
```

#### File: `packages/backend/src/__tests__/mocks/stripe.mock.ts`

```typescript
/**
 * @file stripe.mock.ts
 * @description Mock factories for Stripe objects and SDK.
 */

import { vi } from 'vitest';
import type Stripe from 'stripe';

// ============================================
// DATA FACTORIES
// ============================================

export function createMockCustomer(overrides: Partial<Stripe.Customer> = {}): Stripe.Customer {
  return {
    id: 'cus_test123',
    object: 'customer',
    email: 'test@example.com',
    metadata: { supabase_user_id: 'user-uuid-123' },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  } as Stripe.Customer;
}

export function createMockCheckoutSession(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    id: 'cs_test123',
    object: 'checkout.session',
    customer: 'cus_test123',
    subscription: 'sub_test123',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    url: 'https://checkout.stripe.com/pay/cs_test123',
    metadata: {
      supabase_user_id: 'user-uuid-123',
      tier_id: 'tier-uuid-123',
      billing_cycle: 'monthly',
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  } as Stripe.Checkout.Session;
}

export function createMockSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'sub_test123',
    object: 'subscription',
    customer: 'cus_test123',
    status: 'active',
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    metadata: { supabase_user_id: 'user-uuid-123', tier_id: 'tier-uuid-123' },
    items: {
      object: 'list',
      data: [{
        id: 'si_test123',
        object: 'subscription_item',
        price: { id: 'price_test123', object: 'price', currency: 'usd', unit_amount: 999 } as Stripe.Price,
      } as Stripe.SubscriptionItem],
    },
    created: now,
    livemode: false,
    ...overrides,
  } as Stripe.Subscription;
}

export function createMockInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: 'in_test123',
    object: 'invoice',
    customer: 'cus_test123',
    subscription: 'sub_test123',
    status: 'paid',
    amount_paid: 999,
    amount_due: 999,
    currency: 'usd',
    hosted_invoice_url: 'https://invoice.stripe.com/in_test123',
    description: 'Subscription payment',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  } as Stripe.Invoice;
}

export function createMockEvent(
  type: string,
  data: Record<string, unknown>,
  overrides: Partial<Stripe.Event> = {}
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    api_version: '2023-10-16',
    ...overrides,
  } as Stripe.Event;
}

export function createMockPortalSession(
  overrides: Partial<Stripe.BillingPortal.Session> = {}
): Stripe.BillingPortal.Session {
  return {
    id: 'bps_test123',
    object: 'billing_portal.session',
    customer: 'cus_test123',
    url: 'https://billing.stripe.com/session/test123',
    return_url: 'https://example.com/settings/billing',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  } as Stripe.BillingPortal.Session;
}

// ============================================
// STRIPE SDK MOCK
// ============================================

export function createMockStripe() {
  return {
    customers: {
      create: vi.fn().mockResolvedValue(createMockCustomer()),
      retrieve: vi.fn().mockResolvedValue(createMockCustomer()),
      update: vi.fn().mockResolvedValue(createMockCustomer()),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue(createMockCheckoutSession()),
        retrieve: vi.fn().mockResolvedValue(createMockCheckoutSession()),
      },
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue(createMockSubscription()),
      retrieve: vi.fn().mockResolvedValue(createMockSubscription()),
      update: vi.fn().mockResolvedValue(createMockSubscription()),
      cancel: vi.fn().mockResolvedValue(createMockSubscription({ status: 'canceled' })),
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue(createMockPortalSession()),
      },
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation((payload, _sig, _secret) => {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        return createMockEvent(data.type || 'test.event', data.data?.object || {});
      }),
    },
    invoices: {
      retrieve: vi.fn().mockResolvedValue(createMockInvoice()),
    },
  };
}

// ============================================
// HELPER FACTORIES
// ============================================

export function createMockSupabaseResponse<T>(data: T | null, error: Error | null = null) {
  return { data, error, status: error ? 400 : 200, statusText: error ? 'Bad Request' : 'OK' };
}

export function createMockTier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tier-uuid-123',
    name: '{{TIER_2_NAME}}',
    display_name: '{{TIER_2_DISPLAY}}',
    price_monthly: {{TIER_2_PRICE_MONTHLY}},
    price_yearly: {{TIER_2_PRICE_YEARLY}},
    stripe_price_id_monthly: 'price_monthly_test123',
    stripe_price_id_yearly: 'price_yearly_test123',
    is_active: true,
    is_default: false,
    sort_order: 2,
    ...overrides,
  };
}

export function createMockUserProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    stripe_customer_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership-uuid-123',
    user_id: 'user-uuid-123',
    tier_id: 'tier-uuid-123',
    status: 'active',
    stripe_subscription_id: 'sub_test123',
    ...overrides,
  };
}

export function generateMockWebhookSignature(): string {
  return `t=${Math.floor(Date.now() / 1000)},v1=mock_signature_for_testing`;
}

export function createWebhookPayload(event: Partial<Stripe.Event>): Buffer {
  return Buffer.from(JSON.stringify(event));
}
```

#### File: `packages/backend/src/__tests__/mocks/index.ts`

```typescript
/**
 * @file index.ts
 * @description Central export for all mock utilities.
 */

export {
  createMockCustomer,
  createMockCheckoutSession,
  createMockSubscription,
  createMockInvoice,
  createMockEvent,
  createMockPortalSession,
  createMockStripe,
  createMockSupabaseResponse as createStripeSupabaseResponse,
  createMockTier,
  createMockUserProfile,
  createMockMembership as createStripeMembership,
  generateMockWebhookSignature,
  createWebhookPayload,
} from './stripe.mock.js';

export {
  createMockAuthUser,
  createMockSession,
  createMockProfile,
  createMockTier as createMockMembershipTier,
  createMockMembership as createMockUserMembership,
  createMockFeature,
  createMockUsageTracking,
  createMockContactSubmission,
  createMockNewsletterSubscriber,
  createMockSupabaseResponse,
  createMockAuthResponse,
  createMockSupabaseError,
  createMockQueryBuilder,
  createMockSupabaseClient,
  createMockSupabaseClients,
  createMockRequest,
  createMockResponse,
  createMockNext,
} from './supabase.mock.js';
```

---

### Step 4.5: Example Tests

#### File: `packages/backend/src/__tests__/response.utils.test.ts`

```typescript
/**
 * @file response.utils.test.ts
 * @description Tests for response utility functions.
 */

import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse } from '../utils/response.utils.js';

describe('Response Utils', () => {
  describe('successResponse', () => {
    it('should return success format with data', () => {
      const result = successResponse({ id: 1 });
      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it('should include optional message', () => {
      const result = successResponse({ id: 1 }, 'Created');
      expect(result).toEqual({ success: true, data: { id: 1 }, message: 'Created' });
    });

    it('should handle null data', () => {
      const result = successResponse(null);
      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe('errorResponse', () => {
    it('should return error format', () => {
      const result = errorResponse('Not found');
      expect(result).toEqual({ success: false, error: 'Not found' });
    });

    it('should include optional details', () => {
      const result = errorResponse('Validation failed', { field: 'email' });
      expect(result).toEqual({
        success: false,
        error: 'Validation failed',
        details: { field: 'email' },
      });
    });
  });
});
```

#### File: `packages/backend/src/__tests__/membership.middleware.test.ts`

```typescript
/**
 * @file membership.middleware.test.ts
 * @description Tests for membership middleware (requireFeature, requireTier).
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Each test uses createMockRequest/Response/Next from mock factories.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock values so they're available in vi.mock factory
const mocks = vi.hoisted(() => ({
  supabaseAdmin: {
    rpc: vi.fn(),
  },
}));

// Mock the supabase config module
vi.mock('../../config/supabase.js', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { requireFeature } from '../../middleware/membership.middleware.js';
import { createMockRequest, createMockResponse, createMockNext } from './mocks/index.js';

describe('requireFeature middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  it('should call next() when user has the feature', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: true, error: null });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user does not have the feature', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({ data: false, error: null });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'FEATURE_NOT_AVAILABLE',
        feature_key: 'example_boolean',
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when no user is present', async () => {
    mockReq = createMockRequest({ user: null });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    mocks.supabaseAdmin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'DB connection failed' },
    });

    const middleware = requireFeature('example_boolean');
    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
```

#### File: `packages/backend/src/__tests__/contact.routes.test.ts`

```typescript
/**
 * @file contact.routes.test.ts
 * @description Tests for contact form submission route.
 *
 * Pattern: Directly test the service function with mocked Supabase.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../../config/supabase.js', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

import { createMockContactSubmission, createMockSupabaseResponse } from './mocks/index.js';

describe('Contact Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required fields', () => {
    const input = {
      first_name: '',
      last_name: 'Doe',
      email: 'invalid-email',
      subject: '',
      message: 'Hi',
    };

    // Zod validation should reject empty required fields
    const { contactSubmissionSchema } = require('../../validation/contact.schemas.js');
    const result = contactSubmissionSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('should accept valid contact submission', () => {
    const input = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      subject: 'General Inquiry',
      message: 'This is a test message that is long enough.',
    };

    const { contactSubmissionSchema } = require('../../validation/contact.schemas.js');
    const result = contactSubmissionSchema.safeParse(input);

    expect(result.success).toBe(true);
  });
});
```

---

### Step 4.6: Documentation

#### File: `.env.example`

```bash
# ============================================
# {{PROJECT_DISPLAY_NAME}} — Environment Variables
# ============================================
# Copy this file to .env and fill in your values.

# ─── Server ───────────────────────────────────
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001

# ─── Supabase ─────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# ─── Stripe ───────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Frontend (Vite) ─────────────────────────
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:3001
```

#### File: `README.md`

````markdown
# {{PROJECT_DISPLAY_NAME}}

A full-stack SaaS application built with Express.js, React Router v7, Supabase, and Stripe.

## Tech Stack

- **Backend:** Express.js, TypeScript, Supabase (PostgreSQL + Auth), Stripe
- **Frontend:** React 19, React Router 7, MUI 6, Vite 6
- **Database:** Supabase (PostgreSQL with RLS)
- **Payments:** Stripe (Checkout, Portal, Webhooks)
- **Testing:** Vitest

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd {{PROJECT_NAME}}
npm install

# 2. Set up environment
cp .env.example .env
# Fill in your Supabase and Stripe credentials

# 3. Run database migrations
# Execute files in supabase/migrations/ (000 through 005) in your Supabase SQL editor

# 4. Start development
npm run dev
```

## Project Structure

```
{{PROJECT_NAME}}/
├── packages/
│   ├── backend/          # Express.js API server
│   │   └── src/
│   │       ├── config/       # Environment & service configs
│   │       ├── constants/    # Feature keys, period maps
│   │       ├── middleware/   # Auth, membership, usage, error handling
│   │       ├── routes/       # API route handlers
│   │       ├── services/     # Business logic
│   │       ├── types/        # TypeScript type definitions
│   │       ├── utils/        # Utilities (logger, response, pagination)
│   │       ├── validation/   # Zod schemas
│   │       └── __tests__/    # Vitest tests + mock factories
│   └── frontend/         # React Router v7 SPA
│       └── app/
│           ├── api/          # Backend API client
│           ├── components/   # React components
│           ├── constants/    # Feature keys, upgrade messages
│           ├── contexts/     # Auth context
│           ├── routes/       # Page routes
│           ├── theme/        # MUI theme
│           ├── types/        # TypeScript types
│           └── utils/        # Formatting, navigation
├── supabase/
│   └── migrations/       # Database migrations (000-005)
└── package.json          # npm workspaces root
```

## Available Scripts

```bash
npm run dev              # Start both backend and frontend
npm run dev:backend      # Backend only (port 3001)
npm run dev:frontend     # Frontend only (port 5173)
npm run build:backend    # Build backend
npm run build:frontend   # Build frontend
npm run typecheck        # Type check both packages
npm run test:backend     # Run backend tests
```

## Features

- **Authentication:** Email/password via Supabase Auth with cookie-based sessions
- **Membership Tiers:** {{TIER_1_DISPLAY}}, {{TIER_2_DISPLAY}}, {{TIER_3_DISPLAY}} with configurable features
- **Feature Gating:** Boolean, limit, and enum features per tier
- **Usage Tracking:** Per-feature usage with daily/monthly/lifetime reset periods
- **Stripe Billing:** Checkout sessions, Customer Portal, webhook processing
- **Dashboard:** Profile management, membership overview, billing history
- **Landing Page:** Hero, Features, Pricing (DB-fetched), Newsletter, CTA sections

## API Endpoints

| Route                              | Description             |
| ---------------------------------- | ----------------------- |
| `POST /api/auth/register`          | Register new user       |
| `POST /api/auth/login`             | Sign in                 |
| `GET /api/profile`                 | Get user profile        |
| `PUT /api/profile`                 | Update profile          |
| `GET /api/membership/tiers/public` | Get public tier list    |
| `GET /api/membership`              | Get current membership  |
| `POST /api/billing/checkout`       | Create Stripe Checkout  |
| `POST /api/billing/portal`         | Create Stripe Portal    |
| `POST /api/billing/webhook`        | Stripe webhook handler  |
| `POST /api/contact`                | Submit contact form     |
| `POST /api/newsletter/subscribe`   | Subscribe to newsletter |
| `GET /api/health`                  | Health check            |
````

#### File: `todo.md`

```markdown
# TODO

## Post-Template Customization

- [ ] Replace all `{{TOKEN}}` placeholders with your project values
- [ ] Set up Supabase project and run migrations
- [ ] Configure Stripe products/prices and update seed data with real price IDs
- [ ] Set up Stripe webhook endpoint in dashboard
- [ ] Update landing page copy and features to match your product
- [ ] Add your brand colors to the MUI theme
- [ ] Configure CORS origins for production domain

## Future Enhancements

- [ ] Add email system (Resend, SendGrid, or SMTP)
- [ ] Add admin panel for tier/feature management
- [ ] Add file upload / document storage
- [ ] Add search functionality (Typesense, Algolia, etc.)
- [ ] Add OAuth providers (Google, GitHub)
- [ ] Add rate limiting configuration per route
- [ ] Add CI/CD pipeline
- [ ] Add E2E tests (Playwright)
- [ ] Add monitoring/logging (Sentry, LogRocket)
```

---

### Step 4.7: Update Root package.json

Add test scripts to the root `package.json`. These lines should be added to the `scripts` section:

```json
"test:backend": "npm run test:run --workspace=@{{PROJECT_SLUG}}/backend",
"test:backend:watch": "npm run test --workspace=@{{PROJECT_SLUG}}/backend",
"test:backend:coverage": "npm run test:coverage --workspace=@{{PROJECT_SLUG}}/backend"
```

And add to `packages/backend/package.json` scripts section:

```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

---

## Verification Checklist

1. **Contact form works**: Navigate to `/contact`, fill all fields, submit — success message appears, submission stored in `contact_submissions` table
2. **Newsletter works**: Enter email in landing page newsletter section — subscription stored in `newsletter_subscribers` table
3. **Landing page complete**: All 5 sections render: Hero, Features, Pricing, Newsletter, CTA
4. **TypeScript compiles**: `npm run typecheck` passes for both backend and frontend
5. **Tests pass**: `npm run test:backend` — all example tests pass
6. **Mock factories work**: Each mock factory returns valid typed objects with override support
7. **Environment documented**: `.env.example` includes all required variables with descriptions
8. **README accurate**: README structure matches actual file layout
9. **Full auth flow**: Register → login → dashboard → profile → membership → billing → logout all work end-to-end
10. **Stripe flow**: Checkout → webhook → membership update → portal all function correctly
