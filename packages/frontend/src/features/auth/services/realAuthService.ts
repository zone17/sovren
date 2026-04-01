/**
 * Real Auth Service — NOSTR backend integration
 *
 * Uses apiClient for all HTTP transport. Domain logic (role mapping, permissions)
 * lives here. Email auth methods removed — backend has no email auth routes.
 */

import { apiClient } from '../../../services/api/apiClient';
import { supabase } from '../../../services/supabase';
import type { AuthResponse, LoginCredentials, NostrSignature, SignupData, User } from '../types';

// 🌐 **API RESPONSE INTERFACES**
interface BackendAuthResponse {
  success: boolean;
  data?: {
    user?: {
      id: string;
      email: string;
      name?: string;
      emailVerified?: boolean;
      lastSignIn?: string;
      nostr_pubkey?: string;
      role?: 'admin' | 'creator' | 'supporter';
    };
    token?: string;
  };
  error?: string;
  message?: string;
  code?: string;
}

interface BackendChallengeResponse {
  success: boolean;
  data?: {
    challenge: string;
    timestamp: number;
    expires_at: number;
    message: string;
  };
  error?: string;
  code?: string;
}

// 🔧 **REAL AUTH SERVICE IMPLEMENTATION**
export class RealAuthService {
  /**
   * Verify current authentication status via JWT
   */
  async verifyAuth(): Promise<{ user: User | null; error?: string }> {
    try {
      // Always call the backend — the auth cookie is sent automatically
      // via credentials: 'include'. Do not guard on a local token.
      const result = await apiClient.get<BackendAuthResponse>('/api/auth/verify');

      if (!result.success || !result.data?.user) {
        apiClient.setToken(null);
        return { user: null, error: result.error || 'Authentication verification failed' };
      }

      const user = this.mapUser(result.data.user);
      return { user };
    } catch (error) {
      console.error('Auth verification failed:', error);
      apiClient.setToken(null);
      return { user: null, error: 'Network error during authentication verification' };
    }
  }

  /**
   * NOSTR Authentication — core auth path
   */
  async authenticateNostr(signature: NostrSignature): Promise<AuthResponse> {
    try {
      const result = await apiClient.post<BackendAuthResponse>('/api/auth/authenticate', {
        nostr_pubkey: signature.pubkey,
        challenge: signature.challenge,
        timestamp: signature.timestamp,
        signature: signature.signature,
        event: signature.event,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || result.message || 'NOSTR authentication failed',
        };
      }

      if (result.data?.token) {
        apiClient.setToken(result.data.token);
      }

      if (result.data?.user) {
        const user = this.mapUser(result.data.user, signature.pubkey);
        return { success: true, user };
      }

      return { success: false, error: 'NOSTR authentication response missing user data' };
    } catch (error) {
      console.error('NOSTR authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during NOSTR authentication',
      };
    }
  }

  /**
   * Generate NOSTR challenge — returns both challenge and timestamp
   */
  async generateNostrChallenge(): Promise<{
    challenge?: string;
    timestamp?: number;
    error?: string;
  }> {
    try {
      const result = await apiClient.post<BackendChallengeResponse>('/api/auth/challenge', {});

      if (!result.success) {
        return { error: result.error || 'Failed to generate NOSTR challenge' };
      }

      if (result.data?.challenge) {
        return {
          challenge: result.data.challenge,
          timestamp: result.data.timestamp,
        };
      }

      return { error: 'Challenge response missing challenge data' };
    } catch (error) {
      console.error('Challenge generation failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error during challenge generation',
      };
    }
  }

