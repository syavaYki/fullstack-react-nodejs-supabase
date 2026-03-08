/**
 * @file profile.service.test.ts
 * @description Tests for ProfileService — manages user profile CRUD and Stripe customer IDs.
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Mocks: supabaseAdmin and createSupabaseClientWithAuth (config/supabase).
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
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
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

  // Auth client builder (returned by createSupabaseClientWithAuth)
  const authQueryBuilder = createQueryBuilder();

  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(queryBuilder),
    },
    queryBuilder,
    createQueryBuilder,
    createSupabaseClientWithAuth: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(authQueryBuilder),
    }),
    authQueryBuilder,
  };
});

// ============================================
// vi.mock — uses .ts extensions (test files excluded from tsconfig)
// ============================================

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
  createSupabaseClientWithAuth: mocks.createSupabaseClientWithAuth,
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

import { profileService } from '../services/profile.service.ts';
import { ApiError } from '../middleware/error.middleware.ts';

// ============================================
// Test Data Factories
// ============================================

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    full_name: 'John Doe',
    avatar_url: null,
    phone: null,
    company: null,
    bio: null,
    website: null,
    stripe_customer_id: null,
    profile_completeness: 40,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('ProfileService', () => {
  const userId = 'user-uuid-123';
  const accessToken = 'test-access-token-abc';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the admin query builder so each test starts fresh
    const qb = mocks.createQueryBuilder();
    Object.assign(mocks.queryBuilder, qb);
    mocks.supabaseAdmin.from.mockReturnValue(mocks.queryBuilder);

    // Reset the auth client query builder
    const authQb = mocks.createQueryBuilder();
    Object.assign(mocks.authQueryBuilder, authQb);
    mocks.createSupabaseClientWithAuth.mockReturnValue({
      from: vi.fn().mockReturnValue(mocks.authQueryBuilder),
    });
  });

  // ------------------------------------------
  // getProfile
  // ------------------------------------------

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const profile = makeProfile();
      mocks.queryBuilder.single.mockResolvedValue({ data: profile, error: null });

      const result = await profileService.getProfile(userId);

      expect(result).toEqual(profile);
      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('user_profiles');
      expect(mocks.queryBuilder.select).toHaveBeenCalledWith('*');
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should throw 404 when not found', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      await expect(profileService.getProfile(userId)).rejects.toThrow(ApiError);
      await expect(profileService.getProfile(userId)).rejects.toThrow('Profile not found');

      try {
        await profileService.getProfile(userId);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(404);
      }
    });

    it('should throw 404 when data is null even without error', async () => {
      mocks.queryBuilder.single.mockResolvedValue({ data: null, error: null });

      await expect(profileService.getProfile(userId)).rejects.toThrow('Profile not found');
    });
  });

  // ------------------------------------------
  // updateProfile
  // ------------------------------------------

  describe('updateProfile', () => {
    it('should update and return profile', async () => {
      const updatedProfile = makeProfile({ first_name: 'Jane', full_name: 'Jane Doe' });
      const input = { first_name: 'Jane' };

      mocks.authQueryBuilder.single.mockResolvedValue({
        data: updatedProfile,
        error: null,
      });

      const result = await profileService.updateProfile(userId, accessToken, input);

      expect(result).toEqual(updatedProfile);
      expect(mocks.createSupabaseClientWithAuth).toHaveBeenCalledWith(accessToken);
    });

    it('should throw on error', async () => {
      const input = { first_name: 'BadUpdate' };

      mocks.authQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'RLS policy violation' },
      });

      await expect(profileService.updateProfile(userId, accessToken, input)).rejects.toThrow(
        ApiError
      );
      await expect(profileService.updateProfile(userId, accessToken, input)).rejects.toThrow(
        'Failed to update profile'
      );

      try {
        await profileService.updateProfile(userId, accessToken, input);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(400);
      }
    });

    it('should pass update input to the Supabase client', async () => {
      const input = { first_name: 'Updated', last_name: 'Name', company: 'Acme' };
      const updatedProfile = makeProfile(input);

      mocks.authQueryBuilder.single.mockResolvedValue({
        data: updatedProfile,
        error: null,
      });

      await profileService.updateProfile(userId, accessToken, input);

      expect(mocks.authQueryBuilder.update).toHaveBeenCalledWith(input);
      expect(mocks.authQueryBuilder.eq).toHaveBeenCalledWith('id', userId);
    });
  });

  // ------------------------------------------
  // setStripeCustomerId
  // ------------------------------------------

  describe('setStripeCustomerId', () => {
    it('should update stripe_customer_id', async () => {
      const customerId = 'cus_abc123';
      // eq is the terminal call in this chain (no .single())
      // from().update().eq() — eq resolves the promise
      mocks.queryBuilder.eq.mockResolvedValue({ error: null });

      await profileService.setStripeCustomerId(userId, customerId);

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('user_profiles');
      expect(mocks.queryBuilder.update).toHaveBeenCalledWith({
        stripe_customer_id: customerId,
      });
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should handle errors gracefully (log but not throw)', async () => {
      const customerId = 'cus_xyz789';
      mocks.queryBuilder.eq.mockResolvedValue({
        error: { message: 'database connection lost' },
      });

      // setStripeCustomerId logs the error but does NOT throw
      await expect(profileService.setStripeCustomerId(userId, customerId)).resolves.toBeUndefined();
    });

    it('should not throw when update succeeds', async () => {
      mocks.queryBuilder.eq.mockResolvedValue({ error: null });

      await expect(
        profileService.setStripeCustomerId(userId, 'cus_success')
      ).resolves.toBeUndefined();
    });
  });

  // ------------------------------------------
  // getStripeCustomerId
  // ------------------------------------------

  describe('getStripeCustomerId', () => {
    it('should return stripe_customer_id when found', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_found123' },
        error: null,
      });

      const result = await profileService.getStripeCustomerId(userId);

      expect(result).toBe('cus_found123');
      expect(mocks.queryBuilder.select).toHaveBeenCalledWith('stripe_customer_id');
    });

    it('should return null when no stripe_customer_id exists', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: { stripe_customer_id: null },
        error: null,
      });

      const result = await profileService.getStripeCustomerId(userId);

      expect(result).toBeNull();
    });

    it('should return null when no data is returned', async () => {
      mocks.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const result = await profileService.getStripeCustomerId(userId);

      expect(result).toBeNull();
    });
  });

  // ------------------------------------------
  // deleteProfile
  // ------------------------------------------

  describe('deleteProfile', () => {
    it('should call supabaseAdmin.from("user_profiles").delete().eq("id", userId)', async () => {
      // delete().eq() is terminal — eq resolves the promise
      mocks.queryBuilder.eq.mockResolvedValue({ error: null });

      await profileService.deleteProfile(userId);

      expect(mocks.supabaseAdmin.from).toHaveBeenCalledWith('user_profiles');
      expect(mocks.queryBuilder.delete).toHaveBeenCalled();
      expect(mocks.queryBuilder.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should succeed without error', async () => {
      mocks.queryBuilder.eq.mockResolvedValue({ error: null });

      await expect(profileService.deleteProfile(userId)).resolves.toBeUndefined();
    });

    it('should throw ApiError(500) on database error', async () => {
      mocks.queryBuilder.eq.mockResolvedValue({
        error: { message: 'foreign key constraint violation' },
      });

      await expect(profileService.deleteProfile(userId)).rejects.toThrow(ApiError);
      await expect(profileService.deleteProfile(userId)).rejects.toThrow(
        'Failed to delete profile'
      );

      try {
        await profileService.deleteProfile(userId);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
      }
    });
  });
});
