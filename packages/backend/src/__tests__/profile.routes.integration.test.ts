/**
 * @file profile.routes.integration.test.ts
 * @description HTTP integration tests for profile, contact, and newsletter
 * routes using supertest.
 *
 * Pattern: Mount each router on a mini Express app with mocked services
 * and middleware. Validates request/response flow end-to-end without
 * starting the real server.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  profileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
  },
  contactService: {
    createSubmission: vi.fn(),
  },
  newsletterService: {
    subscribe: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Module mocks (use .ts extensions for vi.mock — vitest resolves via alias)
// ---------------------------------------------------------------------------

vi.mock('../services/profile.service.ts', () => ({ profileService: mocks.profileService }));
vi.mock('../services/contact.service.ts', () => ({ contactService: mocks.contactService }));
vi.mock('../services/newsletter.service.ts', () => ({
  newsletterService: mocks.newsletterService,
}));

vi.mock('../middleware/rateLimit.middleware.ts', () => ({
  contactFormRateLimit: (_req: any, _res: any, next: any) => next(),
  registerRateLimit: (_req: any, _res: any, next: any) => next(),
  loginRateLimit: (_req: any, _res: any, next: any) => next(),
  forgotPasswordRateLimit: (_req: any, _res: any, next: any) => next(),
  createRateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/auth.middleware.ts', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-123', email: 'test@example.com' };
    req.accessToken = 'mock-access-token';
    next();
  },
}));

vi.mock('../middleware/requireUser.middleware.ts', () => ({
  requireUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../config/env.ts', () => ({
  env: {
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:3001',
    PORT: '3001',
  },
}));

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
  supabaseClient: {},
  createSupabaseReqResClient: vi.fn(),
  createSupabaseClientWithAuth: vi.fn(),
}));

vi.mock('../utils/logger.ts', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), logError: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Router imports (must come after mocks)
// ---------------------------------------------------------------------------

import profileRoutes from '../routes/profile.routes.ts';
import contactRoutes from '../routes/contact.routes.ts';
import newsletterRoutes from '../routes/newsletter.routes.ts';
import { errorHandler } from '../middleware/error.middleware.ts';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', profileRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/newsletter', newsletterRoutes);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests — Profile Routes
// ---------------------------------------------------------------------------

describe('Profile Routes — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /api/profile
  // -----------------------------------------------------------------------

  describe('GET /api/profile', () => {
    it('should return the user profile', async () => {
      const profile = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        company: 'Acme',
      };
      mocks.profileService.getProfile.mockResolvedValue(profile);

      const res = await request(createApp()).get('/api/profile');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(profile);
      expect(mocks.profileService.getProfile).toHaveBeenCalledWith('user-uuid-123');
    });
  });

  // -----------------------------------------------------------------------
  // PUT /api/profile
  // -----------------------------------------------------------------------

  describe('PUT /api/profile', () => {
    it('should update and return the profile', async () => {
      const updatedProfile = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        company: 'NewCo',
      };
      mocks.profileService.updateProfile.mockResolvedValue(updatedProfile);

      const res = await request(createApp())
        .put('/api/profile')
        .send({ first_name: 'Jane', last_name: 'Smith', company: 'NewCo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updatedProfile);
      expect(res.body.message).toBe('Profile updated');
      expect(mocks.profileService.updateProfile).toHaveBeenCalledWith(
        'user-uuid-123',
        'mock-access-token',
        { first_name: 'Jane', last_name: 'Smith', company: 'NewCo' }
      );
    });

    it('should return 400 when unknown fields are sent (strict schema)', async () => {
      const res = await request(createApp())
        .put('/api/profile')
        .send({ first_name: 'Jane', unknown_field: 'bad' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.profileService.updateProfile).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/profile
  // -----------------------------------------------------------------------

  describe('DELETE /api/profile', () => {
    it('should delete the profile and return success', async () => {
      mocks.profileService.deleteProfile.mockResolvedValue(undefined);

      const res = await request(createApp()).delete('/api/profile');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Profile deleted');
      expect(mocks.profileService.deleteProfile).toHaveBeenCalledWith('user-uuid-123');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Contact Routes
// ---------------------------------------------------------------------------

describe('Contact Routes — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // POST /api/contact
  // -----------------------------------------------------------------------

  describe('POST /api/contact', () => {
    const validContact = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      subject: 'General Inquiry',
      message: 'This is a valid test message with enough characters.',
    };

    it('should submit contact form and return success', async () => {
      mocks.contactService.createSubmission.mockResolvedValue(undefined);

      const res = await request(createApp()).post('/api/contact').send(validContact);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Thank you for your message. We'll get back to you soon!");
      expect(mocks.contactService.createSubmission).toHaveBeenCalledWith(
        validContact,
        expect.any(String), // ipAddress (e.g. ::ffff:127.0.0.1)
        undefined // userAgent — supertest does not set User-Agent by default
      );
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(createApp()).post('/api/contact').send({ first_name: 'John' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(mocks.contactService.createSubmission).not.toHaveBeenCalled();
    });

    it('should return 400 when message is too short', async () => {
      const res = await request(createApp())
        .post('/api/contact')
        .send({ ...validContact, message: 'Short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.contactService.createSubmission).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Newsletter Routes
// ---------------------------------------------------------------------------

describe('Newsletter Routes — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // POST /api/newsletter/subscribe
  // -----------------------------------------------------------------------

  describe('POST /api/newsletter/subscribe', () => {
    it('should subscribe with a valid email and return success', async () => {
      mocks.newsletterService.subscribe.mockResolvedValue(undefined);

      const res = await request(createApp())
        .post('/api/newsletter/subscribe')
        .send({ email: 'subscriber@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("You're subscribed! Thanks for signing up.");
      expect(mocks.newsletterService.subscribe).toHaveBeenCalledWith('subscriber@example.com');
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(createApp())
        .post('/api/newsletter/subscribe')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(mocks.newsletterService.subscribe).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(createApp()).post('/api/newsletter/subscribe').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mocks.newsletterService.subscribe).not.toHaveBeenCalled();
    });
  });
});
