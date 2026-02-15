/**
 * 🔐 **AUTH CONTEXT SERVICE - ELITE TYPE SAFETY**
 *
 * Elite Engineering Standards:
 * - Zero `any` types with comprehensive interfaces
 * - Proper error handling with typed responses
 * - Clean separation of concerns
 * - Enterprise-grade authentication patterns
 * - Feature flag integration for backend connectivity
 */

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { featureFlags } from '../../../shared/types/feature-flags';
import type {
  AuthContextValue,
  AuthResponse,
  AuthStatus,
  LoginCredentials,
  NostrSignature,
  SignupData,
  User,
} from '../types';
import { realAuthService } from './realAuthService';

// 🔧 **TEMPORARY AUTH SERVICE INTERFACE**
// This will be replaced with proper implementation
interface TempAuthService {
  verifyAuth: () => Promise<{ user: User | null; error?: string }>;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (data: SignupData) => Promise<AuthResponse>;
  authenticateNostr: (signature: NostrSignature) => Promise<AuthResponse>;
  generateNostrChallenge: () => Promise<{ challenge?: string; error?: string }>;
  logout: () => Promise<void>;
}

// 🚧 **DEMO AUTH SERVICE** (for immediate user experience)
const demoAuthService: TempAuthService = {
  verifyAuth: async () => {
    // Check if user has demo authentication
    const demoUser = localStorage.getItem('demo_user');
    if (demoUser) {
      return { user: JSON.parse(demoUser) };
    }
    return { user: null };
  },

  login: async (credentials: LoginCredentials) => {
    // Simple demo login - any email/password works
    const demoUser: User = {
      id: 'demo-creator-123',
      email: credentials.email,
      name: credentials.email.split('@')[0],
      role: 'creator',
      nostr_pubkey: 'demo-nostr-pubkey-' + Date.now(),
      avatar_url: undefined,
      bio: 'Demo creator account',
      website: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: true,
      nostr_verified: true,
      permissions: ['read', 'write', 'create', 'publish'],
    };

    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    return { success: true, user: demoUser };
  },

  signup: async (data: SignupData) => {
    // Simple demo signup
    const demoUser: User = {
      id: 'demo-creator-' + Date.now(),
      email: data.email,
      name: data.name || data.email.split('@')[0],
      role: 'creator',
      nostr_pubkey: 'demo-nostr-pubkey-' + Date.now(),
      avatar_url: undefined,
      bio: 'New creator on Sovren',
      website: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: true,
      nostr_verified: true,
      permissions: ['read', 'write', 'create', 'publish'],
    };

    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    return { success: true, user: demoUser };
  },

  authenticateNostr: async (signature: NostrSignature) => {
    // Simple NOSTR demo
    const demoUser: User = {
      id: 'demo-creator-nostr-' + Date.now(),
      email: 'nostr-creator@sovren.app',
      name: 'NOSTR Creator',
      role: 'creator',
      nostr_pubkey: signature.pubkey,
      avatar_url: undefined,
      bio: 'NOSTR creator on Sovren',
      website: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: true,
      nostr_verified: true,
      permissions: ['read', 'write', 'create', 'publish'],
    };

    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    return { success: true, user: demoUser };
  },

  generateNostrChallenge: async () => {
    return {
      challenge: 'demo-challenge-' + Date.now() + Math.random().toString(36).substring(2, 11),
    };
  },

  logout: async () => {
    localStorage.removeItem('demo_user');
  },
};

// 🚧 **MOCK AUTH SERVICE** (returns no users)
const mockAuthService: TempAuthService = {
  verifyAuth: async () => await Promise.resolve({ user: null }),
  login: async () => await Promise.resolve({ success: false, error: 'Not implemented' }),
  signup: async () => await Promise.resolve({ success: false, error: 'Not implemented' }),
  authenticateNostr: async () =>
    await Promise.resolve({ success: false, error: 'Not implemented' }),
  generateNostrChallenge: async () => await Promise.resolve({ error: 'Not implemented' }),
  logout: async () => await Promise.resolve(),
};

