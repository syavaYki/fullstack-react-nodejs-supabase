/**
 * @file upgradeMessages.ts
 * @description Display names and descriptions shown in UpgradeDialog.
 *
 * Every feature that can trigger an upgrade prompt should have entries here.
 */

import { FEATURE_KEYS } from './featureKeys';

/** User-friendly display name per feature key */
export const FEATURE_NAMES: Record<string, string> = {
  [FEATURE_KEYS.EXAMPLE_BOOLEAN]: 'Example Feature',
  [FEATURE_KEYS.EXAMPLE_LIMIT]: 'Example Usage',
  [FEATURE_KEYS.PRIORITY_SUPPORT]: 'Priority Support',
};

/** Description shown in UpgradeDialog body per feature key */
export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  [FEATURE_KEYS.EXAMPLE_BOOLEAN]:
    'This feature is available on higher tiers. Upgrade to unlock it.',
  [FEATURE_KEYS.EXAMPLE_LIMIT]: "You've reached your usage limit. Upgrade to increase your limit.",
  [FEATURE_KEYS.PRIORITY_SUPPORT]:
    'Get faster support response times. Upgrade to unlock priority support.',
};
