import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AuthenticatedRequest, UserTierWithFeatures } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface MembershipRequest extends AuthenticatedRequest {
  membership?: UserTierWithFeatures;
}

/** Attaches membership info to request via get_user_tier_with_features RPC */
export async function membershipMiddleware(
  req: MembershipRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { data, error } = await supabaseAdmin.rpc('get_user_tier_with_features', {
      p_user_id: req.user.id,
    });

    if (error) {
      logger.error('MEMBERSHIP', 'Error fetching membership', { error: error.message });
      res.status(500).json({ success: false, error: 'Failed to fetch membership information' });
      return;
    }

    if (data && data.length > 0) {
      req.membership = data[0] as UserTierWithFeatures;
    }

    next();
  } catch (error) {
    logger.logError('MEMBERSHIP', 'Membership middleware error', error);
    res.status(500).json({ success: false, error: 'Failed to verify membership' });
  }
}

/** Factory: require user's tier to be in allowedTiers list */
export function requireTier(...allowedTiers: string[]) {
  return async (req: MembershipRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.membership) {
      res.status(403).json({ success: false, error: 'Membership information not available' });
      return;
    }

    if (!allowedTiers.includes(req.membership.tier_name)) {
      res.status(403).json({
        success: false,
        error: `This feature requires one of the following tiers: ${allowedTiers.join(', ')}`,
      });
      return;
    }

    if (req.membership.membership_status !== 'active') {
      res.status(403).json({ success: false, error: 'Your membership is not active' });
      return;
    }

    // Belt-and-suspenders trial expiry check
    if (req.membership.stripe_status === 'trialing' && req.membership.trial_ends_at) {
      if (new Date() > new Date(req.membership.trial_ends_at)) {
        res.status(403).json({
          success: false,
          error: 'Your trial has expired. Please upgrade to continue.',
        });
        return;
      }
    }

    next();
  };
}

/** Factory: require a specific feature via user_has_feature RPC */
export function requireFeature(featureKey: string) {
  return async (req: MembershipRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { data, error } = await supabaseAdmin.rpc('user_has_feature', {
      p_user_id: req.user.id,
      p_feature_key: featureKey,
    });

    if (error) {
      logger.error('MEMBERSHIP', 'Error checking feature', { error: error.message, featureKey });
      res.status(500).json({ success: false, error: 'Failed to verify feature access' });
      return;
    }

    if (!data) {
      res.status(403).json({
        success: false,
        error: `Feature ${featureKey} not available on your plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature_key: featureKey,
        upgrade_url: '/pricing',
      });
      return;
    }

    next();
  };
}

export type { MembershipRequest };
