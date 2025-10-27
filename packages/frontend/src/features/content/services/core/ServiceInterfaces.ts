/**
 * 📋 **SERVICE INTERFACES - CONTRACT DEFINITIONS**
 *
 * Elite Engineering Standards:
 * ✅ Interface segregation principle (ISP)
 * ✅ Clear contract definitions with comprehensive types
 * ✅ Service lifecycle and health monitoring interfaces
 * ✅ Performance monitoring and metrics interfaces
 * ✅ Error handling and recovery interfaces
 * ✅ Extensibility through composition patterns
 */

import type { ContentBlock, ContentItem, MediaAsset } from '../../../../types/content';

// ==================== CORE SERVICE INTERFACES ====================

/**
 * Base interface for all services
 */
export interface IService {
  readonly name: string;
  readonly version: string;
  isHealthy(): Promise<boolean>;
  getMetrics(): Promise<ServiceMetrics>;
  dispose?(): Promise<void>;
}

/**
 * Service health and metrics information
 */
export interface ServiceMetrics {
  name: string;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date | null;
  memoryUsage?: number;
  customMetrics?: Record<string, any>;
}

/**
 * Service error information
 */
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  serviceName: string;
  operation: string;
  retryable: boolean;
}

/**
 * Request context for service operations
 */
export interface ServiceContext {
  userId?: string;
  userRole?: string;
  requestId: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

// ==================== CONTENT SERVICE INTERFACES ====================

/**
 * Content CRUD operations interface
 */
export interface IContentCrudService extends IService {
  create(data: CreateContentRequest, context: ServiceContext): Promise<ContentItem>;
  getById(id: string, context: ServiceContext): Promise<ContentItem | null>;
  update(id: string, data: UpdateContentRequest, context: ServiceContext): Promise<ContentItem>;
  delete(id: string, context: ServiceContext): Promise<void>;
  bulkCreate(items: CreateContentRequest[], context: ServiceContext): Promise<ContentItem[]>;
  bulkUpdate(updates: BulkUpdateRequest[], context: ServiceContext): Promise<ContentItem[]>;
  bulkDelete(ids: string[], context: ServiceContext): Promise<void>;
}

/**
 * Content query and filtering interface
 */
export interface IContentQueryService extends IService {
  search(query: ContentSearchQuery, context: ServiceContext): Promise<ContentSearchResult>;
  filter(filters: ContentFilters, context: ServiceContext): Promise<ContentFilterResult>;
  paginate(query: PaginationQuery, context: ServiceContext): Promise<PaginatedResult<ContentItem>>;
  aggregate(
    aggregation: ContentAggregation,
    context: ServiceContext
  ): Promise<ContentAggregationResult>;
  recommend(
    criteria: RecommendationCriteria,
    context: ServiceContext
  ): Promise<ContentRecommendation[]>;
}

/**
 * Content transformation interface
 */
export interface IContentTransformationService extends IService {
  validate(content: ContentItem, rules: ValidationRules): Promise<ValidationResult>;
  sanitize(content: ContentItem): Promise<ContentItem>;
  optimize(content: ContentItem, options: OptimizationOptions): Promise<ContentItem>;
  format(content: ContentItem, format: ContentFormat): Promise<string>;
  export(content: ContentItem[], options: ExportOptions): Promise<ExportResult>;
  import(data: ImportData, options: ImportOptions): Promise<ImportResult>;
  transform(content: ContentItem, transformation: ContentTransformation): Promise<ContentItem>;
}

/**
 * Content validation interface
 */
export interface IContentValidationService extends IService {
  validateContent(content: ContentItem): Promise<ValidationResult>;
  validateContentBlock(block: ContentBlock): Promise<ValidationResult>;
  validateMediaAsset(asset: MediaAsset): Promise<ValidationResult>;
  validateBatch(items: ContentItem[]): Promise<BatchValidationResult>;
}

/**
 * Content caching interface
 */
export interface IContentCacheService extends IService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
}