  /**
   * Logout — clears token via apiClient
   */
  async logout(): Promise<void> {
    try {
      if (apiClient.getToken()) {
        await apiClient.post('/api/auth/logout', {});
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
    } finally {
      apiClient.setToken(null);
    }
  }

  /**
   * Email signup via Supabase Auth
   */
  async signUpWithEmail(data: SignupData): Promise<AuthResponse> {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: data.role,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Signup failed — no user returned' };
      }

      // If email confirmation is required, user won't have a session yet
      if (!authData.session) {
        return {
          success: true,
          user: this.mapSupabaseUser(authData.user, data.role, data.name),
        };
      }

      // Session exists — set token for API calls
      apiClient.setToken(authData.session.access_token);

      return {
        success: true,
        user: this.mapSupabaseUser(authData.user, data.role, data.name),
        token: authData.session.access_token,
      };
    } catch (error) {
      console.error('Email signup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email signup failed',
      };
    }
  }

  /**
   * Email login via Supabase Auth
   */
  async signInWithEmail(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!authData.user || !authData.session) {
        return { success: false, error: 'Login failed — no session returned' };
      }

      apiClient.setToken(authData.session.access_token);

      const user = this.mapSupabaseUser(authData.user);
      return { success: true, user, token: authData.session.access_token };
    } catch (error) {
      console.error('Email login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email login failed',
      };
    }
  }

  // -- Private helpers --

  private mapUser(
    backendUser: NonNullable<BackendAuthResponse['data']>['user'],
    fallbackPubkey?: string
  ): User {
    if (!backendUser) {
      throw new Error('mapUser called with undefined user');
    }
    const role = this.mapBackendRole(backendUser.role);
    return {
      id: backendUser.id || (fallbackPubkey ? fallbackPubkey.slice(0, 8) : ''),
      email: backendUser.email || `${fallbackPubkey?.slice(0, 8) ?? ''}@nostr.local`,
      name: backendUser.name || backendUser.email || (fallbackPubkey?.slice(0, 8) ?? ''),
      role,
      nostr_pubkey: backendUser.nostr_pubkey ?? fallbackPubkey,
      avatar_url: undefined,
      bio: undefined,
      website: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: backendUser.emailVerified ?? false,
      nostr_verified: !!(backendUser.nostr_pubkey ?? fallbackPubkey),
      permissions: this.getRolePermissions(role),
    };
  }

  private mapSupabaseUser(
    supabaseUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
    roleOverride?: string,
    nameOverride?: string
  ): User {
    const metadata = supabaseUser.user_metadata ?? {};
    const role = this.mapBackendRole(
      (roleOverride ?? metadata.role ?? 'supporter') as string
    );
    const name = (nameOverride ?? metadata.name ?? supabaseUser.email ?? '') as string;
    return {
      id: supabaseUser.id,
      email: supabaseUser.email ?? '',
      name,
      role,
      nostr_pubkey: undefined,
      avatar_url: undefined,
      bio: undefined,
      website: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: !!supabaseUser.email,
      nostr_verified: false,
      permissions: this.getRolePermissions(role),
    };
  }

  private mapBackendRole(backendRole?: string): 'creator' | 'supporter' | 'admin' {
    switch (backendRole) {
      case 'admin':
        return 'admin';
      case 'creator':
        return 'creator';
      case 'supporter':
      default:
        return 'supporter';
    }
  }

  private getRolePermissions(
    role: 'creator' | 'supporter' | 'admin'
  ): (
    | 'content.create'
    | 'content.edit'
    | 'content.delete'
    | 'content.publish'
    | 'payments.receive'
    | 'payments.send'
    | 'admin.users'
    | 'admin.content'
    | 'admin.system'
  )[] {
    switch (role) {
      case 'admin':
        return [
          'content.create',
          'content.edit',
          'content.delete',
          'content.publish',
          'payments.receive',
          'payments.send',
          'admin.users',
          'admin.content',
          'admin.system',
        ];
      case 'creator':
        return [
          'content.create',
          'content.edit',
          'content.delete',
          'content.publish',
          'payments.receive',
        ];
      case 'supporter':
      default:
        return ['payments.send'];
    }
  }
}

export const realAuthService = new RealAuthService();
