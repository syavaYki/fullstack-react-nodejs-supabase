import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/admin.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AdminRequest } from '../types/index.js';
import { trialService } from '../services/trial.service.js';
import { usageService } from '../services/usage.service.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(requireAdmin);

// ============================================
// TIER CRUD
// ============================================

// Validation schemas
const createTierSchema = z.object({
  name: z.string().min(1).max(50),
  display_name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price_monthly: z.number().min(0),
  price_yearly: z.number().min(0),
  stripe_price_id_monthly: z.string().optional(),
  stripe_price_id_yearly: z.string().optional(),
  stripe_product_id: z.string().optional(),
  trial_days: z.number().int().min(0).default(0),
  sort_order: z.number().int().default(0),
});

const updateTierSchema = createTierSchema.partial().extend({
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

/**
 * @swagger
 * /api/admin/tiers:
 *   get:
 *     summary: List all tiers (including inactive)
 *     tags: [Admin - Tiers]
 *     responses:
 *       200:
 *         description: List of all tiers
 *       403:
 *         description: Admin access required
 */
router.get(
  '/tiers',
  asyncHandler(async (_req: AdminRequest, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .select('*')
      .order('sort_order');

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/tiers:
 *   post:
 *     summary: Create a new tier
 *     tags: [Admin - Tiers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, display_name, price_monthly, price_yearly]
 *             properties:
 *               name:
 *                 type: string
 *               display_name:
 *                 type: string
 *               description:
 *                 type: string
 *               price_monthly:
 *                 type: number
 *               price_yearly:
 *                 type: number
 *     responses:
 *       201:
 *         description: Tier created
 *       400:
 *         description: Invalid input
 */
router.post(
  '/tiers',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const input = createTierSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .insert(input)
      .select()
      .single();

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(201).json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/tiers/{id}:
 *   put:
 *     summary: Update a tier
 *     tags: [Admin - Tiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tier updated
 *       404:
 *         description: Tier not found
 */
router.put(
  '/tiers/:id',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { id } = req.params;
    const input = updateTierSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, error: 'Tier not found' });
        return;
      }
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/tiers/{id}:
 *   delete:
 *     summary: Deactivate a tier (soft delete)
 *     tags: [Admin - Tiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tier deactivated
 *       404:
 *         description: Tier not found
 */
router.delete(
  '/tiers/:id',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { id } = req.params;

    // Soft delete - just set is_active to false
    const { data, error } = await supabaseAdmin
      .from('membership_tiers')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, error: 'Tier not found' });
        return;
      }
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data, message: 'Tier deactivated' });
  })
);

// ============================================
// TIER FEATURES CRUD
// ============================================

const setTierFeatureSchema = z.object({
  feature_id: z.string().uuid(),
  value: z.unknown(),
});

const bulkSetTierFeaturesSchema = z.array(setTierFeatureSchema);

/**
 * @swagger
 * /api/admin/tiers/{id}/features:
 *   get:
 *     summary: Get features for a tier
 *     tags: [Admin - Tiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tier features
 */
router.get(
  '/tiers/:id/features',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('tier_features')
      .select(
        `
        *,
        feature:features(*)
      `
      )
      .eq('tier_id', id);

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/tiers/{id}/features:
 *   put:
 *     summary: Update tier features (bulk)
 *     tags: [Admin - Tiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 feature_id:
 *                   type: string
 *                   format: uuid
 *                 value:
 *                   type: any
 *     responses:
 *       200:
 *         description: Tier features updated
 */
router.put(
  '/tiers/:id/features',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { id } = req.params;
    const features = bulkSetTierFeaturesSchema.parse(req.body);

    // Upsert all features
    const upsertData = features.map((f) => ({
      tier_id: id,
      feature_id: f.feature_id,
      value: f.value,
    }));

    const { error } = await supabaseAdmin
      .from('tier_features')
      .upsert(upsertData, { onConflict: 'tier_id,feature_id' });

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    // Fetch updated features
    const { data, error: fetchError } = await supabaseAdmin
      .from('tier_features')
      .select(
        `
        *,
        feature:features(*)
      `
      )
      .eq('tier_id', id);

    if (fetchError) {
      res.status(500).json({ success: false, error: fetchError.message });
      return;
    }

    res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/tiers/{tierId}/features/{featureId}:
 *   delete:
 *     summary: Remove feature from tier
 *     tags: [Admin - Tiers]
 *     responses:
 *       200:
 *         description: Feature removed from tier
 */
router.delete(
  '/tiers/:tierId/features/:featureId',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { tierId, featureId } = req.params;

    const { error } = await supabaseAdmin
      .from('tier_features')
      .delete()
      .eq('tier_id', tierId)
      .eq('feature_id', featureId);

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: 'Feature removed from tier' });
  })
);

// ============================================
// FEATURES CRUD
// ============================================

const createFeatureSchema = z.object({
  key: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  feature_type: z.enum(['boolean', 'limit', 'enum']),
  default_value: z.unknown().optional(),
});

