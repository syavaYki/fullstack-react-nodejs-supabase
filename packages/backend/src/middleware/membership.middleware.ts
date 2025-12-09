import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AuthenticatedRequest, UserTierWithFeatures } from '../types/index.js';

// Extend request to include membership info
interface MembershipRequest extends AuthenticatedRequest {
  membership?: UserTierWithFeatures;
}

/**
 * Middleware to attach membership info to request
 */
export async function membershipMiddleware(
  req: MembershipRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Get user's tier with features using the helper function
    const { data, error } = await supabaseAdmin.rpc('get_user_tier_with_features', {
      p_user_id: req.user.id,
    });

    if (error) {
      console.error('Error fetching membership:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch membership information',
      });
      return;
    }

    if (data && data.length > 0) {
      req.membership = data[0] as UserTierWithFeatures;
    }

    next();
  } catch (error) {
    console.error('Membership middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify membership',
    });
  }
}

/**
 * Middleware factory to require a specific tier or higher
 */
export function requireTier(...allowedTiers: string[]) {
  return async (
    req: MembershipRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.membership) {
      res.status(403).json({
        success: false,
        error: 'Membership information not available',
      });
      return;
    }

    if (!allowedTiers.includes(req.membership.tier_name)) {
      res.status(403).json({
        success: false,
        error: `This feature requires one of the following tiers: ${allowedTiers.join(', ')}`,
      });
      return;
    }

    if (req.membership.membership_status !== 'active' && req.membership.membership_status !== 'trial') {
      res.status(403).json({
        success: false,
        error: 'Your membership is not active',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory to require a specific feature
 */
export function requireFeature(featureKey: string) {
  return async (
    req: MembershipRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Check if user has the feature
    const { data, error } = await supabaseAdmin.rpc('user_has_feature', {
      p_user_id: req.user.id,
      p_feature_key: featureKey,
    });

    if (error) {
      console.error('Error checking feature:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify feature access',
      });
      return;
    }

    if (!data) {
      res.status(403).json({
        success: false,
        error: `This feature requires the "${featureKey}" permission. Please upgrade your plan.`,
      });
      return;
    }

    next();
  };
}

export type { MembershipRequest };
