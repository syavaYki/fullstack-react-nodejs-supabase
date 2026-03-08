import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import membershipRoutes from './membership.routes.js';
import billingRoutes from './billing.routes.js';
import contactRoutes from './contact.routes.js';
import newsletterRoutes from './newsletter.routes.js';
import bugReportRoutes from './bug-report.routes.js';

const router = Router();

// Authentication routes — public (no auth required for most)
router.use('/auth', authRoutes);

// User profile routes — authenticated
router.use('/profile', profileRoutes);

// Membership routes — authenticated
router.use('/membership', membershipRoutes);

// Billing routes — authenticated (except webhook)
router.use('/billing', billingRoutes);

// Contact routes — public with rate limiting
router.use('/contact', contactRoutes);

// Newsletter routes — public with rate limiting
router.use('/newsletter', newsletterRoutes);

// Bug report routes — public with rate limiting + image upload
router.use('/bug-reports', bugReportRoutes);

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================

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
