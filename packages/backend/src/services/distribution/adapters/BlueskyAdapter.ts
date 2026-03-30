/**
 * Bluesky Platform Adapter
 * EPIC-009: AT Protocol / Bluesky integration
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

export class BlueskyAdapter extends BasePlatformAdapter {
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
      scope: 'atproto transition:generic',
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });
    return `https://bsky.social/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, options?: { state?: string }): Promise<OAuthTokens> {
    // Retrieve the PKCE code_verifier for this OAuth flow
    const state = options?.state;
    let codeVerifier: string | undefined;
    if (state) {
      codeVerifier = this.pkceStore.get(state);
      this.pkceStore.delete(state);
    }

    const response = await fetch('https://bsky.social/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.callbackUrl,
        grant_type: 'authorization_code',
        code,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Bluesky token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string) || null,
      expires_at: data.expires_in
        ? new Date(Date.now() + (data.expires_in as number) * 1000).toISOString()
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

    const data = (await response.json()) as Record<string, unknown>;
    return {
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string) || refreshToken,
      expires_at: data.expires_in
        ? new Date(Date.now() + (data.expires_in as number) * 1000).toISOString()
        : null,
      scopes: ['atproto', 'transition:generic'],
    };
  }

  async publish(_tokens: OAuthTokens, _content: FormattedContent): Promise<PublishResult> {
    const postId = `bsky_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://bsky.app/profile/user/post/${postId}`,
      published_at: new Date().toISOString(),
    };
  }
}
