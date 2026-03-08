/**
 * @file email.service.test.ts
 * @description Tests for emailService — raw sendEmail and template-based sendTemplateEmail.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Mocks: config/hostinger (transport + helpers), email/template.service, logger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks
// ============================================

const mocks = vi.hoisted(() => ({
  transport: {
    sendMail: vi.fn(),
  },
  isHostingerConfigured: vi.fn().mockReturnValue(false),
  getHostingerTransport: vi.fn().mockReturnValue(null),
  getHostingerFromEmail: vi.fn().mockReturnValue('app@example.com'),
  getHostingerFromName: vi.fn().mockReturnValue('Test App'),
  templateRender: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

vi.mock('../config/hostinger.ts', () => ({
  isHostingerConfigured: mocks.isHostingerConfigured,
  getHostingerTransport: mocks.getHostingerTransport,
  getHostingerFromEmail: mocks.getHostingerFromEmail,
  getHostingerFromName: mocks.getHostingerFromName,
}));

vi.mock('../services/email/template.service.ts', () => ({
  templateService: { render: mocks.templateRender },
}));

vi.mock('../utils/logger.ts', () => ({ logger: mocks.logger }));

// ============================================
// Import after mocks
// ============================================

import { emailService } from '../services/email/email.service.ts';

// ============================================
// Factories
// ============================================

function makeRendered(overrides: Record<string, unknown> = {}) {
  return {
    subject: 'Test Subject',
    html: '<p>Test body</p>',
    text: 'Test body',
    from_email: null,
    from_name: null,
    ...overrides,
  };
}

function makeSendEmailInput(overrides: Record<string, unknown> = {}) {
  return {
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Hi</p>',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('emailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isHostingerConfigured.mockReturnValue(false);
    mocks.getHostingerTransport.mockReturnValue(null);
    mocks.getHostingerFromEmail.mockReturnValue('app@example.com');
    mocks.getHostingerFromName.mockReturnValue('Test App');
  });

  // ------------------------------------------
  // sendEmail
  // ------------------------------------------

  describe('sendEmail', () => {
    it('should return error when transport is null (SMTP not configured)', async () => {
      mocks.getHostingerTransport.mockReturnValue(null);

      const result = await emailService.sendEmail(makeSendEmailInput());

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP not configured');
    });

    it('should send mail and return success with messageId', async () => {
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.transport.sendMail.mockResolvedValue({ messageId: '<msg-123@example.com>' });

      const result = await emailService.sendEmail(makeSendEmailInput());

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<msg-123@example.com>');
    });

    it('should build "Name <email>" from format when fromName available', async () => {
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'id1' });
      mocks.getHostingerFromEmail.mockReturnValue('notify@app.com');
      mocks.getHostingerFromName.mockReturnValue('My App');

      await emailService.sendEmail(makeSendEmailInput());

      expect(mocks.transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: '"My App" <notify@app.com>' })
      );
    });

    it('should use custom from/fromName fields over defaults', async () => {
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'id2' });

      await emailService.sendEmail(
        makeSendEmailInput({ from: 'custom@domain.com', fromName: 'Custom Sender' })
      );

      expect(mocks.transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: '"Custom Sender" <custom@domain.com>' })
      );
    });

    it('should format to as "Name <email>" when toName is provided', async () => {
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'id3' });

      await emailService.sendEmail(makeSendEmailInput({ toName: 'Jane Doe' }));

      expect(mocks.transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: '"Jane Doe" <user@example.com>' })
      );
    });

    it('should pass replyTo through to sendMail', async () => {
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'id4' });

      await emailService.sendEmail(makeSendEmailInput({ replyTo: 'reply@example.com' }));

      expect(mocks.transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: 'reply@example.com' })
      );
    });

    it('should return error and log when SMTP send throws', async () => {
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.transport.sendMail.mockRejectedValue(new Error('Connection refused'));

      const result = await emailService.sendEmail(makeSendEmailInput());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'EMAIL',
        'Hostinger SMTP send failed',
        expect.objectContaining({ error: 'Connection refused' })
      );
    });

    it('should log success after sending', async () => {
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'log-test' });

      await emailService.sendEmail(makeSendEmailInput());

      expect(mocks.logger.info).toHaveBeenCalledWith(
        'EMAIL',
        'Email sent via Hostinger',
        expect.objectContaining({ messageId: 'log-test', to: 'user@example.com' })
      );
    });
  });

  // ------------------------------------------
  // sendTemplateEmail
  // ------------------------------------------

  describe('sendTemplateEmail', () => {
    it('should return error and warn if SMTP not configured', async () => {
      mocks.isHostingerConfigured.mockReturnValue(false);

      const result = await emailService.sendTemplateEmail({
        templateKey: 'contact_admin_notification',
        to: 'admin@example.com',
        variables: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP not configured');
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'EMAIL',
        'Hostinger SMTP not configured — email skipped',
        expect.objectContaining({ templateKey: 'contact_admin_notification' })
      );
    });

    it('should return error if template render throws', async () => {
      mocks.isHostingerConfigured.mockReturnValue(true);
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.templateRender.mockRejectedValue(new Error('Template not found: missing_tpl'));

      const result = await emailService.sendTemplateEmail({
        templateKey: 'missing_tpl',
        to: 'admin@example.com',
        variables: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template render failed');
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'EMAIL',
        'Template render failed',
        expect.objectContaining({ templateKey: 'missing_tpl' })
      );
    });

    it('should render template and send email on success', async () => {
      mocks.isHostingerConfigured.mockReturnValue(true);
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.templateRender.mockResolvedValue(
        makeRendered({
          subject: 'Bug Report Received',
          html: '<p>A bug was filed</p>',
          from_email: 'bugs@app.com',
          from_name: 'Bug Tracker',
        })
      );
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'bug-msg' });

      const result = await emailService.sendTemplateEmail({
        templateKey: 'bug_report_admin_notification',
        to: 'admin@example.com',
        variables: { description: 'Login crashes' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('bug-msg');
      expect(mocks.templateRender).toHaveBeenCalledWith('bug_report_admin_notification', {
        description: 'Login crashes',
      });
    });

    it('should use template from_email and from_name over defaults', async () => {
      mocks.isHostingerConfigured.mockReturnValue(true);
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.templateRender.mockResolvedValue(
        makeRendered({ from_email: 'tpl@example.com', from_name: 'Template Sender' })
      );
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'id' });

      await emailService.sendTemplateEmail({
        templateKey: 'tpl',
        to: 'user@example.com',
        variables: {},
      });

      expect(mocks.transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: '"Template Sender" <tpl@example.com>' })
      );
    });

    it('should pass replyTo through to the transport', async () => {
      mocks.isHostingerConfigured.mockReturnValue(true);
      mocks.getHostingerTransport.mockReturnValue(mocks.transport);
      mocks.templateRender.mockResolvedValue(makeRendered());
      mocks.transport.sendMail.mockResolvedValue({ messageId: 'id' });

      await emailService.sendTemplateEmail({
        templateKey: 'tpl',
        to: 'admin@example.com',
        replyTo: 'submitter@example.com',
        variables: {},
      });

      expect(mocks.transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: 'submitter@example.com' })
      );
    });
  });
});
