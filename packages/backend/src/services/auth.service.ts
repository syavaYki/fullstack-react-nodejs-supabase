import { supabaseAdmin, supabaseClient } from '../config/supabase.js';
import { RegisterInput, LoginInput, AuthResponse } from '../types/index.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * Service for handling user authentication operations.
 * Uses Supabase Auth for user management, registration, login, and session handling.
 */
export class AuthService {
  /**
   * Registers a new user with email and password.
   * Creates a Supabase Auth user and triggers the creation of a user profile
   * via database trigger (on auth.users insert).
   *
   * @param input - Registration data containing email, password, and optional name
   * @returns Authentication response with user object and session tokens
   * @throws {ApiError} 400 if registration fails (e.g., email already exists, weak password)
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
   * Authenticates a user with email and password.
   * Returns a session with access and refresh tokens on success.
   *
   * @param input - Login credentials (email and password)
   * @returns Authentication response with user object and session tokens
   * @throws {ApiError} 401 if credentials are invalid or user doesn't exist
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
   * Logs out a user by invalidating their session.
   * Uses admin API to ensure the token is invalidated server-side.
   * Does not throw on error as the token may already be invalid.
   *
   * @param accessToken - The user's current access token to invalidate
   */
  async logout(accessToken: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);

    if (error) {
      console.error('Logout error:', error);
      // Don't throw - token might already be invalid
    }
  }

  /**
   * Refreshes an expired or expiring access token using a refresh token.
   * Returns a new session with fresh access and refresh tokens.
   *
   * @param refreshToken - The user's refresh token
   * @returns New authentication response with updated session tokens
   * @throws {ApiError} 401 if refresh token is invalid or expired
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
   * Initiates the password reset flow by sending a reset email.
   * The email contains a link with a token that expires after a set time.
   *
   * @param email - The user's email address
   * @param redirectUrl - Optional URL to redirect to after password reset
   * @throws {ApiError} 400 if email sending fails
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
   * Resets a user's password using their user ID.
   * Called after the user clicks the reset link and provides a new password.
   * Uses admin API to update the password directly.
   *
   * @param accessToken - The user's ID (from the reset token verification)
   * @param newPassword - The new password to set
   * @throws {ApiError} 400 if password update fails (e.g., password too weak)
   */
  async resetPassword(accessToken: string, newPassword: string): Promise<void> {
    // Create a client with the user's access token
    const { error } = await supabaseAdmin.auth.admin.updateUserById(accessToken, {
      password: newPassword,
    });

    if (error) {
      throw new ApiError(400, error.message);
    }
  }

  /**
   * Retrieves the current user's data from an access token.
   * Validates the token and returns the associated Supabase Auth user.
   *
   * @param accessToken - A valid JWT access token
   * @returns The Supabase Auth user object
   * @throws {ApiError} 401 if token is invalid or expired
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
