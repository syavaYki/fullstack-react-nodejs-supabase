import { Request } from 'express';
import { User } from '@supabase/supabase-js';

/** Express Request extended with authenticated user info */
export interface AuthenticatedRequest extends Request {
  user?: User;
  accessToken?: string;
}

/** AuthenticatedRequest with user guaranteed (post-requireUser middleware) */
export interface RequestWithUser extends AuthenticatedRequest {
  user: User;
}

/** Billing cycle for subscriptions */
export type BillingCycle = 'monthly' | 'yearly';

/** Feature value types: boolean toggle, numeric limit, or enum choice */
export type FeatureType = 'boolean' | 'limit' | 'enum';

/** Feature development status */
export type FeatureStatus = 'active' | 'future' | 'development';

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Paginated API response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
