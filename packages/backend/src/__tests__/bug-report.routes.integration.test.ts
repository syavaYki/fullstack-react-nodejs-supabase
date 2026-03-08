/**
 * @file bug-report.routes.integration.test.ts
 * @description HTTP integration tests for the bug report route.
 *
 * Pattern: Mount the router on a mini Express app with mocked service + rate limiter.
 * Validates validation, file filtering, and success/error response shapes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';

// ============================================
// Hoisted mocks
// ============================================

const mocks = vi.hoisted(() => ({
  bugReportService: {
    submitBugReport: vi.fn(),
  },
  bugReportRateLimit: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../services/bug-report.service.ts', () => ({
  bugReportService: mocks.bugReportService,
}));

vi.mock('../middleware/rateLimit.middleware.ts', () => ({
  bugReportRateLimit: mocks.bugReportRateLimit,
}));

vi.mock('../utils/logger.ts', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), logError: vi.fn() },
}));

// ============================================
// App setup
// ============================================

import bugReportRouter from '../routes/bug-report.routes.ts';
import { errorHandler } from '../middleware/error.middleware.ts';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bug-reports', bugReportRouter);
  app.use(errorHandler);
  return app;
}

// ============================================
// Factories
// ============================================

function makeBugReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bug-uuid-456',
    name: 'Test User',
    email: 'tester@example.com',
    description: 'Submit button crashes the app on the dashboard page.',
    images: [],
    page_url: 'https://app.example.com/dashboard',
    status: 'new',
    ip_address: '127.0.0.1',
    user_agent: 'Test Agent',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('POST /api/bug-reports', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mocks.bugReportRateLimit.mockImplementation(
      (_req: Request, _res: Response, next: NextFunction) => next()
    );
  });

  // ------------------------------------------
  // Validation
  // ------------------------------------------

  it('should return 400 when description is missing', async () => {
    const res = await request(app).post('/api/bug-reports').field('name', 'Test User');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  it('should return 400 when description is too short (< 10 chars)', async () => {
    const res = await request(app).post('/api/bug-reports').field('description', 'Short');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/10 characters/i);
  });

  it('should return 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/bug-reports')
      .field('description', 'This is a valid description for the bug.')
      .field('email', 'not-an-email');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/email/i);
  });

  it('should return 400 when page_url is invalid', async () => {
    const res = await request(app)
      .post('/api/bug-reports')
      .field('description', 'This is a valid description for the bug.')
      .field('page_url', 'not-a-url');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ------------------------------------------
  // File filtering
  // ------------------------------------------

  it('should reject non-image file types with 400', async () => {
    const res = await request(app)
      .post('/api/bug-reports')
      .field('description', 'This is a valid description for the bug.')
      .attach('images', Buffer.from('fake pdf content'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
  });

  // ------------------------------------------
  // Success
  // ------------------------------------------

  it('should return 200 with report id and images_uploaded on success', async () => {
    const report = makeBugReport();
    mocks.bugReportService.submitBugReport.mockResolvedValue({
      report,
      images_uploaded: 0,
    });

    const res = await request(app)
      .post('/api/bug-reports')
      .field('description', 'Submit button crashes the app on the dashboard page.');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('bug-uuid-456');
    expect(res.body.data.images_uploaded).toBe(0);
    expect(res.body.message).toBeTruthy();
  });

  it('should accept optional fields (name, email, page_url)', async () => {
    const report = makeBugReport();
    mocks.bugReportService.submitBugReport.mockResolvedValue({
      report,
      images_uploaded: 0,
    });

    const res = await request(app)
      .post('/api/bug-reports')
      .field('description', 'Submit button crashes the app on the dashboard page.')
      .field('name', 'Jane Doe')
      .field('email', 'jane@example.com')
      .field('page_url', 'https://app.example.com/form');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should pass parsed data, files, ip, and user-agent to the service', async () => {
    const report = makeBugReport();
    mocks.bugReportService.submitBugReport.mockResolvedValue({
      report,
      images_uploaded: 0,
    });

    await request(app)
      .post('/api/bug-reports')
      .set('user-agent', 'TestAgent/1.0')
      .field('description', 'Submit button crashes the app on the dashboard page.')
      .field('name', 'Tester');

    expect(mocks.bugReportService.submitBugReport).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Submit button crashes the app on the dashboard page.',
      }),
      expect.any(Array),
      expect.anything(), // ip
      'TestAgent/1.0'
    );
  });

  it('should accept valid image attachments', async () => {
    const report = makeBugReport({
      images: [{ name: 'shot.jpg', url: 'http://cdn/shot.jpg', size: 100, uploaded_at: '' }],
    });
    mocks.bugReportService.submitBugReport.mockResolvedValue({
      report,
      images_uploaded: 1,
    });

    const res = await request(app)
      .post('/api/bug-reports')
      .field('description', 'Submit button crashes the app on the dashboard page.')
      .attach('images', Buffer.from('fake jpeg'), {
        filename: 'screenshot.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.images_uploaded).toBe(1);
  });

  // ------------------------------------------
  // Rate limiting
  // ------------------------------------------

  it('should apply rate limiting middleware', async () => {
    const report = makeBugReport();
    mocks.bugReportService.submitBugReport.mockResolvedValue({ report, images_uploaded: 0 });

    await request(app)
      .post('/api/bug-reports')
      .field('description', 'Submit button crashes the app on the dashboard page.');

    expect(mocks.bugReportRateLimit).toHaveBeenCalled();
  });
});
