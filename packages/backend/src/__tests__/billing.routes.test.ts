/**
 * @file billing.routes.test.ts
 * @description Tests for billing validation schemas (checkout, convert-trial).
 *
 * Covers the safeRedirectUrlSchema open-redirect protection: success_url and
 * cancel_url must match the FRONTEND_URL origin or be omitted entirely.
 *
 * Pattern: Direct schema validation tests -- no HTTP layer needed.
 */

import { describe, it, expect, vi } from 'vitest';

// Must mock env BEFORE any schema import, because common.schemas.ts reads
// env.FRONTEND_URL at module evaluation time for safeRedirectUrlSchema.
const mocks = vi.hoisted(() => ({
  env: {
    PORT: '3001',
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
  },
}));

vi.mock('../config/env.ts', () => ({ env: mocks.env }));

import { checkoutSchema, convertTrialSchema } from '../validation/billing.schemas.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function validCheckoutInput(overrides: Record<string, unknown> = {}) {
  return {
    tier_id: VALID_UUID,
    billing_cycle: 'monthly' as const,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// checkoutSchema
// ---------------------------------------------------------------------------

describe('checkoutSchema', () => {
  it('should validate valid checkout input', () => {
    const result = checkoutSchema.safeParse(validCheckoutInput());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tier_id).toBe(VALID_UUID);
      expect(result.data.billing_cycle).toBe('monthly');
    }
  });

  it('should require tier_id as UUID', () => {
    const cases = [
      { tier_id: 'not-a-uuid', billing_cycle: 'monthly' },
      { tier_id: '', billing_cycle: 'monthly' },
      { tier_id: 12345, billing_cycle: 'monthly' },
      { billing_cycle: 'monthly' }, // missing entirely
    ];

    for (const input of cases) {
      const result = checkoutSchema.safeParse(input);
      expect(result.success).toBe(false);
    }
  });

  it('should require billing_cycle as monthly or yearly', () => {
    const invalidCycles = ['weekly', 'daily', 'annual', '', 123, null];

    for (const billing_cycle of invalidCycles) {
      const result = checkoutSchema.safeParse({ tier_id: VALID_UUID, billing_cycle });
      expect(result.success).toBe(false);
    }

    // Both valid values should pass
    expect(checkoutSchema.safeParse(validCheckoutInput({ billing_cycle: 'monthly' })).success).toBe(
      true
    );
    expect(checkoutSchema.safeParse(validCheckoutInput({ billing_cycle: 'yearly' })).success).toBe(
      true
    );
  });

  it('should accept optional success_url matching frontend origin', () => {
    const result = checkoutSchema.safeParse(
      validCheckoutInput({
        success_url: 'http://localhost:5173/dashboard?checkout=success',
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success_url).toBe('http://localhost:5173/dashboard?checkout=success');
    }
  });

  it('should REJECT success_url pointing to external domain', () => {
    const maliciousUrls = [
      'https://evil.com/steal-session',
      'https://attacker.io/phish',
      'http://localhost:9999/wrong-port',
      'https://localhost:5173/wrong-scheme', // https vs http
    ];

    for (const success_url of maliciousUrls) {
      const result = checkoutSchema.safeParse(validCheckoutInput({ success_url }));
      expect(result.success).toBe(false);
    }
  });

  it('should REJECT cancel_url pointing to external domain', () => {
    const maliciousUrls = [
      'https://evil.com/redirect',
      'http://malicious.example.org/callback',
      'http://127.0.0.1:5173/different-host',
    ];

    for (const cancel_url of maliciousUrls) {
      const result = checkoutSchema.safeParse(validCheckoutInput({ cancel_url }));
      expect(result.success).toBe(false);
    }
  });

  it('should accept omitted success_url and cancel_url', () => {
    const result = checkoutSchema.safeParse({
      tier_id: VALID_UUID,
      billing_cycle: 'yearly',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success_url).toBeUndefined();
      expect(result.data.cancel_url).toBeUndefined();
    }
  });

  it('should accept optional skip_trial boolean', () => {
    const withTrue = checkoutSchema.safeParse(validCheckoutInput({ skip_trial: true }));
    const withFalse = checkoutSchema.safeParse(validCheckoutInput({ skip_trial: false }));
    const withoutIt = checkoutSchema.safeParse(validCheckoutInput());

    expect(withTrue.success).toBe(true);
    expect(withFalse.success).toBe(true);
    expect(withoutIt.success).toBe(true);

    if (withTrue.success) expect(withTrue.data.skip_trial).toBe(true);
    if (withFalse.success) expect(withFalse.data.skip_trial).toBe(false);
    if (withoutIt.success) expect(withoutIt.data.skip_trial).toBeUndefined();
  });

  it('should reject skip_trial when not a boolean', () => {
    const result = checkoutSchema.safeParse(validCheckoutInput({ skip_trial: 'yes' }));
    expect(result.success).toBe(false);
  });

  it('should accept valid cancel_url matching frontend origin', () => {
    const result = checkoutSchema.safeParse(
      validCheckoutInput({
        cancel_url: 'http://localhost:5173/pricing?checkout=cancelled',
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cancel_url).toBe('http://localhost:5173/pricing?checkout=cancelled');
    }
  });

  it('should accept both success_url and cancel_url when both are valid', () => {
    const result = checkoutSchema.safeParse(
      validCheckoutInput({
        success_url: 'http://localhost:5173/dashboard?status=success',
        cancel_url: 'http://localhost:5173/pricing?status=cancelled',
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success_url).toBe('http://localhost:5173/dashboard?status=success');
      expect(result.data.cancel_url).toBe('http://localhost:5173/pricing?status=cancelled');
    }
  });
});

// ---------------------------------------------------------------------------
// convertTrialSchema
// ---------------------------------------------------------------------------

describe('convertTrialSchema', () => {
  it('should validate tier_id and billing_cycle', () => {
    const result = convertTrialSchema.safeParse({
      tier_id: VALID_UUID,
      billing_cycle: 'yearly',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tier_id).toBe(VALID_UUID);
      expect(result.data.billing_cycle).toBe('yearly');
    }
  });

  it('should reject invalid UUID', () => {
    const cases = [
      { tier_id: 'bad-uuid', billing_cycle: 'monthly' },
      { tier_id: '123', billing_cycle: 'monthly' },
      { tier_id: '', billing_cycle: 'monthly' },
    ];

    for (const input of cases) {
      const result = convertTrialSchema.safeParse(input);
      expect(result.success).toBe(false);
    }
  });

  it('should reject missing billing_cycle', () => {
    const result = convertTrialSchema.safeParse({ tier_id: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('should reject invalid billing_cycle values', () => {
    const result = convertTrialSchema.safeParse({
      tier_id: VALID_UUID,
      billing_cycle: 'quarterly',
    });
    expect(result.success).toBe(false);
  });
});
