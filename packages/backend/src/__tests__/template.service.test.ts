/**
 * @file template.service.test.ts
 * @description Tests for TemplateService — DB-backed email templates with 5-min cache.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Creates a fresh TemplateService instance per test to reset the in-process cache.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks
// ============================================

const mocks = vi.hoisted(() => {
  const queryBuilder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  // Chain all methods except terminal
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.single.mockResolvedValue({ data: null, error: null });

  return {
    supabaseAdmin: { from: vi.fn().mockReturnValue(queryBuilder) },
    queryBuilder,
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
vi.mock('../utils/logger.ts', () => ({ logger: mocks.logger }));

// ============================================
// Import after mocks
// ============================================

import { TemplateService } from '../services/email/template.service.ts';

// ============================================
// Factories
// ============================================

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-uuid-1',
    key: 'contact_admin_notification',
    name: 'Contact Admin Notification',
    description: null,
    subject_template: 'New contact from {{first_name}}',
    html_template: '<p>From: {{email}}</p><p>{{message}}</p>',
    text_template: 'From: {{email}}\n{{message}}',
    default_from_email: 'admin@example.com',
    default_from_name: 'Admin',
    available_variables: ['first_name', 'email', 'message'],
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Fresh instance = empty cache
    service = new TemplateService();
    // Reset chain
    mocks.queryBuilder.select.mockReturnValue(mocks.queryBuilder);
    mocks.queryBuilder.eq.mockReturnValue(mocks.queryBuilder);
    mocks.queryBuilder.single.mockResolvedValue({ data: null, error: null });
    mocks.supabaseAdmin.from.mockReturnValue(mocks.queryBuilder);
  });

  // ------------------------------------------
  // getTemplate
  // ------------------------------------------

  describe('getTemplate', () => {
    it('should query DB and return the template', async () => {
      const tpl = makeTemplate();
      mocks.queryBuilder.single.mockResolvedValue({ data: tpl, error: null });

      const result = await service.getTemplate('contact_admin_notification');

      expect(result).toEqual(tpl);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('email_templates');
    });

    it('should cache the template and avoid a second DB call', async () => {
      const tpl = makeTemplate();
      mocks.queryBuilder.single.mockResolvedValue({ data: tpl, error: null });

      await service.getTemplate('contact_admin_notification');
      await service.getTemplate('contact_admin_notification');

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledTimes(1);
    });

    it('should return null for not-found (PGRST116)', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await service.getTemplate('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null and log error for other DB errors', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST001', message: 'Connection error' },
      });

      const result = await service.getTemplate('some_key');
      expect(result).toBeNull();
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'EMAIL',
        'Failed to load email template',
        expect.objectContaining({ key: 'some_key' })
      );
    });

    it('should cache per key independently', async () => {
      const tpl1 = makeTemplate({ key: 'tpl_a' });
      const tpl2 = makeTemplate({ key: 'tpl_b' });
      mocks.queryBuilder.single
        .mockResolvedValueOnce({ data: tpl1, error: null })
        .mockResolvedValueOnce({ data: tpl2, error: null });

      const r1 = await service.getTemplate('tpl_a');
      const r2 = await service.getTemplate('tpl_b');

      expect(r1?.key).toBe('tpl_a');
      expect(r2?.key).toBe('tpl_b');
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledTimes(2);
    });
  });

  // ------------------------------------------
  // render
  // ------------------------------------------

  describe('render', () => {
    it('should interpolate variables into subject, html, and text', async () => {
      mocks.queryBuilder.single.mockResolvedValue({ data: makeTemplate(), error: null });

      const result = await service.render('contact_admin_notification', {
        first_name: 'Jane',
        email: 'jane@example.com',
        message: 'Hello world',
      });

      expect(result.subject).toBe('New contact from Jane');
      expect(result.html).toBe('<p>From: jane@example.com</p><p>Hello world</p>');
      expect(result.text).toBe('From: jane@example.com\nHello world');
    });

    it('should return from_email and from_name from the template', async () => {
      mocks.queryBuilder.single.mockResolvedValue({ data: makeTemplate(), error: null });

      const result = await service.render('contact_admin_notification', {});
      expect(result.from_email).toBe('admin@example.com');
      expect(result.from_name).toBe('Admin');
    });

    it('should return null text when text_template is null', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: makeTemplate({ text_template: null }),
        error: null,
      });

      const result = await service.render('tpl', {});
      expect(result.text).toBeNull();
    });

    it('should leave unknown {{variables}} as-is', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: makeTemplate({ html_template: 'Hello {{missing}}' }),
        error: null,
      });

      const result = await service.render('tpl', {});
      expect(result.html).toBe('Hello {{missing}}');
    });

    it('should throw if template not found', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.render('ghost_template', {})).rejects.toThrow(
        'Email template not found: ghost_template'
      );
    });

    it('should HTML-escape & < > " \' in variable values', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: makeTemplate({ html_template: '{{val}}' }),
        error: null,
      });

      const result = await service.render('tpl', { val: `& < > " '` });
      expect(result.html).toBe('&amp; &lt; &gt; &quot; &#39;');
    });

    it('should HTML-escape script injection attempts', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: makeTemplate({ html_template: '<div>{{message}}</div>' }),
        error: null,
      });

      const result = await service.render('tpl', {
        message: '<script>alert("xss")</script>',
      });
      expect(result.html).toBe('<div>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</div>');
    });
  });

  // ------------------------------------------
  // exists
  // ------------------------------------------

  describe('exists', () => {
    it('should return true when template is found', async () => {
      mocks.queryBuilder.single.mockResolvedValue({ data: makeTemplate(), error: null });
      expect(await service.exists('contact_admin_notification')).toBe(true);
    });

    it('should return false when template is not found', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      expect(await service.exists('missing_key')).toBe(false);
    });
  });

  // ------------------------------------------
  // clearCache
  // ------------------------------------------

  describe('clearCache', () => {
    it('should force a fresh DB call after clearing the cache', async () => {
      const tpl = makeTemplate();
      mocks.queryBuilder.single.mockResolvedValue({ data: tpl, error: null });

      await service.getTemplate('contact_admin_notification');
      service.clearCache();
      await service.getTemplate('contact_admin_notification');

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledTimes(2);
    });
  });
});
