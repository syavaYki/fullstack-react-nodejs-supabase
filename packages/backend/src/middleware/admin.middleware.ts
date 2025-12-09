import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AdminRequest, AdminRole } from '../types/index.js';

/**
 * Middleware to check if user is an admin
 * Must be used after authMiddleware
 */
export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    const { data: adminUser, error } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', req.user.id)
      .single();

    if (error || !adminUser) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    req.isAdmin = true;
    req.adminRole = adminUser.role as AdminRole;

    next();
  } catch {
    res.status(500).json({ success: false, error: 'Failed to verify admin status' });
  }
}

/**
 * Middleware to check if user is a super admin
 * Must be used after authMiddleware
 */
export async function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    const { data: adminUser, error } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', req.user.id)
      .single();

    if (error || !adminUser || adminUser.role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Super admin access required' });
      return;
    }

    req.isAdmin = true;
    req.adminRole = 'super_admin';

    next();
  } catch {
    res.status(500).json({ success: false, error: 'Failed to verify admin status' });
  }
}
