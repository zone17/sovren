/**
 * Mastodon Platform Adapter
 * EPIC-009: ActivityPub / Mastodon API integration
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
} from '@sovren/shared/types/distribution';
import type { IPlatformAdapter, PlatformAdapterConfig } from './IPlatformAdapter';

export class MastodonAdapter implements IPlatformAdapter {
  readonly platform: SupportedPlatform = 'mastodon';
  readonly constraints: ContentConstraints = {
    max_text_length: 500,
    max_images: 4,
    max_image_size_bytes: 10 * 1024 * 1024, // 10MB
    supported_image_formats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    supports_threads: false,
    supports_video: true,
    max_video_length_seconds: 60,
  };

  private readonly config: PlatformAdapterConfig;

  constructor(config: PlatformAdapterConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string, options?: { instance_url?: string }): string {
    const instanceUrl = options?.instance_url || 'https://mastodon.social';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: 'code',
      scope: 'read write push',
      state,
    });
    return `${instanceUrl}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    options?: { instance_url?: string }
  ): Promise<OAuthTokens> {
    const instanceUrl = options?.instance_url || 'https://mastodon.social';
    const response = await fetch(`${instanceUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.callbackUrl,
        grant_type: 'authorization_code',
        code,
        scope: 'read write push',
      }),
    });

    if (!response.ok) {
      throw new Error(`Mastodon token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: null, // Mastodon tokens don't expire by default
      expires_at: null,
      scopes: (data.scope || 'read write push').split(' '),
    };
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    // Mastodon tokens don't expire by default, no refresh needed
    throw new Error('Mastodon tokens do not support refresh');
  }

  async revokeTokens(accessToken: string): Promise<void> {
    // Mastodon doesn't have a standard revoke endpoint for all instances
    // The token is effectively revoked by deleting from our database
    void accessToken;
  }

  async publish(tokens: OAuthTokens, content: FormattedContent): Promise<PublishResult> {
    // In production, this would call the Mastodon API
    // For now, return a structured result for the queue worker
    const postId = `mastodon_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://mastodon.social/@user/${postId}`,
      published_at: new Date().toISOString(),
    };
  }

  async deletePost(tokens: OAuthTokens, platformPostId: string): Promise<void> {
    void tokens;
    void platformPostId;
  }

  async getMessages(tokens: OAuthTokens, since: string): Promise<PlatformMessage[]> {
    void tokens;
    void since;
    return [];
  }

  async sendReply(tokens: OAuthTokens, messageId: string, content: string): Promise<void> {
    void tokens;
    void messageId;
    void content;
  }

  async getMetrics(tokens: OAuthTokens): Promise<PlatformMetrics> {
    void tokens;
    return {
      followers: 0,
      following: 0,
      posts: 0,
      engagement_rate: 0,
      impressions_30d: 0,
    };
  }

  async getPostMetrics(tokens: OAuthTokens, postId: string): Promise<PostMetrics> {
    void tokens;
    void postId;
    return { views: 0, likes: 0, shares: 0, comments: 0, engagement_rate: 0 };
  }
}
