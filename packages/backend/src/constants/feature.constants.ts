import { PeriodType } from '../types/index.js';

/**
 * Centralized feature key constants.
 * Values must match the `key` column in the `features` database table.
 */
export const FEATURE_KEYS = {
  EXAMPLE_BOOLEAN: 'example_boolean',
  EXAMPLE_LIMIT: 'example_limit',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

/** Union type of all valid feature key values */
export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Mapping of collection feature keys to their database table names.
 * Used by enforceCollectionLimit to count actual items in the table.
 * Add entries here when you have limit-type features that track DB rows.
 */
export const COLLECTION_TABLE_MAP: Record<string, string> = {
  // Example: [FEATURE_KEYS.EXAMPLE_LIMIT]: 'user_items',
};

/**
 * Mapping of feature keys to their usage reset period types.
 * - 'daily': Resets at end of each day (UTC)
 * - 'monthly': Resets at end of each month (UTC)
 * - 'lifetime': Never resets, cumulative
 * - 'none': No usage tracking (boolean features)
 */
export const FEATURE_PERIOD_MAP: Record<string, PeriodType> = {
  example_boolean: 'none',
  example_limit: 'monthly',
  priority_support: 'none',
};
