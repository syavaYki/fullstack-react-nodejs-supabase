# Phase 2: Billing Engine — Stripe + Feature/Usage System + Contact + Newsletter

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Stripe billing engine, membership/usage services, contact form, and newsletter subscription on top of the Phase 1 foundation.

**Architecture:** Services layer handles all business logic. Routes are thin wrappers that validate input and delegate to services. Stripe is the source of truth for subscription state — absence of a Stripe subscription means Free tier. Webhook events are logged with idempotency via unique constraint on `stripe_event_id`. Usage tracking uses atomic `check_reset_and_increment_usage` RPC with `FOR UPDATE` row locks.

**Tech Stack:** Express, Stripe SDK, Supabase admin client, Zod validation

---

## Prerequisites

- **Phase 1 must be complete and verified.** Server starts, `/api/health` responds, register creates user + profile + membership via trigger.
- All Phase 1 files exist and compile without errors.

---

## Token Substitution Table

Same tokens as Phase 1 — see Phase 1 document for the full table.

---

## What This Phase Produces

~14 new/updated files:

**Types (1):** `features.types.ts`
**Constants (2):** `cache.constants.ts`, updated `constants/index.ts`
**Services (6):** `stripe.service.ts`, `membership.service.ts`, `usage.service.ts`, `webhook.service.ts`, `contact.service.ts`, `newsletter.service.ts`
**Routes (5):** `billing.routes.ts`, `membership.routes.ts`, `contact.routes.ts`, `newsletter.routes.ts`, updated `routes/index.ts`

---

## Implementation

### Step 2.1: Feature Types

Phase 1 defined shared, profile, membership, billing, usage, auth, and contact types. We need `features.types.ts` for the feature/tier-feature associations used by membership and usage services.

#### File: `packages/backend/src/types/features.types.ts`

```typescript
/**
 * @file features.types.ts
 * @description Types for feature definitions and tier-feature associations.
 *
 * @see services/membership.service.ts - Feature management
 */

import type { FeatureType, FeatureStatus } from './shared.types.js';

/**
 * Feature definition from features table.
 * Defines available features that can be assigned to tiers.
 */
export interface Feature {
  /** UUID primary key */
  id: string;
  /** Unique feature identifier (e.g., 'ai_search', 'max_exports') */
  key: string;
  /** Human-readable feature name */
  name: string;
  /** Description of what the feature provides */
  description: string | null;
  /** Type of feature value (boolean, limit, or enum) */
  feature_type: FeatureType;
  /** Default value if not configured for a tier */
  default_value: unknown;
  /** Whether this feature is currently active */
  is_active: boolean;
  /** Development status: active, future, or development */
  status: FeatureStatus;
  /** Display order for sorting features (lower = higher priority) */
  sort_order: number;
  /** Timestamp when feature was created */
  created_at: string;
}

/**
 * Feature assignment for a tier from tier_features table.
 * Many-to-many relationship between tiers and features.
 */
export interface TierFeature {
  /** UUID primary key */
  id: string;
  /** Foreign key to membership_tiers.id */
  tier_id: string;
  /** Foreign key to features.id */
  feature_id: string;
  /** Feature value for this tier (type depends on feature_type) */
  value: unknown;
  /** Timestamp when assignment was created */
  created_at: string;
}

/**
 * TierFeature with joined Feature details.
 * Used when querying tier features with feature metadata.
 */
export interface TierFeatureWithDetails extends TierFeature {
  /** Joined feature details (present when using JOIN query) */
  feature?: Feature;
}
```

Now update the types barrel to export the new types.

#### Update: `packages/backend/src/types/index.ts`

Add to the existing barrel export file:

```typescript
// Add this line to the existing exports in types/index.ts:
export * from './features.types.js';
```

---

### Step 2.2: Cache Constants

#### File: `packages/backend/src/constants/cache.constants.ts`

```typescript
/**
 * @file cache.constants.ts
 * @description Constants for caching durations across services.
 *
 * Centralizes cache TTL values to ensure consistency and easy tuning.
 *
 * @see services/membership.service.ts - Uses STRIPE_SYNC_CACHE_TTL_MS
 */

/**
 * Cache TTL for Stripe subscription sync.
 * 24 hours to avoid hammering Stripe API.
 */
export const STRIPE_SYNC_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Default cache TTL for general-purpose caching.
 */
export const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 1 minute
```

#### Update: `packages/backend/src/constants/index.ts`

Add to the existing barrel export file:

```typescript
// Add this line to the existing exports in constants/index.ts:
export * from './cache.constants.js';
```

---

### Step 2.3: Stripe Service

The Stripe service manages customers, checkout sessions, billing portal, payment history, and subscription syncing. It is the primary bridge between your app and the Stripe API.

Key patterns:

- `getOrCreateCustomer()` — checks DB, searches Stripe by metadata, creates with idempotency key
- `syncSubscriptionToDatabase()` — maps Stripe status to membership status, updates tier, populates trial dates
- `getLatestActiveSubscription()` — prioritizes trialing > active subscriptions
- `transformInvoiceToPaymentHistory()` — maps Stripe invoice fields to app payment history format

#### File: `packages/backend/src/services/stripe.service.ts`

