/**
 * Distribution Types
 * Shared type definitions for EPIC-009: Multi-Platform Hub
 */

// ============================================================================
// Platform Types
// ============================================================================

export type SupportedPlatform = 'mastodon' | 'bluesky' | 'twitter' | 'youtube';
export type AllPlatform = SupportedPlatform | 'nostr';

export type ConnectionStatus =
  | 'connected'
  | 'token_expiring'
  | 'token_expired'
  | 'error'
  | 'disconnected';

export interface PlatformStatus {
  platform: SupportedPlatform;
  connected: boolean;
  status: ConnectionStatus;
  username: string | null;
  connected_at: string | null;
  expires_at: string | null;
  scopes: string[];
}

// ============================================================================
// Cross-Post Types
// ============================================================================

export type CrossPostStatus =
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface CrossPostEntry {
  id: string;
  content_id: string;
  platform: SupportedPlatform;
  status: CrossPostStatus;
  platform_post_id: string | null;
  platform_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
}

// ============================================================================
// Repurposing Types
// ============================================================================

export type RepurposeFormatType = 'thread' | 'summary' | 'short_post' | 'video_description';

export interface RepurposedContent {
  id: string;
  source_content_id: string;
  platform: SupportedPlatform;
  format_type: RepurposeFormatType;
  text: string;
  character_count: number;
  character_limit: number;
  approved: boolean;
  backlink_url: string;
}

// ============================================================================
// Inbox Types
// ============================================================================

export type InboxMessageType = 'comment' | 'reply' | 'dm' | 'mention';

export interface InboxMessage {
  id: string;
  platform: AllPlatform;
  author: string;
  author_avatar_url: string | null;
  content: string;
  type: InboxMessageType;
  parent_post_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface PlatformOverview {
  total_followers: number;
  total_engagement_30d: number;
  platforms: PlatformMetricsSummary[];
  updated_at: string;
}

export interface PlatformMetricsSummary {
  platform: AllPlatform;
  followers: number;
  engagement_rate: number;
  impressions_30d: number;
  growth_30d: number;
}

export interface ContentComparison {
  platform: SupportedPlatform;
  platform_post_id: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  engagement_rate: number;
  published_at: string;
}

export interface PlatformROI {
  platform: AllPlatform;
  engagement_per_hour: number;
  total_engagement_30d: number;
  estimated_hours_30d: number;
  rank: number;
}

// ============================================================================
// Platform Adapter Types
// ============================================================================

export interface OAuthTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[];
}

export interface PublishResult {
  platform_post_id: string;
  url: string;
  published_at: string;
}

export interface PlatformMessage {
  id: string;
  platform: SupportedPlatform;
  author: string;
  content: string;
  type: InboxMessageType;
  parent_post_id: string | null;
  created_at: string;
  is_read: boolean;
}

export interface PlatformMetrics {
  followers: number;
  following: number;
  posts: number;
  engagement_rate: number;
  impressions_30d: number;
}

export interface ContentConstraints {
  max_text_length: number;
  max_images: number;
  max_image_size_bytes: number;
  supported_image_formats: string[];
  supports_threads: boolean;
  supports_video: boolean;
  max_video_length_seconds: number;
}

export interface FormattedContent {
  text: string;
  media_urls?: string[];
  thread_parts?: string[];
  backlink_url: string;
}

export interface PostMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  engagement_rate: number;
}

// ============================================================================
// Pagination
// ============================================================================

export interface DistributionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
