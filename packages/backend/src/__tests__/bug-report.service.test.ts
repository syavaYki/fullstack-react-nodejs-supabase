/**
 * @file bug-report.service.test.ts
 * @description Tests for BugReportService — image upload, DB insert, and orchestration.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Mocks: supabaseAdmin (with storage), emailService, env, logger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks
// ============================================

const mocks = vi.hoisted(() => {
  const storageBucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/reports/123-file.jpg' },
    }),
  };

  const queryBuilder: Record<string, ReturnType<typeof vi.fn>> = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  queryBuilder.insert.mockReturnValue(queryBuilder);
  queryBuilder.select.mockReturnValue(queryBuilder);

  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
      storage: { from: vi.fn().mockReturnValue(storageBucket) },
    },
    storageBucket,
    queryBuilder,
    emailService: {
      sendTemplateEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'notify-msg' }),
    },
    env: {
      CONTACT_NOTIFICATION_EMAIL: 'admin@example.com',
      NODE_ENV: 'test',
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logError: vi.fn(),
    },
  };
});

vi.mock('../config/supabase.ts', () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock('../services/email/email.service.ts', () => ({ emailService: mocks.emailService }));
vi.mock('../config/env.ts', () => ({ env: mocks.env }));
vi.mock('../utils/logger.ts', () => ({ logger: mocks.logger }));

// ============================================
// Import after mocks
// ============================================

import { BugReportService } from '../services/bug-report.service.ts';
import { ApiError } from '../middleware/error.middleware.ts';

// ============================================
// Factories
// ============================================

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'images',
    originalname: 'screenshot.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-data'),
    size: 1024,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    ...overrides,
  };
}

function makeBugReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bug-uuid-123',
    name: 'Test User',
    email: 'user@example.com',
    description: 'App crashes when clicking submit button',
    images: [] as { name: string; url: string; size: number; uploaded_at: string }[],
    page_url: 'https://app.example.com/dashboard',
    user_agent: 'Mozilla/5.0',
    ip_address: '127.0.0.1',
    status: 'new' as const,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

function makeInput() {
  return {
    name: 'Test User',
    email: 'user@example.com',
    description: 'App crashes when clicking submit button',
    page_url: 'https://app.example.com/dashboard',
  };
}

// ============================================
// Tests
// ============================================

describe('BugReportService', () => {
  let service: BugReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BugReportService();

    // Reset query builder chain
    mocks.queryBuilder.insert.mockReturnValue(mocks.queryBuilder);
    mocks.queryBuilder.select.mockReturnValue(mocks.queryBuilder);
    mocks.queryBuilder.single.mockResolvedValue({ data: null, error: null });
    mocks.supabaseAdmin.from.mockReturnValue(mocks.queryBuilder);

    // Reset storage
    mocks.storageBucket.upload.mockResolvedValue({ error: null });
    mocks.storageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/reports/123-file.jpg' },
    });
    mocks.supabaseAdmin.storage.from.mockReturnValue(mocks.storageBucket);

    // Reset email
    mocks.emailService.sendTemplateEmail.mockResolvedValue({ success: true, messageId: 'msg' });
    mocks.env.CONTACT_NOTIFICATION_EMAIL = 'admin@example.com';
  });

  // ------------------------------------------
  // uploadImage
  // ------------------------------------------

  describe('uploadImage', () => {
    it('should upload file to storage and return image metadata', async () => {
      const file = makeFile();
      const result = await service.uploadImage(file);

      expect(mocks.supabaseAdmin.storage.from).toHaveBeenCalledWith('bug-report-images');
      expect(mocks.storageBucket.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^reports\/\d+-screenshot\.jpg$/),
        file.buffer,
        { contentType: 'image/jpeg', upsert: false }
      );
      expect(result.name).toBe('screenshot.jpg');
      expect(result.url).toBe('https://cdn.example.com/reports/123-file.jpg');
      expect(result.size).toBe(1024);
      expect(result.uploaded_at).toBeTruthy();
    });

    it('should sanitize special characters in filename', async () => {
      const file = makeFile({ originalname: 'my file (copy).jpg' });
      await service.uploadImage(file);

      expect(mocks.storageBucket.upload).toHaveBeenCalledWith(
        expect.stringMatching(/my_file__copy_\.jpg$/),
        expect.anything(),
        expect.anything()
      );
    });

    it('should throw ApiError 500 when storage upload fails', async () => {
      mocks.storageBucket.upload.mockResolvedValue({ error: { message: 'Bucket not found' } });

      await expect(service.uploadImage(makeFile())).rejects.toThrow(ApiError);
      await expect(service.uploadImage(makeFile())).rejects.toThrow(
        'Failed to upload image: screenshot.jpg'
      );
      expect(mocks.logger.error).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // createBugReport
  // ------------------------------------------

  describe('createBugReport', () => {
    it('should insert bug report and return created record', async () => {
      const report = makeBugReport();
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });

      const result = await service.createBugReport(makeInput(), [], '127.0.0.1', 'Mozilla/5.0');

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('bug_reports');
      expect(mocks.queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'App crashes when clicking submit button',
          status: 'new',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
        })
      );
      expect(result.id).toBe('bug-uuid-123');
    });

    it('should set ip_address and user_agent to null when not provided', async () => {
      const report = makeBugReport({ ip_address: null, user_agent: null });
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });

      await service.createBugReport(makeInput(), []);

      expect(mocks.queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ ip_address: null, user_agent: null })
      );
    });

    it('should use null for optional fields not provided', async () => {
      const report = makeBugReport({ name: null, email: null, page_url: null });
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });

      await service.createBugReport({ description: 'Something broke' }, []);

      expect(mocks.queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ name: null, email: null, page_url: null })
      );
    });

    it('should throw ApiError 500 on DB insert error', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(service.createBugReport(makeInput(), [])).rejects.toThrow(ApiError);
      await expect(service.createBugReport(makeInput(), [])).rejects.toThrow(
        'Failed to save bug report'
      );
    });
  });

  // ------------------------------------------
  // submitBugReport
  // ------------------------------------------

  describe('submitBugReport', () => {
    it('should upload images and create report, returning images_uploaded count', async () => {
      const files = [makeFile(), makeFile({ originalname: 'second.png' })];
      const report = makeBugReport({ images: [] });
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });

      const result = await service.submitBugReport(makeInput(), files, '127.0.0.1', 'Chrome');

      expect(result.images_uploaded).toBe(2);
      expect(result.report.id).toBe('bug-uuid-123');
      expect(mocks.storageBucket.upload).toHaveBeenCalledTimes(2);
    });

    it('should tolerate partial image upload failures', async () => {
      const files = [makeFile({ originalname: 'good.jpg' }), makeFile({ originalname: 'bad.jpg' })];
      mocks.storageBucket.upload
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'File too large' } });

      const report = makeBugReport();
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });

      const result = await service.submitBugReport(makeInput(), files);

      expect(result.images_uploaded).toBe(1);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'BUG_REPORT',
        'Image upload skipped',
        expect.any(Object)
      );
    });

    it('should work with no files', async () => {
      const report = makeBugReport({ images: [] });
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });

      const result = await service.submitBugReport(makeInput(), []);

      expect(result.images_uploaded).toBe(0);
      expect(mocks.storageBucket.upload).not.toHaveBeenCalled();
    });

    it('should log the submission', async () => {
      const report = makeBugReport();
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });

      await service.submitBugReport(makeInput(), [makeFile()]);

      expect(mocks.logger.info).toHaveBeenCalledWith(
        'BUG_REPORT',
        'Submitted',
        expect.objectContaining({ id: 'bug-uuid-123', images: 1 })
      );
    });

    it('should fire-and-forget admin notification when CONTACT_NOTIFICATION_EMAIL is set', async () => {
      const report = makeBugReport({ images: [] });
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });
      mocks.env.CONTACT_NOTIFICATION_EMAIL = 'admin@example.com';

      await service.submitBugReport(makeInput(), []);
      // Allow microtask queue to drain for the fire-and-forget call
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateKey: 'bug_report_admin_notification',
          to: 'admin@example.com',
        })
      );
    });

    it('should skip admin notification when CONTACT_NOTIFICATION_EMAIL is not set', async () => {
      const report = makeBugReport({ images: [] });
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });
      mocks.env.CONTACT_NOTIFICATION_EMAIL = '';

      await service.submitBugReport(makeInput(), []);
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mocks.emailService.sendTemplateEmail).not.toHaveBeenCalled();
    });

    it('should warn when admin notification email fails', async () => {
      const report = makeBugReport({ images: [] });
      mocks.queryBuilder.single.mockResolvedValue({ data: report, error: null });
      mocks.env.CONTACT_NOTIFICATION_EMAIL = 'admin@example.com';
      mocks.emailService.sendTemplateEmail.mockResolvedValue({
        success: false,
        error: 'SMTP error',
      });

      await service.submitBugReport(makeInput(), []);
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'BUG_REPORT',
        'Admin notification email failed',
        expect.objectContaining({ error: 'SMTP error' })
      );
    });
  });
});