const updateFeatureSchema = createFeatureSchema.partial().extend({
  is_active: z.boolean().optional(),
});

/**
 * @swagger
 * /api/admin/features:
 *   get:
 *     summary: List all features
 *     tags: [Admin - Features]
 *     responses:
 *       200:
 *         description: List of all features
 */
router.get(
  '/features',
  asyncHandler(async (_req: AdminRequest, res: Response) => {
    const { data, error } = await supabaseAdmin.from('features').select('*').order('name');

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/features:
 *   post:
 *     summary: Create a new feature
 *     tags: [Admin - Features]
 *     responses:
 *       201:
 *         description: Feature created
 */
router.post(
  '/features',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const input = createFeatureSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('features')
      .insert({
        ...input,
        default_value: input.default_value ?? (input.feature_type === 'boolean' ? false : 0),
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(201).json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/features/{id}:
 *   put:
 *     summary: Update a feature
 *     tags: [Admin - Features]
 *     responses:
 *       200:
 *         description: Feature updated
 */
router.put(
  '/features/:id',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { id } = req.params;
    const input = updateFeatureSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('features')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, error: 'Feature not found' });
        return;
      }
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/features/{id}:
 *   delete:
 *     summary: Deactivate a feature (soft delete)
 *     tags: [Admin - Features]
 *     responses:
 *       200:
 *         description: Feature deactivated
 */
router.delete(
  '/features/:id',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('features')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ success: false, error: 'Feature not found' });
        return;
      }
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data, message: 'Feature deactivated' });
  })
);

// ============================================
// TRIAL MANAGEMENT (Admin)
// ============================================

/**
 * @swagger
 * /api/admin/trials/expire:
 *   post:
 *     summary: Expire all ended trials (cron job endpoint)
 *     tags: [Admin - Trials]
 *     responses:
 *       200:
 *         description: Trials expired
 */
router.post(
  '/trials/expire',
  asyncHandler(async (_req: AdminRequest, res: Response) => {
    const expiredCount = await trialService.expireTrials();

    res.json({
      success: true,
      data: { expired_count: expiredCount },
      message: `Expired ${expiredCount} trial(s)`,
    });
  })
);

// ============================================
// USAGE MANAGEMENT (Admin)
// ============================================

/**
 * @swagger
 * /api/admin/usage/reset:
 *   post:
 *     summary: Reset periodic usage counters (cron job endpoint)
 *     tags: [Admin - Usage]
 *     responses:
 *       200:
 *         description: Usage counters reset
 */
router.post(
  '/usage/reset',
  asyncHandler(async (_req: AdminRequest, res: Response) => {
    const resetCount = await usageService.resetPeriodicUsage();

    res.json({
      success: true,
      data: { reset_count: resetCount },
      message: `Reset ${resetCount} usage record(s)`,
    });
  })
);

/**
 * @swagger
 * /api/admin/users/{userId}/usage:
 *   get:
 *     summary: Get usage for a specific user
 *     tags: [Admin - Usage]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User usage summary
 */
router.get(
  '/users/:userId/usage',
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { userId } = req.params;
    const usage = await usageService.getAllUsage(userId);

    res.json({ success: true, data: usage });
  })
);

// ============================================
// ADMIN USER MANAGEMENT (Super Admin only)
// ============================================

/**
 * @swagger
 * /api/admin/admins:
 *   get:
 *     summary: List all admin users
 *     tags: [Admin - Management]
 *     responses:
 *       200:
 *         description: List of admin users
 */
router.get(
  '/admins',
  requireSuperAdmin,
  asyncHandler(async (_req: AdminRequest, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select(
        `
        *,
        user:user_profiles(id, email, first_name, last_name, full_name)
      `
      )
      .order('created_at');

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/admins:
 *   post:
 *     summary: Add a new admin user
 *     tags: [Admin - Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [admin, super_admin]
 *     responses:
 *       201:
 *         description: Admin user added
 */
router.post(
  '/admins',
  requireSuperAdmin,
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { user_id, role = 'admin' } = req.body;

    if (!user_id) {
      res.status(400).json({ success: false, error: 'user_id is required' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .insert({
        user_id,
        role,
        created_by: req.user?.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        res.status(400).json({ success: false, error: 'User is already an admin' });
        return;
      }
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(201).json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/admins/{userId}:
 *   delete:
 *     summary: Remove admin user
 *     tags: [Admin - Management]
 *     responses:
 *       200:
 *         description: Admin user removed
 */
router.delete(
  '/admins/:userId',
  requireSuperAdmin,
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { userId } = req.params;

    // Prevent self-removal
    if (req.user?.id === userId) {
      res.status(400).json({ success: false, error: 'Cannot remove yourself as admin' });
      return;
    }

    const { error } = await supabaseAdmin.from('admin_users').delete().eq('user_id', userId);

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: 'Admin user removed' });
  })
);

export default router;
