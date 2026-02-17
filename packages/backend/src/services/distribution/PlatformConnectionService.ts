/**
 * Platform Connection Service
 * EPIC-009: OAuth flows, token encryption, token refresh
 *
 * SECURITY:
 * - All tokens encrypted at rest with AES-256-GCM
 * - OAuth state parameter validated for CSRF protection
 * - No tokens in logs — only encrypted blobs stored
 */

import { randomBytes } from 'crypto';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';
import type { IPlatformAdapter } from './adapters/IPlatformAdapter';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { PlatformStatus, SupportedPlatform, OAuthTokens } from '@sovren/shared/types/distribution';
import { encryptToken, decryptToken, getEncryptionKey } from './crypto';
import { MastodonAdapter } from './adapters/MastodonAdapter';
import { BlueskyAdapter } from './adapters/BlueskyAdapter';
import { TwitterAdapter } from './adapters/TwitterAdapter';
import { YouTubeAdapter } from './adapters/YouTubeAdapter';

// In-memory state store for OAuth CSRF protection
// In production, use Redis-backed session store
const oauthStateStore = new Map<string, { creatorId: string; platform: SupportedPlatform; expiresAt: number }>();

// Clean up expired state tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthStateStore) {
    if (value.expiresAt < now) {
      oauthStateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export class PlatformConnectionService implements IPlatformConnectionService {
  private readonly adapters: Map<SupportedPlatform, IPlatformAdapter>;
  private readonly logger: ILogger;
  private readonly db: any; // Supabase client

  constructor(db: any, logger: ILogger) {
    this.db = db;
    this.logger = logger;

    // Initialize platform adapters
    this.adapters = new Map();

    const callbackBase = process.env.API_BASE_URL || 'http://localhost:3001';

    if (process.env.MASTODON_CLIENT_ID) {
      this.adapters.set('mastodon', new MastodonAdapter({
        clientId: process.env.MASTODON_CLIENT_ID!,
        clientSecret: process.env.MASTODON_CLIENT_SECRET!,
        callbackUrl: `${callbackBase}/api/v2/platforms/callback/mastodon`,
      }));
    }

    if (process.env.BLUESKY_CLIENT_ID) {
      this.adapters.set('bluesky', new BlueskyAdapter({
        clientId: process.env.BLUESKY_CLIENT_ID!,
        clientSecret: process.env.BLUESKY_CLIENT_SECRET!,
        callbackUrl: `${callbackBase}/api/v2/platforms/callback/bluesky`,
      }));
    }

    if (process.env.TWITTER_CLIENT_ID) {
      this.adapters.set('twitter', new TwitterAdapter({
        clientId: process.env.TWITTER_CLIENT_ID!,
        clientSecret: process.env.TWITTER_CLIENT_SECRET!,
        callbackUrl: `${callbackBase}/api/v2/platforms/callback/twitter`,
      }));
    }

    if (process.env.YOUTUBE_CLIENT_ID) {
      this.adapters.set('youtube', new YouTubeAdapter({
        clientId: process.env.YOUTUBE_CLIENT_ID!,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
        callbackUrl: `${callbackBase}/api/v2/platforms/callback/youtube`,
      }));
    }
  }

  getAdapter(platform: SupportedPlatform): IPlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform "${platform}" is not configured. Check environment variables.`);
    }
    return adapter;
  }

  async initiateConnection(
    creatorId: string,
    platform: SupportedPlatform,
    options?: { instance_url?: string; scopes?: string[] }
  ): Promise<{ authorization_url: string }> {
    const adapter = this.getAdapter(platform);

    // Generate CSRF state token
    const state = randomBytes(32).toString('hex');
    oauthStateStore.set(state, {
      creatorId,
      platform,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minute expiry
    });

    const authorization_url = adapter.getAuthorizationUrl(state, options);

    this.logger.info('[PlatformConnectionService] OAuth flow initiated', {
      creatorId,
      platform,
      // SECURITY: Never log the state token value in production
    });

    return { authorization_url };
  }

  async handleCallback(
    platform: SupportedPlatform,
    code: string,
    state: string
  ): Promise<{ creator_id: string; platform: SupportedPlatform }> {
    // Validate CSRF state token
    const stateData = oauthStateStore.get(state);
    if (!stateData) {
      this.logger.warn('[PlatformConnectionService] Invalid OAuth state parameter — potential CSRF', {
        platform,
      });
      throw new Error('Invalid or expired OAuth state parameter');
    }

    if (stateData.platform !== platform) {
      throw new Error('Platform mismatch in OAuth callback');
    }

    if (stateData.expiresAt < Date.now()) {
      oauthStateStore.delete(state);
      throw new Error('OAuth state parameter has expired');
    }

    // Remove used state token (one-time use)
    oauthStateStore.delete(state);

    const adapter = this.getAdapter(platform);
    const tokens = await adapter.exchangeCodeForTokens(code);

    // Encrypt tokens before storage
    await this.storeEncryptedTokens(stateData.creatorId, platform, tokens);

    this.logger.info('[PlatformConnectionService] Platform connected successfully', {
      creatorId: stateData.creatorId,
      platform,
    });

    return { creator_id: stateData.creatorId, platform };
  }

  async disconnect(creatorId: string, platform: SupportedPlatform): Promise<void> {
    // Try to revoke tokens on the external platform
    try {
      const accessToken = await this.getDecryptedToken(creatorId, platform);
      const adapter = this.getAdapter(platform);
      await adapter.revokeTokens(accessToken);
    } catch {
      // If revocation fails, still delete from our database
      this.logger.warn('[PlatformConnectionService] Token revocation failed, proceeding with disconnect', {
        creatorId,
        platform,
      });
    }

    // Delete connection from database
    const { error } = await this.db
      .from('platform_connections')
      .delete()
      .eq('creator_id', creatorId)
      .eq('platform', platform);

    if (error) {
      throw error;
    }

    this.logger.info('[PlatformConnectionService] Platform disconnected', {
      creatorId,
      platform,
    });
  }

  async getStatus(creatorId: string): Promise<PlatformStatus[]> {
    const { data, error } = await this.db
      .from('platform_connections')
      .select('platform, platform_username, connected_at, expires_at, status, scopes')
      .eq('creator_id', creatorId);

    if (error) {
      throw error;
    }

    const allPlatforms: SupportedPlatform[] = ['mastodon', 'bluesky', 'twitter', 'youtube'];

    return allPlatforms.map((platform) => {
      const connection = (data || []).find((c: any) => c.platform === platform);
      if (connection) {
        return {
          platform,
          connected: connection.status === 'connected' || connection.status === 'token_expiring',
          status: connection.status,
          username: connection.platform_username,
          connected_at: connection.connected_at,
          expires_at: connection.expires_at,
          scopes: connection.scopes || [],
        };
      }
      return {
        platform,
        connected: false,
        status: 'disconnected' as const,
        username: null,
        connected_at: null,
        expires_at: null,
        scopes: [],
      };
    });
  }

  async getDecryptedToken(creatorId: string, platform: SupportedPlatform): Promise<string> {
    const { data, error } = await this.db
      .from('platform_connections')
      .select('access_token_encrypted, token_iv, token_auth_tag')
      .eq('creator_id', creatorId)
      .eq('platform', platform)
      .single();

    if (error || !data) {
      throw new Error(`No ${platform} connection found for creator`);
    }

    const key = getEncryptionKey();
    return decryptToken(
      Buffer.from(data.access_token_encrypted),
      key,
      Buffer.from(data.token_iv),
      Buffer.from(data.token_auth_tag)
    );
  }

  async refreshExpiringTokens(): Promise<number> {
    // Find tokens expiring within the next hour
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data, error } = await this.db
      .from('platform_connections')
      .select('id, creator_id, platform, refresh_token_encrypted, token_iv, token_auth_tag')
      .eq('status', 'connected')
      .not('expires_at', 'is', null)
      .lt('expires_at', oneHourFromNow);

    if (error || !data || data.length === 0) {
      return 0;
    }

    let refreshedCount = 0;

    for (const connection of data) {
      try {
        if (!connection.refresh_token_encrypted) {
          continue;
        }

        const key = getEncryptionKey();
        const refreshToken = decryptToken(
          Buffer.from(connection.refresh_token_encrypted),
          key,
          Buffer.from(connection.token_iv),
          Buffer.from(connection.token_auth_tag)
        );

        const adapter = this.getAdapter(connection.platform);
        const newTokens = await adapter.refreshTokens(refreshToken);

        await this.storeEncryptedTokens(connection.creator_id, connection.platform, newTokens);
        refreshedCount++;

        this.logger.info('[PlatformConnectionService] Token refreshed', {
          creatorId: connection.creator_id,
          platform: connection.platform,
        });
      } catch (err) {
        this.logger.error('[PlatformConnectionService] Token refresh failed', {
          creatorId: connection.creator_id,
          platform: connection.platform,
          error: (err as Error).message,
        });

        // Mark connection as expired
        await this.db
          .from('platform_connections')
          .update({ status: 'token_expired', error_message: 'Token refresh failed' })
          .eq('id', connection.id);
      }
    }

    return refreshedCount;
  }

  private async storeEncryptedTokens(
    creatorId: string,
    platform: SupportedPlatform,
    tokens: OAuthTokens
  ): Promise<void> {
    const key = getEncryptionKey();

    // Encrypt access token
    const accessEncrypted = encryptToken(tokens.access_token, key);

    // Encrypt refresh token if available
    let refreshEncrypted = null;
    if (tokens.refresh_token) {
      refreshEncrypted = encryptToken(tokens.refresh_token, key);
    }

    const row: any = {
      creator_id: creatorId,
      platform,
      access_token_encrypted: accessEncrypted.encrypted,
      token_iv: accessEncrypted.iv,
      token_auth_tag: accessEncrypted.authTag,
      refresh_token_encrypted: refreshEncrypted?.encrypted || null,
      scopes: tokens.scopes,
      expires_at: tokens.expires_at,
      status: 'connected',
      last_refreshed_at: new Date().toISOString(),
      error_message: null,
    };

    // Upsert: update if same creator+platform already exists
    const { error } = await this.db
      .from('platform_connections')
      .upsert(row, { onConflict: 'creator_id,platform' });

    if (error) {
      throw error;
    }
  }
}
