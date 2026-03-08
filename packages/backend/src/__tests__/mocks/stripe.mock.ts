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
      data: [
        {
          id: 'si_test123',
          object: 'subscription_item',
          price: {
            id: 'price_test123',
            object: 'price',
            currency: 'usd',
            unit_amount: 999,
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
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
    name: 'premium',
    display_name: 'Premium',
    price_monthly: 29,
    price_yearly: 290,
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
