/**
 * AUTH COMPATIBILITY LAYER
 *
 * Clean re-export layer for backward compatibility
 * This maintains our feature-based architecture while supporting legacy imports
 */

// Re-export all auth types from features
export type {
  AuthContextValue,
  AuthResponse,
  LoginCredentials,
  NostrChallenge,
  NostrSignature,
  SignupData,
  User,
} from '../features/auth/types';

// Re-export auth services and context
export { AuthProvider, useAuth } from '../features/auth/services/AuthContext';

/**
 * AUTH SERVICE - MOCK IMPLEMENTATION
 *
 * Mock auth service for testing and development
 * Will be replaced with real backend integration
 */
import type {
  LoginCredentials,
  NostrChallenge,
  NostrSignature,
  SignupData,
  User,
} from '../features/auth/types';

export const authService = {
  login: async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; user: User; token: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      success: true,
      user: {
        id: '1',
        email: credentials.email,
        name: credentials.email,
        role: 'creator',
        permissions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_verified: true,
        nostr_verified: false,
      } as User,
      token: 'mock-jwt-token',
    };
  },

  signup: async (data: SignupData): Promise<{ success: boolean; user: User; token: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      success: true,
      user: {
        id: '2',
        email: data.email,
        name: data.name || data.email,
        role: 'creator',
        permissions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_verified: true,
        nostr_verified: false,
      } as User,
      token: 'mock-jwt-token',
    };
  },

  authenticateNostr: async (
    signature: NostrSignature
  ): Promise<{ success: boolean; user: User; token: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return {
      success: true,
      user: {
        id: '3',
        email: `${signature.pubkey}@nostr.local`,
        name: signature.pubkey.slice(0, 8),
        role: 'creator',
        permissions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_verified: true,
        nostr_verified: true,
      } as User,
      token: 'mock-jwt-token',
    };
  },

  generateNostrChallenge: async (): Promise<NostrChallenge> => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return {
      challenge: 'mock-challenge',
      expires_at: new Date(Date.now() + 300000).toISOString(),
    } as NostrChallenge;
  },

  verifyAuth: async (): Promise<{ success: boolean; user: User | null }> => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { success: true, user: null };
  },
};
