/**
 * @file featureKeys.ts
 * @description Feature key constants matching the backend features table.
 *
 * Must stay in sync with packages/backend/src/constants/feature.constants.ts
 */

export const FEATURE_KEYS = {
  EXAMPLE_BOOLEAN: 'example_boolean',
  EXAMPLE_LIMIT: 'example_limit',
  PRIORITY_SUPPORT: 'priority_support',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];
