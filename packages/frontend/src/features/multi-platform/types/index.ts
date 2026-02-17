// Multi-Platform Hub Feature Types — re-exported from @sovren/shared with frontend-only additions

export type {
  SupportedPlatform,
  AllPlatform,
  ConnectionStatus,
  PlatformStatus,
  CrossPostStatus,
  CrossPostEntry,
  RepurposeFormatType,
  RepurposedContent,
  InboxMessageType,
  InboxMessage,
  PlatformOverview,
  PlatformMetricsSummary,
  ContentComparison,
  PlatformROI,
  DistributionPagination,
} from '@sovren/shared/types/distribution';

// --- Frontend-only types (UI state, form payloads, component props) ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Platform filter for inbox queries */
export type InboxPlatformFilter = 'all' | 'mastodon' | 'bluesky' | 'twitter' | 'youtube' | 'nostr';

/** Status filter for inbox queries */
export type InboxStatusFilter = 'all' | 'unread' | 'archived';

/** Payload for publishing content to platforms */
export interface PublishPayload {
  content_id: string;
  platforms: Array<'mastodon' | 'bluesky' | 'twitter' | 'youtube'>;
  schedule?: Record<string, string>;
  repurposed_version_ids?: Record<string, string>;
}

/** Payload for repurposing content */
export interface RepurposePayload {
  content_id: string;
  platforms: Array<'mastodon' | 'bluesky' | 'twitter' | 'youtube'>;
}

/** Payload for replying to an inbox message */
export interface ReplyPayload {
  content: string;
}

/** Payload for batch inbox actions */
export interface BatchActionPayload {
  message_ids: string[];
  action: 'mark_read' | 'mark_unread' | 'archive';
}

/** Platform display metadata */
export interface PlatformDisplayInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  charLimit: number;
}

export const PLATFORM_DISPLAY: Record<string, PlatformDisplayInfo> = {
  mastodon: { id: 'mastodon', name: 'Mastodon', icon: 'mastodon', color: '#6364FF', charLimit: 500 },
  bluesky: { id: 'bluesky', name: 'Bluesky', icon: 'bluesky', color: '#0085FF', charLimit: 300 },
  twitter: { id: 'twitter', name: 'X (Twitter)', icon: 'twitter', color: '#1DA1F2', charLimit: 280 },
  youtube: { id: 'youtube', name: 'YouTube', icon: 'youtube', color: '#FF0000', charLimit: 5000 },
  nostr: { id: 'nostr', name: 'NOSTR', icon: 'nostr', color: '#8B5CF6', charLimit: 0 },
};