/**
 * Content analytics interface
 */
export interface IContentAnalyticsService extends IService {
  trackView(contentId: string, context: ServiceContext): Promise<void>;
  trackEngagement(contentId: string, type: EngagementType, context: ServiceContext): Promise<void>;
  getAnalytics(contentId: string, timeframe: Timeframe): Promise<ContentAnalytics>;
  getBatchAnalytics(contentIds: string[], timeframe: Timeframe): Promise<BatchAnalytics>;
  getInsights(criteria: InsightsCriteria): Promise<ContentInsights>;
}

// ==================== DATA TRANSFER OBJECTS ====================

export interface CreateContentRequest {
  title: string;
  contentType: string;
  contentBlocks: ContentBlock[];
  description?: string;
  tags?: string[];
  status?: string;
  visibility?: string;
  monetization?: MonetizationSettings;
  metadata?: Record<string, any>;
}

export interface UpdateContentRequest {
  title?: string;
  contentBlocks?: ContentBlock[];
  description?: string;
  tags?: string[];
  status?: string;
  visibility?: string;
  monetization?: MonetizationSettings;
  metadata?: Record<string, any>;
}

export interface BulkUpdateRequest {
  id: string;
  updates: UpdateContentRequest;
}

export interface ContentSearchQuery {
  query: string;
  filters?: ContentFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
}

export interface ContentSearchResult {
  items: ContentItem[];
  total: number;
  facets?: SearchFacets;
  suggestions?: string[];
  metadata?: SearchMetadata;
}

export interface ContentFilters {
  contentType?: string[];
  status?: string[];
  visibility?: string[];
  tags?: string[];
  authorId?: string;
  dateRange?: DateRange;
  hasMedia?: boolean;
  isMonetized?: boolean;
}

export interface ContentFilterResult {
  items: ContentItem[];
  total: number;
  appliedFilters: ContentFilters;
  availableFilters: AvailableFilters;
}

export interface PaginationQuery {
  page: number;
  pageSize: number;
  filters?: ContentFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ContentAggregation {
  groupBy: string[];
  metrics: string[];
  filters?: ContentFilters;
  timeframe?: Timeframe;
}

export interface ContentAggregationResult {
  groups: AggregationGroup[];
  total: number;
  metadata: AggregationMetadata;
}

export interface RecommendationCriteria {
  userId?: string;
  contentType?: string;
  tags?: string[];
  limit?: number;
  excludeIds?: string[];
  algorithm?: 'collaborative' | 'content_based' | 'hybrid';
}

export interface ContentRecommendation {
  content: ContentItem;
  score: number;
  reason: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: ValidationMetadata;
}

export interface BatchValidationResult {
  results: Array<{ id: string; result: ValidationResult }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
}

export interface ValidationRules {
  required?: string[];
  maxLength?: Record<string, number>;
  patterns?: Record<string, RegExp>;
  custom?: Array<(content: ContentItem) => ValidationError | null>;
}

export interface OptimizationOptions {
  compressImages?: boolean;
  optimizeForSEO?: boolean;
  generateMetadata?: boolean;
  autoTag?: boolean;
  improveReadability?: boolean;
}

export interface ContentFormat {
  type: 'html' | 'markdown' | 'plain' | 'json' | 'pdf';
  options?: Record<string, any>;
}

export interface ExportOptions {
  format: ContentFormat;
  includeMedia?: boolean;
  includeMetadata?: boolean;
  compression?: 'none' | 'zip' | 'gzip';
}

export interface ExportResult {
  data: string | ArrayBuffer;
  format: string;
  size: number;
  checksum: string;
  metadata: ExportMetadata;
}

export interface ImportData {
  content: string | ArrayBuffer;
  format: string;
  metadata?: Record<string, any>;
}

export interface ImportOptions {
  validateBeforeImport?: boolean;
  overwriteExisting?: boolean;
  generateIds?: boolean;
  preserveTimestamps?: boolean;
}

export interface ImportResult {
  imported: number;
  failed: number;
  skipped: number;
  errors: ImportError[];
  createdIds: string[];
}

export interface ContentTransformation {
  type: 'format' | 'structure' | 'metadata' | 'content';
  rules: TransformationRule[];
  options?: Record<string, any>;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  totalSize: number;
  itemCount: number;
  evictionCount: number;
}

export interface MonetizationSettings {
  enabled: boolean;
  price?: number;
  currency?: string;
  paymentMethods?: string[];
  subscriptionTiers?: string[];
}

// ==================== SUPPORTING TYPES ====================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SearchFacets {
  contentTypes: Array<{ value: string; count: number }>;
  tags: Array<{ value: string; count: number }>;
  authors: Array<{ value: string; count: number }>;
}