```typescript
import Stripe from 'stripe';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { membershipService } from './membership.service.js';
import { BillingCycle, MembershipTier, PaymentHistory } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Service for handling Stripe payment operations.
 * Manages customers, checkout sessions, billing portal, and subscription lifecycle.
 * Note: stripe_customer_id is stored in user_profiles, not memberships.
 */
export class StripeService {
  /**
   * Gets an existing Stripe customer or creates a new one for the user.
   * Checks database first, then searches Stripe directly to prevent duplicates.
   *
   * @param userId - The Supabase user ID
   * @param email - The user's email for Stripe customer creation
   * @returns The Stripe customer ID (cus_xxx)
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    // Check if user already has a Stripe customer ID in database
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id, first_name, last_name')
      .eq('id', userId)
      .single();

    if (profile?.stripe_customer_id) {
      // Verify the customer still exists in Stripe (handles test mode reset, account changes)
      try {
        await stripe.customers.retrieve(profile.stripe_customer_id);
        return profile.stripe_customer_id;
      } catch {
        // Customer doesn't exist in Stripe - clear stale ID
        logger.debug('STRIPE', 'Stale Stripe customer ID, will create new', {
          userId,
          staleCustomerId: profile.stripe_customer_id,
        });
        await supabaseAdmin
          .from('user_profiles')
          .update({ stripe_customer_id: null })
          .eq('id', userId);
      }
    }

    // Search Stripe directly for existing customer with this user ID
    // This prevents duplicates when multiple requests come in simultaneously
    const existingCustomers = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${userId}'`,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      const existingCustomer = existingCustomers.data[0];
      // Save to database for future lookups
      await supabaseAdmin
        .from('user_profiles')
        .update({ stripe_customer_id: existingCustomer.id })
        .eq('id', userId);
      return existingCustomer.id;
    }

    // Build customer name from profile if available
    const nameParts = [profile?.first_name, profile?.last_name].filter(Boolean);
    const name = nameParts.length > 0 ? nameParts.join(' ') : undefined;

    // Create new Stripe customer with idempotency key to prevent duplicates
    const customer = await stripe.customers.create(
      {
        email,
        ...(name && { name }),
        metadata: {
          supabase_user_id: userId,
        },
      },
      {
        idempotencyKey: `create-customer-${userId}`,
      }
    );

    // Save customer ID to user_profiles
    await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);

    return customer.id;
  }

  /**
   * Creates a Stripe Checkout session for subscription purchase.
   *
   * For tiers with trial_days > 0:
   * - payment_method_collection: 'if_required' — No payment method needed upfront
   * - trial_settings.end_behavior.missing_payment_method: 'cancel'
   *
   * @param userId - The Supabase user ID
   * @param email - The user's email address
   * @param tierId - The membership tier ID to purchase
   * @param billingCycle - Either 'monthly' or 'yearly'
   * @param successUrl - Optional redirect URL after successful payment
   * @param cancelUrl - Optional redirect URL if user cancels
   * @param skipTrial - Skip trial period and charge immediately
   * @returns The Stripe checkout session URL
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    tierId: string,
    billingCycle: BillingCycle,
    successUrl?: string,
    cancelUrl?: string,
    skipTrial = false
  ): Promise<string> {
    // Check for existing active subscription
    const { hasActive } = await this.userHasActiveSubscription(userId);
    if (hasActive) {
      throw new ApiError(400, 'ACTIVE_SUBSCRIPTION_EXISTS');
    }

    // Get the tier
    const tier = await membershipService.getTierById(tierId);

    // Get the price ID based on billing cycle
    const priceId =
      billingCycle === 'monthly' ? tier.stripe_price_id_monthly : tier.stripe_price_id_yearly;

    if (!priceId) {
      throw new ApiError(400, `No Stripe price configured for ${tier.name} ${billingCycle}`);
    }

    // Get or create Stripe customer
    const customerId = await this.getOrCreateCustomer(userId, email);

    // Check if tier offers trial and user hasn't used it yet
    const canUseTrial = !skipTrial && tier.trial_days > 0 && !(await this.hasUserUsedTrial(userId));

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        successUrl || `${env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${env.FRONTEND_URL}/billing/cancel`,
      allow_promotion_codes: true,
      metadata: {
        supabase_user_id: userId,
        tier_id: tierId,
        billing_cycle: billingCycle,
      },
    };

    // Add trial configuration if eligible
    if (canUseTrial) {
      sessionParams.payment_method_collection = 'if_required';
      sessionParams.subscription_data = {
        trial_period_days: tier.trial_days,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
        metadata: {
          supabase_user_id: userId,
          tier_id: tierId,
        },
      };
    } else {
      sessionParams.subscription_data = {
        metadata: {
          supabase_user_id: userId,
          tier_id: tierId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      throw new ApiError(500, 'Failed to create checkout session');
    }

    return session.url;
  }

  /**
   * Checks if a user has already used their Stripe trial.
   */
  async hasUserUsedTrial(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('memberships')
      .select('has_used_trial')
      .eq('user_id', userId)
      .single();

    return data?.has_used_trial ?? false;
  }

  /**
   * Marks a user as having used their trial.
   * Called when Stripe subscription enters 'trialing' status.
   */
  async markTrialUsed(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('memberships')
      .update({ has_used_trial: true })
      .eq('user_id', userId);

    if (error) {
      logger.error('STRIPE', 'Error marking trial as used', { error: error.message, userId });
    }
  }

  /**
   * Creates a Stripe Billing Portal session for subscription management.
   */
  async createPortalSession(userId: string): Promise<string> {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) {
      throw new ApiError(400, 'User profile not found');
    }

    const customerId = await this.getOrCreateCustomer(userId, profile.email);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.FRONTEND_URL}/dashboard/billing`,
    });

    return session.url;
  }

  /**
   * Retrieves a user's payment history directly from Stripe API.
   * Returns invoices ordered by most recent first.
   */
  async getPaymentHistory(userId: string, limit = 10): Promise<PaymentHistory[]> {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return [];
    }

    const invoices = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: Math.min(Math.max(limit, 1), 100),
      expand: ['data.charge'],
    });

    return invoices.data.map((invoice) => this.transformInvoiceToPaymentHistory(invoice, userId));
  }

  /**
   * Transforms a Stripe Invoice to PaymentHistory format.
   */
  private transformInvoiceToPaymentHistory(
    invoice: Stripe.Invoice,
    userId: string
  ): PaymentHistory {
    const charge = typeof invoice.charge === 'object' ? invoice.charge : null;

    let status: PaymentHistory['status'] = 'pending';
    if (invoice.status === 'paid') {
      status = 'succeeded';
    } else if (invoice.status === 'open' || invoice.status === 'draft') {
      status = 'pending';
    } else if (invoice.status === 'uncollectible' || invoice.status === 'void') {
      status = 'failed';
    }

    if (charge?.refunded) {
      status = charge.amount_refunded === charge.amount ? 'refunded' : 'partially_refunded';
    }

    return {
      id: invoice.id,
      user_id: userId,
      membership_id: null,
      stripe_payment_intent_id:
        typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice.payment_intent?.id || null,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: typeof invoice.charge === 'string' ? invoice.charge : charge?.id || null,
      stripe_subscription_id:
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription as Stripe.Subscription)?.id || null,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status,
      invoice_url: invoice.hosted_invoice_url || null,
      receipt_url: charge?.receipt_url || null,
      invoice_pdf: invoice.invoice_pdf || null,
      description:
        invoice.description ||
        `Payment for ${invoice.lines.data[0]?.description || 'subscription'}`,
      metadata: invoice.metadata || {},
      failure_reason: invoice.last_finalization_error?.message || null,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
      created_at: new Date(invoice.created * 1000).toISOString(),
    };
  }

  /**
   * Retrieves a Stripe subscription by its ID.
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Retrieves the latest active or trialing subscription for a customer.
   * Prioritizes trialing > active subscriptions.
   */
  async getLatestActiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 1,
    });

    if (trialingSubscriptions.data.length > 0) {
      return trialingSubscriptions.data[0];
    }

    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (activeSubscriptions.data.length > 0) {
      return activeSubscriptions.data[0];
    }

    return null;
  }

  /**
   * Cancels a subscription at the end of the current billing period.
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Reactivates a subscription that was scheduled for cancellation.
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Syncs subscription data from Stripe to the Supabase memberships table.
   * Maps Stripe status to membership status, updates tier, populates trial dates.
   * Sets a 24-hour cache expiration to avoid excessive Stripe API calls.
   */
  async syncSubscriptionToDatabase(
    userId: string,
    subscription: Stripe.Subscription
  ): Promise<void> {
    logger.debug('STRIPE', 'Syncing subscription to database', {
      subscriptionId: subscription.id,
      userId,
      status: subscription.status,
    });

    const priceId = subscription.items.data[0]?.price.id;
    const tier = priceId ? await this.getTierByStripePriceId(priceId) : null;

    const interval = subscription.items.data[0]?.price.recurring?.interval;
    const billingCycle: BillingCycle | null =
      interval === 'month' ? 'monthly' : interval === 'year' ? 'yearly' : null;

    const updateData: Record<string, unknown> = {
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_status: subscription.status,
      stripe_current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      billing_cycle: billingCycle,
      last_synced_at: new Date().toISOString(),
      sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    if (tier) {
      updateData.tier_id = tier.id;
    }

    // Map Stripe status to membership status
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      updateData.status = 'active';
    } else if (subscription.status === 'past_due') {
      updateData.status = 'past_due';
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      updateData.status = 'cancelled';
    }

    // Populate trial dates from Stripe
    if (subscription.trial_start) {
      updateData.trial_starts_at = new Date(subscription.trial_start * 1000).toISOString();
    }
    if (subscription.trial_end) {
      updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
    }

    if (subscription.status === 'trialing') {
      updateData.has_used_trial = true;
    }

    const { error } = await supabaseAdmin
      .from('memberships')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      logger.error('STRIPE', 'Error syncing subscription to database', {
        error: error.message,
        userId,
      });
      throw new ApiError(500, 'Failed to sync subscription');
    }
  }

  /**
   * Maps a Stripe price ID to a membership tier.
   */
  async getTierByStripePriceId(priceId: string): Promise<MembershipTier | null> {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
      .single();

    if (error || !data) {
      return null;
    }

    return data as MembershipTier;
  }

  /**
   * Checks if a user has an active Stripe subscription.
   */
  async userHasActiveSubscription(
    userId: string
  ): Promise<{ hasActive: boolean; subscriptionId?: string }> {
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('stripe_subscription_id, stripe_status')
      .eq('user_id', userId)
      .single();

    if (!membership?.stripe_subscription_id) {
      return { hasActive: false };
    }

    const activeStatuses = ['active', 'trialing', 'past_due'];
    const isActive = membership.stripe_status
      ? activeStatuses.includes(membership.stripe_status)
      : false;

    return {
      hasActive: isActive,
      subscriptionId: membership.stripe_subscription_id,
    };
  }
}

export const stripeService = new StripeService();
```

