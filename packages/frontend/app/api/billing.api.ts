/**
 * Billing API
 * Stripe checkout, portal, and payment history endpoints
 */

import { apiClient } from './client';
import type { CreateCheckoutInput, PaymentHistory, BillingCycle } from '../types';

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(input: CreateCheckoutInput) {
  return apiClient.post<{ url: string; session_id: string }>(
    '/api/billing/create-checkout-session',
    input
  );
}

/**
 * Create a Stripe customer portal session for subscription management
 */
export async function createPortalSession(returnUrl?: string) {
  return apiClient.post<{ url: string }>('/api/billing/create-portal-session', {
    return_url: returnUrl,
  });
}

/**
 * Get payment history for current user
 */
export async function getPaymentHistory(limit = 10) {
  return apiClient.get<PaymentHistory[]>(`/api/billing/payment-history?limit=${limit}`);
}

/**
 * Helper to redirect to Stripe Checkout
 */
export async function redirectToCheckout(tierId: string, billingCycle: BillingCycle) {
  const response = await createCheckoutSession({
    tier_id: tierId,
    billing_cycle: billingCycle,
    success_url: `${window.location.origin}/checkout/success`,
    cancel_url: `${window.location.origin}/checkout/cancel`,
  });

  if (response.success && response.data?.url) {
    window.location.href = response.data.url;
  } else {
    throw new Error(response.error || 'Failed to create checkout session');
  }
}

/**
 * Helper to redirect to Stripe Customer Portal
 */
export async function redirectToPortal() {
  const response = await createPortalSession(window.location.href);

  if (response.success && response.data?.url) {
    window.location.href = response.data.url;
  } else {
    throw new Error(response.error || 'Failed to create portal session');
  }
}
