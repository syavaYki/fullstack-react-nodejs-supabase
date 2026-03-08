/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars */
/**
 * @file stripe.service.test.ts
 * @description Tests for StripeService -- customer management, checkout sessions,
 * trial eligibility, billing portal, payment history, subscription sync, and
 * active subscription checks.
 *
 * Pattern: vi.hoisted() + vi.mock() with .ts extensions for hoisted mock paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// ============================================
// HOISTED MOCKS
// ============================================

const mocks = vi.hoisted(() => {
  // Chainable query builder for supabaseAdmin.from(...)
  const createQueryBuilder = () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      is: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    // Make everything chainable except terminal methods
    for (const key of Object.keys(builder)) {
      if (key !== 'single') {
        builder[key].mockReturnValue(builder);
      }
    }
    return builder;
  };

  const queryBuilder = createQueryBuilder();

  return {
    stripe: {
      customers: {
        create: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      invoices: {
        list: vi.fn(),
      },
      subscriptions: {
        retrieve: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
      },
    },
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
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
    },
    queryBuilder,
    createQueryBuilder,
    membershipService: {
      getTierById: vi.fn(),
      getTiers: vi.fn(),
      getUserMembership: vi.fn(),
      updateMembership: vi.fn(),
      downgradeToFree: vi.fn(),
    },
  };
});

// ============================================
// MODULE MOCKS
// ============================================

vi.mock('../config/stripe.ts', () => ({
  stripe: mocks.stripe,
  STRIPE_WEBHOOK_SECRET: mocks.env.STRIPE_WEBHOOK_SECRET,
}));

vi.mock('../config/env.ts', () => ({
  env: mocks.env,
}));

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock('../services/membership.service.ts', () => ({
  membershipService: mocks.membershipService,
}));

vi.mock('../utils/logger.ts', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

// ============================================
// IMPORT UNDER TEST
// ============================================

import { StripeService } from '../services/stripe.service.ts';
import { ApiError } from '../middleware/error.middleware.ts';

// ============================================
// HELPERS
// ============================================

const USER_ID = 'user-uuid-123';
const EMAIL = 'test@example.com';
const CUSTOMER_ID = 'cus_test123';
const TIER_ID = 'tier-uuid-premium';

function createPremiumTier(overrides: Record<string, unknown> = {}) {
  return {
    id: TIER_ID,
    name: 'premium',
    display_name: 'Premium',
    description: 'Premium tier',
    price_monthly: 29,
    price_yearly: 290,
    stripe_price_id_monthly: 'price_monthly_premium',
    stripe_price_id_yearly: 'price_yearly_premium',
    stripe_product_id: 'prod_premium',
    trial_days: 14,
    is_active: true,
    is_default: false,
    sort_order: 2,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createFreeTier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tier-uuid-free',
    name: 'free',
    display_name: 'Free',
    description: 'Free tier',
    price_monthly: 0,
    price_yearly: 0,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: null,
    stripe_product_id: null,
    trial_days: 0,
    is_active: true,
    is_default: true,
    sort_order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Builds a fresh chainable query builder and wires supabaseAdmin.from()
 * to return it. Returns the builder for fine-grained assertions.
 */
function resetQueryBuilder() {
  const qb = mocks.createQueryBuilder();
  mocks.supabaseAdmin.from.mockReturnValue(qb);
  return qb;
}

