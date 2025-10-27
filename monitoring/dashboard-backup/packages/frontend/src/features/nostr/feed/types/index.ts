/**
 * Feed/Timeline Type Definitions
 * Comprehensive types for NOSTR feed functionality
 */

import type { Event as NostrEvent } from 'nostr-tools';

/**
 * Feed sort options
 */
export type FeedSort = 'latest' | 'popular' | 'trending';

/**
 * Feed filter configuration
 */
export interface FeedFilters {
  /** Filter by author public keys */
  authors?: string[];
  /** Filter by hashtags (without #) */
  hashtags?: string[];
  /** Filter by mentions (public keys) */
  mentions?: string[];
  /** Filter events since this timestamp (Unix seconds) */
  since?: number;
  /** Filter events until this timestamp (Unix seconds) */
  until?: number;
  /** Event kinds to include (default: [1, 6, 7]) */
  kinds?: number[];
  /** Search query for content */
  search?: string;
}

/**
 * Engagement metrics for a feed event
 */
export interface FeedEventEngagement {
  /** Number of kind 7 reactions (likes) */
  reactions: number;
  /** Number of kind 6 reposts */
  reposts: number;
  /** Number of kind 1 replies */
  replies: number;
  /** Current user has reacted */
  isLikedByUser: boolean;
  /** Current user has reposted */
  isRepostedByUser: boolean;
}

/**
 * Enhanced feed event with metadata
 */
export interface FeedEvent {
  /** Original NOSTR event */
  event: NostrEvent;
  /** Engagement metrics */
  engagement: FeedEventEngagement;
  /** Author profile metadata (if available) */
  authorProfile?: {
    name?: string;
    picture?: string;
    nip05?: string;
    display_name?: string;
  };
  /** For kind 6 reposts, the original reposted event */
  repostedEvent?: NostrEvent;
  /** Parsed content with media/links extracted */
  parsedContent?: {
    text: string;
    images: string[];
    videos: string[];
    links: string[];
    mentions: string[];
    hashtags: string[];
  };
  /** Timestamp for sorting */
  timestamp: number;
}

/**
 * Feed state for subscription hook
 */
export interface FeedState {
  /** List of feed events */
  events: FeedEvent[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Has more events to load */
  hasMore: boolean;
  /** Current subscription ID */
  subscriptionId: string | null;
  /** Is subscribing to real-time updates */
  isSubscribed: boolean;
}

/**
 * Pagination state
 */
export interface PaginationState {
  /** Current page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Oldest timestamp loaded */
  oldestTimestamp: number | null;
  /** Is loading more */
  isLoadingMore: boolean;
  /** Has more pages */
  hasMore: boolean;
}

/**
 * Feed timeline props
 */
export interface FeedTimelineProps {
  /** Filter configuration */
  filters?: FeedFilters;
  /** Initial sort order */
  initialSort?: FeedSort;
  /** Enable real-time updates */
  autoUpdate?: boolean;
  /** Events per page */
  pageSize?: number;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Callback when event is clicked */
  onEventClick?: (event: FeedEvent) => void;
  /** Callback when profile is clicked */
  onProfileClick?: (pubkey: string) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Feed item props
 */
export interface FeedItemProps {
  /** Feed event data */
  feedEvent: FeedEvent;
  /** Current user's public key */
  currentUserPubkey?: string;
  /** Is condensed view (for replies) */
  condensed?: boolean;
  /** Callback when event is clicked */
  onClick?: (event: FeedEvent) => void;
  /** Callback when profile is clicked */
  onProfileClick?: (pubkey: string) => void;
  /** Callback when like button is clicked */
  onLike?: (event: NostrEvent) => void;
  /** Callback when repost button is clicked */
  onRepost?: (event: NostrEvent) => void;
  /** Callback when reply button is clicked */
  onReply?: (event: NostrEvent) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Feed filters component props
 */
export interface FeedFiltersProps {
  /** Current filters */
  filters: FeedFilters;
  /** Callback when filters change */
  onChange: (filters: FeedFilters) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Feed sort component props
 */
export interface FeedSortProps {
  /** Current sort order */
  currentSort: FeedSort;
  /** Callback when sort changes */
  onChange: (sort: FeedSort) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Feed empty state props
 */
export interface FeedEmptyProps {
  /** Custom message */
  message?: string;
  /** Show create post button */
  showCreateButton?: boolean;
  /** Callback when create button is clicked */
  onCreateClick?: () => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Hook return type for useFeedSubscription
 */
export interface UseFeedSubscriptionReturn extends FeedState {
  /** Subscribe to feed with filters */
  subscribe: (filters: FeedFilters) => void;
  /** Unsubscribe from current feed */
  unsubscribe: () => void;
  /** Refresh feed */
  refresh: () => void;
  /** Add optimistic event update */
  addOptimisticUpdate: (event: NostrEvent) => void;
}

/**
 * Hook return type for useFeedPagination
 */
export interface UseFeedPaginationReturn extends PaginationState {
  /** Load next page */
  loadMore: () => void;
  /** Reset pagination */
  reset: () => void;
}

/**
 * Hook return type for useFeedFilters
 */
export interface UseFeedFiltersReturn {
  /** Current filters */
  filters: FeedFilters;
  /** Update filters */
  updateFilters: (filters: Partial<FeedFilters>) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Add author filter */
  addAuthor: (pubkey: string) => void;
  /** Remove author filter */
  removeAuthor: (pubkey: string) => void;
  /** Add hashtag filter */
  addHashtag: (tag: string) => void;
  /** Remove hashtag filter */
  removeHashtag: (tag: string) => void;
  /** Set date range */
  setDateRange: (since?: number, until?: number) => void;
}

/**
 * Content parser result
 */
export interface ParsedContent {
  text: string;
  images: string[];
  videos: string[];
  links: string[];
  mentions: string[];
  hashtags: string[];
}

/**
 * Relay status for debugging
 */
export interface RelayStatus {
  url: string;
  connected: boolean;
  eventCount: number;
  lastEventTime: number | null;
}