---

### Step 2.4: Membership Service

The membership service handles tier queries, feature access checks, and Stripe-as-truth sync. The key architectural pattern: absence of a Stripe subscription = Free tier. The `syncFromStripe()` method uses a 24-hour cache via `sync_expires_at` to avoid hammering the Stripe API.

#### File: `packages/backend/src/services/membership.service.ts`

```typescript
import { supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import {
  MembershipTier,
  Membership,
  Feature,
  TierFeatureWithDetails,
  UserTierWithFeatures,
} from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { stripeService } from './stripe.service.js';
import { logger } from '../utils/logger.js';

/**
 * Service for managing membership tiers, user memberships, and feature access.
 * Handles tier queries, membership CRUD, and feature checks via database functions.
 */
export class MembershipService {
  /**
   * Retrieves all membership tiers ordered by sort_order.
   *
   * @param accessToken - Optional access token for RLS-compliant queries
   * @returns Array of all membership tiers
   */
  async getTiers(accessToken?: string): Promise<MembershipTier[]> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client.from('membership_tiers').select('*').order('sort_order');

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as MembershipTier[];
  }

  /**
   * Retrieves a specific membership tier by its UUID.
   */
  async getTierById(tierId: string): Promise<MembershipTier> {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .eq('id', tierId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Tier not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as MembershipTier;
  }

  /**
   * Retrieves a membership tier by its unique name (e.g., 'free', '{{TIER_2_NAME}}').
   */
  async getTierByName(name: string): Promise<MembershipTier> {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Tier not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as MembershipTier;
  }

  /**
   * Retrieves a user's current membership with full tier details.
   */
  async getUserMembership(
    userId: string,
    accessToken?: string
  ): Promise<Membership & { tier: MembershipTier }> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('memberships')
      .select('*, tier:membership_tiers(*)')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Membership not found');
      }
      throw new ApiError(500, error.message);
    }

    return data as Membership & { tier: MembershipTier };
  }

  /**
   * Retrieves a user's tier along with all associated features.
   * Uses a database function that aggregates features into a JSON object.
   */
  async getUserTierWithFeatures(userId: string): Promise<UserTierWithFeatures | null> {
    const { data, error } = await supabaseAdmin.rpc('get_user_tier_with_features', {
      p_user_id: userId,
    });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data && data.length > 0 ? (data[0] as UserTierWithFeatures) : null;
  }

  /**
   * Retrieves all features assigned to a specific tier with full feature details.
   */
  async getTierFeatures(tierId: string, accessToken?: string): Promise<TierFeatureWithDetails[]> {
    const client = accessToken ? createSupabaseClientWithAuth(accessToken) : supabaseAdmin;

    const { data, error } = await client
      .from('tier_features')
      .select(`*, feature:features(*)`)
      .eq('tier_id', tierId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as TierFeatureWithDetails[];
  }

  /**
   * Retrieves all active features defined in the system.
   */
  async getAllFeatures(): Promise<Feature[]> {
    const { data, error } = await supabaseAdmin.from('features').select('*').eq('is_active', true);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Feature[];
  }

  /**
   * Checks if a user has access to a specific feature based on their tier.
   */
  async userHasFeature(userId: string, featureKey: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.rpc('user_has_feature', {
      p_user_id: userId,
      p_feature_key: featureKey,
    });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return Boolean(data);
  }

  /**
   * Retrieves the numeric limit for a feature based on user's tier.
   * Returns -1 for unlimited features, 0 if feature not available.
   */
  async getFeatureLimit(userId: string, featureKey: string): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc('get_feature_limit', {
      p_user_id: userId,
      p_feature_key: featureKey,
    });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as number;
  }

  /**
   * Updates a user's membership with partial data.
   */
  async updateMembership(userId: string, updates: Partial<Membership>): Promise<Membership> {
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Membership;
  }

  /**
   * Changes a user's tier directly without payment processing.
   * Intended for testing/development or admin overrides.
   * Uses atomic database function to prevent race conditions.
   */
  async changeTier(
    userId: string,
    tierId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<Membership & { tier: MembershipTier }> {
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('change_user_tier', {
      p_user_id: userId,
      p_tier_id: tierId,
      p_billing_cycle: billingCycle,
    });

    if (rpcError) {
      throw new ApiError(500, `Failed to change tier: ${rpcError.message}`);
    }

    if (!rpcResult || rpcResult.length === 0 || !rpcResult[0].success) {
      const errorMsg = rpcResult?.[0]?.error_message || 'Unknown error changing tier';
      throw new ApiError(400, errorMsg);
    }

    const { data, error } = await supabaseAdmin
      .from('memberships')
      .select('*, tier:membership_tiers(*)')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Membership & { tier: MembershipTier };
  }

  /**
   * Upgrades a user's membership after successful Stripe payment.
   * Called by webhook handler after checkout.session.completed event.
   */
  async upgradeMembership(
    userId: string,
    tierId: string,
    stripeData: {
      stripe_subscription_id: string;
      stripe_price_id: string;
      billing_cycle: 'monthly' | 'yearly';
      current_period_start: Date;
      current_period_end: Date;
    }
  ): Promise<Membership> {
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: tierId,
        status: 'active',
        stripe_subscription_id: stripeData.stripe_subscription_id,
        stripe_price_id: stripeData.stripe_price_id,
        billing_cycle: stripeData.billing_cycle,
        current_period_start: stripeData.current_period_start.toISOString(),
        current_period_end: stripeData.current_period_end.toISOString(),
        started_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return data as Membership;
  }

  // ============================================
  // Stripe-as-truth sync methods
  // ============================================

  /**
   * Syncs membership data from Stripe subscription.
   * Called on-demand at login, billing page load, or when cache expires.
   * Uses 24-hour cache to avoid excessive Stripe API calls.
   *
   * ARCHITECTURE: Absence of Stripe subscription = Free tier.
   * - No Stripe customer ID → stays on current tier (cache update only)
   * - Customer ID but no active subscription → downgrades to Free tier
   * - Active/trialing subscription → syncs subscription data
   */
  async syncFromStripe(
    userId: string,
    forceSync: boolean = false
  ): Promise<Membership & { tier: MembershipTier }> {
    const membership = await this.getUserMembership(userId);

    // Check if cache is still valid
    if (!forceSync && membership.sync_expires_at) {
      const expiresAt = new Date(membership.sync_expires_at);
      if (expiresAt > new Date()) {
        return membership;
      }
    }

    // Get user's Stripe customer ID from profile
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      // No Stripe customer, just update cache timestamps
      await this.updateMembership(userId, {
        last_synced_at: new Date().toISOString(),
        sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      return this.getUserMembership(userId);
    }

    try {
      const latestSubscription = await stripeService.getLatestActiveSubscription(
        profile.stripe_customer_id
      );

      if (latestSubscription) {
        await stripeService.syncSubscriptionToDatabase(userId, latestSubscription);
      } else {
        // No active subscription = Free tier
        const freeTier = await this.getTierByName('free');
        if (membership.tier_id !== freeTier.id) {
          await this.downgradeToFree(userId, 'No active Stripe subscription');
        } else {
          await this.updateMembership(userId, {
            last_synced_at: new Date().toISOString(),
            sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      return this.getUserMembership(userId);
    } catch (error) {
      logger.logError('STRIPE', 'Error syncing from Stripe', error);
      // Still update cache to prevent hammering Stripe on errors
      await this.updateMembership(userId, {
        last_synced_at: new Date().toISOString(),
        sync_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour on error
      });
      throw new ApiError(500, 'Failed to sync subscription from Stripe');
    }
  }

  /**
   * Downgrades a user to the Free tier.
   * Called when subscription is cancelled, payment fails, or subscription ends.
   * Preserves user data (bookmarks, etc.).
   */
  async downgradeToFree(userId: string, reason?: string): Promise<void> {
    const freeTier = await this.getTierByName('free');

    if (reason) {
      logger.info('MEMBERSHIP', 'Downgrading user to Free tier', { userId, reason });
    }

    const { error } = await supabaseAdmin
      .from('memberships')
      .update({
        tier_id: freeTier.id,
        status: 'active',
        stripe_subscription_id: null,
        stripe_price_id: null,
        stripe_status: null,
        stripe_current_period_end: null,
        cancel_at_period_end: false,
        billing_cycle: null,
        last_synced_at: new Date().toISOString(),
        sync_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('MEMBERSHIP', 'Error downgrading to Free tier', {
        error: error.message,
        userId,
      });
      throw new ApiError(500, 'Failed to downgrade to Free tier');
    }
  }
}

export const membershipService = new MembershipService();
```

