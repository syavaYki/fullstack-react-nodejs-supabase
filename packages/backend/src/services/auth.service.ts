import { supabaseClient, supabaseAdmin, createSupabaseClientWithAuth } from '../config/supabase.js';
import { RegisterInput, LoginInput, AuthResponse } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, first_name, last_name } = input;

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { first_name, last_name },
      },
    });

    if (error) {
      logger.error('AUTH', 'Registration failed', { error: error.message });
      throw new ApiError(400, error.message);
    }

    if (!data.user || !data.session) {
      throw new ApiError(400, 'Registration failed — please try again');
    }

    return {
      user: { id: data.user.id, email: data.user.email! },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error('AUTH', 'Login failed', { error: error.message });
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!data.user || !data.session) {
      throw new ApiError(401, 'Login failed');
    }

    return {
      user: { id: data.user.id, email: data.user.email! },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  async logout(accessToken: string): Promise<void> {
    // Use admin client (service_role) to revoke any user session
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'local');
    if (error) {
      logger.warn('AUTH', 'Logout error', { error: error.message });
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.user || !data.session) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    return {
      user: { id: data.user.id, email: data.user.email! },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  async forgotPassword(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      logger.error('AUTH', 'Forgot password error', { error: error.message });
      // Don't reveal if email exists
    }
  }

  async resetPassword(accessToken: string, newPassword: string): Promise<void> {
    const client = createSupabaseClientWithAuth(accessToken);
    const { error } = await client.auth.updateUser({ password: newPassword });

    if (error) {
      logger.error('AUTH', 'Reset password error', { error: error.message });
      throw new ApiError(400, 'Failed to reset password');
    }
  }
}

export const authService = new AuthService();
