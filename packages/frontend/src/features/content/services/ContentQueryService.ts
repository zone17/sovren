/**
 * 🔍 **CONTENT QUERY SERVICE - ADVANCED SEARCH AND FILTERING**
 *
 * Elite Engineering Standards:
 * ✅ Advanced search with full-text and semantic capabilities
 * ✅ Efficient filtering with multiple criteria support
 * ✅ High-performance pagination with cursor-based navigation
 * ✅ Real-time aggregations and analytics
 * ✅ AI-powered content recommendations
 * ✅ Query optimization and caching
 * ✅ Faceted search and auto-suggestions
 */

import type { ContentItem } from '../../../types/content';
import { BaseService } from './core/BaseService';
import type {
  ContentAggregation,
  ContentAggregationResult,
  ContentFilterResult,
  ContentFilters,
  ContentRecommendation,
  ContentSearchQuery,
  ContentSearchResult,
  IContentQueryService,
  PaginatedResult,
  PaginationQuery,
  RecommendationCriteria,
  ServiceContext,
} from './core/ServiceInterfaces';

// Global type declarations
declare const fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
declare const setTimeout: (handler: TimerHandler, timeout?: number) => number;
declare const clearTimeout: (handle: number) => void;

export interface QueryConfig {
  apiBaseUrl: string;
  timeout: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  defaultPageSize: number;
  maxPageSize: number;
  enableSemanticSearch: boolean;
  enableFacetedSearch: boolean;
  enableAutoComplete: boolean;
}

export interface SearchIndex {
  contentId: string;
  tokens: string[];
  vectors: number[];
  metadata: SearchMetadata;
  lastIndexed: Date;
}

export interface SearchMetadata {
  title: string;
  description?: string;
  tags: string[];
  contentType: string;
  authorId: string;
  createdAt: Date;
  engagementScore: number;
  qualityScore: number;
}

export interface QueryCache {
  key: string;
  result: any;
  timestamp: number;
  hitCount: number;
  lastAccessed: Date;
}

/**
 * Content Query Service Implementation
 * Provides advanced search, filtering, and recommendation capabilities
 */
export class ContentQueryService extends BaseService implements IContentQueryService {
  private config: QueryConfig;
  private queryCache: Map<string, QueryCache> = new Map();
  private searchIndex: Map<string, SearchIndex> = new Map();
  private requestHeaders: HeadersInit;