---

### Step 2.5: Usage Service

The usage service tracks feature consumption against tier limits. It uses the atomic `check_reset_and_increment_usage` RPC with `FOR UPDATE` row locks to prevent race conditions on concurrent usage increments.

#### File: `packages/backend/src/services/usage.service.ts`

```typescript
/**
 * @file usage.service.ts
 * @description Service for tracking feature usage and enforcing limits.
 *
 * Uses atomic database operations to prevent race conditions.
 *
 * @see constants/feature.constants.ts - FEATURE_PERIOD_MAP
 * @see types/usage.types.ts - UsageTracking, FeatureUsage, UsageResult
 */

import { supabaseAdmin } from '../config/supabase.js';
import { UsageTracking, FeatureUsage, UsageResult, UsageSummary } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { membershipService } from './membership.service.js';
import { FEATURE_PERIOD_MAP } from '../constants/index.js';
import { getEndOfDay, getEndOfMonth } from '../utils/index.js';

/**
 * Service for tracking feature usage and enforcing limits.
 */
export class UsageService {
  /**
   * Initializes usage tracking records for a user based on their tier's features.
   * Creates or resets usage_tracking records for all limit-type features.
   */
  async initializeUsage(userId: string, tierId: string): Promise<void> {
    const tierFeatures = await membershipService.getTierFeatures(tierId);
    const features = await membershipService.getAllFeatures();

    for (const tierFeature of tierFeatures) {
      const feature = features.find((f) => f.id === tierFeature.feature_id);
      if (!feature || feature.feature_type !== 'limit') {
        continue;
      }

      const periodType = FEATURE_PERIOD_MAP[feature.key] || 'lifetime';
      const limit = this.parseLimit(tierFeature.value);

      let periodEnd: Date | null = null;
      if (periodType === 'daily') {
        periodEnd = getEndOfDay();
      } else if (periodType === 'monthly') {
        periodEnd = getEndOfMonth();
      }

      const { error } = await supabaseAdmin.from('usage_tracking').upsert(
        {
          user_id: userId,
          feature_key: feature.key,
          current_usage: 0,
          usage_limit: limit,
          period_type: periodType,
          period_start: new Date().toISOString(),
          period_end: periodEnd?.toISOString() || null,
        },
        {
          onConflict: 'user_id,feature_key',
        }
      );

      if (error) {
        throw new ApiError(500, `Failed to initialize usage for ${feature.key}: ${error.message}`);
      }
    }
  }

  /**
   * Updates usage limits when a user changes tiers.
   * Preserves current usage counts but updates the limits.
   */
  async updateLimitsForTier(userId: string, tierId: string): Promise<void> {
    const tierFeatures = await membershipService.getTierFeatures(tierId);
    const features = await membershipService.getAllFeatures();

    for (const tierFeature of tierFeatures) {
      const feature = features.find((f) => f.id === tierFeature.feature_id);
      if (!feature || feature.feature_type !== 'limit') {
        continue;
      }

      const limit = this.parseLimit(tierFeature.value);

      const { error } = await supabaseAdmin
        .from('usage_tracking')
        .update({ usage_limit: limit })
        .eq('user_id', userId)
        .eq('feature_key', feature.key);

      if (error) {
        await this.initializeUsage(userId, tierId);
        return;
      }
    }
  }

  /**
   * Checks if a user can use a feature based on their current usage.
   * Returns true if usage is below limit or feature is unlimited (-1).
   */
  async canUseFeature(userId: string, featureKey: string): Promise<boolean> {
    const usage = await this.getUsage(userId, featureKey);

    if (!usage) {
      return membershipService.userHasFeature(userId, featureKey);
    }

    if (usage.usage_limit === -1) {
      return true;
    }

    return usage.current_usage < usage.usage_limit;
  }

  /**
   * Increment usage using atomic database operation.
   * Prevents race conditions with concurrent requests.
   */
  async incrementUsage(
    userId: string,
    featureKey: string,
    amount: number = 1
  ): Promise<UsageResult> {
    const { data, error } = await supabaseAdmin.rpc('check_reset_and_increment_usage', {
      p_user_id: userId,
      p_feature_key: featureKey,
      p_amount: amount,
    });

    if (error) {
      throw new ApiError(500, `Failed to increment usage: ${error.message}`);
    }

    if (!data || data.length === 0 || !data[0].success) {
      const membership = await membershipService.getUserMembership(userId);
      await this.initializeUsage(userId, membership.tier_id);
      return this.incrementUsage(userId, featureKey, amount);
    }

    const result = data[0];

    return {
      success: true,
      current_usage: result.current_usage,
      usage_limit: result.usage_limit,
      remaining: result.remaining,
      is_exceeded: result.is_exceeded,
    };
  }

  /**
   * Retrieves current usage for a specific feature.
   * Automatically resets the period if it has ended.
   */
  async getUsage(userId: string, featureKey: string): Promise<FeatureUsage | null> {
    await this.checkAndResetPeriod(userId, featureKey);

    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new ApiError(500, error.message);
    }

    const usageTracking = data as UsageTracking;
    const features = await membershipService.getAllFeatures();
    const feature = features.find((f) => f.key === featureKey);

    const isUnlimited = usageTracking.usage_limit === -1;
    const percentageUsed = isUnlimited
      ? null
      : Math.min(100, Math.round((usageTracking.current_usage / usageTracking.usage_limit) * 100));

    return {
      feature_key: usageTracking.feature_key,
      feature_name: feature?.name || featureKey,
      current_usage: usageTracking.current_usage,
      usage_limit: usageTracking.usage_limit,
      percentage_used: percentageUsed,
      period_type: usageTracking.period_type,
      period_resets_at: usageTracking.period_end,
      is_exceeded: !isUnlimited && usageTracking.current_usage >= usageTracking.usage_limit,
    };
  }

  /**
   * Retrieves usage for all tracked features for a user.
   */
  async getAllUsage(userId: string): Promise<UsageSummary> {
    const tierWithFeatures = await membershipService.getUserTierWithFeatures(userId);

    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    const features = await membershipService.getAllFeatures();
    const usageList = data as UsageTracking[];

    const featureUsages: FeatureUsage[] = usageList.map((usage) => {
      const feature = features.find((f) => f.key === usage.feature_key);
      const isUnlimited = usage.usage_limit === -1;
      const percentageUsed = isUnlimited
        ? null
        : Math.min(100, Math.round((usage.current_usage / usage.usage_limit) * 100));

      return {
        feature_key: usage.feature_key,
        feature_name: feature?.name || usage.feature_key,
        current_usage: usage.current_usage,
        usage_limit: usage.usage_limit,
        percentage_used: percentageUsed,
        period_type: usage.period_type,
        period_resets_at: usage.period_end,
        is_exceeded: !isUnlimited && usage.current_usage >= usage.usage_limit,
      };
    });

    return {
      user_id: userId,
      tier_name: tierWithFeatures?.tier_name || 'unknown',
      features: featureUsages,
    };
  }

  /**
   * Resets usage counters for all expired periods.
   * Intended to be called by a cron job (e.g., daily at midnight UTC).
   */
  async resetPeriodicUsage(): Promise<number> {
    const now = new Date();

    const { data: expiredRecords, error: selectError } = await supabaseAdmin
      .from('usage_tracking')
      .select('id, feature_key, period_type')
      .lt('period_end', now.toISOString())
      .in('period_type', ['daily', 'monthly']);

    if (selectError) {
      throw new ApiError(500, selectError.message);
    }

    if (!expiredRecords || expiredRecords.length === 0) {
      return 0;
    }

    let resetCount = 0;

    for (const record of expiredRecords) {
      const newPeriodEnd = record.period_type === 'daily' ? getEndOfDay() : getEndOfMonth();

      const { error: updateError } = await supabaseAdmin
        .from('usage_tracking')
        .update({
          current_usage: 0,
          period_start: now.toISOString(),
          period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', record.id);

      if (!updateError) {
        resetCount++;
      }
    }

    return resetCount;
  }

  /**
   * Checks if a usage period has ended and resets if necessary.
   */
  private async checkAndResetPeriod(userId: string, featureKey: string): Promise<void> {
    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('id, period_end, period_type')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .single();

    if (error || !data) {
      return;
    }

    if (!data.period_end || data.period_type === 'lifetime' || data.period_type === 'none') {
      return;
    }

    const periodEnd = new Date(data.period_end);
    const now = new Date();

    if (now > periodEnd) {
      const newPeriodEnd = data.period_type === 'daily' ? getEndOfDay() : getEndOfMonth();

      await supabaseAdmin
        .from('usage_tracking')
        .update({
          current_usage: 0,
          period_start: now.toISOString(),
          period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', data.id);
    }
  }

  /**
   * Parses a limit value from JSONB storage into a number.
   */
  private parseLimit(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }
}

export const usageService = new UsageService();
```

