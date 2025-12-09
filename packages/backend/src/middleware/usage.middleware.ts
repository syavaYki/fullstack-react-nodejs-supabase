import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { usageService } from '../services/usage.service.js';

/**
 * Middleware factory to enforce feature limits
 * Use this to protect routes that should count against usage limits
 *
 * @param featureKey - The feature key to check and increment
 * @param autoIncrement - Whether to auto-increment usage on successful response (default: true)
 */
export function enforceLimit(featureKey: string, autoIncrement: boolean = true) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    try {
      const canUse = await usageService.canUseFeature(req.user.id, featureKey);

      if (!canUse) {
        res.status(429).json({
          success: false,
          error: `Usage limit exceeded for ${featureKey}`,
          code: 'USAGE_LIMIT_EXCEEDED',
          upgrade_url: '/pricing',
        });
        return;
      }

      if (autoIncrement) {
        // Auto-increment after successful response
        res.on('finish', () => {
          if (res.statusCode < 400 && req.user) {
            usageService.incrementUsage(req.user.id, featureKey).catch((err) => {
              console.error(`Failed to increment usage for ${featureKey}:`, err);
            });
          }
        });
      }

      next();
    } catch (error) {
      console.error('Error in enforceLimit middleware:', error);
      // Don't block request on tracking errors
      next();
    }
  };
}

/**
 * Middleware to check feature access without incrementing usage
 * Use this for read-only operations that should respect feature limits
 *
 * @param featureKey - The feature key to check
 */
export function requireFeature(featureKey: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    try {
      const canUse = await usageService.canUseFeature(req.user.id, featureKey);

      if (!canUse) {
        res.status(403).json({
          success: false,
          error: `Feature ${featureKey} not available on your plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          upgrade_url: '/pricing',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error in requireFeature middleware:', error);
      // Don't block request on tracking errors
      next();
    }
  };
}
