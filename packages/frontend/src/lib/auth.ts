/**
 * 🎯 **AUTH COMPATIBILITY LAYER**
 *
 * Elite Engineering: Clean re-export layer for backward compatibility
 * This maintains our feature-based architecture while supporting legacy imports
 */

// Re-export all auth types from features
export type {
    AuthContextValue, AuthResponse, LoginCredentials, NostrChallenge, NostrSignature, SignupData, User
} from '../features/auth/types';

// Re-export auth services and context
export { AuthProvider, useAuth } from '../features/auth/services/AuthContext';

/**
 * 🤖 **AUTH SERVICE - ELITE MOCK IMPLEMENTATION**
 *
 * Mock auth service for testing and development
 * Will be replaced with real backend integration
 */
import type { LoginCredentials, NostrChallenge, NostrSignature, SignupData, User } from '../features/auth/types';

export const authService = {
  /**
   * User login with email/password
   */
  login: async (credentials: LoginCredentials): Promise<{ success: boolean; user: User; token: string }> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      success: true,
      user: {
        id: '1',
        email: credentials.email,
        username: credentials.email,
        role: 'user' as const,
        permissions: ['read', 'write'],
        createdAt: new Date(),
        lastLogin: new Date(),
      },
      token: 'mock-jwt-token'
    };
  },

  /**
   * User signup with form data
   */
  signup: async (data: SignupData): Promise<{ success: boolean; user: User; token: string }> => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return {
      success: true,
      user: {
        id: '2',
        email: data.email,
        username: data.username,
        role: 'user' as const,
        permissions: ['read', 'write'],
        createdAt: new Date(),
        lastLogin: new Date(),
      },
      token: 'mock-jwt-token'
    };
  },

  /**
   * Nostr authentication
   */
  authenticateNostr: async (signature: NostrSignature): Promise<{ success: boolean; user: User; token: string }> => {
    await new Promise(resolve => setTimeout(resolve, 120));
    return {
      success: true,
      user: {
        id: '3',
        email: `${signature.pubkey}@nostr.local`,
        username: signature.pubkey.slice(0, 8),
        role: 'user' as const,
        permissions: ['read', 'write'],
        createdAt: new Date(),
        lastLogin: new Date(),
      },
      token: 'mock-jwt-token'
    };
  },

  /**
   * Generate Nostr challenge for authentication
   */
  generateNostrChallenge: async (): Promise<NostrChallenge> => {
    await new Promise(resolve => setTimeout(resolve, 80));
    return {
      challenge: 'mock-challenge',
      expiresAt: new Date(Date.now() + 300000) // 5 minutes
    };
  },

  /**
   * Verify existing authentication token
   */
  verifyAuth: async (): Promise<{ success: boolean; user: User | null }> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { success: true, user: null };
  },
};
