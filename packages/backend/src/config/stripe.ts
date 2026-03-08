import Stripe from 'stripe';
import { env } from './env.js';

// Lazy-initialized so the server can start without Stripe credentials.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }
  return _stripe;
}

// Backwards-compatible export — lazy proxy
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