---

### Step 2.6: Webhook Service

The webhook service routes Stripe events to appropriate handlers. Events are logged with idempotency (duplicate `stripe_event_id` inserts are silently ignored via the `23505` unique violation code). The email-sending functionality from the source has been removed — add your own notification logic as needed.

#### File: `packages/backend/src/services/webhook.service.ts`

```typescript
import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { membershipService } from './membership.service.js';
import { stripeService } from './stripe.service.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Service for handling Stripe webhook events.
 * Processes subscription lifecycle events, payments, and invoices.
 * Events are logged to stripe_webhook_events table for auditing and replay.
 */
export class WebhookService {
  /**
   * Verifies the Stripe webhook signature and constructs the event object.
   * Should be called with the raw request body (Buffer, not parsed JSON).
   */
  verifyWebhookSignature(payload: Buffer, signature: string): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new ApiError(400, 'Webhook signature verification failed');
    }
  }

  /**
   * Logs a webhook event to the database for auditing.
   * Ignores duplicate events (idempotency via stripe_event_id unique constraint).
   */
  async logWebhookEvent(event: Stripe.Event): Promise<void> {
    const { error } = await supabaseAdmin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    });

    if (error && error.code !== '23505') {
      logger.error('STRIPE', 'Error logging webhook event', {
        error: error.message,
        eventId: event.id,
      });
    }
  }

  /**
   * Marks a webhook event as processed in the database.
   */
  async markEventProcessed(eventId: string, error?: string): Promise<void> {
    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: error || null,
      })
      .eq('stripe_event_id', eventId);
  }

  /**
   * Routes and processes a Stripe webhook event.
   * Logs the event, delegates to appropriate handler, and marks as processed.
   */
  async processEvent(event: Stripe.Event): Promise<void> {
    await this.logWebhookEvent(event);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.debug('STRIPE', 'Unhandled webhook event type', { eventType: event.type });
      }

      await this.markEventProcessed(event.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markEventProcessed(event.id, errorMessage);
      throw error;
    }
  }

  /**
   * Handles successful checkout completion.
   * Saves customer ID and syncs subscription to database.
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.supabase_user_id;

    if (!userId || !session.subscription) {
      logger.error('STRIPE', 'Missing required metadata in checkout session', {
        sessionId: session.id,
      });
      return;
    }

    // Save stripe_customer_id to user_profiles (if not already saved)
    await supabaseAdmin
      .from('user_profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', userId)
      .is('stripe_customer_id', null);

    // Get subscription details and sync to database
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    await stripeService.syncSubscriptionToDatabase(userId, subscription);

    logger.info('STRIPE', 'Subscription synced after checkout', { userId });

    // TODO: Add email notification here if desired
  }

  /**
   * Handles subscription create/update events.
   * Syncs subscription data and marks trial as used when applicable.
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.error('STRIPE', 'Missing supabase_user_id in subscription metadata', {
        subscriptionId: subscription.id,
      });
      return;
    }

    await stripeService.syncSubscriptionToDatabase(userId, subscription);

    if (subscription.status === 'trialing') {
      await stripeService.markTrialUsed(userId);
      logger.info('STRIPE', 'Trial marked as used', { userId });
    }

    logger.info('STRIPE', 'Subscription synced', { subscriptionId: subscription.id, userId });
  }

  /**
   * Handles subscription deletion/cancellation.
   * Downgrades user to free tier when subscription ends.
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.error('STRIPE', 'Missing supabase_user_id in subscription metadata for deletion', {
        subscriptionId: subscription.id,
      });
      return;
    }

    const wasTrialing = subscription.status === 'trialing' || subscription.trial_end !== null;
    const reason = wasTrialing ? 'Trial ended without payment' : 'Subscription ended';

    await membershipService.downgradeToFree(userId, reason);

    logger.info('STRIPE', 'User downgraded to Free tier', { userId, reason });
  }

  /**
   * Handles trial_will_end event (sent 3 days before trial ends).
   * Logs the event. Add your own email/notification logic as needed.
   */
  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.error('STRIPE', 'Missing supabase_user_id for trial_will_end', {
        subscriptionId: subscription.id,
      });
      return;
    }

    const trialEndDate = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    const daysRemaining = trialEndDate
      ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 3;

    const hasPaymentMethod = subscription.default_payment_method !== null;

    logger.info('STRIPE', 'Trial will end', {
      userId,
      daysRemaining,
      hasPaymentMethod,
    });

    // TODO: Add email reminder here if desired
  }

  /**
   * Handles successful invoice payment.
   * Only processes invoices linked to subscriptions.
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Extract subscription ID from various possible locations
    let subscriptionId: string | null = null;

    if (typeof invoice.subscription === 'string') {
      subscriptionId = invoice.subscription;
    } else if (invoice.subscription && typeof invoice.subscription === 'object') {
      subscriptionId = (invoice.subscription as Stripe.Subscription).id;
    }

    if (!subscriptionId && invoice.lines?.data?.length > 0) {
      const lineSubscription = invoice.lines.data[0]?.subscription;
      if (typeof lineSubscription === 'string') {
        subscriptionId = lineSubscription;
      } else if (lineSubscription && typeof lineSubscription === 'object') {
        subscriptionId = (lineSubscription as Stripe.Subscription).id;
      }
    }

    if (!subscriptionId) {
      logger.debug('STRIPE', 'No subscription on invoice, skipping', { invoiceId: invoice.id });
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logger.debug('STRIPE', 'No supabase_user_id in subscription metadata, skipping');
      return;
    }

    logger.info('STRIPE', 'Invoice paid', { invoiceId: invoice.id, userId });

    // TODO: Add payment confirmation email for recurring payments here if desired
  }

  /**
   * Handles failed invoice payment.
   * IMMEDIATELY downgrades to Free tier on payment failure.
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) return;

    await membershipService.downgradeToFree(userId, 'Payment failed');

    logger.warn('STRIPE', 'Invoice payment failed - user downgraded', {
      invoiceId: invoice.id,
      userId,
    });
  }
}

export const webhookService = new WebhookService();
```

