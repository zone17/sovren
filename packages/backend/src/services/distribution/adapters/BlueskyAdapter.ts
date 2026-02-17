/**
 * Bluesky Platform Adapter
 * EPIC-009: AT Protocol / Bluesky integration
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

export class BlueskyAdapter implements IPlatformAdapter {
  readonly platform: SupportedPlatform = 'bluesky';
  readonly constraints: ContentConstraints = {
    max_text_length: 300,
    max_images: 4,
    max_image_size_bytes: 1 * 1024 * 1024, // 1MB
    supported_image_formats: ['image/jpeg', 'image/png'],
    supports_threads: true,
    supports_video: false,
    max_video_length_seconds: 0,
  };

  private readonly config: PlatformAdapterConfig;

  constructor(config: PlatformAdapterConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: 'code',
      scope: 'atproto transition:generic',
      state,
      code_challenge_method: 'S256',
    });
    return `https://bsky.social/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://bsky.social/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.callbackUrl,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bluesky token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      scopes: ['atproto', 'transition:generic'],
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch('https://bsky.social/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bluesky token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      scopes: ['atproto', 'transition:generic'],
    };
  }

  async revokeTokens(accessToken: string): Promise<void> {
    void accessToken;
  }

  async publish(tokens: OAuthTokens, content: FormattedContent): Promise<PublishResult> {
    const postId = `bsky_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://bsky.app/profile/user/post/${postId}`,
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