// ============================================
// TESTS
// ============================================

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeService();
    resetQueryBuilder();
  });

  // ============================================
  // getOrCreateCustomer
  // ============================================

  describe('getOrCreateCustomer', () => {
    it('should return existing customer ID from database when valid in Stripe', async () => {
      // DB has a stripe_customer_id
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_customer_id: CUSTOMER_ID,
          first_name: 'Test',
          last_name: 'User',
        },
        error: null,
      });

      // Stripe validates the customer exists
      mocks.stripe.customers.retrieve.mockResolvedValue({ id: CUSTOMER_ID });

      const result = await service.getOrCreateCustomer(USER_ID, EMAIL);

      expect(result).toBe(CUSTOMER_ID);
      expect(mocks.stripe.customers.retrieve).toHaveBeenCalledWith(CUSTOMER_ID);
      // Should NOT have searched or created
      expect(mocks.stripe.customers.search).not.toHaveBeenCalled();
      expect(mocks.stripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create a new customer when no customer exists in DB or Stripe', async () => {
      // DB has no stripe_customer_id
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_customer_id: null,
          first_name: 'Test',
          last_name: 'User',
        },
        error: null,
      });

      // Stripe search finds nothing
      mocks.stripe.customers.search.mockResolvedValue({ data: [] });

      // Stripe create returns new customer
      const newCustomerId = 'cus_new_123';
      mocks.stripe.customers.create.mockResolvedValue({ id: newCustomerId });

      const result = await service.getOrCreateCustomer(USER_ID, EMAIL);

      expect(result).toBe(newCustomerId);
      expect(mocks.stripe.customers.search).toHaveBeenCalledWith({
        query: `metadata['supabase_user_id']:'${USER_ID}'`,
        limit: 1,
      });
      expect(mocks.stripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: EMAIL,
          name: 'Test User',
          metadata: { supabase_user_id: USER_ID },
        }),
        expect.objectContaining({
          idempotencyKey: `create-customer-${USER_ID}`,
        })
      );
      // Should update profile with new customer ID
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('user_profiles');
    });

    it('should search Stripe by metadata when DB customer ID is stale', async () => {
      const staleCustomerId = 'cus_stale_deleted';

      // DB has a stale stripe_customer_id
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_customer_id: staleCustomerId,
          first_name: 'Test',
          last_name: 'User',
        },
        error: null,
      });

      // Stripe retrieve throws (customer deleted/invalid)
      mocks.stripe.customers.retrieve.mockRejectedValue(
        new Error('No such customer: cus_stale_deleted')
      );

      // Search finds existing customer by metadata
      const existingCustomerId = 'cus_found_via_search';
      mocks.stripe.customers.search.mockResolvedValue({
        data: [{ id: existingCustomerId }],
      });

      const result = await service.getOrCreateCustomer(USER_ID, EMAIL);

      expect(result).toBe(existingCustomerId);
      // Should have tried to retrieve the stale ID first
      expect(mocks.stripe.customers.retrieve).toHaveBeenCalledWith(staleCustomerId);
      // Should have searched Stripe by metadata
      expect(mocks.stripe.customers.search).toHaveBeenCalledWith({
        query: `metadata['supabase_user_id']:'${USER_ID}'`,
        limit: 1,
      });
      // Should NOT have created a new customer
      expect(mocks.stripe.customers.create).not.toHaveBeenCalled();
      // Should have cleared the stale ID and then saved the found one
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('user_profiles');
    });
  });

  // ============================================
  // createCheckoutSession
  // ============================================

  describe('createCheckoutSession', () => {
    it('should create a checkout session with correct parameters', async () => {
      const tier = createPremiumTier();

      // userHasActiveSubscription => no active sub
      const qbActive = mocks.createQueryBuilder();
      qbActive.single.mockResolvedValue({
        data: { stripe_subscription_id: null, stripe_status: null },
        error: null,
      });

      // getTierById returns premium tier
      mocks.membershipService.getTierById.mockResolvedValue(tier);

      // hasUserUsedTrial => trial not used
      const qbTrial = mocks.createQueryBuilder();
      qbTrial.single.mockResolvedValue({
        data: { has_used_trial: true },
        error: null,
      });

      // getOrCreateCustomer => existing customer in DB
      const qbProfile = mocks.createQueryBuilder();
      qbProfile.single.mockResolvedValue({
        data: {
          stripe_customer_id: CUSTOMER_ID,
          first_name: 'Test',
          last_name: 'User',
        },
        error: null,
      });

      // Wire up from() calls in order:
      // 1st: memberships (userHasActiveSubscription)
      // 2nd: user_profiles (getOrCreateCustomer)
      // 3rd: memberships (hasUserUsedTrial)
      let fromCallCount = 0;
      mocks.supabaseAdmin.from.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'memberships' && fromCallCount === 1) return qbActive;
        if (table === 'user_profiles') return qbProfile;
        if (table === 'memberships') return qbTrial;
        return mocks.createQueryBuilder();
      });

      mocks.stripe.customers.retrieve.mockResolvedValue({ id: CUSTOMER_ID });

      const checkoutUrl = 'https://checkout.stripe.com/pay/cs_test_session';
      mocks.stripe.checkout.sessions.create.mockResolvedValue({
        url: checkoutUrl,
      });

      const result = await service.createCheckoutSession(
        USER_ID,
        EMAIL,
        TIER_ID,
        'monthly',
        undefined,
        undefined,
        true // skipTrial
      );

      expect(result).toBe(checkoutUrl);
      expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: CUSTOMER_ID,
          mode: 'subscription',
          line_items: [{ price: 'price_monthly_premium', quantity: 1 }],
          allow_promotion_codes: true,
          metadata: expect.objectContaining({
            supabase_user_id: USER_ID,
            tier_id: TIER_ID,
            billing_cycle: 'monthly',
          }),
        })
      );
    });

    it('should throw ApiError for free/default tier', async () => {
      const freeTier = createFreeTier();

      // userHasActiveSubscription => no active sub
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: { stripe_subscription_id: null, stripe_status: null },
        error: null,
      });

      mocks.membershipService.getTierById.mockResolvedValue(freeTier);

      await expect(
        service.createCheckoutSession(USER_ID, EMAIL, freeTier.id, 'monthly')
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          message: 'Cannot create checkout for a free tier',
        })
      );

      expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should throw ApiError when no Stripe price ID is configured', async () => {
      const tierNoPrices = createPremiumTier({
        stripe_price_id_monthly: null,
        stripe_price_id_yearly: null,
      });

      // userHasActiveSubscription => no active sub
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: { stripe_subscription_id: null, stripe_status: null },
        error: null,
      });

      mocks.membershipService.getTierById.mockResolvedValue(tierNoPrices);

      await expect(
        service.createCheckoutSession(USER_ID, EMAIL, TIER_ID, 'monthly')
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining('No Stripe price configured'),
        })
      );

      expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should throw ApiError when user already has an active subscription', async () => {
      // userHasActiveSubscription => has active sub
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_subscription_id: 'sub_existing_123',
          stripe_status: 'active',
        },
        error: null,
      });

      await expect(
        service.createCheckoutSession(USER_ID, EMAIL, TIER_ID, 'monthly')
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          message: 'ACTIVE_SUBSCRIPTION_EXISTS',
        })
      );

      // Should not even fetch the tier
      expect(mocks.membershipService.getTierById).not.toHaveBeenCalled();
      expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should include trial_period_days when user is eligible for trial', async () => {
      const tier = createPremiumTier({ trial_days: 14 });

      // userHasActiveSubscription => no active sub
      const qbActive = mocks.createQueryBuilder();
      qbActive.single.mockResolvedValue({
        data: { stripe_subscription_id: null, stripe_status: null },
        error: null,
      });

      mocks.membershipService.getTierById.mockResolvedValue(tier);

      // hasUserUsedTrial => trial NOT used
      const qbTrial = mocks.createQueryBuilder();
      qbTrial.single.mockResolvedValue({
        data: { has_used_trial: false },
        error: null,
      });

      // getOrCreateCustomer => profile with customer ID
      const qbProfile = mocks.createQueryBuilder();
      qbProfile.single.mockResolvedValue({
        data: {
          stripe_customer_id: CUSTOMER_ID,
          first_name: 'Test',
          last_name: 'User',
        },
        error: null,
      });

      let fromCallCount = 0;
      mocks.supabaseAdmin.from.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'memberships' && fromCallCount === 1) return qbActive;
        if (table === 'user_profiles') return qbProfile;
        if (table === 'memberships') return qbTrial;
        return mocks.createQueryBuilder();
      });

      mocks.stripe.customers.retrieve.mockResolvedValue({ id: CUSTOMER_ID });

      mocks.stripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/cs_trial',
      });

      await service.createCheckoutSession(
        USER_ID,
        EMAIL,
        TIER_ID,
        'monthly',
        undefined,
        undefined,
        false // skipTrial = false, so trial is eligible
      );

      expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_collection: 'if_required',
          subscription_data: expect.objectContaining({
            trial_period_days: 14,
            trial_settings: {
              end_behavior: {
                missing_payment_method: 'cancel',
              },
            },
          }),
        })
      );
    });
  });

  // ============================================
  // hasUserUsedTrial
  // ============================================

  describe('hasUserUsedTrial', () => {
    it('should return true when user has used trial', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: { has_used_trial: true },
        error: null,
      });

      const result = await service.hasUserUsedTrial(USER_ID);

      expect(result).toBe(true);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('memberships');
    });

    it('should return false when user has not used trial', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: { has_used_trial: false },
        error: null,
      });

      const result = await service.hasUserUsedTrial(USER_ID);

      expect(result).toBe(false);
    });

    it('should return false when no membership data exists', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.hasUserUsedTrial(USER_ID);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // createPortalSession
  // ============================================

  describe('createPortalSession', () => {
    it('should return the billing portal URL', async () => {
      // First from() call: fetch profile email
      const qbProfile = mocks.createQueryBuilder();
      qbProfile.single.mockResolvedValue({
        data: { email: EMAIL },
        error: null,
      });

      // Second from() call: getOrCreateCustomer fetches profile for stripe_customer_id
      const qbCustomer = mocks.createQueryBuilder();
      qbCustomer.single.mockResolvedValue({
        data: {
          stripe_customer_id: CUSTOMER_ID,
          first_name: 'Test',
          last_name: 'User',
        },
        error: null,
      });

      let fromCallCount = 0;
      mocks.supabaseAdmin.from.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return qbProfile;
        return qbCustomer;
      });

      mocks.stripe.customers.retrieve.mockResolvedValue({ id: CUSTOMER_ID });

      const portalUrl = 'https://billing.stripe.com/session/test_portal';
      mocks.stripe.billingPortal.sessions.create.mockResolvedValue({
        url: portalUrl,
      });

      const result = await service.createPortalSession(USER_ID);

      expect(result).toBe(portalUrl);
      expect(mocks.stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: CUSTOMER_ID,
        return_url: `${mocks.env.FRONTEND_URL}/dashboard/billing`,
      });
    });

    it('should throw ApiError when user profile not found', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.createPortalSession(USER_ID)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 400,
          message: 'User profile not found',
        })
      );
    });
  });

  // ============================================
  // getPaymentHistory
  // ============================================

  describe('getPaymentHistory', () => {
    it('should return empty array when user has no stripe_customer_id', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: { stripe_customer_id: null },
        error: null,
      });

      const result = await service.getPaymentHistory(USER_ID);

      expect(result).toEqual([]);
      expect(mocks.stripe.invoices.list).not.toHaveBeenCalled();
    });

    it('should return transformed payment history from Stripe invoices', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: { stripe_customer_id: CUSTOMER_ID },
        error: null,
      });

      const now = Math.floor(Date.now() / 1000);
      mocks.stripe.invoices.list.mockResolvedValue({
        data: [
          {
            id: 'in_test_001',
            object: 'invoice',
            customer: CUSTOMER_ID,
            status: 'paid',
            amount_paid: 2900,
            currency: 'usd',
            charge: null,
            payment_intent: 'pi_test_001',
            subscription: 'sub_test_001',
            hosted_invoice_url: 'https://invoice.stripe.com/in_test_001',
            invoice_pdf: 'https://invoice.stripe.com/in_test_001/pdf',
            description: null,
            lines: { data: [{ description: 'Premium monthly' }] },
            metadata: {},
            last_finalization_error: null,
            status_transitions: { paid_at: now },
            created: now,
          },
        ],
      });

      const result = await service.getPaymentHistory(USER_ID, 5);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'in_test_001',
        user_id: USER_ID,
        status: 'succeeded',
        amount: 2900,
        currency: 'usd',
        stripe_invoice_id: 'in_test_001',
        stripe_payment_intent_id: 'pi_test_001',
        stripe_subscription_id: 'sub_test_001',
      });
      expect(mocks.stripe.invoices.list).toHaveBeenCalledWith({
        customer: CUSTOMER_ID,
        limit: 5,
        expand: ['data.charge'],
      });
    });
  });

  // ============================================
  // syncSubscriptionToDatabase
  // ============================================

  describe('syncSubscriptionToDatabase', () => {
    it('should update membership with subscription data', async () => {
      const now = Math.floor(Date.now() / 1000);
      const subscription = {
        id: 'sub_sync_test',
        status: 'active',
        current_period_end: now + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        trial_start: null,
        trial_end: null,
        items: {
          data: [
            {
              price: {
                id: 'price_monthly_premium',
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      } as unknown as Stripe.Subscription;

      // getTierByStripePriceId => returns the tier
      const qbTier = mocks.createQueryBuilder();
      qbTier.single.mockResolvedValue({
        data: createPremiumTier(),
        error: null,
      });

      // update memberships => success
      const qbUpdate = mocks.createQueryBuilder();
      qbUpdate.eq.mockResolvedValue({ data: null, error: null });

      let fromCallCount = 0;
      mocks.supabaseAdmin.from.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'membership_tiers') return qbTier;
        if (table === 'memberships') return qbUpdate;
        return mocks.createQueryBuilder();
      });

      await service.syncSubscriptionToDatabase(USER_ID, subscription);

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('membership_tiers');
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('memberships');
      expect(qbUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_subscription_id: 'sub_sync_test',
          stripe_status: 'active',
          stripe_price_id: 'price_monthly_premium',
          billing_cycle: 'monthly',
          cancel_at_period_end: false,
          tier_id: TIER_ID,
          status: 'active',
        })
      );
      expect(qbUpdate.eq).toHaveBeenCalledWith('user_id', USER_ID);
    });

    it('should set status to cancelled for canceled Stripe subscription', async () => {
      const now = Math.floor(Date.now() / 1000);
      const subscription = {
        id: 'sub_canceled',
        status: 'canceled',
        current_period_end: now,
        cancel_at_period_end: true,
        trial_start: null,
        trial_end: null,
        items: {
          data: [
            {
              price: {
                id: 'price_monthly_premium',
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      } as unknown as Stripe.Subscription;

      const qbTier = mocks.createQueryBuilder();
      qbTier.single.mockResolvedValue({
        data: createPremiumTier(),
        error: null,
      });

      const qbUpdate = mocks.createQueryBuilder();
      qbUpdate.eq.mockResolvedValue({ data: null, error: null });

      mocks.supabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'membership_tiers') return qbTier;
        return qbUpdate;
      });

      await service.syncSubscriptionToDatabase(USER_ID, subscription);

      expect(qbUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          stripe_status: 'canceled',
        })
      );
    });

    it('should mark has_used_trial for trialing subscriptions', async () => {
      const now = Math.floor(Date.now() / 1000);
      const subscription = {
        id: 'sub_trialing',
        status: 'trialing',
        current_period_end: now + 14 * 24 * 60 * 60,
        cancel_at_period_end: false,
        trial_start: now,
        trial_end: now + 14 * 24 * 60 * 60,
        items: {
          data: [
            {
              price: {
                id: 'price_monthly_premium',
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      } as unknown as Stripe.Subscription;

      const qbTier = mocks.createQueryBuilder();
      qbTier.single.mockResolvedValue({
        data: createPremiumTier(),
        error: null,
      });

      const qbUpdate = mocks.createQueryBuilder();
      qbUpdate.eq.mockResolvedValue({ data: null, error: null });

      mocks.supabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'membership_tiers') return qbTier;
        return qbUpdate;
      });

      await service.syncSubscriptionToDatabase(USER_ID, subscription);

      expect(qbUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          has_used_trial: true,
          status: 'active',
          stripe_status: 'trialing',
        })
      );
    });

    it('should throw ApiError when database update fails', async () => {
      const now = Math.floor(Date.now() / 1000);
      const subscription = {
        id: 'sub_error',
        status: 'active',
        current_period_end: now + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        trial_start: null,
        trial_end: null,
        items: {
          data: [
            {
              price: {
                id: 'price_monthly_premium',
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      } as unknown as Stripe.Subscription;

      const qbTier = mocks.createQueryBuilder();
      qbTier.single.mockResolvedValue({
        data: createPremiumTier(),
        error: null,
      });

      const qbUpdate = mocks.createQueryBuilder();
      qbUpdate.eq.mockResolvedValue({
        data: null,
        error: { message: 'Database connection lost' },
      });

      mocks.supabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'membership_tiers') return qbTier;
        return qbUpdate;
      });

      await expect(service.syncSubscriptionToDatabase(USER_ID, subscription)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 500,
          message: 'Failed to sync subscription',
        })
      );
    });
  });

  // ============================================
  // getTierByStripePriceId
  // ============================================

  describe('getTierByStripePriceId', () => {
    it('should return tier matching the Stripe price ID', async () => {
      const tier = createPremiumTier();
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({ data: tier, error: null });

      const result = await service.getTierByStripePriceId('price_monthly_premium');

      expect(result).toEqual(tier);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('membership_tiers');
      expect(qb.or).toHaveBeenCalledWith(
        'stripe_price_id_monthly.eq.price_monthly_premium,stripe_price_id_yearly.eq.price_monthly_premium'
      );
    });

    it('should return null when no tier matches', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const result = await service.getTierByStripePriceId('price_nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // userHasActiveSubscription
  // ============================================

  describe('userHasActiveSubscription', () => {
    it('should return hasActive true for active stripe status', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_subscription_id: 'sub_active_123',
          stripe_status: 'active',
        },
        error: null,
      });

      const result = await service.userHasActiveSubscription(USER_ID);

      expect(result).toEqual({
        hasActive: true,
        subscriptionId: 'sub_active_123',
      });
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('memberships');
    });

    it('should return hasActive true for trialing stripe status', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_subscription_id: 'sub_trialing_123',
          stripe_status: 'trialing',
        },
        error: null,
      });

      const result = await service.userHasActiveSubscription(USER_ID);

      expect(result).toEqual({
        hasActive: true,
        subscriptionId: 'sub_trialing_123',
      });
    });

    it('should return hasActive true for past_due stripe status', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_subscription_id: 'sub_past_due_123',
          stripe_status: 'past_due',
        },
        error: null,
      });

      const result = await service.userHasActiveSubscription(USER_ID);

      expect(result).toEqual({
        hasActive: true,
        subscriptionId: 'sub_past_due_123',
      });
    });

    it('should return hasActive false when no subscription ID exists', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_subscription_id: null,
          stripe_status: null,
        },
        error: null,
      });

      const result = await service.userHasActiveSubscription(USER_ID);

      expect(result).toEqual({ hasActive: false });
    });

    it('should return hasActive false for canceled stripe status', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: {
          stripe_subscription_id: 'sub_canceled_123',
          stripe_status: 'canceled',
        },
        error: null,
      });

      const result = await service.userHasActiveSubscription(USER_ID);

      expect(result).toEqual({
        hasActive: false,
        subscriptionId: 'sub_canceled_123',
      });
    });

    it('should return hasActive false when membership data is null', async () => {
      const qb = resetQueryBuilder();
      qb.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.userHasActiveSubscription(USER_ID);

      expect(result).toEqual({ hasActive: false });
    });
  });

  // ============================================
  // markTrialUsed
  // ============================================

  describe('markTrialUsed', () => {
    it('should update membership has_used_trial to true', async () => {
      const qb = resetQueryBuilder();
      qb.eq.mockResolvedValue({ data: null, error: null });

      await service.markTrialUsed(USER_ID);

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('memberships');
      expect(qb.update).toHaveBeenCalledWith({ has_used_trial: true });
      expect(qb.eq).toHaveBeenCalledWith('user_id', USER_ID);
    });
  });
});
