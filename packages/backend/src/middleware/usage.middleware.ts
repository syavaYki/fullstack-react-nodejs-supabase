import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { COLLECTION_TABLE_MAP } from '../constants/index.js';
import { logger } from '../utils/logger.js';

/**
 * Factory: enforce usage limit for a feature.
 * - Checks if user can use the feature (under limit)
 * - If autoIncrement=true, increments usage AFTER response succeeds (res.on('finish'))
 * - Returns 429 with machine-readable error on limit exceeded
 */
export function enforceLimit(featureKey: string, autoIncrement = true) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    try {
      // Check current limit
      const { data: limitData } = await supabaseAdmin.rpc('get_feature_limit', {
        p_user_id: req.user.id,
        p_feature_key: featureKey,
      });

      if (!limitData || limitData.length === 0) {
        res.status(403).json({
          success: false,
          error: 'Feature not available on your plan',
          code: 'FEATURE_NOT_AVAILABLE',
          feature_key: featureKey,
        });
        return;
      }

      const { usage_limit, current_usage } = limitData[0];

      // -1 means unlimited
      if (usage_limit !== -1 && current_usage >= usage_limit) {
        res.status(429).json({
          success: false,
          error: 'Usage limit exceeded',
          code: 'USAGE_LIMIT_EXCEEDED',
          feature_key: featureKey,
          current_usage,
          usage_limit,
        });
        return;
      }

      // Post-response increment: only if the route succeeds (2xx)
      if (autoIncrement) {
        const userId = req.user.id;
        res.on('finish', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            supabaseAdmin
              .rpc('check_reset_and_increment_usage', {
                p_user_id: userId,
                p_feature_key: featureKey,
              })
              .then(({ error }) => {
                if (error) {
                  logger.error('USAGE', 'Failed to increment usage', {
                    error: error.message,
                    featureKey,
                    userId,
                  });
                }
              });
          }
        });
      }

      next();
    } catch (error) {
      logger.logError('USAGE', 'enforceLimit error', error);
      res.status(500).json({ success: false, error: 'Failed to check usage limit' });
    }
  };
}

/** Read-only limit check (no increment) */
export function checkUsageQuota(featureKey: string) {
  return enforceLimit(featureKey, false);
}

/**
 * Enforce collection-based limits by counting actual DB rows.
 * Uses COLLECTION_TABLE_MAP to look up the table name.
 */
export function enforceCollectionLimit(featureKey: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const tableName = COLLECTION_TABLE_MAP[featureKey];
    if (!tableName) {
      logger.warn('USAGE', `No collection table mapped for feature: ${featureKey}`);
      return next();
    }

    try {
      // Get the feature limit
      const { data: limitData } = await supabaseAdmin.rpc('get_feature_limit', {
        p_user_id: req.user.id,
        p_feature_key: featureKey,
      });

      if (!limitData || limitData.length === 0) {
        res.status(403).json({
          success: false,
          error: 'Feature not available on your plan',
          code: 'FEATURE_NOT_AVAILABLE',
          feature_key: featureKey,
        });
        return;
      }

      const { usage_limit } = limitData[0];

      // -1 means unlimited
      if (usage_limit === -1) return next();

      // Count actual rows in the collection table
      const { count, error } = await supabaseAdmin
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

      if (error) {
        logger.error('USAGE', 'Error counting collection', { error: error.message, tableName });
        res.status(503).json({ success: false, error: 'Usage service temporarily unavailable' });
        return;
      }

      const currentCount = count ?? 0;
      if (currentCount >= usage_limit) {
        res.status(429).json({
          success: false,
          error: 'Collection limit reached',
          code: 'USAGE_LIMIT_EXCEEDED',
          feature_key: featureKey,
          current_usage: currentCount,
          usage_limit,
        });
        return;
      }

      next();
    } catch (error) {
      logger.logError('USAGE', 'enforceCollectionLimit error', error);
      res.status(503).json({ success: false, error: 'Usage service temporarily unavailable' });
    }
  };
}
