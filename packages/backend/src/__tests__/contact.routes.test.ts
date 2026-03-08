/**
 * @file contact.routes.test.ts
 * @description Tests for contact form submission schema validation.
 *
 * Pattern: Direct schema validation tests — no HTTP needed.
 */

import { describe, it, expect } from 'vitest';
import { contactSubmissionSchema } from '../validation/contact.schemas.js';

describe('Contact Submission', () => {
  it('should validate required fields', () => {
    const input = {
      first_name: '',
      last_name: 'Doe',
      email: 'invalid-email',
      subject: '',
      message: 'Hi',
    };

    const result = contactSubmissionSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('should accept valid contact submission', () => {
    const input = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      subject: 'General Inquiry',
      message: 'This is a test message that is long enough.',
    };

    const result = contactSubmissionSchema.safeParse(input);

    expect(result.success).toBe(true);
  });
});
