/**
 * @file routes.index.integration.test.ts
 * @description HTTP integration tests for the routes index (health check + route mounting).
 *
 * All sub-route modules are mocked as empty Express Routers so their
 * transitive dependencies (services, Supabase, Stripe, etc.) are never loaded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// Mocks — replace every sub-route module with a fresh empty Router
// ---------------------------------------------------------------------------

vi.mock('../routes/auth.routes.ts', async () => {
  const { Router } = await import('express');
  return { default: Router() };
});

vi.mock('../routes/profile.routes.ts', async () => {
  const { Router } = await import('express');
  return { default: Router() };
});

vi.mock('../routes/membership.routes.ts', async () => {
  const { Router } = await import('express');
  return { default: Router() };
});

vi.mock('../routes/billing.routes.ts', async () => {
  const { Router } = await import('express');
  return { default: Router() };
});

vi.mock('../routes/contact.routes.ts', async () => {
  const { Router } = await import('express');
  return { default: Router() };
});

vi.mock('../routes/newsletter.routes.ts', async () => {
  const { Router } = await import('express');
  return { default: Router() };
});

// Common dependencies that sub-routes would normally pull in
vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: {},
  supabaseClient: {},
  createSupabaseReqResClient: vi.fn(),
  createSupabaseClientWithAuth: vi.fn(),
}));

vi.mock('../config/env.ts', () => ({
  env: { NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173' },
}));

vi.mock('../utils/logger.ts', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), logError: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import indexRoutes from '../routes/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', indexRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Routes Index — Integration', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /api/health', () => {
    it('should return 200 with success: true and status "healthy"', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });

    it('should include a valid ISO timestamp', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      const { timestamp } = res.body.data;
      expect(typeof timestamp).toBe('string');
      // Verify it parses as a valid date
      expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
    });
  });
});
