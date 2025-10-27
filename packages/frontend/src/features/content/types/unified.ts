/**
 * 🎯 **UNIFIED CONTENT MANAGEMENT TYPES**
 *
 * Elite Engineering Standards:
 * ✅ Single source of truth for all content types
 * ✅ Zero type duplication across implementations
 * ✅ Comprehensive TypeScript safety
 * ✅ Runtime validation with Zod
 * ✅ API-first design with clear interfaces
 */

import { z } from 'zod';

// ==================== CORE CONTENT TYPES ====================

export const ContentStatusSchema = z.enum([
  'draft',
  'published',
  'archived',
  'scheduled',
  'under_review',
]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const ContentVisibilitySchema = z.enum([
  'public',
  'private',
  'subscribers',
  'supporters',
  'token-gated',
]);
export type ContentVisibility = z.infer<typeof ContentVisibilitySchema>;

export const ContentTypeSchema = z.enum([
  'article',
  'video',
  'audio',
  'course',
  'ebook',
  'image',
  'code',
  'poll',
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const CollectionTypeSchema = z.enum(['series', 'category', 'playlist', 'bundle', 'tag']);
export type CollectionType = z.infer<typeof CollectionTypeSchema>;

// ==================== CONTENT BLOCK TYPES ====================

export const ContentBlockTypeSchema = z.enum([
  'paragraph',
  'heading',
  'list',
  'quote',
  'code',
  'image',
  'video',
  'audio',
  'embed',
  'divider',
  'button',
  'table',
]);
export type ContentBlockType = z.infer<typeof ContentBlockTypeSchema>;

export interface ContentBlockBase {
  id: string;
  type: ContentBlockType;
  order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ParagraphBlock extends ContentBlockBase {
  type: 'paragraph';
  content: {
    text: string;
    formatting?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      code?: boolean;
      color?: string;
      backgroundColor?: string;
    };
  };
}

export interface HeadingBlock extends ContentBlockBase {
  type: 'heading';
  content: {
    text: string;
    level: 1 | 2 | 3 | 4 | 5 | 6;
    anchor?: string;
  };
}

export interface MediaBlock extends ContentBlockBase {
  type: 'image' | 'video' | 'audio';
  content: {
    url: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
    duration?: number;
    mimeType: string;
    size: number;
  };
}

export interface CodeBlock extends ContentBlockBase {
  type: 'code';
  content: {
    code: string;
    language: string;
    showLineNumbers?: boolean;
    highlightLines?: number[];
    filename?: string;
  };
}

export type ContentBlock = ParagraphBlock | HeadingBlock | MediaBlock | CodeBlock;

// ==================== CONTENT ITEM TYPES ====================

export interface ContentMetadata {
  seo_title?: string;
  seo_description?: string;
  og_image?: string;
  canonical_url?: string;
  schema_markup?: Record<string, any>;
  reading_time?: number;
  word_count?: number;
  language: string;
}

export interface ContentEngagement {
  view_count: number;
  like_count: number;
  comment_count: number;
  support_count: number;
  share_count: number;
  bookmark_count: number;
  total_earned_sats: number;
  engagement_rate: number;
  average_read_time?: number;
}

export interface ContentAIEnhancement {
  seo_optimized: boolean;
  readability_score: number;
  engagement_prediction: number;
  auto_translation_enabled: boolean;
  available_languages: string[];
  content_quality_score: number;
  suggested_improvements: string[];
  ai_generated_summary?: string;
  ai_tags?: string[];
  sentiment_score?: number;
}

export interface ContentCollaboration {
  editors: string[];
  reviewers: string[];
  edit_permissions: 'owner_only' | 'editors' | 'public_suggestions';
  review_status?: 'pending' | 'approved' | 'needs_changes';
  last_reviewed_by?: string;
  last_reviewed_at?: string;
  comments: CollaborationComment[];
  version_history: ContentVersion[];
}

export interface CollaborationComment {
  id: string;
  author_pubkey: string;
  content: string;
  block_id?: string;
  position?: { line: number; column: number };
  created_at: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
}

export interface ContentVersion {
  id: string;
  version_number: number;
  title: string;
  content_blocks: ContentBlock[];
  change_summary: string;
  author_pubkey: string;
  created_at: string;
  is_published: boolean;
  parent_version_id?: string;
}

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  excerpt?: string;
  content_blocks: ContentBlock[];
  status: ContentStatus;
  visibility: ContentVisibility;
  content_type: ContentType;
  creator_pubkey: string;

  // Content Organization
  tags: string[];
  categories: string[];
  collection_ids: string[];
  series_id?: string;
  episode_number?: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
  scheduled_at?: string;

  // Metadata & SEO
  metadata: ContentMetadata;
  featured_image_id?: string;

  // Engagement & Analytics
  engagement: ContentEngagement;

  // AI Enhancement
  ai_enhancement?: ContentAIEnhancement;

  // Collaboration
  collaboration?: ContentCollaboration;

  // Monetization
  is_premium: boolean;
  price_sats?: number;
  lightning_invoice?: string;

  // Decentralized Storage
  ipfs_hash?: string;
  arweave_id?: string;
  nostr_event_id?: string;

  // Version Control
  version: number;
  parent_version_id?: string;
}

// ==================== CONTENT COLLECTION TYPES ====================

export interface ContentCollectionItem {
  content_id: string;
  order_index: number;
  added_at: string;
  added_by: string;
  custom_title?: string;
  custom_description?: string;
}

export interface ContentCollection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: CollectionType;
  creator_pubkey: string;

  // Content Items
  content_items: ContentCollectionItem[];
  item_count: number;

  // Organization
  parent_collection_id?: string;
  subcollections: string[];
  tags: string[];

  // Visibility & Access
  is_public: boolean;
  visibility: ContentVisibility;
  access_control?: {
    editors: string[];
    viewers: string[];
    collaborators: string[];
  };

  // Metadata
  featured_image_id?: string;
  color_theme?: string;
  custom_fields?: Record<string, any>;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Analytics
  total_views: number;
  total_likes: number;
  subscriber_count: number;

  // Monetization
  is_premium: boolean;
  price_sats?: number;
}

// ==================== CONTENT SERIES TYPES ====================

export interface SeriesEpisode {
  id: string;
  content_id: string;
  episode_number: number;
  title: string;
  description?: string;
  duration?: number;
  is_free: boolean;
  prerequisites: string[];
  learning_objectives: string[];
  resources: SeriesResource[];
  completion_rate: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
}

export interface SeriesResource {
  id: string;
  title: string;
  type: 'link' | 'file' | 'reference';
  url: string;
  description?: string;
  is_downloadable: boolean;
}

export interface ContentSeries {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category: 'course' | 'tutorial' | 'workshop' | 'masterclass' | 'bootcamp';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  creator_pubkey: string;

  // Episodes
  episodes: SeriesEpisode[];
  episode_count: number;
  total_duration?: number;

  // Learning Management
  prerequisites: string[];
  learning_objectives: string[];
  completion_certificate: boolean;
  estimated_completion_time?: number;

  // Metadata
  featured_image_id?: string;
  trailer_video_id?: string;
  syllabus?: string;

  // Enrollment & Progress
  enrollment_count: number;
  completion_rate: number;
  average_rating: number;
  reviews_count: number;

  // Monetization
  is_premium: boolean;
  price_sats?: number;
  has_free_episodes: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;

  // Analytics
  total_views: number;
  total_revenue_sats: number;
}

// ==================== ANALYTICS & METRICS TYPES ====================

export interface ContentMetrics {
  content_id: string;
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  start_date: string;
  end_date: string;

  // View Metrics
  views: number;
  unique_views: number;
  average_view_duration: number;
  bounce_rate: number;

  // Engagement Metrics
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;

  // Revenue Metrics
  revenue_sats: number;
  support_count: number;
  subscription_conversions: number;

  // Performance Metrics
  load_time: number;
  error_rate: number;
  search_ranking?: number;

  // Geographic & Demographic Data
  top_countries: Array<{ country: string; views: number }>;
  top_cities: Array<{ city: string; views: number }>;
  device_types: Array<{ device: string; views: number }>;
  referral_sources: Array<{ source: string; views: number }>;
}

export interface AnalyticsTimeRange {
  start: string;
  end: string;
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  timezone: string;
}

export interface AnalyticsFilters {
  content_types?: ContentType[];
  content_ids?: string[];
  creator_pubkeys?: string[];
  tags?: string[];
  collections?: string[];
  time_range: AnalyticsTimeRange;
  countries?: string[];
  devices?: string[];
  referral_sources?: string[];
}

// ==================== EDITOR STATE TYPES ====================

export interface AIAssistantState {
  enabled: boolean;
  model: string;
  available_models: AIModel[];
  usage_quota: {
    used: number;
    limit: number;
    reset_date: string;
  };
  suggestions: AISuggestion[];
  processing: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'local';
  capabilities: string[];
  cost_per_token: number;
  max_tokens: number;
  specialized_for: string[];
}

export interface AISuggestion {
  id: string;
  type: 'improvement' | 'completion' | 'translation' | 'seo' | 'grammar';
  content: string;
  confidence: number;
  block_id?: string;
  position?: { start: number; end: number };
  created_at: string;
  applied: boolean;
}

export interface EditorState {
  mode: 'create' | 'edit' | 'view' | 'preview';
  current_content: ContentItem | null;
  is_dirty: boolean;
  auto_save_enabled: boolean;
  auto_save_interval: number;
  last_saved: string | null;

  // Collaboration
  collaborative_mode: boolean;
  current_collaborators: string[];
  live_cursors: Array<{
    user_pubkey: string;
    position: { block_id: string; offset: number };
    color: string;
  }>;

  // AI Assistant
  ai_assistant: AIAssistantState;

  // UI State
  sidebar_open: boolean;
  active_panel: 'blocks' | 'ai' | 'media' | 'settings' | 'collaboration';
  selected_block_id?: string;
  is_fullscreen: boolean;

  // History & Undo/Redo
  history: ContentItem[];
  history_index: number;
  max_history_size: number;
}

// ==================== UNIFIED CMS STATE ====================

export interface UnifiedCMSState {
  // Core Content Management
  content: {
    items: ContentItem[];
    current_item: ContentItem | null;
    selected_items: string[];
    filters: ContentFilters;
    pagination: PaginationState;
    search_query?: string;
    search_results?: ContentItem[];
  };

  // Collections & Organization
  collections: {
    items: ContentCollection[];
    current_collection: ContentCollection | null;
    selected_collection: string | null;
    types: CollectionType[];
  };

  // Series Management
  series: {
    items: ContentSeries[];
    current_series: ContentSeries | null;
    episodes: SeriesEpisode[];
    current_episode: SeriesEpisode | null;
  };

  // Editor State
  editor: EditorState;

  // Analytics & Metrics
  analytics: {
    metrics: ContentMetrics[];
    time_range: AnalyticsTimeRange;
    filters: AnalyticsFilters;
    loading: boolean;
    cache: Map<string, ContentMetrics[]>;
  };

  // UI State
  ui: {
    active_view: 'library' | 'editor' | 'collections' | 'series' | 'analytics';
    sidebar_open: boolean;
    selected_tab: string;
    theme: 'light' | 'dark' | 'auto';
    layout: 'grid' | 'list' | 'table';
    mobile_nav_open: boolean;
  };

  // Loading & Error States
  loading: {
    content: boolean;
    collections: boolean;
    series: boolean;
    analytics: boolean;
    search: boolean;
  };

  error: {
    content: string | null;
    collections: string | null;
    series: string | null;
    analytics: string | null;
    search: string | null;
  };

  // Performance & Caching
  cache: {
    content_items: Map<string, ContentItem>;
    collections: Map<string, ContentCollection>;
    series: Map<string, ContentSeries>;
    analytics: Map<string, ContentMetrics[]>;
    last_updated: string;
  };
}

// ==================== API TYPES ====================

export interface ContentFilters {
  status?: ContentStatus[];
  visibility?: ContentVisibility[];
  content_type?: ContentType[];
  creator_pubkey?: string;
  tags?: string[];
  categories?: string[];
  collections?: string[];
  series_id?: string;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  is_premium?: boolean;
  has_lightning_invoice?: boolean;
  search_query?: string;
  sort_by?: 'created_at' | 'updated_at' | 'published_at' | 'title' | 'views' | 'likes' | 'revenue';
  sort_order?: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ContentResponse {
  items: ContentItem[];
  pagination: PaginationState;
  filters: ContentFilters;
}

export interface SearchQuery {
  query: string;
  filters?: ContentFilters;
  facets?: string[];
  highlight?: boolean;
  fuzzy?: boolean;
  boost_fields?: Record<string, number>;
}

export interface SearchResults {
  items: ContentItem[];
  total: number;
  facets?: Record<string, Array<{ value: string; count: number }>>;
  suggestions?: string[];
  query_time: number;
}

// ==================== COMPONENT PROP TYPES ====================

export interface ContentManagementHubProps {
  initial_view?: 'library' | 'editor' | 'collections' | 'series' | 'analytics';
  user_id: string;
  permissions: ContentPermissions;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export interface ContentPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  publish: boolean;
  collaborate: boolean;
  analyze: boolean;
  moderate: boolean;
  admin: boolean;
}

export interface BulkOperation {
  operation:
    | 'delete'
    | 'publish'
    | 'archive'
    | 'update_tags'
    | 'move_to_collection'
    | 'update_visibility';
  content_ids: string[];
  parameters?: Record<string, any>;
  dry_run?: boolean;
}

export interface BulkOperationResult {
  success: boolean;
  affected_count: number;
  errors: Array<{ content_id: string; error: string }>;
  warnings?: Array<{ content_id: string; warning: string }>;
}

// ==================== VALIDATION SCHEMAS ====================

export const ContentItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  content_blocks: z.array(z.any()), // TODO: Add proper ContentBlock schema
  status: ContentStatusSchema,
  visibility: ContentVisibilitySchema,
  content_type: ContentTypeSchema,
  creator_pubkey: z.string().min(1),
  tags: z.array(z.string()),
  categories: z.array(z.string()),
  collection_ids: z.array(z.string().uuid()),
  is_premium: z.boolean(),
  price_sats: z.number().positive().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  published_at: z.string().datetime().optional(),
});

export const ContentCollectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  type: CollectionTypeSchema,
  creator_pubkey: z.string().min(1),
  is_public: z.boolean(),
  visibility: ContentVisibilitySchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ContentSeriesSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['course', 'tutorial', 'workshop', 'masterclass', 'bootcamp']),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  creator_pubkey: z.string().min(1),
  is_premium: z.boolean(),
  price_sats: z.number().positive().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Export all schemas for runtime validation
export const ValidationSchemas = {
  ContentItem: ContentItemSchema,
  ContentCollection: ContentCollectionSchema,
  ContentSeries: ContentSeriesSchema,
} as const;