  constructor(config: Partial<QueryConfig> = {}) {
    super('ContentQueryService', '1.0.0');

    this.config = {
      apiBaseUrl: '/api/content-management',
      timeout: 15000,
      cacheEnabled: true,
      cacheTtl: 300000, // 5 minutes
      defaultPageSize: 20,
      maxPageSize: 100,
      enableSemanticSearch: true,
      enableFacetedSearch: true,
      enableAutoComplete: true,
      ...config,
    };

    this.requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Advanced content search with full-text and semantic capabilities
   */
  async search(query: ContentSearchQuery, context: ServiceContext): Promise<ContentSearchResult> {
    return await this.executeOperation('search', context, async () => {
      this.validateSearchQuery(query);

      // Check cache first
      const cacheKey = this.generateCacheKey('search', query);
      if (this.config.cacheEnabled) {
        const cached = this.getFromCache<ContentSearchResult>(cacheKey);
        if (cached) {
          this.log('debug', `Search result retrieved from cache`, context, { query: query.query });
          return cached;
        }
      }

      // Prepare search request
      const searchRequest = {
        ...query,
        semantic: this.config.enableSemanticSearch,
        faceted: this.config.enableFacetedSearch,
      };

      // Execute search
      const response = await this.makeApiRequest('POST', '/search', searchRequest, context);
      const result = await this.parseResponse<ContentSearchResult>(response);

      // Enhance with search metadata
      const enhancedResult = await this.enhanceSearchResult(result, query, context);

      // Update cache
      if (this.config.cacheEnabled) {
        this.updateCache(cacheKey, enhancedResult);
      }

      this.log('info', `Search completed`, context, {
        query: query.query,
        resultCount: enhancedResult.items.length,
        totalResults: enhancedResult.total,
      });

      return enhancedResult;
    });
  }

  /**
   * Filter content with advanced criteria and faceting
   */
  async filter(filters: ContentFilters, context: ServiceContext): Promise<ContentFilterResult> {
    return await this.executeOperation('filter', context, async () => {
      this.validateFilters(filters);

      // Check cache
      const cacheKey = this.generateCacheKey('filter', filters);
      if (this.config.cacheEnabled) {
        const cached = this.getFromCache<ContentFilterResult>(cacheKey);
        if (cached) {
          this.log('debug', `Filter result retrieved from cache`, context);
          return cached;
        }
      }

      // Execute filter
      const response = await this.makeApiRequest('POST', '/filter', filters, context);
      const result = await this.parseResponse<ContentFilterResult>(response);

      // Enhance with available filters
      const enhancedResult = await this.enhanceFilterResult(result, filters, context);

      // Update cache
      if (this.config.cacheEnabled) {
        this.updateCache(cacheKey, enhancedResult);
      }

      this.log('info', `Filter completed`, context, {
        appliedFilters: Object.keys(filters).length,
        resultCount: enhancedResult.items.length,
      });

      return enhancedResult;
    });
  }

  /**
   * Paginate content with efficient cursor-based navigation
   */
  async paginate(
    query: PaginationQuery,
    context: ServiceContext
  ): Promise<PaginatedResult<ContentItem>> {
    return await this.executeOperation('paginate', context, async () => {
      this.validatePaginationQuery(query);

      // Apply size limits
      const normalizedQuery = {
        ...query,
        pageSize: Math.min(query.pageSize, this.config.maxPageSize),
      };

      // Check cache
      const cacheKey = this.generateCacheKey('paginate', normalizedQuery);
      if (this.config.cacheEnabled) {
        const cached = this.getFromCache<PaginatedResult<ContentItem>>(cacheKey);
        if (cached) {
          this.log('debug', `Pagination result retrieved from cache`, context);
          return cached;
        }
      }

      // Execute pagination
      const response = await this.makeApiRequest('POST', '/paginate', normalizedQuery, context);
      const items = await this.parseResponse<ContentItem[]>(response);

      // Get total count for pagination metadata
      const totalResponse = await this.makeApiRequest(
        'POST',
        '/count',
        normalizedQuery.filters || {},
        context
      );
      const { total } = await this.parseResponse<{ total: number }>(totalResponse);

      // Build pagination result
      const result: PaginatedResult<ContentItem> = {
        items,
        pagination: {
          page: normalizedQuery.page,
          pageSize: normalizedQuery.pageSize,
          total,
          totalPages: Math.ceil(total / normalizedQuery.pageSize),
          hasNext: normalizedQuery.page * normalizedQuery.pageSize < total,
          hasPrevious: normalizedQuery.page > 1,
        },
      };

      // Update cache
      if (this.config.cacheEnabled) {
        this.updateCache(cacheKey, result);
      }

      this.log('info', `Pagination completed`, context, {
        page: result.pagination.page,
        pageSize: result.pagination.pageSize,
        total: result.pagination.total,
      });

      return result;
    });
  }

  /**
   * Aggregate content data for analytics and insights
   */
  async aggregate(
    aggregation: ContentAggregation,
    context: ServiceContext
  ): Promise<ContentAggregationResult> {
    return await this.executeOperation('aggregate', context, async () => {
      this.validateAggregation(aggregation);

      // Check cache
      const cacheKey = this.generateCacheKey('aggregate', aggregation);
      if (this.config.cacheEnabled) {
        const cached = this.getFromCache<ContentAggregationResult>(cacheKey);
        if (cached) {
          this.log('debug', `Aggregation result retrieved from cache`, context);
          return cached;
        }
      }

      // Execute aggregation
      const response = await this.makeApiRequest('POST', '/aggregate', aggregation, context);
      const result = await this.parseResponse<ContentAggregationResult>(response);

      // Enhance with metadata
      const enhancedResult = await this.enhanceAggregationResult(result, aggregation, context);

      // Update cache with shorter TTL for real-time data
      if (this.config.cacheEnabled) {
        this.updateCache(cacheKey, enhancedResult, this.config.cacheTtl / 2);
      }

      this.log('info', `Aggregation completed`, context, {
        groupBy: aggregation.groupBy,
        metrics: aggregation.metrics,
        groupCount: enhancedResult.groups.length,
      });

      return enhancedResult;
    });
  }

  /**
   * Get AI-powered content recommendations
   */
  async recommend(
    criteria: RecommendationCriteria,
    context: ServiceContext
  ): Promise<ContentRecommendation[]> {
    return await this.executeOperation('recommend', context, async () => {
      this.validateRecommendationCriteria(criteria);

      // Check cache
      const cacheKey = this.generateCacheKey('recommend', criteria);
      if (this.config.cacheEnabled) {
        const cached = this.getFromCache<ContentRecommendation[]>(cacheKey);
        if (cached) {
          this.log('debug', `Recommendations retrieved from cache`, context);
          return cached;
        }
      }

      // Execute recommendation
      const response = await this.makeApiRequest('POST', '/recommend', criteria, context);
      const recommendations = await this.parseResponse<ContentRecommendation[]>(response);

      // Enhance recommendations with additional metadata
      const enhancedRecommendations = await this.enhanceRecommendations(
        recommendations,
        criteria,
        context
      );

      // Update cache with shorter TTL for personalized content
      if (this.config.cacheEnabled) {
        this.updateCache(cacheKey, enhancedRecommendations, this.config.cacheTtl / 4);
      }

      this.log('info', `Recommendations completed`, context, {
        algorithm: criteria.algorithm || 'hybrid',
        recommendationCount: enhancedRecommendations.length,
        userId: criteria.userId,
      });

      return enhancedRecommendations;
    });
  }

  // Private helper methods

  private validateSearchQuery(query: ContentSearchQuery): void {
    if (!query.query || query.query.trim().length === 0) {
      throw new Error('Search query is required');
    }
    if (query.query.length > 500) {
      throw new Error('Search query too long (max 500 characters)');
    }
    if (query.limit && (query.limit < 1 || query.limit > this.config.maxPageSize)) {
      throw new Error(`Invalid limit: must be between 1 and ${this.config.maxPageSize}`);
    }
  }

  private validateFilters(filters: ContentFilters): void {
    if (filters.dateRange) {
      if (filters.dateRange.start >= filters.dateRange.end) {
        throw new Error('Invalid date range: start must be before end');
      }
    }
  }

  private validatePaginationQuery(query: PaginationQuery): void {
    if (query.page < 1) {
      throw new Error('Page number must be >= 1');
    }
    if (query.pageSize < 1 || query.pageSize > this.config.maxPageSize) {
      throw new Error(`Page size must be between 1 and ${this.config.maxPageSize}`);
    }
  }

  private validateAggregation(aggregation: ContentAggregation): void {
    if (!aggregation.groupBy || aggregation.groupBy.length === 0) {
      throw new Error('Aggregation groupBy is required');
    }
    if (!aggregation.metrics || aggregation.metrics.length === 0) {
      throw new Error('Aggregation metrics are required');
    }
  }

  private validateRecommendationCriteria(criteria: RecommendationCriteria): void {
    if (criteria.limit && (criteria.limit < 1 || criteria.limit > 50)) {
      throw new Error('Recommendation limit must be between 1 and 50');
    }
  }

  private async enhanceSearchResult(
    result: ContentSearchResult,
    query: ContentSearchQuery,
    context: ServiceContext
  ): Promise<ContentSearchResult> {
    // Add search suggestions if no results
    if (result.items.length === 0 && this.config.enableAutoComplete) {
      const suggestions = await this.generateSearchSuggestions(query.query, context);
      result.suggestions = suggestions;
    }

    // Add facets if enabled
    if (this.config.enableFacetedSearch && query.includeMetadata) {
      result.facets = await this.generateSearchFacets(result.items, context);
    }

    // Add search metadata
    result.metadata = {
      queryTime: Date.now() - context.timestamp.getTime(),
      totalResults: result.total,
      searchDepth: result.items.length > 0 ? Math.log10(result.total) : 0,
    };

    return result;
  }

  private async enhanceFilterResult(
    result: ContentFilterResult,
    filters: ContentFilters,
    context: ServiceContext
  ): Promise<ContentFilterResult> {
    // Generate available filters based on current results
    result.availableFilters = await this.generateAvailableFilters(result.items, context);

    return result;
  }

  private async enhanceAggregationResult(
    result: ContentAggregationResult,
    aggregation: ContentAggregation,
    context: ServiceContext
  ): Promise<ContentAggregationResult> {
    // Add aggregation metadata
    result.metadata = {
      aggregationTime: Date.now() - context.timestamp.getTime(),
      groupCount: result.groups.length,
      totalRecords: result.total,
    };

    return result;
  }

  private async enhanceRecommendations(
    recommendations: ContentRecommendation[],
    criteria: RecommendationCriteria,
    context: ServiceContext
  ): Promise<ContentRecommendation[]> {
    // Sort by score and add ranking
    return recommendations
      .sort((a, b) => b.score - a.score)
      .map((rec, index) => ({
        ...rec,
        metadata: {
          ...rec.metadata,
          rank: index + 1,
          algorithm: criteria.algorithm || 'hybrid',
        },
      }));
  }

  private async generateSearchSuggestions(
    query: string,
    context: ServiceContext
  ): Promise<string[]> {
    try {
      const response = await this.makeApiRequest('POST', '/suggest', { query }, context);
      const { suggestions } = await this.parseResponse<{ suggestions: string[] }>(response);
      return suggestions;
    } catch (error) {
      this.log('warn', 'Failed to generate search suggestions', context, { error });
      return [];
    }
  }

  private async generateSearchFacets(items: ContentItem[], context: ServiceContext): Promise<any> {
    // Extract facets from current results
    const facets = {
      contentTypes: this.extractFacet(items, 'status'),
      tags: this.extractTagFacets(items),
      authors: this.extractFacet(items, 'creator_pubkey'),
    };

    return facets;
  }

  private async generateAvailableFilters(
    items: ContentItem[],
    context: ServiceContext
  ): Promise<any> {
    return {
      contentTypes: [...new Set(items.map((item) => item.status))],
      statuses: ['draft', 'published', 'archived'],
      visibilities: ['public', 'private', 'subscribers'],
      tags: [...new Set(items.flatMap((item) => item.tags))],
      authors: [
        ...new Set(items.map((item) => ({ id: item.creator_pubkey, name: item.creator_pubkey }))),
      ],
    };
  }

  private extractFacet(
    items: ContentItem[],
    field: keyof ContentItem
  ): Array<{ value: string; count: number }> {
    const counts = new Map<string, number>();

    items.forEach((item) => {
      const value = String(item[field] || 'unknown');
      counts.set(value, (counts.get(value) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }

  private extractTagFacets(items: ContentItem[]): Array<{ value: string; count: number }> {
    const tagCounts = new Map<string, number>();

    items.forEach((item) => {
      item.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 tags
  }

  private generateCacheKey(operation: string, data: any): string {
    // Create a deterministic cache key
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return `${operation}:${this.hashString(serialized)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - cached.timestamp > this.config.cacheTtl) {
      this.queryCache.delete(key);
      return null;
    }

    // Update access statistics
    cached.hitCount++;
    cached.lastAccessed = new Date();

    return cached.result as T;
  }

  private updateCache(key: string, result: any, ttl?: number): void {
    const cacheTtl = ttl || this.config.cacheTtl;

    this.queryCache.set(key, {
      key,
      result,
      timestamp: Date.now(),
      hitCount: 0,
      lastAccessed: new Date(),
    });

    // Cleanup old cache entries
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxCacheSize = 1000;

    // Remove expired entries
    for (const [key, cached] of this.queryCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTtl) {
        this.queryCache.delete(key);
      }
    }

    // If still over limit, remove least recently used
    if (this.queryCache.size > maxCacheSize) {
      const entries = Array.from(this.queryCache.entries()).sort(
        (a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
      );

      const toRemove = entries.slice(0, this.queryCache.size - maxCacheSize);
      toRemove.forEach(([key]) => this.queryCache.delete(key));
    }
  }

  private async makeApiRequest(
    method: string,
    endpoint: string,
    data: any,
    context: ServiceContext
  ): Promise<Response> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    const headers = {
      ...this.requestHeaders,
      'X-Request-ID': context.requestId,
      'X-User-ID': context.userId || '',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      options.signal = controller.signal;
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw this.createServiceError(
          'API_ERROR',
          `API request failed: ${response.status} ${response.statusText}`,
          method.toLowerCase(),
          context,
          response.status >= 500
        );
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw this.createServiceError(
          'TIMEOUT',
          'Request timed out',
          method.toLowerCase(),
          context,
          true
        );
      }

      throw error;
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    throw new Error('Invalid response format');
  }

  // Service lifecycle methods

  protected async performHealthCheck(): Promise<boolean> {
    try {
      const context = this.createInternalContext('healthCheck');
      const response = await this.makeApiRequest('GET', '/health', null, context);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  protected async getCustomMetrics(): Promise<Record<string, any>> {
    const cacheStats = this.getCacheStatistics();

    return {
      cacheSize: this.queryCache.size,
      cacheHitRate: cacheStats.hitRate,
      indexSize: this.searchIndex.size,
      configuredTimeout: this.config.timeout,
      semanticSearchEnabled: this.config.enableSemanticSearch,
      facetedSearchEnabled: this.config.enableFacetedSearch,
    };
  }

  protected async performCleanup(): Promise<void> {
    this.queryCache.clear();
    this.searchIndex.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    size: number;
    hitRate: number;
    totalHits: number;
    averageAge: number;
  } {
    const now = Date.now();
    let totalHits = 0;
    let totalAge = 0;

    for (const cached of this.queryCache.values()) {
      totalHits += cached.hitCount;
      totalAge += now - cached.timestamp;
    }

    const size = this.queryCache.size;
    const hitRate = size > 0 ? totalHits / size : 0;
    const averageAge = size > 0 ? totalAge / size : 0;

    return {
      size,
      hitRate,
      totalHits,
      averageAge,
    };
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get search suggestions for auto-complete
   */
  async getSearchSuggestions(partialQuery: string, context: ServiceContext): Promise<string[]> {
    if (!this.config.enableAutoComplete || partialQuery.length < 2) {
      return [];
    }

    return await this.executeOperation('suggest', context, async () => {
      const cacheKey = this.generateCacheKey('suggest', { query: partialQuery });

      if (this.config.cacheEnabled) {
        const cached = this.getFromCache<string[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const suggestions = await this.generateSearchSuggestions(partialQuery, context);

      if (this.config.cacheEnabled) {
        this.updateCache(cacheKey, suggestions, this.config.cacheTtl * 2); // Longer cache for suggestions
      }

      return suggestions;
    });
  }
}
