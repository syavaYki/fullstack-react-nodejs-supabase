import type { TierFeatureWithDetails } from '~/types';

/**
 * Check if a tier feature is available (not disabled or zero)
 */
export function isFeatureAvailable(tierFeature: TierFeatureWithDetails): boolean {
  const value = tierFeature.value;
  const featureType = tierFeature.feature?.feature_type;

  if (featureType === 'boolean') {
    return value === true || value === 'true';
  }

  if (featureType === 'limit') {
    const numValue = typeof value === 'number' ? value : parseInt(String(value), 10);
    return numValue !== 0;
  }

  return true;
}

/**
 * Format feature for display in pricing cards
 * Returns full descriptive text like "Unlimited team members" or "5 GB storage"
 */
export function formatFeatureDisplay(tierFeature: TierFeatureWithDetails): string {
  const feature = tierFeature.feature;
  if (!feature) return '';

  const value = tierFeature.value;
  const featureType = feature.feature_type;

  if (featureType === 'boolean') {
    return feature.name;
  }

  if (featureType === 'limit') {
    const numValue = typeof value === 'number' ? value : parseInt(String(value), 10);

    if (numValue === -1) {
      // Unlimited
      if (feature.key === 'team_collaboration') return 'Unlimited team members';
      if (feature.key === 'cloud_storage') return 'Unlimited storage';
      if (feature.key === 'api_integrations') return 'Unlimited integrations';
      return `Unlimited ${feature.name.toLowerCase()}`;
    }

    if (feature.key === 'team_collaboration') {
      return numValue === 1 ? '1 team member' : `${numValue} team members`;
    }
    if (feature.key === 'cloud_storage') {
      if (numValue >= 1000) return `${numValue / 1000} GB storage`;
      return `${numValue} MB storage`;
    }
    if (feature.key === 'api_integrations') {
      return numValue === 1 ? '1 API integration' : `${numValue} API integrations`;
    }

    return `${numValue} ${feature.name.toLowerCase()}`;
  }

  return feature.name;
}

/**
 * Format feature value for comparison tables
 * Returns concise value like "Unlimited", "5 GB", "Included"
 */
export function formatFeatureValue(tierFeature: TierFeatureWithDetails): string {
  const value = tierFeature.value;
  const featureType = tierFeature.feature?.feature_type;

  if (featureType === 'boolean') {
    return value === true || value === 'true' ? 'Included' : 'Not included';
  }

  if (featureType === 'limit') {
    const numValue = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (numValue === -1) return 'Unlimited';
    if (numValue === 0) return 'Not available';

    // Format based on feature key
    const featureKey = tierFeature.feature?.key;
    if (featureKey === 'cloud_storage') {
      if (numValue >= 1000) {
        return `${numValue / 1000} GB`;
      }
      return `${numValue} MB`;
    }
    if (featureKey === 'team_collaboration') {
      return numValue === 1 ? '1 member' : `${numValue} members`;
    }
    if (featureKey === 'api_integrations') {
      return numValue === 1 ? '1 integration' : `${numValue} integrations`;
    }

    return String(numValue);
  }

  return String(value);
}
