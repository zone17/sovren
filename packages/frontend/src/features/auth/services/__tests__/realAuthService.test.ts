/**
 * Real Auth Service Tests
 *
 * Updated for cookie-based auth (JWT in httpOnly cookies).
 * - No more localStorage token storage
 * - Uses apiClient for HTTP transport
 * - Auth verification relies on credentials:'include' (cookies sent automatically)
 * - Email signup/signin via Supabase Auth
 */

import type { NostrSignature } from '../../types';

// Must use vi.hoisted() because vi.mock factories are hoisted above imports
const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  setToken: vi.fn(),
  getToken: vi.fn(),
}));

const mockSupabaseAuth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock('../../../../services/api/apiClient', () => ({
  apiClient: mockApiClient,
}));

vi.mock('../../../../services/supabase', () => ({
  supabase: {
    auth: mockSupabaseAuth,
  },
}));

import { realAuthService } from '../realAuthService';

describe('RealAuthService - Cookie-based Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyAuth', () => {
    it('should return null user when backend returns unsuccessful response', async () => {
      mockApiClient.get.mockResolvedValue({
        success: false,
        error: 'Not authenticated',
      });

      const result = await realAuthService.verifyAuth();

      expect(result.user).toBeNull();
      expect(result.error).toBeDefined();
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/verify');
      expect(mockApiClient.setToken).toHaveBeenCalledWith(null);
    });

    it('should verify auth and return user on successful response', async () => {
      const mockBackendResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'creator',
            nostr_pubkey: 'npub123456',
            emailVerified: true,
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockBackendResponse);

      const result = await realAuthService.verifyAuth();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/verify');
      expect(result.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'creator',
        nostr_pubkey: 'npub123456',
        email_verified: true,
        nostr_verified: true,
      });
    });

    it('should handle network error and clear token', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      const result = await realAuthService.verifyAuth();

      expect(result.user).toBeNull();
      expect(result.error).toBeDefined();
      expect(mockApiClient.setToken).toHaveBeenCalledWith(null);
    });
  });

  describe('authenticateNostr', () => {
    it('should successfully authenticate with NOSTR signature', async () => {
      const nostrSignature: NostrSignature = {
        pubkey: 'npub1234567890abcdef',
        challenge: 'challenge-123',
        signature: 'signature-abc',
        timestamp: Date.now(),
      };

      const mockBackendResponse = {
        success: true,
        data: {
          user: {
            id: 'nostr-user-789',
            email: 'npub1234@nostr.local',
            name: 'NOSTR User',
            role: 'supporter',
            nostr_pubkey: 'npub1234567890abcdef',
          },
          token: 'nostr-jwt-token',
        },
      };

      mockApiClient.post.mockResolvedValue(mockBackendResponse);

      const result = await realAuthService.authenticateNostr(nostrSignature);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/auth/authenticate',
        expect.objectContaining({
          nostr_pubkey: 'npub1234567890abcdef',
          challenge: 'challenge-123',
          signature: 'signature-abc',
        })
      );

      // Token stored via apiClient.setToken (not localStorage)
      expect(mockApiClient.setToken).toHaveBeenCalledWith('nostr-jwt-token');
      expect(result.success).toBe(true);
      expect(result.user?.nostr_verified).toBe(true);
      expect(result.user?.nostr_pubkey).toBe('npub1234567890abcdef');
    });

    it('should handle NOSTR authentication failure', async () => {
      const nostrSignature: NostrSignature = {
        pubkey: 'npub1234567890abcdef',
        challenge: 'challenge-123',
        signature: 'invalid-signature',
        timestamp: Date.now(),
      };

      const mockBackendResponse = {
        success: false,
        error: 'Invalid NOSTR signature',
      };

      mockApiClient.post.mockResolvedValue(mockBackendResponse);

      const result = await realAuthService.authenticateNostr(nostrSignature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid NOSTR signature');
    });
  });

  describe('generateNostrChallenge', () => {
    it('should successfully generate NOSTR challenge', async () => {
      const mockBackendResponse = {
        success: true,
        data: {
          challenge: 'nostr-challenge-abc123',
          timestamp: Date.now(),
          expires_at: Date.now() + 300000,
          message: 'Sign this challenge to authenticate',
        },
      };

      mockApiClient.post.mockResolvedValue(mockBackendResponse);

      const result = await realAuthService.generateNostrChallenge();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/challenge', {});
      expect(result.challenge).toBe('nostr-challenge-abc123');
      expect(result.error).toBeUndefined();
    });

    it('should handle challenge generation failure', async () => {
      const mockBackendResponse = {
        success: false,
        error: 'Unable to generate challenge',
      };

      mockApiClient.post.mockResolvedValue(mockBackendResponse);

      const result = await realAuthService.generateNostrChallenge();

      expect(result.error).toBe('Unable to generate challenge');
      expect(result.challenge).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear token via apiClient', async () => {
      mockApiClient.getToken.mockReturnValue('some-token');
      mockApiClient.post.mockResolvedValue({ success: true });

      await realAuthService.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout', {});
      expect(mockApiClient.setToken).toHaveBeenCalledWith(null);
    });

    it('should clear token even if backend logout fails', async () => {
      mockApiClient.getToken.mockReturnValue('failing-token');
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      await realAuthService.logout();

      expect(mockApiClient.setToken).toHaveBeenCalledWith(null);
    });

    it('should skip backend call if no token exists', async () => {
      mockApiClient.getToken.mockReturnValue(null);

      await realAuthService.logout();

      expect(mockApiClient.post).not.toHaveBeenCalled();
      expect(mockApiClient.setToken).toHaveBeenCalledWith(null);
    });
  });

  describe('signUpWithEmail', () => {
    const signupData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'securePassword123',
      role: 'creator' as const,
      terms_accepted: true,
    };

    it('should return requiresConfirmation when no session is returned (email confirmation required)', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'supabase-user-1',
            email: 'jane@example.com',
            email_confirmed_at: null,
            user_metadata: { name: 'Jane Doe', role: 'creator' },
          },
          session: null,
        },
        error: null,
      });

      const result = await realAuthService.signUpWithEmail(signupData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('jane@example.com');
      expect(result.user?.email_verified).toBe(false);
      expect(result.token).toBeUndefined();
      // apiClient.setToken should NOT have been called (no session)
      expect(mockApiClient.setToken).not.toHaveBeenCalled();
    });

    it('should return token when session is returned (email confirmation disabled)', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'supabase-user-2',
            email: 'jane@example.com',
            email_confirmed_at: '2026-03-30T00:00:00Z',
            user_metadata: { name: 'Jane Doe', role: 'creator' },
          },
          session: {
            access_token: 'supabase-access-token',
            refresh_token: 'supabase-refresh-token',
          },
        },
        error: null,
      });

      const result = await realAuthService.signUpWithEmail(signupData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email_verified).toBe(true);
      expect(result.token).toBe('supabase-access-token');
      expect(mockApiClient.setToken).toHaveBeenCalledWith('supabase-access-token');
    });

    it('should return error for duplicate email', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await realAuthService.signUpWithEmail(signupData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User already registered');
    });

    it('should handle unexpected exceptions during signup', async () => {
      mockSupabaseAuth.signUp.mockRejectedValue(new Error('Network failure'));

      const result = await realAuthService.signUpWithEmail(signupData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });
  });

  describe('signInWithEmail', () => {
    const credentials = {
      email: 'jane@example.com',
      password: 'securePassword123',
    };

    it('should return session and user on successful login', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'supabase-user-1',
            email: 'jane@example.com',
            email_confirmed_at: '2026-03-30T00:00:00Z',
            user_metadata: { name: 'Jane Doe', role: 'creator' },
          },
          session: {
            access_token: 'login-access-token',
            refresh_token: 'login-refresh-token',
          },
        },
        error: null,
      });

      const result = await realAuthService.signInWithEmail(credentials);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('jane@example.com');
      expect(result.user?.email_verified).toBe(true);
      expect(result.token).toBe('login-access-token');
      expect(mockApiClient.setToken).toHaveBeenCalledWith('login-access-token');
    });

    it('should return error for wrong password', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await realAuthService.signInWithEmail(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid login credentials');
    });

    it('should handle unexpected exceptions during login', async () => {
      mockSupabaseAuth.signInWithPassword.mockRejectedValue(new Error('Connection refused'));

      const result = await realAuthService.signInWithEmail(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('mapSupabaseUser', () => {
    it('should use email_confirmed_at for email_verified', async () => {
      // Test with confirmed email
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-confirmed',
            email: 'confirmed@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
            user_metadata: {},
          },
          session: { access_token: 'token-1', refresh_token: 'rt-1' },
        },
        error: null,
      });

      const confirmedResult = await realAuthService.signInWithEmail({
        email: 'confirmed@example.com',
        password: 'pass',
      });
      expect(confirmedResult.user?.email_verified).toBe(true);

      // Test with unconfirmed email (null)
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-unconfirmed',
            email: 'unconfirmed@example.com',
            email_confirmed_at: null,
            user_metadata: {},
          },
          session: { access_token: 'token-2', refresh_token: 'rt-2' },
        },
        error: null,
      });

      const unconfirmedResult = await realAuthService.signInWithEmail({
        email: 'unconfirmed@example.com',
        password: 'pass',
      });
      expect(unconfirmedResult.user?.email_verified).toBe(false);
    });
  });

  describe('Helper Methods', () => {
    it('should map backend roles correctly', async () => {
      const mockBackendResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'admin',
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockBackendResponse);

      const result = await realAuthService.verifyAuth();

      expect(result.user?.role).toBe('admin');
      expect(result.user?.permissions).toEqual([
        'content.create',
        'content.edit',
        'content.delete',
        'content.publish',
        'payments.receive',
        'payments.send',
        'admin.users',
        'admin.content',
        'admin.system',
      ]);
    });
  });
});
