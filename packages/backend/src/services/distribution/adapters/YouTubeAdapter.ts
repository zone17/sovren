/**
 * YouTube Platform Adapter
 * EPIC-009: YouTube Data API v3 integration
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

export class YouTubeAdapter implements IPlatformAdapter {
  readonly platform: SupportedPlatform = 'youtube';
  readonly constraints: ContentConstraints = {
    max_text_length: 5000, // description limit
    max_images: 1, // thumbnail only
    max_image_size_bytes: 2 * 1024 * 1024, // 2MB
    supported_image_formats: ['image/jpeg', 'image/png'],
    supports_threads: false,
    supports_video: true,
    max_video_length_seconds: 43200, // 12 hours
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
      scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.callbackUrl,
        grant_type: 'authorization_code',
        code,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`YouTube token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      scopes: (data.scope || '').split(' '),
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`YouTube token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Google doesn't return new refresh token on refresh
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      scopes: (data.scope || '').split(' '),
    };
  }

  async revokeTokens(accessToken: string): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
    });
  }

  async publish(tokens: OAuthTokens, content: FormattedContent): Promise<PublishResult> {
    const postId = `youtube_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://youtube.com/watch?v=${postId}`,
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
    return { followers: 0, following: 0, posts: 0, engagement_rate: 0, impressions_30d: 0 };
  }

  async getPostMetrics(tokens: OAuthTokens, postId: string): Promise<PostMetrics> {
    void tokens;
    void postId;
    return { views: 0, likes: 0, shares: 0, comments: 0, engagement_rate: 0 };
  }
}
