import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  membershipMiddleware,
  requireTier,
  MembershipRequest,
} from '../middleware/membership.middleware.js';

const router = Router();

// All test routes require authentication and membership info
router.use(authMiddleware);
router.use(membershipMiddleware);

/**
 * GET /api/test/free-feature
 * Accessible by: Trial, Free, Premium, Pro tiers
 */
router.get(
  '/free-feature',
  requireTier('trial', 'free', 'premium', 'pro'),
  (req: MembershipRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        feature: 'free-feature',
        tier: req.membership?.tier_name,
        message: 'Access granted to Free feature!',
      },
    });
  }
);

/**
 * GET /api/test/premium-feature
 * Accessible by: Trial, Premium, Pro tiers only
 */
router.get(
  '/premium-feature',
  requireTier('trial', 'premium', 'pro'),
  (req: MembershipRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        feature: 'premium-feature',
        tier: req.membership?.tier_name,
        message: 'Access granted to Premium feature!',
      },
    });
  }
);

/**
 * GET /api/test/pro-feature
 * Accessible by: Trial, Pro tier only
 */
router.get('/pro-feature', requireTier('trial', 'pro'), (req: MembershipRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      feature: 'pro-feature',
      tier: req.membership?.tier_name,
      message: 'Access granted to Pro feature!',
    },
  });
});

/**
 * GET /api/test/tier-info
 * Returns current user's tier and features (accessible by all authenticated users)
 */
router.get('/tier-info', (req: MembershipRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      tier_name: req.membership?.tier_name,
      tier_display_name: req.membership?.tier_display_name,
      membership_status: req.membership?.membership_status,
      features: req.membership?.features,
    },
  });
});

export default router;
