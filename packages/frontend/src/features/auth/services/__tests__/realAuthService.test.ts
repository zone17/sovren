/**
 * 🧪 **REAL AUTH SERVICE TESTS - ELITE TDD**
 *
 * Elite Engineering Standards:
 * - Comprehensive test coverage for all auth flows
 * - Mock backend API responses
 * - Test both success and error scenarios
 * - NOSTR authentication testing
 * - Type safety verification
 */

import type { LoginCredentials, NostrSignature, SignupData } from '../../types';
import { realAuthService } from '../realAuthService';

// 🔧 **LOCAL STORAGE MOCK**
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });

// Helper to create a mock Response object
const createMockResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    clone: vi.fn().mockReturnThis(),
  }) as unknown as Response;

describe('🔐 RealAuthService - Elite Backend Integration', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('🔍 verifyAuth', () => {
    it('should return null user when no token exists', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await realAuthService.verifyAuth();

      expect(result).toEqual({ user: null });
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('auth_token');
    });

    it('should verify valid token and return user', async () => {
      const mockToken = 'valid-jwt-token';
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

      mockLocalStorage.getItem.mockReturnValue(mockToken);
      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, true));

      const result = await realAuthService.verifyAuth();

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/verify', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      });

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

    it('should handle invalid token and clear storage', async () => {
      const mockToken = 'invalid-token';

      mockLocalStorage.getItem.mockReturnValue(mockToken);
      fetchSpy.mockResolvedValue(createMockResponse({}, false, 401));

      const result = await realAuthService.verifyAuth();

      expect(result).toEqual({ user: null, error: 'Token invalid or expired' });
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('📧 login', () => {
    it('should successfully login with email/password', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'secure-password',
      };

      const mockBackendResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'supporter',
            emailVerified: true,
          },
          session: {
            accessToken: 'new-jwt-token',
          },
        },
      };

      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, true));

      const result = await realAuthService.login(credentials);

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'new-jwt-token');
      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
    });

    it('should handle login failure', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      const mockBackendResponse = {
        success: false,
        error: 'Invalid credentials',
      };

      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, false));

      const result = await realAuthService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('📝 signup', () => {
    it('should successfully register new user', async () => {
      const signupData: SignupData = {
        email: 'newuser@example.com',
        password: 'secure-password',
        name: 'New User',
        role: 'creator',
        terms_accepted: true,
      };

      const mockBackendResponse = {
        success: true,
        data: {
          user: {
            id: 'user-456',
            email: 'newuser@example.com',
            name: 'New User',
            emailVerified: false,
          },
          token: 'signup-jwt-token',
        },
      };

      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, true));

      const result = await realAuthService.signup(signupData);

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData),
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'signup-jwt-token');
      expect(result.success).toBe(true);
      expect(result.user?.name).toBe('New User');
    });
  });

  describe('🌐 authenticateNostr', () => {
    it('should successfully authenticate with NOSTR signature', async () => {
      const nostrSignature: NostrSignature = {
        pubkey: 'npub1234567890abcdef',
        challenge: 'challenge-123',
        signature: 'signature-abc',
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

      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, true));

      const result = await realAuthService.authenticateNostr(nostrSignature);

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nostr_pubkey: nostrSignature.pubkey,
          challenge: nostrSignature.challenge,
          signature: nostrSignature.signature,
          role: 'supporter',
        }),
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'nostr-jwt-token');
      expect(result.success).toBe(true);
      expect(result.user?.nostr_verified).toBe(true);
      expect(result.user?.nostr_pubkey).toBe('npub1234567890abcdef');
    });

    it('should handle NOSTR authentication failure', async () => {
      const nostrSignature: NostrSignature = {
        pubkey: 'npub1234567890abcdef',
        challenge: 'challenge-123',
        signature: 'invalid-signature',
      };

      const mockBackendResponse = {
        success: false,
        error: 'Invalid NOSTR signature',
      };

      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, false));

      const result = await realAuthService.authenticateNostr(nostrSignature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid NOSTR signature');
    });
  });

  describe('🔑 generateNostrChallenge', () => {
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

      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, true));

      const result = await realAuthService.generateNostrChallenge();

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(result.challenge).toBe('nostr-challenge-abc123');
      expect(result.error).toBeUndefined();
    });

    it('should handle challenge generation failure', async () => {
      const mockBackendResponse = {
        success: false,
        error: 'Unable to generate challenge',
      };

      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, false));

      const result = await realAuthService.generateNostrChallenge();

      expect(result.error).toBe('Unable to generate challenge');
      expect(result.challenge).toBeUndefined();
    });
  });

  describe('🚪 logout', () => {
    it('should successfully logout and clear token', async () => {
      const mockToken = 'logout-token';

      mockLocalStorage.getItem.mockReturnValue(mockToken);
      fetchSpy.mockResolvedValue(createMockResponse({ success: true }, true));

      await realAuthService.logout();

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should clear local storage even if backend logout fails', async () => {
      const mockToken = 'failing-token';

      mockLocalStorage.getItem.mockReturnValue(mockToken);
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await realAuthService.logout();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('🔧 Helper Methods', () => {
    it('should map backend roles correctly', async () => {
      // Test through the auth flow to verify role mapping
      const mockBackendResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'admin',
          },
          token: 'test-token',
        },
      };

      mockLocalStorage.getItem.mockReturnValue('test-token');
      fetchSpy.mockResolvedValue(createMockResponse(mockBackendResponse, true));

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
