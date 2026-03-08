import type { FeatureType, FeatureStatus } from './shared.types.js';

/**
 * Feature definition from features table.
 * Defines available features that can be assigned to tiers.
 */
export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  feature_type: FeatureType;
  default_value: unknown;
  is_active: boolean;
  status: FeatureStatus;
  sort_order: number;
  created_at: string;
}

/**
 * Feature assignment for a tier from tier_features table.
 */
export interface TierFeature {
  id: string;
  tier_id: string;
  feature_id: string;
  value: unknown;
  created_at: string;
}

/**
 * TierFeature with joined Feature details.
 */
export interface TierFeatureWithDetails extends TierFeature {
  feature?: Feature;
}
