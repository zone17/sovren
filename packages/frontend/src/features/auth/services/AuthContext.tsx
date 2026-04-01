/**
 * Auth Context — NOSTR-first authentication
 *
 * realAuthService is default. demoAuthService only when VITE_DEMO_MODE=true.
 */

import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../services/api/apiClient';
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

// Auth service interface (NOSTR + email auth)
interface AuthService {
  verifyAuth: () => Promise<{ user: User | null; error?: string }>;
  authenticateNostr: (signature: NostrSignature) => Promise<AuthResponse>;
  generateNostrChallenge: () => Promise<{
    challenge?: string;
    timestamp?: number;
    error?: string;
  }>;
  signUpWithEmail: (data: SignupData) => Promise<AuthResponse>;
  signInWithEmail: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}

// Demo auth service — only active when VITE_DEMO_MODE=true
const demoAuthService: AuthService = {
  verifyAuth: async () => {
    const demoUser = localStorage.getItem('demo_user');
    if (demoUser) {
      return { user: JSON.parse(demoUser) as User };
    }
    return { user: null };
  },

  authenticateNostr: async (signature: NostrSignature) => {
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
      permissions: [
        'content.create',
        'content.edit',
        'content.delete',
        'content.publish',
        'payments.receive',
      ],
    };

    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    return { success: true, user: demoUser };
  },

  generateNostrChallenge: async () => {
    return {
      challenge: 'demo-challenge-' + Date.now() + Math.random().toString(36).substring(2, 11),
      timestamp: Math.floor(Date.now() / 1000),
    };
  },

  signUpWithEmail: async (data: SignupData) => {
    const demoUser: User = {
      id: 'demo-email-' + Date.now(),
      email: data.email,
      name: data.name,
      role: data.role,
      nostr_pubkey: undefined,
      avatar_url: undefined,
      bio: undefined,
      website: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: false,
      nostr_verified: false,
      permissions:
        data.role === 'creator'
          ? [
              'content.create',
              'content.edit',
              'content.delete',
              'content.publish',
              'payments.receive',
            ]
          : ['payments.send'],
    };
    // Mirror production: require email confirmation — do NOT store to localStorage
    return { success: true, user: demoUser, requiresConfirmation: true };
  },

  signInWithEmail: async (credentials: LoginCredentials) => {
    const demoUser: User = {
      id: 'demo-email-' + Date.now(),
      email: credentials.email,
      name: credentials.email.split('@')[0],
      role: 'supporter',
      nostr_pubkey: undefined,
      avatar_url: undefined,
      bio: undefined,
      website: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: true,
      nostr_verified: false,
      permissions: ['payments.send'],
    };
    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    return { success: true, user: demoUser };
  },

  logout: async () => {
    localStorage.removeItem('demo_user');
  },
};

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const getAuthService = (): AuthService => {
  if (isDemoMode) return demoAuthService;
  return realAuthService;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Core logout sequence: clear token → clear cache → navigate
  const performLogout = useCallback(async () => {
    try {
      const authService = getAuthService();
      await authService.logout();
    } catch (err) {
      console.error('Logout backend call failed:', err);
    } finally {
      apiClient.setToken(null);
      queryClient.clear();
      setUser(null);
      setError(null);
    }
  }, [queryClient]);

  // Verify auth on mount
  const refreshAuth = useCallback(async (): Promise<void> => {
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
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  // Listen for 401 session-expired events from apiClient
  useEffect(() => {
    const handleSessionExpired = () => {
      void performLogout().then(() => {
        navigate('/login?reason=session-expired');
      });
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [performLogout, navigate]);

  // Email login via Supabase Auth
  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      setError(null);

      const authService = getAuthService();
      const result = await authService.signInWithEmail(credentials);

      if (result.error || !result.user) {
        const errorMsg = result.error || 'Email login failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setUser(result.user);
      return { success: true, user: result.user };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Email login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // NOSTR authentication
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

  // Email signup via Supabase Auth
  const signup = async (data: SignupData): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      setError(null);

      const authService = getAuthService();
      const result = await authService.signUpWithEmail(data);

      if (result.error || !result.user) {
        const errorMsg = result.error || 'Email signup failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // If no token/session, email confirmation is required — don't set auth state
      if (!result.token) {
        return { success: true, requiresConfirmation: true, user: result.user };
      }

      setUser(result.user);
      return { success: true, user: result.user, token: result.token };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Email signup failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Generate NOSTR challenge
  const generateNostrChallenge = async (): Promise<{
    challenge?: string;
    timestamp?: number;
    error?: string;
  }> => {
    try {
      const authService = getAuthService();
      return await authService.generateNostrChallenge();
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Challenge generation failed' };
    }
  };

  // Logout
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    await performLogout();
    navigate('/login');
    setIsLoading(false);
  };

  // Refresh token — stub (Phase 0e deferred)
  const refreshToken = async (): Promise<boolean> => {
    try {
      await refreshAuth();
      return !!user;
    } catch {
      return false;
    }
  };

  // Update profile — local state only
  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (user) {
      setUser({ ...user, ...updates });
      return true;
    }
    return false;
  };

  // Verify email — stub
  const verifyEmail = async (_token: string): Promise<boolean> => {
    return true;
  };

  // Reset password — stub
  const resetPassword = async (_email: string): Promise<boolean> => {
    return true;
  };

  const value: AuthContextValue = {
    isAuthenticated: !!user,
    isLoading,
    user,
    error,
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
