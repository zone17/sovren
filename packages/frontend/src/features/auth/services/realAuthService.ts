/**
 * 🔐 **REAL AUTH SERVICE - ELITE BACKEND INTEGRATION**
 *
 * Elite Engineering Standards:
 * - Zero `any` types with comprehensive interfaces
 * - Proper error handling with typed responses
 * - Clean separation of concerns
 * - Enterprise-grade authentication patterns
 * - Backend API integration with JWT handling
 * - NOSTR-first authentication architecture
 */

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
    session?: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: number;
      tokenType?: string;
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
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api';
  }

  /**
   * 🔍 **Verify current authentication status**
   */
  async verifyAuth(): Promise<{ user: User | null; error?: string }> {
    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        return { user: null };
      }

      const response = await fetch(`${this.baseUrl}/auth/verify`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        localStorage.removeItem('auth_token');
        return { user: null, error: 'Token invalid or expired' };
      }

      const result = (await response.json()) as BackendAuthResponse;

      if (!result.success || !result.data?.user) {
        localStorage.removeItem('auth_token');
        return { user: null, error: result.error || 'Authentication verification failed' };
      }

      // Transform backend user to frontend User type
      const user: User = {
        id: result.data.user.id,
        email: result.data.user.email,
        name: result.data.user.name || result.data.user.email,
        role: this.mapBackendRole(result.data.user.role),
        nostr_pubkey: result.data.user.nostr_pubkey,
        avatar_url: undefined,
        bio: undefined,
        website: undefined,
        created_at: new Date().toISOString(), // Backend should provide this
        updated_at: new Date().toISOString(),
        email_verified: result.data.user.emailVerified || false,
        nostr_verified: !!result.data.user.nostr_pubkey,
        permissions: this.getRolePermissions(this.mapBackendRole(result.data.user.role)),
      };

      return { user };
    } catch (error) {
      console.error('Auth verification failed:', error);
      localStorage.removeItem('auth_token');
      return { user: null, error: 'Network error during authentication verification' };
    }
  }

  /**
   * 📧 **Email/Password Login**
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = (await response.json()) as BackendAuthResponse;

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || result.message || 'Login failed',
        };
      }

      // Store the token
      if (result.data?.session?.accessToken) {
        localStorage.setItem('auth_token', result.data.session.accessToken);
      } else if (result.data?.token) {
        localStorage.setItem('auth_token', result.data.token);
      }

      // Transform backend user to frontend User type
      if (result.data?.user) {
        const user: User = {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name || result.data.user.email,
          role: this.mapBackendRole(result.data.user.role),
          nostr_pubkey: result.data.user.nostr_pubkey,
          avatar_url: undefined,
          bio: undefined,
          website: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_verified: result.data.user.emailVerified || false,
          nostr_verified: !!result.data.user.nostr_pubkey,
          permissions: this.getRolePermissions(this.mapBackendRole(result.data.user.role)),
        };

        return { success: true, user };
      }

      return { success: false, error: 'Login response missing user data' };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during login',
      };
    }
  }

  /**
   * 📝 **User Signup**
   */
  async signup(data: SignupData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as BackendAuthResponse;

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || result.message || 'Signup failed',
        };
      }

      // Store the token
      if (result.data?.session?.accessToken) {
        localStorage.setItem('auth_token', result.data.session.accessToken);
      } else if (result.data?.token) {
        localStorage.setItem('auth_token', result.data.token);
      }

      // Transform backend user to frontend User type
      if (result.data?.user) {
        const user: User = {
          id: result.data.user.id,
          email: result.data.user.email,
          name: data.name,
          role: data.role,
          nostr_pubkey: undefined,
          avatar_url: undefined,
          bio: undefined,
          website: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_verified: result.data.user.emailVerified || false,
          nostr_verified: false,
          permissions: this.getRolePermissions(data.role),
        };

        return { success: true, user };
      }

      return { success: false, error: 'Signup response missing user data' };
    } catch (error) {
      console.error('Signup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during signup',
      };
    }
  }

  /**
   * 🌐 **NOSTR Authentication - Core NOSTR Protocol Implementation**
   */
  async authenticateNostr(signature: NostrSignature): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nostr_pubkey: signature.pubkey,
          challenge: signature.challenge,
          timestamp: signature.timestamp,
          signature: signature.signature,
          role: 'supporter', // Default role for NOSTR auth
        }),
      });

      const result = (await response.json()) as BackendAuthResponse;

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || result.message || 'NOSTR authentication failed',
        };
      }

      // Store the token
      if (result.data?.token) {
        localStorage.setItem('auth_token', result.data.token);
      }

      // Transform backend user to frontend User type
      if (result.data?.user) {
        const user: User = {
          id: result.data.user.id || signature.pubkey.slice(0, 8),
          email: result.data.user.email || `${signature.pubkey.slice(0, 8)}@nostr.local`,
          name: result.data.user.name || signature.pubkey.slice(0, 8),
          role: this.mapBackendRole(result.data.user.role),
          nostr_pubkey: signature.pubkey,
          avatar_url: undefined,
          bio: undefined,
          website: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_verified: false,
          nostr_verified: true, // Always true for NOSTR authentication
          permissions: this.getRolePermissions(this.mapBackendRole(result.data.user.role)),
        };

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
   * 🔑 **Generate NOSTR Challenge - Core NOSTR Protocol**
   */
  async generateNostrChallenge(): Promise<{ challenge?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = (await response.json()) as BackendChallengeResponse;

      if (!response.ok || !result.success) {
        return {
          error: result.error || 'Failed to generate NOSTR challenge',
        };
      }

      if (result.data?.challenge) {
        return { challenge: result.data.challenge };
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
   * 🚪 **Logout**
   */
  async logout(): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');

      if (token) {
        // Attempt to logout on backend
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
      // Continue with local logout even if backend fails
    } finally {
      // Always clear local storage
      localStorage.removeItem('auth_token');
    }
  }

  /**
   * 🔧 **Helper: Map backend role to frontend role**
   */
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

  /**
   * 🔧 **Helper: Get role permissions**
   */
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

// 🎯 **Export singleton instance**
export const realAuthService = new RealAuthService();