---

### Step 2.7: Contact Service

Simplified contact form service — stores submissions in the database. Email notifications are excluded from this template (add per-project).

#### File: `packages/backend/src/services/contact.service.ts`

```typescript
import { supabaseAdmin } from '../config/supabase.js';
import { ContactSubmission, CreateContactSubmissionInput } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Service for handling public contact form submissions.
 * Stores submissions in the database.
 * Uses admin client to bypass RLS for anonymous submissions.
 */
export class ContactService {
  /**
   * Creates a new contact form submission.
   * Uses supabaseAdmin (service role) to bypass RLS since submitters may be anonymous.
   *
   * @param input - Contact form data (name, email, subject, message)
   * @param ipAddress - Optional IP address of the submitter
   * @param userAgent - Optional user agent string
   * @returns The created contact submission record
   */
  async createSubmission(
    input: CreateContactSubmissionInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ContactSubmission> {
    const { data, error } = await supabaseAdmin
      .from('contact_submissions')
      .insert({
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      logger.error('DB', 'Contact submission error', { error: error.message });
      throw new ApiError(500, 'Failed to submit contact form');
    }

    return data;
  }
}

export const contactService = new ContactService();
```

---

### Step 2.8: Newsletter Service

Simple newsletter subscription with privacy-first duplicate handling.

#### File: `packages/backend/src/services/newsletter.service.ts`

```typescript
/**
 * @file newsletter.service.ts
 * @description Service for handling newsletter subscriptions.
 *
 * Privacy-first approach: silently handles duplicate subscriptions.
 */

import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Newsletter subscriber record.
 */
export interface NewsletterSubscriber {
  id: string;
  email: string;
  created_at: string;
}

/**
 * Service for handling newsletter subscriptions.
 * Uses admin client to bypass RLS for anonymous subscriptions.
 */
export class NewsletterService {
  /**
   * Subscribe an email to the newsletter.
   * Silently succeeds if email already exists (privacy-first).
   *
   * @param email - Email address to subscribe
   * @returns Object indicating if this was a new subscription
   */
  async subscribe(email: string): Promise<{ isNew: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({ email: normalizedEmail });

    // Handle unique constraint violation silently (privacy-first)
    if (error?.code === '23505') {
      return { isNew: false };
    }

    if (error) {
      logger.error('DB', 'Newsletter subscription error', { error: error.message });
      throw new ApiError(500, 'Failed to subscribe to newsletter');
    }

    return { isNew: true };
  }
}

export const newsletterService = new NewsletterService();
```

---

### Step 2.9: Billing Routes

Stripe billing endpoints: checkout, portal, payment history, subscription status, trial start, and webhook.

#### File: `packages/backend/src/routes/billing.routes.ts`

