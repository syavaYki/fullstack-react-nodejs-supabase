/**
 * Cache TTL for Stripe subscription sync.
 * 24 hours to avoid hammering Stripe API.
 */
export const STRIPE_SYNC_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Default cache TTL for general-purpose caching.
 */
export const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 1 minute
