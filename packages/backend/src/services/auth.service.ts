import { supabaseAdmin, supabaseClient } from '../config/supabase.js';
import { RegisterInput, LoginInput, AuthResponse } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, first_name, last_name } = input;

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: first_name || '',
          last_name: last_name || '',
        },
      },
    });

    if (error) {
      throw new ApiError(400, error.message);
    }

    if (!data.user || !data.session) {
      throw new ApiError(400, 'Registration failed - please check your email for confirmation');
    }

    return {
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
    };
  }

  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new ApiError(401, error.message);
    }

    if (!data.user || !data.session) {
      throw new ApiError(401, 'Login failed');
    }

    return {
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
    };
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(accessToken: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);

    if (error) {
      console.error('Logout error:', error);
      // Don't throw - token might already be invalid
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new ApiError(401, error.message);
    }

    if (!data.user || !data.session) {
      throw new ApiError(401, 'Failed to refresh token');
    }

    return {
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
    };
  }

  /**
   * Send password reset email
   */
  async forgotPassword(email: string, redirectUrl?: string): Promise<void> {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw new ApiError(400, error.message);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(accessToken: string, newPassword: string): Promise<void> {
    // Create a client with the user's access token
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      accessToken,
      { password: newPassword }
    );

    if (error) {
      throw new ApiError(400, error.message);
    }
  }

  /**
   * Get current user from token
   */
  async getCurrentUser(accessToken: string) {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error) {
      throw new ApiError(401, error.message);
    }

    return data.user;
  }
}

export const authService = new AuthService();
