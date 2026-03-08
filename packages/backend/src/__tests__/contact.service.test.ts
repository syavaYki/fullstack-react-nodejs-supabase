/**
 * @file contact.service.test.ts
 * @description Tests for ContactService — handles public contact form submissions.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Mocks: supabaseAdmin (config/supabase).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks — available inside vi.mock factories
// ============================================

const mocks = vi.hoisted(() => {
  // Chainable query builder for supabaseAdmin.from(...)
  const createQueryBuilder = () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      insert: vi.fn(),
      single: vi.fn(),
    };

    // All methods except terminal ones return the builder for chaining
    for (const key of Object.keys(builder)) {
      if (key !== 'single') {
        builder[key].mockReturnValue(builder);
      }
    }

    // Default single resolves to null
    builder.single.mockResolvedValue({ data: null, error: null });

    return builder;
  };

  const queryBuilder = createQueryBuilder();

  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
    },
    queryBuilder,
    createQueryBuilder,
    emailService: {
      sendTemplateEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'test-msg' }),
    },
    env: {
      CONTACT_NOTIFICATION_EMAIL: '',
      NODE_ENV: 'test',
    },
  };
});

// ============================================
// vi.mock — uses .ts extensions (test files excluded from tsconfig)
// ============================================

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock('../services/email/email.service.ts', () => ({
  emailService: mocks.emailService,
}));

vi.mock('../config/env.ts', () => ({
  env: mocks.env,
}));

vi.mock('../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

// ============================================
// Import the service under test
// ============================================

import { contactService } from '../services/contact.service.ts';
import { ApiError } from '../middleware/error.middleware.ts';

// ============================================
// Test Data Factories
// ============================================

function makeContactInput() {
  return {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    subject: 'Question about pricing',
    message: 'I would like to know more about your premium tier.',
  };
}

function makeContactSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contact-uuid-123',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    subject: 'Question about pricing',
    message: 'I would like to know more about your premium tier.',
    status: 'new',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0 TestAgent',
    created_at: '2026-01-15T10:30:00Z',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('ContactService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the query builder so each test starts fresh
    const qb = mocks.createQueryBuilder();
    Object.assign(mocks.queryBuilder, qb);
    mocks.supabaseAdmin.from.mockReturnValue(mocks.queryBuilder);
  });

  // ------------------------------------------
  // createSubmission
  // ------------------------------------------

  describe('createSubmission', () => {
    it('should insert contact submission', async () => {
      const input = makeContactInput();
      const savedSubmission = makeContactSubmission();
      mocks.queryBuilder.single.mockResolvedValue({ data: savedSubmission, error: null });

      await contactService.createSubmission(input, '192.168.1.1', 'Mozilla/5.0 TestAgent');

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('contact_submissions');
      expect(mocks.queryBuilder.insert).toHaveBeenCalledWith({
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0 TestAgent',
        status: 'new',
      });
    });

    it('should include ip_address and user_agent when provided', async () => {
      const input = makeContactInput();
      const ipAddress = '10.0.0.42';
      const userAgent = 'Chrome/120.0';
      const savedSubmission = makeContactSubmission({
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      mocks.queryBuilder.single.mockResolvedValue({ data: savedSubmission, error: null });

      const result = await contactService.createSubmission(input, ipAddress, userAgent);

      expect(mocks.queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: ipAddress,
          user_agent: userAgent,
        })
      );
      expect(result.ip_address).toBe(ipAddress);
      expect(result.user_agent).toBe(userAgent);
    });

    it('should set ip_address and user_agent to null when not provided', async () => {
      const input = makeContactInput();
      const savedSubmission = makeContactSubmission({
        ip_address: null,
        user_agent: null,
      });

      mocks.queryBuilder.single.mockResolvedValue({ data: savedSubmission, error: null });

      await contactService.createSubmission(input);

      expect(mocks.queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: null,
          user_agent: null,
        })
      );
    });

    it('should throw on DB error', async () => {
      const input = makeContactInput();
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'unique constraint violation on email' },
      });

      await expect(
        contactService.createSubmission(input, '127.0.0.1', 'TestAgent')
      ).rejects.toThrow(ApiError);
      await expect(
        contactService.createSubmission(input, '127.0.0.1', 'TestAgent')
      ).rejects.toThrow('Failed to submit contact form');

      try {
        await contactService.createSubmission(input, '127.0.0.1', 'TestAgent');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
      }
    });

    it('should return the created submission', async () => {
      const input = makeContactInput();
      const savedSubmission = makeContactSubmission();

      mocks.queryBuilder.single.mockResolvedValue({ data: savedSubmission, error: null });

      const result = await contactService.createSubmission(
        input,
        '192.168.1.1',
        'Mozilla/5.0 TestAgent'
      );

      expect(result).toEqual(savedSubmission);
      expect(result.id).toBe('contact-uuid-123');
      expect(result.status).toBe('new');
      expect(result.first_name).toBe('Jane');
      expect(result.email).toBe('jane@example.com');
    });

    it('should always set status to new', async () => {
      const input = makeContactInput();
      const savedSubmission = makeContactSubmission();

      mocks.queryBuilder.single.mockResolvedValue({ data: savedSubmission, error: null });

      await contactService.createSubmission(input, '1.2.3.4');

      expect(mocks.queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'new',
        })
      );
    });

    it('should call select() and single() to return the created row', async () => {
      const input = makeContactInput();
      const savedSubmission = makeContactSubmission();

      mocks.queryBuilder.single.mockResolvedValue({ data: savedSubmission, error: null });

      await contactService.createSubmission(input);

      expect(mocks.queryBuilder.select).toHaveBeenCalled();
      expect(mocks.queryBuilder.single).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // sendAdminNotification (via createSubmission)
  // ------------------------------------------

  describe('sendAdminNotification (fire-and-forget)', () => {
    it('should send admin notification when CONTACT_NOTIFICATION_EMAIL is set', async () => {
      mocks.env.CONTACT_NOTIFICATION_EMAIL = 'admin@example.com';
      const submission = makeContactSubmission();
      mocks.queryBuilder.single.mockResolvedValue({ data: submission, error: null });

      await contactService.createSubmission(makeContactInput());
      // Drain microtask queue for the fire-and-forget call
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateKey: 'contact_admin_notification',
          to: 'admin@example.com',
          replyTo: submission.email,
        })
      );
    });

    it('should include submission fields as template variables', async () => {
      mocks.env.CONTACT_NOTIFICATION_EMAIL = 'admin@example.com';
      const submission = makeContactSubmission();
      mocks.queryBuilder.single.mockResolvedValue({ data: submission, error: null });

      await contactService.createSubmission(makeContactInput());
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            first_name: submission.first_name,
            last_name: submission.last_name,
            email: submission.email,
            subject: submission.subject,
            message: submission.message,
          }),
        })
      );
    });

    it('should skip admin notification when CONTACT_NOTIFICATION_EMAIL is not set', async () => {
      mocks.env.CONTACT_NOTIFICATION_EMAIL = '';
      const submission = makeContactSubmission();
      mocks.queryBuilder.single.mockResolvedValue({ data: submission, error: null });

      await contactService.createSubmission(makeContactInput());
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mocks.emailService.sendTemplateEmail).not.toHaveBeenCalled();
    });

    it('should still succeed createSubmission even if admin email fails', async () => {
      mocks.env.CONTACT_NOTIFICATION_EMAIL = 'admin@example.com';
      mocks.emailService.sendTemplateEmail.mockResolvedValue({
        success: false,
        error: 'SMTP down',
      });
      const submission = makeContactSubmission();
      mocks.queryBuilder.single.mockResolvedValue({ data: submission, error: null });

      // Should not throw — notification is fire-and-forget
      const result = await contactService.createSubmission(makeContactInput());
      expect(result).toEqual(submission);
    });
  });
});
