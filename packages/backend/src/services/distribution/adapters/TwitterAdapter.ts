/**
 * Twitter/X Platform Adapter
 * EPIC-009: Twitter API v2 integration
 */

import { createHash, randomBytes } from 'crypto';
import type {
  SupportedPlatform,
  OAuthTokens,
  PublishResult,
  ContentConstraints,
  FormattedContent,
} from '@shared/types/distribution';
import type { PlatformAdapterConfig } from './IPlatformAdapter';
import { BasePlatformAdapter } from './BasePlatformAdapter';

export class TwitterAdapter extends BasePlatformAdapter {
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

  constructor(config: PlatformAdapterConfig) {
    super(config);
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

    const data = (await response.json()) as Record<string, unknown>;
    return {
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string) || null,
      expires_at: data.expires_in
        ? new Date(Date.now() + (data.expires_in as number) * 1000).toISOString()
        : null,
      scopes: ((data.scope as string) || '').split(' '),
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

    const data = (await response.json()) as Record<string, unknown>;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      scopes: ((data.scope as string) || '').split(' '),
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

  async publish(_tokens: OAuthTokens, _content: FormattedContent): Promise<PublishResult> {
    const postId = `twitter_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://x.com/user/status/${postId}`,
      published_at: new Date().toISOString(),
    };
  }
}
