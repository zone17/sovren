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

import type { NostrSignature } from '../../types';
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

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/verify'),
        expect.objectContaining({ method: 'GET' })
      );

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

      expect(result.user).toBeNull();
      expect(result.error).toBeDefined();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
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

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/authenticate'),
        expect.objectContaining({ method: 'POST' })
      );

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

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/challenge'),
        expect.objectContaining({ method: 'POST' })
      );

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

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({ method: 'POST' })
      );

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
