/**
 * Tests for Platform Connection Service
 * EPIC-009: OAuth flows and token encryption
 */

import { PlatformConnectionService } from '../PlatformConnectionService';
import { createMockChain } from '../../../test-utils/supabase-mock';

// Mock the crypto module
vi.mock('../crypto', () => ({
  encryptToken: vi.fn().mockReturnValue({
    encrypted: Buffer.from('encrypted'),
    iv: Buffer.from('iv-value-16bytes'),
    authTag: Buffer.from('authtag-16bytes!'),
  }),
  decryptToken: vi.fn().mockReturnValue('decrypted-access-token'),
  getEncryptionKey: vi.fn().mockReturnValue(Buffer.alloc(32, 'a')),
}));

describe('PlatformConnectionService', () => {
  let service: PlatformConnectionService;
  let mockDb: any;
  let mockLogger: any;
  let connectionsChain: any;
  let crossPostsChain: any;

  const creatorId = 'creator-pubkey-123';

  beforeEach(() => {
    // Set env vars for adapters
    process.env.MASTODON_CLIENT_ID = 'test-mastodon-id';
    process.env.MASTODON_CLIENT_SECRET = 'test-mastodon-secret';
    process.env.BLUESKY_CLIENT_ID = 'test-bluesky-id';
    process.env.BLUESKY_CLIENT_SECRET = 'test-bluesky-secret';
    process.env.API_BASE_URL = 'http://localhost:3001';

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    connectionsChain = createMockChain();
    crossPostsChain = createMockChain();

    mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'cross_posts') return crossPostsChain;
        return connectionsChain;
      }),
    };

    service = new PlatformConnectionService(mockDb, mockLogger);
  });

  afterEach(() => {
    delete process.env.MASTODON_CLIENT_ID;
    delete process.env.MASTODON_CLIENT_SECRET;
    delete process.env.BLUESKY_CLIENT_ID;
    delete process.env.BLUESKY_CLIENT_SECRET;
  });

  describe('initiateConnection', () => {
    it('should return an authorization URL for a supported platform', async () => {
      const result = await service.initiateConnection(creatorId, 'mastodon');

      expect(result.authorization_url).toBeDefined();
      expect(result.authorization_url).toContain('oauth/authorize');
      expect(result.authorization_url).toContain('state=');
    });

    it('should throw for unconfigured platform', async () => {
      delete process.env.MASTODON_CLIENT_ID;
      const freshService = new PlatformConnectionService(mockDb, mockLogger);

      await expect(freshService.initiateConnection(creatorId, 'mastodon')).rejects.toThrow(
        'Platform "mastodon" is not configured'
      );
    });

    it('should log OAuth flow initiation', async () => {
      await service.initiateConnection(creatorId, 'mastodon');

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PlatformConnectionService] OAuth flow initiated',
        expect.objectContaining({
          creatorId,
          platform: 'mastodon',
        })
      );
    });
  });

  describe('handleCallback', () => {
    it('should reject invalid state parameter', async () => {
      await expect(
        service.handleCallback('mastodon', 'auth-code', 'invalid-state')
      ).rejects.toThrow('Invalid or expired OAuth state parameter');
    });

    it('should log warning for invalid state (potential CSRF)', async () => {
      try {
        await service.handleCallback('mastodon', 'auth-code', 'bad-state');
      } catch {
        // Expected
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid OAuth state'),
        expect.any(Object)
      );
    });
  });

  describe('getStatus', () => {
    it('should return status for all platforms including disconnected ones', async () => {
      const mockConnections = [
        {
          platform: 'mastodon',
          platform_username: '@user@mastodon.social',
          connected_at: '2026-02-16T00:00:00Z',
          expires_at: null,
          status: 'connected',
          scopes: ['read', 'write'],
        },
      ];

      // getStatus calls: .from('platform_connections').select('*').eq('creator_id', ...)
      // The final .eq() resolves as a PromiseLike, so override it to resolve with data
      connectionsChain.eq.mockResolvedValue({ data: mockConnections, error: null });

      const result = await service.getStatus(creatorId);

      expect(result).toHaveLength(4); // All 4 platforms
      const mastodon = result.find((p: any) => p.platform === 'mastodon');
      expect(mastodon?.connected).toBe(true);
      expect(mastodon?.username).toBe('@user@mastodon.social');

      const twitter = result.find((p: any) => p.platform === 'twitter');
      expect(twitter?.connected).toBe(false);
      expect(twitter?.status).toBe('disconnected');
    });
  });

  describe('disconnect', () => {
    it('should delete connection from database', async () => {
      // disconnect() makes 3 DB calls in sequence:
      // 1. getDecryptedToken: .from('platform_connections').select().eq().eq().single()
      // 2. cross_posts update: .from('cross_posts').update().eq().eq().in()
      // 3. delete connection: .from('platform_connections').delete().eq().eq()

      // Build per-call chains to avoid chaining conflicts
      const tokenChain = createMockChain({
        access_token_encrypted: Buffer.from('enc'),
        token_iv: Buffer.from('iv-16bytes------'),
        token_auth_tag: Buffer.from('tag-16bytes-----'),
      });
      const updateChain = createMockChain();
      updateChain.in.mockResolvedValue({ error: null });
      const deleteChain = createMockChain();
      // First .eq() returns chain (for further chaining), second .eq() resolves (terminal)
      deleteChain.eq.mockReturnValueOnce(deleteChain).mockResolvedValueOnce({ error: null });

      let callCount = 0;
      mockDb.from = vi.fn().mockImplementation((table: string) => {
        callCount++;
        if (table === 'cross_posts') return updateChain;
        // First platform_connections call = getDecryptedToken, second = delete
        if (callCount <= 1) return tokenChain;
        return deleteChain;
      });

      await service.disconnect(creatorId, 'mastodon');

      expect(mockDb.from).toHaveBeenCalledWith('platform_connections');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PlatformConnectionService] Platform disconnected',
        expect.objectContaining({ creatorId, platform: 'mastodon' })
      );
    });
  });

  describe('getDecryptedToken', () => {
    it('should return decrypted access token', async () => {
      connectionsChain.single.mockResolvedValue({
        data: {
          access_token_encrypted: Buffer.from('encrypted'),
          token_iv: Buffer.from('iv'),
          token_auth_tag: Buffer.from('tag'),
        },
        error: null,
      });

      const token = await service.getDecryptedToken(creatorId, 'mastodon');
      expect(token).toBe('decrypted-access-token');
    });

    it('should throw if no connection found', async () => {
      connectionsChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      await expect(service.getDecryptedToken(creatorId, 'twitter')).rejects.toThrow(
        'No twitter connection found'
      );
    });
  });

  describe('refreshExpiringTokens', () => {
    it('should return 0 when no tokens need refreshing', async () => {
      connectionsChain.lt.mockResolvedValue({ data: [], error: null });

      const count = await service.refreshExpiringTokens();
      expect(count).toBe(0);
    });
  });
});
