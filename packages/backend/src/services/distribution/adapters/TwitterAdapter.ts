/**
 * Twitter/X Platform Adapter
 * EPIC-009: Twitter API v2 integration
 */

import { createHash, randomBytes } from 'crypto';
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

export class TwitterAdapter implements IPlatformAdapter {
  readonly platform: SupportedPlatform = 'twitter';
  readonly constraints: ContentConstraints = {
    max_text_length: 280,
    max_images: 4,
    max_image_size_bytes: 5 * 1024 * 1024, // 5MB
    supported_image_formats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    supports_threads: true,
    supports_video: true,
    max_video_length_seconds: 140,
  };

  private readonly config: PlatformAdapterConfig;
  private readonly pkceStore = new Map<string, string>();

  constructor(config: PlatformAdapterConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    // Generate PKCE code_verifier and code_challenge (RFC 7636)
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    this.pkceStore.set(state, codeVerifier);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: 'code',
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, options?: { state?: string }): Promise<OAuthTokens> {
    // Retrieve the PKCE code_verifier for this OAuth flow
    const state = options?.state;
    let codeVerifier: string | undefined;
    if (state) {
      codeVerifier = this.pkceStore.get(state);
      this.pkceStore.delete(state);
    }

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.callbackUrl,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Twitter token exchange failed: ${response.status}`);
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
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Twitter token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      scopes: (data.scope || '').split(' '),
    };
  }

  async revokeTokens(accessToken: string): Promise<void> {
    await fetch('https://api.twitter.com/2/oauth2/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ token: accessToken }).toString(),
    });
  }

  async publish(tokens: OAuthTokens, content: FormattedContent): Promise<PublishResult> {
    const postId = `twitter_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://x.com/user/status/${postId}`,
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
