/**
 * Mastodon Platform Adapter
 * EPIC-009: ActivityPub / Mastodon API integration
 */

import type {
  SupportedPlatform,
  OAuthTokens,
  PublishResult,
  ContentConstraints,
  FormattedContent,
} from '@shared/types/distribution';
import type { PlatformAdapterConfig } from './IPlatformAdapter';
import { BasePlatformAdapter } from './BasePlatformAdapter';

export class MastodonAdapter extends BasePlatformAdapter {
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

  constructor(config: PlatformAdapterConfig) {
    super(config);
  }

  /**
   * Validates that an instance URL is safe to use in server-side requests.
   * Blocks SSRF attempts via private IPs, localhost, and non-HTTPS protocols.
   */
  private validateInstanceUrl(url: string): void {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('Instance URL must use HTTPS');
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    ) {
      throw new Error('Instance URL cannot point to localhost');
    }
    // Block private IP ranges
    const parts = hostname.split('.');
    if (parts.length === 4) {
      const first = parseInt(parts[0]);
      const second = parseInt(parts[1]);
      if (
        first === 10 ||
        first === 127 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254)
      ) {
        throw new Error('Instance URL cannot point to private IP range');
      }
    }
  }

  getAuthorizationUrl(state: string, options?: { instance_url?: string }): string {
    const instanceUrl = options?.instance_url || 'https://mastodon.social';
    this.validateInstanceUrl(instanceUrl);
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
    this.validateInstanceUrl(instanceUrl);
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

  async refreshTokens(
    _refreshToken: string,
    options?: { instance_url?: string }
  ): Promise<OAuthTokens> {
    if (options?.instance_url) {
      this.validateInstanceUrl(options.instance_url);
    }
    // Mastodon tokens don't expire by default, no refresh needed
    throw new Error('Mastodon tokens do not support refresh');
  }

  async publish(_tokens: OAuthTokens, _content: FormattedContent): Promise<PublishResult> {
    // In production, this would call the Mastodon API
    // For now, return a structured result for the queue worker
    const postId = `mastodon_${Date.now()}`;
    return {
      platform_post_id: postId,
      url: `https://mastodon.social/@user/${postId}`,
      published_at: new Date().toISOString(),
    };
  }
}
