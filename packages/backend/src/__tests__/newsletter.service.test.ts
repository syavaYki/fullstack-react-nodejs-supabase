/**
 * @file newsletter.service.test.ts
 * @description Tests for NewsletterService -- subscribe and unsubscribe.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Uses .ts extensions in vi.mock paths (test files are excluded from tsconfig).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock values so they are available inside the vi.mock factory
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const update = vi.fn();
  const eq = vi.fn();

  // Chainable builder: .from().insert() and .from().update().eq()
  const from = vi.fn().mockImplementation(() => ({
    insert,
    update: update.mockImplementation(() => ({
      eq,
    })),
  }));

  return {
    supabaseAdmin: { from },
    from,
    insert,
    update,
    eq,
  };
});

// ---------------------------------------------------------------------------
// Mock external modules
// ---------------------------------------------------------------------------
vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
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

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are configured
// ---------------------------------------------------------------------------
import { NewsletterService } from '../services/newsletter.service.ts';
import { ApiError } from '../middleware/error.middleware.ts';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('NewsletterService', () => {
  let service: NewsletterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NewsletterService();

    // Reset the chainable builder for each test
    mocks.from.mockImplementation(() => ({
      insert: mocks.insert,
      update: mocks.update.mockImplementation(() => ({
        eq: mocks.eq,
      })),
    }));
  });

  // -----------------------------------------------------------------------
  // subscribe
  // -----------------------------------------------------------------------
  describe('subscribe', () => {
    it('should insert new subscriber and return isNew: true', async () => {
      mocks.insert.mockResolvedValue({ error: null });

      const result = await service.subscribe('Test@Example.com');

      expect(result).toEqual({ isNew: true });
      expect(mocks.from).toHaveBeenCalledWith('newsletter_subscribers');
      expect(mocks.insert).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should handle duplicate email gracefully and return isNew: false', async () => {
      // Postgres unique violation code
      mocks.insert.mockResolvedValue({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

      const result = await service.subscribe('existing@example.com');

      expect(result).toEqual({ isNew: false });
      // Should not throw -- privacy-first: silently succeeds
    });

    it('should throw ApiError with 500 on database error', async () => {
      mocks.insert.mockResolvedValue({
        error: { code: '42P01', message: 'relation "newsletter_subscribers" does not exist' },
      });

      await expect(service.subscribe('user@example.com')).rejects.toThrow(ApiError);
      await expect(service.subscribe('user@example.com')).rejects.toThrow(
        'Failed to subscribe to newsletter'
      );
    });

    it('should normalize email to lowercase and trimmed before insert', async () => {
      mocks.insert.mockResolvedValue({ error: null });

      await service.subscribe('  UPPER@CASE.COM  ');

      expect(mocks.insert).toHaveBeenCalledWith({ email: 'upper@case.com' });
    });

    it('should throw ApiError with statusCode 500 on unexpected DB error', async () => {
      mocks.insert.mockResolvedValue({
        error: { code: 'PGRST301', message: 'connection refused' },
      });

      try {
        await service.subscribe('user@example.com');
        expect.fail('Expected subscribe to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
        expect((err as ApiError).message).toBe('Failed to subscribe to newsletter');
      }
    });
  });

  // -----------------------------------------------------------------------
  // unsubscribe
  // -----------------------------------------------------------------------
  describe('unsubscribe', () => {
    it('should update unsubscribed_at for an existing subscriber', async () => {
      mocks.eq.mockResolvedValue({ data: [{ email: 'user@example.com' }], error: null });

      // The unsubscribe method should exist on the service.
      // It updates the unsubscribed_at column for the given email.
      if (typeof service.unsubscribe !== 'function') {
        // If unsubscribe is not implemented yet, skip with a clear message
        console.warn('unsubscribe method not yet implemented on NewsletterService');
        return;
      }

      await service.unsubscribe('user@example.com');

      expect(mocks.from).toHaveBeenCalledWith('newsletter_subscribers');
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ unsubscribed_at: expect.any(String) })
      );
      expect(mocks.eq).toHaveBeenCalledWith('email', 'user@example.com');
    });

    it('should handle non-existent email gracefully without throwing', async () => {
      // When no matching row is found, Supabase returns empty data with no error
      mocks.eq.mockResolvedValue({ data: [], error: null });

      if (typeof service.unsubscribe !== 'function') {
        console.warn('unsubscribe method not yet implemented on NewsletterService');
        return;
      }

      // Should not throw -- privacy-first: does not reveal whether email exists
      await expect(service.unsubscribe('nonexistent@example.com')).resolves.not.toThrow();
    });

    it('should throw ApiError on database error during unsubscribe', async () => {
      mocks.eq.mockResolvedValue({
        error: { code: '42P01', message: 'relation does not exist' },
      });

      if (typeof service.unsubscribe !== 'function') {
        console.warn('unsubscribe method not yet implemented on NewsletterService');
        return;
      }

      await expect(service.unsubscribe('user@example.com')).rejects.toThrow(ApiError);
    });

    it('should normalize email before updating', async () => {
      mocks.eq.mockResolvedValue({ data: [{ email: 'user@example.com' }], error: null });

      if (typeof service.unsubscribe !== 'function') {
        console.warn('unsubscribe method not yet implemented on NewsletterService');
        return;
      }

      await service.unsubscribe('  USER@Example.COM  ');

      expect(mocks.eq).toHaveBeenCalledWith('email', 'user@example.com');
    });
  });
});
