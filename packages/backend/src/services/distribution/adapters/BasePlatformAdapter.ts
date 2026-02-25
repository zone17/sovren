/**
 * Base Platform Adapter
 * EPIC-009: Shared default implementations for platform adapter stubs
 */

import type {
  SupportedPlatform,
  OAuthTokens,
  PublishResult,
  PlatformMessage,
  PlatformMetrics,
  ContentConstraints,
  FormattedContent,
  PostMetrics,
} from '@shared/types/distribution';
import type { IPlatformAdapter, PlatformAdapterConfig } from './IPlatformAdapter';
import { TTLCache } from '../../../utils/ttl-cache';

/** TTL for PKCE verifiers: 10 minutes matches standard OAuth flow timeout */
const PKCE_TTL_MS = 10 * 60 * 1000;
const PKCE_MAX_ENTRIES = 1000;

export abstract class BasePlatformAdapter implements IPlatformAdapter {
  abstract readonly platform: SupportedPlatform;
  abstract readonly constraints: ContentConstraints;

  protected readonly config: PlatformAdapterConfig;
  /**
   * Bounded TTL cache for PKCE code_verifier values.
   * Entries expire after 10 minutes; max 1000 concurrent OAuth flows.
   */
  protected readonly pkceStore = new TTLCache<string, string>({
    maxSize: PKCE_MAX_ENTRIES,
    ttlMs: PKCE_TTL_MS,
  });

  constructor(config: PlatformAdapterConfig) {
    this.config = config;
  }

  /** Release the PKCE store's background cleanup timer. Call on adapter shutdown. */
  destroy(): void {
    this.pkceStore.destroy();
  }

  // OAuth — must be implemented per platform
  abstract getAuthorizationUrl(state: string, options?: { instance_url?: string }): string;
  abstract exchangeCodeForTokens(
    code: string,
    options?: { instance_url?: string; state?: string }
  ): Promise<OAuthTokens>;
  abstract refreshTokens(
    refreshToken: string,
    options?: { instance_url?: string }
  ): Promise<OAuthTokens>;

  async revokeTokens(_accessToken: string): Promise<void> {
    // Default no-op; override in adapters that support token revocation
  }

  async publish(_tokens: OAuthTokens, _content: FormattedContent): Promise<PublishResult> {
    const postId = `${this.platform}_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://${this.platform}.stub/${postId}`,
      published_at: new Date().toISOString(),
    };
  }

  async deletePost(_tokens: OAuthTokens, _platformPostId: string): Promise<void> {
    // Stub — override when platform API integration is implemented
  }

  async getMessages(_tokens: OAuthTokens, _since: string): Promise<PlatformMessage[]> {
    return [];
  }

  async sendReply(_tokens: OAuthTokens, _messageId: string, _content: string): Promise<void> {
    // Stub — override when platform API integration is implemented
  }

  async getMetrics(_tokens: OAuthTokens): Promise<PlatformMetrics> {
    return { followers: 0, following: 0, posts: 0, engagement_rate: 0, impressions_30d: 0 };
  }

  async getPostMetrics(_tokens: OAuthTokens, _postId: string): Promise<PostMetrics> {
    return { views: 0, likes: 0, shares: 0, comments: 0, engagement_rate: 0 };
  }
}