```typescript
/**
 * @file billing.routes.ts
 * @description Stripe billing API endpoints.
 *
 * @see services/stripe.service.ts - Stripe operations
 * @see services/webhook.service.ts - Webhook processing
 */

import { Router, Response, Request } from 'express';
import { stripeService } from '../services/stripe.service.js';
import { webhookService } from '../services/webhook.service.js';
import { membershipService } from '../services/membership.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import { asyncHandler, ApiError } from '../middleware/error.middleware.js';
import { RequestWithUser } from '../types/index.js';
import { env } from '../config/env.js';
import { checkoutSchema } from '../validation/index.js';

const router = Router();

/**
 * POST /create-checkout-session
 * Creates a Stripe Checkout session for upgrading membership.
 * If user already has active subscription, returns portal URL instead.
 */
router.post(
  '/create-checkout-session',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const input = checkoutSchema.parse(req.body);

    try {
      const checkoutUrl = await stripeService.createCheckoutSession(
        req.user.id,
        req.user.email!,
        input.tier_id,
        input.billing_cycle,
        input.success_url,
        input.cancel_url,
        input.skip_trial ?? false
      );

      res.json({
        success: true,
        data: { checkout_url: checkoutUrl },
      });
    } catch (error) {
      if (error instanceof ApiError && error.message === 'ACTIVE_SUBSCRIPTION_EXISTS') {
        const portalUrl = await stripeService.createPortalSession(req.user.id);
        res.json({
          success: true,
          data: {
            portal_url: portalUrl,
            message:
              'You already have an active subscription. Use the billing portal to manage it.',
          },
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * POST /create-portal-session
 * Creates a Stripe customer portal session for subscription management.
 */
router.post(
  '/create-portal-session',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const portalUrl = await stripeService.createPortalSession(req.user.id);

    res.json({
      success: true,
      data: { portal_url: portalUrl },
    });
  })
);

/**
 * GET /payment-history
 * Returns payment history fetched directly from Stripe API.
 */
router.get(
  '/payment-history',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const payments = await stripeService.getPaymentHistory(req.user.id, limit);

    res.json({
      success: true,
      data: payments,
    });
  })
);

/**
 * GET /subscription-status
 * Returns current subscription status with fresh sync from Stripe.
 * Pass ?force=true to bypass cache.
 */
router.get(
  '/subscription-status',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const forceSync = req.query.force === 'true';
    const membership = await membershipService.syncFromStripe(req.user.id, forceSync);

    res.json({
      success: true,
      data: membership,
    });
  })
);

/**
 * POST /start-pro-trial
 * Start a trial via Stripe Checkout for the top-tier plan.
 * No payment method required upfront.
 */
router.post(
  '/start-pro-trial',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const hasUsedTrial = await stripeService.hasUserUsedTrial(req.user.id);
    if (hasUsedTrial) {
      throw new ApiError(400, 'TRIAL_ALREADY_USED');
    }

    const { hasActive } = await stripeService.userHasActiveSubscription(req.user.id);
    if (hasActive) {
      throw new ApiError(400, 'ACTIVE_SUBSCRIPTION_EXISTS');
    }

    // Get the top tier (the one with trial_days configured)
    const topTier = await membershipService.getTierByName('{{TIER_3_NAME}}');

    if (!topTier.trial_days || topTier.trial_days <= 0) {
      throw new ApiError(400, '{{TIER_3_DISPLAY}} tier does not offer a trial');
    }

    const checkoutUrl = await stripeService.createCheckoutSession(
      req.user.id,
      req.user.email!,
      topTier.id,
      'monthly',
      `${env.FRONTEND_URL}/dashboard?trial=started`,
      `${env.FRONTEND_URL}/pricing?trial=cancelled`
    );

    res.json({
      success: true,
      data: { checkout_url: checkoutUrl },
    });
  })
);

/**
 * POST /webhook
 * Stripe webhook endpoint. Raw body needed for signature verification.
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
      return;
    }

    const event = webhookService.verifyWebhookSignature(req.body, signature);
    await webhookService.processEvent(event);

    res.json({ received: true });
  })
);

export default router;
```

---

### Step 2.10: Membership Routes

Membership management: tiers, features, trial management, tier change (dev), usage tracking.

#### File: `packages/backend/src/routes/membership.routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { membershipService } from '../services/membership.service.js';
import { stripeService } from '../services/stripe.service.js';
import { usageService } from '../services/usage.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireUser } from '../middleware/requireUser.middleware.js';
import { asyncHandler, ApiError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, RequestWithUser } from '../types/index.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================
// PUBLIC ENDPOINTS (no authentication required)
// ============================================

/**
 * GET /public/tiers-with-features
 * Returns all tiers with their features. Used for pricing page.
 */
router.get(
  '/public/tiers-with-features',
  asyncHandler(async (_req: Request, res: Response) => {
    const tiers = await membershipService.getTiers();
    const tiersWithFeatures = await Promise.all(
      tiers.map(async (tier) => ({
        ...tier,
        features: await membershipService.getTierFeatures(tier.id),
      }))
    );
    res.json({ success: true, data: tiersWithFeatures });
  })
);

// ============================================
// AUTHENTICATED ENDPOINTS
// ============================================

/**
 * GET /tiers - All membership tiers
 */
router.get(
  '/tiers',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tiers = await membershipService.getTiers(req.accessToken);
    res.json({ success: true, data: tiers });
  })
);

/**
 * GET /tiers/:tierId/features - Features for a specific tier
 */
router.get(
  '/tiers/:tierId/features',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { tierId } = req.params;
    const features = await membershipService.getTierFeatures(tierId, req.accessToken);
    res.json({ success: true, data: features });
  })
);

/**
 * GET / - Current user's membership
 */
router.get(
  '/',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const membership = await membershipService.getUserMembership(req.user.id, req.accessToken);
    res.json({ success: true, data: membership });
  })
);

/**
 * GET /features - Current user's tier with features
 */
router.get(
  '/features',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const tierWithFeatures = await membershipService.getUserTierWithFeatures(req.user.id);
    res.json({ success: true, data: tierWithFeatures });
  })
);

/**
 * GET /check-feature/:featureKey - Check if user has a specific feature
 */
router.get(
  '/check-feature/:featureKey',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { featureKey } = req.params;
    const hasFeature = await membershipService.userHasFeature(req.user.id, featureKey);
    res.json({ success: true, data: { has_feature: hasFeature } });
  })
);

/**
 * GET /feature-limit/:featureKey - Get the limit value for a feature
 */
router.get(
  '/feature-limit/:featureKey',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { featureKey } = req.params;
    const limit = await membershipService.getFeatureLimit(req.user.id, featureKey);
    res.json({ success: true, data: { limit } });
  })
);

// ============================================
// TRIAL MANAGEMENT
// ============================================

/**
 * GET /trial/status - Get current user's trial status (from Stripe)
 */
router.get(
  '/trial/status',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const membership = await membershipService.getUserMembership(req.user.id);
    const hasUsedTrial = membership.has_used_trial ?? false;

    let isOnTrial = false;
    let trialStartsAt: string | null = null;
    let trialEndsAt: string | null = null;
    let daysRemaining = 0;

    try {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('id', req.user.id)
        .single();

      if (profile?.stripe_customer_id) {
        const subscription = await stripeService.getLatestActiveSubscription(
          profile.stripe_customer_id
        );

        if (subscription && subscription.status === 'trialing') {
          isOnTrial = true;

          if (subscription.trial_start) {
            trialStartsAt = new Date(subscription.trial_start * 1000).toISOString();
          }
          if (subscription.trial_end) {
            trialEndsAt = new Date(subscription.trial_end * 1000).toISOString();
            const trialEnd = new Date(subscription.trial_end * 1000);
            daysRemaining = Math.max(
              0,
              Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            );
          }
        }
      }
    } catch (error) {
      const isNoSuchCustomer = error instanceof Error && error.message.includes('No such customer');

      if (!isNoSuchCustomer) {
        logger.logError('STRIPE', 'Error fetching trial status from Stripe', error);
        isOnTrial = membership.stripe_status === 'trialing';
        trialStartsAt = membership.trial_starts_at;
        trialEndsAt = membership.trial_ends_at;
        if (isOnTrial && trialEndsAt) {
          const trialEnd = new Date(trialEndsAt);
          daysRemaining = Math.max(
            0,
            Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );
        }
      }
    }

    const canStartTrial = !hasUsedTrial && !isOnTrial;

    res.json({
      success: true,
      data: {
        is_on_trial: isOnTrial,
        trial_starts_at: trialStartsAt,
        trial_ends_at: trialEndsAt,
        days_remaining: daysRemaining,
        has_used_trial: hasUsedTrial,
        can_start_trial: canStartTrial,
      },
    });
  })
);

