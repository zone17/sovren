/**
 * Content Service Interfaces
 * Defines contracts for all content-related services in the Epic 005 implementation
 */

// ============================================================================
// Core Types
// ============================================================================

export interface ContentDraft {
  id?: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  category?: string;
  status?: 'draft' | 'ready' | 'scheduled' | 'published';
  visibility?: 'public' | 'private' | 'unlisted';
  publishAt?: Date;
  authorId: string;
  collaborators?: string[];
  mediaIds?: string[];
  allowComments?: boolean;
  featured?: boolean;
}

export interface Content extends ContentDraft {
  id: string;
  slug: string;
  metadata: ContentMetadata;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  deletedAt?: Date;
}

export interface ContentMetadata {
  wordCount: number;
  readingTime: number; // in minutes
  excerpt: string;
  hashtags: string[];
  language: string;
  hasMedia: boolean;
  lastModified: Date;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
}

export interface MediaFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface MediaAsset {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number; // for videos
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    type: string;
  }>;
}

// ============================================================================
// ContentCreationService Interface
// ============================================================================

export interface IContentCreationService {
  create(draft: ContentDraft): Promise<Content>;
  uploadMedia(file: MediaFile): Promise<MediaAsset>;
  validateContent(draft: ContentDraft): Promise<ValidationResult>;
  autosave(contentId: string, draft: Partial<ContentDraft>): Promise<void>;
  generateSlug(title: string): Promise<string>;
  extractMetadata(draft: ContentDraft): Promise<ContentMetadata>;
}

// ============================================================================
// ContentPublishingService Interface
// ============================================================================

export interface PublishOptions {
  immediate?: boolean;
  distributeToNostr?: boolean;
  crossPost?: string[]; // social media platforms
  notifySubscribers?: boolean;
}

export interface PublishedContent extends Content {
  publishedAt: Date;
  nostrEventId?: string;
  crossPostIds?: Record<string, string>;
}

export interface ScheduledContent extends Content {
  scheduledFor: Date;
  scheduleId: string;
}

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface IContentPublishingService {
  publish(contentId: string, options?: PublishOptions): Promise<PublishedContent>;
  schedule(contentId: string, publishAt: Date): Promise<ScheduledContent>;
  unpublish(contentId: string): Promise<void>;
  distributeToNostr(content: PublishedContent): Promise<NostrEvent>;
  cancelScheduled(scheduleId: string): Promise<void>;
  getScheduledContent(): Promise<ScheduledContent[]>;
}

// ============================================================================
// ContentModerationService Interface
// ============================================================================

// Import the comprehensive interface from dedicated file
export type { IContentModerationService } from './IContentModerationService';

// Legacy interfaces - deprecated, kept for backward compatibility
export interface ModerationResult {
  approved: boolean;
  score: number;
  flags: string[];
  reasons?: string[];
  requiresManualReview?: boolean;
}

export interface ModerationRule {
  id: string;
  name: string;
  type: 'keyword' | 'regex' | 'ai';
  pattern?: string;
  action: 'flag' | 'block' | 'review';
  severity: 'low' | 'medium' | 'high';
}

export interface Flag {
  id: string;
  contentId: string;
  reason: string;
  reportedBy?: string;
  createdAt: Date;
  status: 'pending' | 'reviewed' | 'resolved';
}

// ============================================================================
// ContentSearchService Interface
// ============================================================================

export interface SearchFilters {
  author?: string;
  category?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  status?: string[];
  visibility?: string[];
}

export interface SearchResult {
  results: Content[];
  total: number;
  page: number;
  pageSize: number;
  facets?: Record<string, FacetValue[]>;
  highlights?: Record<string, string[]>;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface Facet {
  field: string;
  size?: number;
}

export interface FacetedResult {
  facets: Record<string, FacetValue[]>;
  total: number;
}

export interface IContentSearchService {
  search(query: string, filters?: SearchFilters, page?: number, size?: number): Promise<SearchResult>;
  indexContent(content: Content): Promise<void>;
  removeFromIndex(contentId: string): Promise<void>;
  suggest(partial: string): Promise<string[]>;
  facetedSearch(facets: Facet[]): Promise<FacetedResult>;
  rebuildIndex(): Promise<void>;
}

// ============================================================================
// ContentRecommendationService Interface
// ============================================================================

export interface RecommendationOptions {
  limit?: number;
  excludeViewed?: boolean;
  timeRange?: 'day' | 'week' | 'month' | 'all';
  algorithm?: 'collaborative' | 'content-based' | 'hybrid';
}

export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface IContentRecommendationService {
  getRecommendations(userId: string, options?: RecommendationOptions): Promise<Content[]>;
  getSimilar(contentId: string, limit?: number): Promise<Content[]>;
  getTrending(period?: TimePeriod): Promise<Content[]>;
  personalizeFor(userId: string, content: Content[]): Promise<Content[]>;
  trainModel(interactions: UserInteraction[]): Promise<void>;
  getPopular(category?: string, limit?: number): Promise<Content[]>;
}

export interface UserInteraction {
  userId: string;
  contentId: string;
  action: 'view' | 'like' | 'share' | 'comment' | 'save';
  timestamp: Date;
  duration?: number; // viewing duration in seconds
}

// ============================================================================
// ContentAnalyticsService Interface
// ============================================================================

export interface EngagementEvent {
  contentId: string;
  userId?: string;
  type: 'view' | 'like' | 'share' | 'comment' | 'save' | 'click';
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ContentMetrics {
  contentId: string;
  views: number;
  uniqueViews: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  avgReadTime: number;
  completionRate: number;
  engagementRate: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AnalyticsReport {
  dateRange: DateRange;
  totalContent: number;
  totalViews: number;
  totalEngagement: number;
  topContent: Content[];
  contentByCategory: Record<string, number>;
  engagementByType: Record<string, number>;
  growthRate: number;
}

export interface IContentAnalyticsService {
  trackView(contentId: string, userId?: string, duration?: number): Promise<void>;
  trackEngagement(event: EngagementEvent): Promise<void>;
  getMetrics(contentId: string, dateRange?: DateRange): Promise<ContentMetrics>;
  generateReport(dateRange: DateRange, authorId?: string): Promise<AnalyticsReport>;
  getRealtimeStats(contentId: string): Promise<ContentMetrics>;
  exportAnalytics(format: 'json' | 'csv', dateRange: DateRange): Promise<Buffer>;
}

// ============================================================================
// ContentVersioningService Interface
// ============================================================================

export interface ContentVersion {
  id: string;
  contentId: string;
  versionNumber: number;
  delta?: any; // JSON Patch format
  snapshot?: Content;
  createdBy: string;
  createdAt: Date;
  message?: string; // Version message/comment
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  modified: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

export interface IContentVersioningService {
  createVersion(content: Content, message?: string): Promise<ContentVersion>;
  getVersions(contentId: string): Promise<ContentVersion[]>;
  getVersion(versionId: string): Promise<ContentVersion>;
  revert(contentId: string, versionId: string): Promise<Content>;
  compareVersions(versionId1: string, versionId2: string): Promise<VersionDiff>;
  mergeVersions(versionId1: string, versionId2: string): Promise<Content>;
  pruneOldVersions(contentId: string, keepLast: number): Promise<void>;
}