export interface SearchMetadata {
  queryTime: number;
  totalResults: number;
  searchDepth: number;
}

export interface AvailableFilters {
  contentTypes: string[];
  statuses: string[];
  visibilities: string[];
  tags: string[];
  authors: Array<{ id: string; name: string }>;
}

export interface AggregationGroup {
  key: Record<string, any>;
  count: number;
  metrics: Record<string, number>;
}

export interface AggregationMetadata {
  aggregationTime: number;
  groupCount: number;
  totalRecords: number;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
}

export interface ValidationMetadata {
  validationTime: number;
  rulesApplied: number;
  checksPerformed: number;
}

export interface TransformationRule {
  source: string;
  target: string;
  operation: 'copy' | 'transform' | 'combine' | 'split';
  transformer?: (value: any) => any;
}

export interface ExportMetadata {
  exportTime: Date;
  itemCount: number;
  totalSize: number;
  includes: string[];
}

export interface ImportError {
  index: number;
  error: string;
  data?: any;
}

export interface Timeframe {
  start: Date;
  end: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface ContentAnalytics {
  contentId: string;
  views: number;
  uniqueViews: number;
  engagement: EngagementMetrics;
  performance: PerformanceMetrics;
  audience: AudienceMetrics;
}

export interface BatchAnalytics {
  items: ContentAnalytics[];
  summary: AnalyticsSummary;
}

export interface ContentInsights {
  trends: TrendInsight[];
  recommendations: InsightRecommendation[];
  predictions: PredictionInsight[];
}

export interface EngagementType {
  type: 'like' | 'share' | 'comment' | 'bookmark' | 'download';
  metadata?: Record<string, any>;
}

export interface EngagementMetrics {
  likes: number;
  shares: number;
  comments: number;
  bookmarks: number;
  downloads: number;
  engagementRate: number;
}

export interface PerformanceMetrics {
  loadTime: number;
  bounceRate: number;
  timeOnContent: number;
  completionRate: number;
}

export interface AudienceMetrics {
  demographics: DemographicData;
  geographic: GeographicData;
  behavioral: BehavioralData;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalEngagement: number;
  averagePerformance: number;
  topPerformers: string[];
}

export interface TrendInsight {
  trend: string;
  direction: 'up' | 'down' | 'stable';
  magnitude: number;
  confidence: number;
}

export interface InsightRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
}

export interface PredictionInsight {
  metric: string;
  prediction: number;
  confidence: number;
  timeframe: string;
}

export interface InsightsCriteria {
  contentIds?: string[];
  timeframe: Timeframe;
  metrics: string[];
  includesPredictions?: boolean;
}

export interface DemographicData {
  ageGroups: Record<string, number>;
  gender: Record<string, number>;
  interests: Record<string, number>;
}

export interface GeographicData {
  countries: Record<string, number>;
  cities: Record<string, number>;
  timezones: Record<string, number>;
}

export interface BehavioralData {
  deviceTypes: Record<string, number>;
  sources: Record<string, number>;
  returningUsers: number;
  sessionDuration: number;
}