// 🎯 **AUTH SERVICE SELECTOR**
// Using demo auth for immediate user experience
const getAuthService = (): TempAuthService => {
  if (featureFlags.enableBackendIntegration) {
    return {
      verifyAuth: realAuthService.verifyAuth.bind(realAuthService),
      login: realAuthService.login.bind(realAuthService),
      signup: realAuthService.signup.bind(realAuthService),
      authenticateNostr: realAuthService.authenticateNostr.bind(realAuthService),
      generateNostrChallenge: realAuthService.generateNostrChallenge.bind(realAuthService),
      logout: realAuthService.logout.bind(realAuthService),
    };
  }
  return demoAuthService; // Use demo auth instead of mock
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔄 **VERIFY AUTHENTICATION**
  const refreshAuth = async (): Promise<void> => {
    try {
      const authService = getAuthService();
      const result = await authService.verifyAuth();
      setUser(result.user);
      setError(result.error || null);
    } catch (err) {
      console.error('Auth verification failed:', err);
      setUser(null);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 **INITIALIZE AUTH STATE**
  useEffect(() => {
    void refreshAuth();
  }, []);

  // 📧 **EMAIL/PASSWORD LOGIN**
  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      setError(null);

      const authService = getAuthService();
      const result = await authService.login(credentials);

      if (result.error || !result.user) {
        const errorMsg = result.error || 'Login failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setUser(result.user);
      return { success: true, user: result.user };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // 🌐 **NOSTR AUTHENTICATION**
  const authenticateNostr = async (signature: NostrSignature): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      setError(null);

      const authService = getAuthService();
      const result = await authService.authenticateNostr(signature);

      if (result.error || !result.user) {
        const errorMsg = result.error || 'NOSTR authentication failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setUser(result.user);
      return { success: true, user: result.user };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'NOSTR authentication failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // 📝 **USER SIGNUP**
  const signup = async (data: SignupData): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      setError(null);

      const authService = getAuthService();
      const result = await authService.signup(data);

      if (result.error || !result.user) {
        const errorMsg = result.error || 'Signup failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setUser(result.user);
      return { success: true, user: result.user };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // 🔑 **GENERATE NOSTR CHALLENGE**
  const generateNostrChallenge = async (): Promise<{ challenge?: string; error?: string }> => {
    try {
      const authService = getAuthService();
      return await authService.generateNostrChallenge();
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Challenge generation failed' };
    }
  };

  // 🚪 **LOGOUT**
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const authService = getAuthService();
      await authService.logout();
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
      // Still clear user state even if logout fails
      setUser(null);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔄 **REFRESH TOKEN** (stub implementation)
  const refreshToken = async (): Promise<boolean> => {
    try {
      await refreshAuth();
      return !!user;
    } catch {
      return false;
    }
  };

  // 👤 **UPDATE PROFILE** (stub implementation)
  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    try {
      if (user) {
        setUser({ ...user, ...updates });
        return await Promise.resolve(true);
      }
      return await Promise.resolve(false);
    } catch {
      return await Promise.resolve(false);
    }
  };

  // ✉️ **VERIFY EMAIL** (stub implementation)
  const verifyEmail = async (token: string): Promise<boolean> => {
    try {
      console.log('Verifying email with token:', token);
      return await Promise.resolve(true);
    } catch {
      return await Promise.resolve(false);
    }
  };

  // 🔒 **RESET PASSWORD** (stub implementation)
  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      console.log('Resetting password for:', email);
      return await Promise.resolve(true);
    } catch {
      return await Promise.resolve(false);
    }
  };

  const value: AuthContextValue = {
    // State
    isAuthenticated: !!user,
    isLoading,
    user,
    error,

    // Actions
    login,
    logout,
    signup,
    authenticateNostr,
    generateNostrChallenge,
    refreshToken,
    updateProfile,
    verifyEmail,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 🎯 **CUSTOM HOOKS**

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthStatus = (): AuthStatus => {
  const { isAuthenticated, isLoading, user } = useAuth();
  return { isAuthenticated, isLoading, user };
};
