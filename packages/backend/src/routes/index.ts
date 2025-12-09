import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import membershipRoutes from './membership.routes.js';
import billingRoutes from './billing.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/membership', membershipRoutes);
router.use('/billing', billingRoutes);
router.use('/admin', adminRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
