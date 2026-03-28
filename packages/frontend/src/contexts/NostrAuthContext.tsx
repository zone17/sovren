/**
 * 🔐 NOSTR Authentication Context
 * US-305: Unified NOSTR Authentication Integration
 *
 * Provides React context and hooks for NOSTR authentication
 * Integrates with the unified backend authentication service
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { KeyManagementService } from '../services/nostr/KeyManagementService';
import type { NostrEnhancedKeyPair } from '@shared/types/nostr/index';
import { createSignatureMessage } from '@shared/types/nostr/auth';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface NostrAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  pubkey: string | null;
  npub: string | null;
  profile: NostrProfile | null;
  sessionId: string | null;
  token: string | null;
  error: string | null;
}

export interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
}

export interface AuthChallenge {
  challenge: string;
  pubkey: string;
  created_at: number;
  expires_at: number;
}

export interface NostrAuthContextValue extends NostrAuthState {
  // Authentication methods
  login: (privateKey?: string) => Promise<void>;
  loginWithExtension: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;

  // Key management
  generateNewKey: () => Promise<NostrEnhancedKeyPair>;
  importKey: (key: string, format: 'nsec' | 'hex') => Promise<void>;

  // Session management
  getSessions: () => Promise<Session[]>;
  revokeSession: (sessionId: string) => Promise<void>;

  // Utilities
  clearError: () => void;
}

export interface Session {
  id: string;
  device_info: {
    deviceType: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    os: string;
  };
  created_at: string;
  last_activity_at: string;
  location?: {
    country?: string;
    city?: string;
  };
  is_current?: boolean;
}

// =====================================================
// CONTEXT CREATION
// =====================================================

const NostrAuthContext = createContext<NostrAuthContextValue | undefined>(undefined);

export const useNostrAuth = (): NostrAuthContextValue => {
  const context = useContext(NostrAuthContext);
  if (!context) {
    throw new Error('useNostrAuth must be used within NostrAuthProvider');
  }
  return context;
};

// =====================================================
// AUTHENTICATION PROVIDER
// =====================================================

export interface NostrAuthProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
  autoConnect?: boolean;
  persistSession?: boolean;
}

export const NostrAuthProvider: React.FC<NostrAuthProviderProps> = ({
  children,
  apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001',
  autoConnect = true,
  persistSession = true,
}) => {
  // State management
  const [state, setState] = useState<NostrAuthState>({
    isAuthenticated: false,
    isLoading: false,
    pubkey: null,
    npub: null,
    profile: null,
    sessionId: null,
    token: null,
    error: null,
  });

  // Service instances
  const [keyManagement] = useState(() => KeyManagementService.getInstance());

  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  const login = useCallback(
    async (privateKey?: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Step 1: Get or import key
        let keyPair: NostrEnhancedKeyPair;

        if (privateKey) {
          // Import provided key
          const format = privateKey.startsWith('nsec') ? 'nsec' : 'hex';
          keyPair = await keyManagement.importKey(privateKey, format);
        } else {
          // Use active key or generate new one
          const activeKey = keyManagement.getActiveKey();
          if (!activeKey) {
            keyPair = await keyManagement.generateKeyPair();
            await keyManagement.setActiveKey(keyPair.keyId);
          } else {
            keyPair = activeKey;
          }
        }

        // Step 2: Request authentication challenge
        const challengeResponse = await fetch(`${apiBaseUrl}/api/auth/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pubkey: keyPair.publicKey }),
        });

        if (!challengeResponse.ok) {
          throw new Error('Failed to get authentication challenge');
        }

        const challenge: AuthChallenge = await challengeResponse.json();

        // Step 3: Sign the challenge
        const timestamp = Date.now();
        const message = createSignatureMessage(challenge.challenge, timestamp);

        const event = {
          kind: 22242, // AUTH kind
          pubkey: keyPair.publicKey,
          created_at: Math.floor(timestamp / 1000),
          tags: [['challenge', challenge.challenge]],
          content: message,
        };

        const signedEvent = await keyManagement.signEvent(keyPair.keyId, event);

        // Step 4: Verify signature with backend
        const verifyResponse = await fetch(`${apiBaseUrl}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            pubkey: keyPair.publicKey,
            signature: signedEvent.sig,
            challenge: challenge.challenge,
            timestamp,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              deviceType: getDeviceType(),
            },
          }),
        });

        if (!verifyResponse.ok) {
          const error = await verifyResponse.json();
          throw new Error(error.message || 'Authentication failed');
        }

        const authResult = await verifyResponse.json();

        // Step 5: Store authentication state
        setState({
          isAuthenticated: true,
          isLoading: false,
          pubkey: keyPair.publicKey,
          npub: keyPair.npub,
          profile: null, // Will be loaded separately
          sessionId: authResult.sessionId,
          token: authResult.token,
          error: null,
        });

        // Session persistence: token is now stored in HttpOnly cookie by backend.
        // Only persist non-sensitive session metadata client-side.
        if (persistSession) {
          localStorage.setItem('nostr_pubkey', keyPair.publicKey);
          sessionStorage.setItem('nostr_session_id', authResult.sessionId);
        }

        // Step 6: Load profile (async, non-blocking)
        loadProfile(keyPair.publicKey);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        }));
      }
    },
    [apiBaseUrl, keyManagement, persistSession]
  );

  const loginWithExtension = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Step 1: Connect to browser extension
      const extension = await keyManagement.connectBrowserExtension();

      if (!extension.enabled || !extension.publicKey) {
        throw new Error('Failed to connect to browser extension');
      }

      // Step 2: Request authentication challenge
      const challengeResponse = await fetch(`${apiBaseUrl}/api/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pubkey: extension.publicKey }),
      });

      if (!challengeResponse.ok) {
        throw new Error('Failed to get authentication challenge');
      }

      const challenge: AuthChallenge = await challengeResponse.json();

      // Step 3: Sign with extension
      const timestamp = Date.now();
      const message = createSignatureMessage(challenge.challenge, timestamp);

      const event = {
        kind: 22242,
        pubkey: extension.publicKey,
        created_at: Math.floor(timestamp / 1000),
        tags: [['challenge', challenge.challenge]],
        content: message,
      };

      const signedEvent = await keyManagement.signEvent('extension', event);

      // Step 4: Verify with backend
      const verifyResponse = await fetch(`${apiBaseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pubkey: extension.publicKey,
          signature: signedEvent.sig,
          challenge: challenge.challenge,
          timestamp,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            deviceType: getDeviceType(),
          },
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authResult = await verifyResponse.json();

      // Step 5: Update state
      setState({
        isAuthenticated: true,
        isLoading: false,
        pubkey: extension.publicKey,
        npub: '', // Will convert later
        profile: null,
        sessionId: authResult.sessionId,
        token: authResult.token,
        error: null,
      });

      // Token is now stored in HttpOnly cookie by backend.
      if (persistSession) {
        localStorage.setItem('nostr_pubkey', extension.publicKey);
      }

      loadProfile(extension.publicKey);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Extension authentication failed',
      }));
    }
  }, [apiBaseUrl, keyManagement, persistSession]);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Call backend logout — cookie cleared server-side
      await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      // Clear local state
      setState({
        isAuthenticated: false,
        isLoading: false,
        pubkey: null,
        npub: null,
        profile: null,
        sessionId: null,
        token: null,
        error: null,
      });

      // Clear storage (non-sensitive metadata only; token cookie cleared by backend)
      localStorage.removeItem('nostr_pubkey');
      sessionStorage.removeItem('nostr_session_id');

      // Clear key management session
      await keyManagement.clearSession();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if backend call fails
      setState({
        isAuthenticated: false,
        isLoading: false,
        pubkey: null,
        npub: null,
        profile: null,
        sessionId: null,
        token: null,
        error: null,
      });
    }
  }, [apiBaseUrl, keyManagement]);

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      setState((prev) => ({ ...prev, token: data.data?.token || prev.token }));
    } catch (error) {
      // If refresh fails, logout
      await logout();
      throw error;
    }
  }, [apiBaseUrl, logout]);

  // =====================================================
  // KEY MANAGEMENT
  // =====================================================

  const generateNewKey = useCallback(async () => {
    return keyManagement.generateKeyPair();
  }, [keyManagement]);

  const importKey = useCallback(
    async (key: string, format: 'nsec' | 'hex') => {
      const keyPair = await keyManagement.importKey(key, format);
      await keyManagement.setActiveKey(keyPair.keyId);
      await login(); // Auto-login with imported key
    },
    [keyManagement, login]
  );

  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================

  const getSessions = useCallback(async (): Promise<Session[]> => {
    if (!state.isAuthenticated) {
      return [];
    }

    const response = await fetch(`${apiBaseUrl}/api/auth/sessions`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }

    const { sessions } = await response.json();
    return sessions;
  }, [apiBaseUrl, state.isAuthenticated]);

  const revokeSession = useCallback(
    async (sessionId: string) => {
      if (!state.isAuthenticated) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${apiBaseUrl}/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      // If revoking current session, logout
      if (sessionId === state.sessionId) {
        await logout();
      }
    },
    [apiBaseUrl, state.isAuthenticated, state.sessionId, logout]
  );

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const loadProfile = useCallback(async (pubkey: string) => {
    // This would fetch the profile from NOSTR relays
    // Simplified for now
    setState((prev) => ({
      ...prev,
      profile: {
        name: pubkey.substring(0, 8),
        display_name: 'NOSTR User',
      },
    }));
  }, []);

  const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  // =====================================================
  // AUTO-CONNECT ON MOUNT
  // =====================================================

  useEffect(() => {
    const initAuth = async () => {
      if (!autoConnect) return;

      const pubkey = localStorage.getItem('nostr_pubkey');

      if (pubkey) {
        setState((prev) => ({ ...prev, isLoading: true }));

        try {
          // Validate session via HttpOnly cookie (sent automatically)
          const response = await fetch(`${apiBaseUrl}/api/auth/validate`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            setState({
              isAuthenticated: true,
              isLoading: false,
              pubkey,
              npub: '', // Convert later
              profile: null,
              sessionId: data.sessionId,
              token: null, // Token is in HttpOnly cookie, not accessible client-side
              error: null,
            });

            loadProfile(pubkey);
          } else {
            // Session invalid, clear metadata
            localStorage.removeItem('nostr_pubkey');
            setState((prev) => ({ ...prev, isLoading: false }));
          }
        } catch (error) {
          console.error('Auto-connect failed:', error);
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    // Initialize key management service
    keyManagement.initialize().then(() => {
      initAuth();
    });
  }, [autoConnect, apiBaseUrl, keyManagement, loadProfile]);

  // =====================================================
  // TOKEN REFRESH INTERVAL
  // =====================================================

  useEffect(() => {
    if (!state.token) return;

    // Refresh token every 23 hours (for 24h expiry)
    const refreshInterval = setInterval(
      () => {
        refreshToken().catch(console.error);
      },
      23 * 60 * 60 * 1000
    );

    return () => clearInterval(refreshInterval);
  }, [state.token, refreshToken]);

  // =====================================================
  // CONTEXT VALUE
  // =====================================================

  const contextValue: NostrAuthContextValue = {
    ...state,
    login,
    loginWithExtension,
    logout,
    refreshToken,
    generateNewKey,
    importKey,
    getSessions,
    revokeSession,
    clearError,
  };

  return <NostrAuthContext.Provider value={contextValue}>{children}</NostrAuthContext.Provider>;
};

export default NostrAuthProvider;
