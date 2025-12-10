import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import membershipRoutes from './membership.routes.js';
import billingRoutes from './billing.routes.js';
import adminRoutes from './admin.routes.js';
import contactRoutes from './contact.routes.js';
import { env } from '../config/env.js';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/membership', membershipRoutes);
router.use('/billing', billingRoutes);
router.use('/admin', adminRoutes);
router.use('/contact', contactRoutes);

// Test routes only available in development/test environments
if (env.NODE_ENV !== 'production') {
  // Dynamic import to avoid loading test routes in production
  import('./test.routes.js').then((testRoutes) => {
    router.use('/test', testRoutes.default);
  });
}

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