/**
 * POST /trial/start - Start trial via Stripe Checkout
 */
router.post(
  '/trial/start',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const hasUsedTrial = await stripeService.hasUserUsedTrial(req.user.id);
    if (hasUsedTrial) {
      throw new ApiError(400, 'TRIAL_ALREADY_USED');
    }

    const { hasActive } = await stripeService.userHasActiveSubscription(req.user.id);
    if (hasActive) {
      throw new ApiError(400, 'ACTIVE_SUBSCRIPTION_EXISTS');
    }

    const topTier = await membershipService.getTierByName('{{TIER_3_NAME}}');

    if (!topTier.trial_days || topTier.trial_days <= 0) {
      throw new ApiError(400, '{{TIER_3_DISPLAY}} tier does not offer a trial');
    }

    const checkoutUrl = await stripeService.createCheckoutSession(
      req.user.id,
      req.user.email!,
      topTier.id,
      'monthly',
      `${env.FRONTEND_URL}/dashboard?trial=started`,
      `${env.FRONTEND_URL}/pricing?trial=cancelled`
    );

    res.json({
      success: true,
      data: { checkout_url: checkoutUrl },
      message: 'Redirecting to Stripe to start your trial. No payment required upfront.',
    });
  })
);

// ============================================
// TIER CHANGE (WITHOUT PAYMENT — FOR TESTING)
// ============================================

const changeTierSchema = z.object({
  tier_id: z.string().uuid(),
  billing_cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

/**
 * POST /change-tier - Change tier without payment (development/testing)
 */
router.post(
  '/change-tier',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { tier_id, billing_cycle } = changeTierSchema.parse(req.body);
    const membership = await membershipService.changeTier(req.user.id, tier_id, billing_cycle);

    res.json({
      success: true,
      data: membership,
      message: `Successfully changed to ${membership.tier.display_name} tier`,
    });
  })
);

// ============================================
// USAGE TRACKING
// ============================================

/**
 * GET /usage - All usage for current user
 */
router.get(
  '/usage',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const usage = await usageService.getAllUsage(req.user.id);
    res.json({ success: true, data: usage });
  })
);

/**
 * GET /usage/:featureKey - Usage for a specific feature
 */
router.get(
  '/usage/:featureKey',
  authMiddleware,
  requireUser,
  asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { featureKey } = req.params;
    const usage = await usageService.getUsage(req.user.id, featureKey);

    if (!usage) {
      res.status(404).json({
        success: false,
        error: 'No usage tracking found for this feature',
      });
      return;
    }

    res.json({ success: true, data: usage });
  })
);

export default router;
```

---

### Step 2.11: Contact Routes

Public contact form endpoint with rate limiting.

#### File: `packages/backend/src/routes/contact.routes.ts`

```typescript
/**
 * @file contact.routes.ts
 * @description Contact form API endpoint.
 * Public with rate limiting.
 */

import { Router, Request, Response } from 'express';
import { contactService } from '../services/contact.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { contactFormRateLimit } from '../middleware/rateLimit.middleware.js';
import { contactSubmissionSchema } from '../validation/index.js';

const router = Router();

/**
 * POST / - Submit contact form
 * Public, rate limited to 10 per 15 minutes per IP.
 */
router.post(
  '/',
  contactFormRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const input = contactSubmissionSchema.parse(req.body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    await contactService.createSubmission(input, ipAddress, userAgent);

    res.json({
      success: true,
      message: "Thank you for your message. We'll get back to you soon!",
    });
  })
);

export default router;
```

---

### Step 2.12: Newsletter Routes

Public newsletter subscription endpoint with rate limiting.

#### File: `packages/backend/src/routes/newsletter.routes.ts`

```typescript
/**
 * @file newsletter.routes.ts
 * @description Newsletter subscription endpoint.
 * Public with rate limiting.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { newsletterService } from '../services/newsletter.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { rateLimit } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Rate limit: 5 requests per 15 minutes per IP
const newsletterRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many subscription attempts. Please try again later.',
});

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
});

/**
 * POST /subscribe - Subscribe to newsletter
 * Public, rate limited to 5 per 15 minutes per IP.
 */
router.post(
  '/subscribe',
  newsletterRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = subscribeSchema.parse(req.body);
    await newsletterService.subscribe(email);

    res.json({
      success: true,
      message: "You're subscribed! Thanks for signing up.",
    });
  })
);

export default router;
```

---

### Step 2.13: Updated Routes Index

Replace the Phase 1 routes index with this expanded version that includes billing, membership, contact, and newsletter routes.

#### File: `packages/backend/src/routes/index.ts`

```typescript
/**
 * @file index.ts
 * @description Central API route registration.
 *
 * Route Categories:
 * - Authentication: /auth — Register, login, password reset
 * - User: /profile, /membership — Profile and subscription management
 * - Billing: /billing — Stripe checkout, webhooks, payment history
 * - Contact: /contact — Contact form submission
 * - Newsletter: /newsletter — Newsletter subscription
 * - Health: /health — Service health checks
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import membershipRoutes from './membership.routes.js';
import billingRoutes from './billing.routes.js';
import contactRoutes from './contact.routes.js';
import newsletterRoutes from './newsletter.routes.js';

const router = Router();

// Authentication routes — public (no auth required for most)
router.use('/auth', authRoutes);

// User profile routes — authenticated
router.use('/profile', profileRoutes);

// Membership routes — authenticated
// Handles: tiers, features, trial management, usage tracking
router.use('/membership', membershipRoutes);

// Billing routes — authenticated (except webhook)
// Handles: Stripe checkout, portal, webhooks, payment history
router.use('/billing', billingRoutes);

// Contact routes — public with rate limiting
router.use('/contact', contactRoutes);

// Newsletter routes — public with rate limiting
router.use('/newsletter', newsletterRoutes);

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================

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

## Verification Checklist

After completing all steps, verify:

1. **TypeScript compiles:** `npm run typecheck:backend` passes with no errors
2. **Server starts:** `npm run dev:backend` — no crash, `/api/health` returns 200
3. **Tiers endpoint works:** `GET /api/membership/public/tiers-with-features` returns seeded tiers with features
4. **Contact form works:** `POST /api/contact` with valid body returns success message
5. **Newsletter works:** `POST /api/newsletter/subscribe` with `{ "email": "test@example.com" }` returns success
6. **Auth + membership flow:** Register → user gets Free tier membership via trigger → `GET /api/membership` returns membership with tier
7. **Feature check works:** `GET /api/membership/check-feature/{{any_feature_key}}` returns `has_feature: true/false`
8. **Usage endpoint works:** `GET /api/membership/usage` returns usage summary
9. **Billing checkout:** `POST /api/billing/create-checkout-session` with valid tier_id returns Stripe checkout URL (requires Stripe test keys)
10. **Webhook endpoint exists:** `POST /api/billing/webhook` accepts requests (returns 400 without valid signature — expected)
11. **Subscription status:** `GET /api/billing/subscription-status` triggers sync and returns membership data
12. **Rate limiting works:** Rapid contact form submissions trigger 429 after limit
