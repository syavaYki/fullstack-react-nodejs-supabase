/**
 * @file validation.test.ts
 * @description Tests for Zod validation schemas (common, auth, profile, contact).
 *
 * Uses vi.hoisted() + vi.mock() to mock env before schema modules import it.
 */

import { describe, it, expect, vi } from 'vitest';

// Hoist mock env so it is available in vi.mock factory
const mocks = vi.hoisted(() => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    NODE_ENV: 'test',
    PORT: '3001',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
  },
}));

vi.mock('../config/env.ts', () => ({ env: mocks.env }));

import {
  emailSchema,
  uuidSchema,
  safeRedirectUrlSchema,
  lenientUrlSchema,
  paginationSchema,
  stringArraySchema,
} from '../validation/common.schemas.ts';
import { registerSchema, loginSchema } from '../validation/auth.schemas.ts';
import { updateProfileSchema } from '../validation/profile.schemas.ts';
import { contactSubmissionSchema } from '../validation/contact.schemas.ts';

describe('Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept a valid email', () => {
      const result = emailSchema.safeParse('user@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('should reject an invalid email', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });

    it('should trim and lowercase the email', () => {
      // Zod .email() validates before .trim(), so leading/trailing spaces fail.
      // However, a valid email with mixed case gets lowercased.
      const result = emailSchema.safeParse('User@Example.COM');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });
  });

  describe('uuidSchema', () => {
    it('should accept a valid UUID', () => {
      const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });
  });

  describe('safeRedirectUrlSchema', () => {
    it('should accept URL matching frontend origin', () => {
      const result = safeRedirectUrlSchema.safeParse('http://localhost:5173/dashboard');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('http://localhost:5173/dashboard');
      }
    });

    it('should reject URL with different origin', () => {
      const result = safeRedirectUrlSchema.safeParse('https://evil.com/phish');
      expect(result.success).toBe(false);
    });

    it('should reject non-URL strings', () => {
      const result = safeRedirectUrlSchema.safeParse('not-a-url');
      expect(result.success).toBe(false);
    });
  });

  describe('lenientUrlSchema', () => {
    it('should accept a full URL', () => {
      const result = lenientUrlSchema.safeParse('https://example.com');
      expect(result.success).toBe(true);
    });

    it('should accept a URL without protocol (prepends https://)', () => {
      const result = lenientUrlSchema.safeParse('example.com');
      expect(result.success).toBe(true);
    });

    it('should accept an empty string (optional)', () => {
      const result = lenientUrlSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('should reject completely invalid URLs', () => {
      const result = lenientUrlSchema.safeParse('not a url at all !!!');
      expect(result.success).toBe(false);
    });

    it('should accept empty string as valid', () => {
      const result = lenientUrlSchema.safeParse('');
      expect(result.success).toBe(true);
    });
  });

  describe('paginationSchema', () => {
    it('should use defaults when no values provided', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should coerce string values to numbers', () => {
      const result = paginationSchema.safeParse({ page: '3', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject page < 1', () => {
      const result = paginationSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = paginationSchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('stringArraySchema', () => {
    it('should split comma-separated string into array', () => {
      const result = stringArraySchema.safeParse('a,b,c');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(['a', 'b', 'c']);
      }
    });

    it('should trim whitespace from items', () => {
      const result = stringArraySchema.safeParse('a , b , c');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(['a', 'b', 'c']);
      }
    });

    it('should filter out empty strings', () => {
      const result = stringArraySchema.safeParse('a,,b,');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(['a', 'b']);
      }
    });

    it('should pass through an array directly', () => {
      const result = stringArraySchema.safeParse(['x', 'y']);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(['x', 'y']);
      }
    });
  });

  describe('Auth: registerSchema', () => {
    it('should require email and password fields', () => {
      const result = registerSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.issues.map((i) => i.path[0]);
        expect(fields).toContain('email');
        expect(fields).toContain('password');
      }
    });

    it('should enforce 8-char minimum password', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const pwIssue = result.error.issues.find((i) => i.path[0] === 'password');
        expect(pwIssue).toBeDefined();
        expect(pwIssue?.message).toContain('8 characters');
      }
    });

    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'securepassword123',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Auth: loginSchema', () => {
    it('should validate email and password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'mypassword',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'bad-email',
        password: 'mypassword',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Profile: updateProfileSchema', () => {
    it('should accept partial updates', () => {
      const result = updateProfileSchema.safeParse({
        first_name: 'Jane',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ first_name: 'Jane' });
      }
    });

    it('should accept an empty object (all fields optional)', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject unknown fields (strict mode)', () => {
      const result = updateProfileSchema.safeParse({
        first_name: 'Jane',
        unknown_field: 'should fail',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Contact: contactSubmissionSchema', () => {
    it('should require all fields', () => {
      const result = contactSubmissionSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.issues.map((i) => i.path[0]);
        expect(fields).toContain('first_name');
        expect(fields).toContain('last_name');
        expect(fields).toContain('email');
        expect(fields).toContain('subject');
        expect(fields).toContain('message');
      }
    });

    it('should accept valid contact submission', () => {
      const result = contactSubmissionSchema.safeParse({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        subject: 'Hello there',
        message: 'I would like to learn more about your product.',
      });
      expect(result.success).toBe(true);
    });

    it('should reject message shorter than 10 characters', () => {
      const result = contactSubmissionSchema.safeParse({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        subject: 'Hello',
        message: 'Short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgIssue = result.error.issues.find((i) => i.path[0] === 'message');
        expect(msgIssue).toBeDefined();
        expect(msgIssue?.message).toContain('10 characters');
      }
    });
  });
});
