/**
 * @file errors.ts
 * @description Typed error classes for usage limits and feature gates.
 *
 * Use instanceof checks (never string matching) to handle these errors.
 */

export interface LimitExceededInfo {
  featureKey: string;
  currentUsage: number;
  usageLimit: number;
}

/** Thrown when user exceeds a usage limit (HTTP 429 with USAGE_LIMIT_EXCEEDED code) */
export class UsageLimitExceededError extends Error {
  public info: LimitExceededInfo;

  constructor(info: LimitExceededInfo) {
    super(`Usage limit exceeded for ${info.featureKey}`);
    this.name = 'UsageLimitExceededError';
    this.info = info;
  }
}

/** Thrown when user lacks a feature (HTTP 403 with FEATURE_NOT_AVAILABLE code) */
export class FeatureNotAvailableError extends Error {
  public featureKey: string;

  constructor(featureKey: string) {
    super(`Feature ${featureKey} not available on your plan`);
    this.name = 'FeatureNotAvailableError';
    this.featureKey = featureKey;
  }
}

/**
 * Check an API response for limit/feature errors and throw typed errors.
 * Call this in API functions that may trigger usage or feature gates.
 */
export function checkLimitExceeded(response: {
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}): void {
  if (response.success) return;

  const details = response.details as Record<string, unknown> | undefined;
  if (!details?.code) return;

  if (details.code === 'USAGE_LIMIT_EXCEEDED') {
    throw new UsageLimitExceededError({
      featureKey: details.feature_key as string,
      currentUsage: details.current_usage as number,
      usageLimit: details.usage_limit as number,
    });
  }

  if (details.code === 'FEATURE_NOT_AVAILABLE') {
    throw new FeatureNotAvailableError(details.feature_key as string);
  }
}
