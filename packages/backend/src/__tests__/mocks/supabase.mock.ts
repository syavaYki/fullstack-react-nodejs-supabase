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
    name: 'premium',
    display_name: 'Premium',
    description: 'Mid-tier with advanced features',
    price_monthly: 29,
    price_yearly: 290,
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
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: createMockSession() }, error: null }),
      signUp: vi
        .fn()
        .mockResolvedValue(createMockAuthResponse(createMockAuthUser(), createMockSession())),
      signInWithPassword: vi
        .fn()
        .mockResolvedValue(createMockAuthResponse(createMockAuthUser(), createMockSession())),
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
