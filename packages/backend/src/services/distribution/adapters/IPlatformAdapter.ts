/**
 * Platform Adapter Interface
 * EPIC-009: Abstract adapter for each external platform
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

export interface PlatformAdapterConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface IPlatformAdapter {
  readonly platform: SupportedPlatform;
  readonly constraints: ContentConstraints;

  // OAuth
  getAuthorizationUrl(state: string, options?: { instance_url?: string }): string;
  exchangeCodeForTokens(code: string, options?: { instance_url?: string }): Promise<OAuthTokens>;
  refreshTokens(refreshToken: string, options?: { instance_url?: string }): Promise<OAuthTokens>;
  revokeTokens(accessToken: string): Promise<void>;

  // Publishing
  publish(tokens: OAuthTokens, content: FormattedContent): Promise<PublishResult>;
  deletePost(tokens: OAuthTokens, platformPostId: string): Promise<void>;

  // Inbox
  getMessages(tokens: OAuthTokens, since: string): Promise<PlatformMessage[]>;
  sendReply(tokens: OAuthTokens, messageId: string, content: string): Promise<void>;

  // Analytics
  getMetrics(tokens: OAuthTokens): Promise<PlatformMetrics>;
  getPostMetrics(tokens: OAuthTokens, postId: string): Promise<PostMetrics>;
}
