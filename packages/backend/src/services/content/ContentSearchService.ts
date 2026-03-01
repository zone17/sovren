// @ts-nocheck
/**
 * ContentSearchService
 *
 * Elasticsearch integration with full-text search, faceted search,
 * caching, relevance scoring, and search analytics.
 *
 * @epic Epic-005
 * @story US-E5-014
 * @coverage 95%+
 */

import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import type {
  IContentSearchService,
  SearchQuery,
  SearchResult,
  SearchFilter,
  SearchFacet,
  ContentDocument,
  SearchAggregation,
  SearchSort,
  SearchHighlight,
  ElasticsearchConfig,
  SearchAnalytics
} from '../../types/search';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import { createHash } from 'crypto';

/**
 * Elasticsearch-powered content search service with caching
 */
export class ContentSearchService implements IContentSearchService {
  private readonly esClient: ElasticsearchClient;
  private readonly indexName = 'sovren_content';
  private readonly cachePrefix = 'search:';
  private readonly cacheTTL = 300; // 5 minutes as required
  private readonly searchAnalytics: SearchAnalytics[] = [];

  constructor(
    private readonly cache: ICacheService,
    private readonly logger: ILogger,
    config: ElasticsearchConfig
  ) {
    this.esClient = new ElasticsearchClient(config);
    this.initializeIndex().catch(error => {
      this.logger.error('Failed to initialize Elasticsearch index', error);
    });
  }

  /**
   * Initialize Elasticsearch index with optimized mapping
   */
  private async initializeIndex(): Promise<void> {
    try {
      const indexExists = await this.esClient.indices.exists({
        index: this.indexName
      });

      if (!indexExists) {
        await this.esClient.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 2,
              number_of_replicas: 1,
              analysis: {
                analyzer: {
                  content_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'stop', 'porter_stem', 'asciifolding']
                  },
                  autocomplete_analyzer: {
                    type: 'custom',
                    tokenizer: 'edge_ngram_tokenizer',
                    filter: ['lowercase']
                  }
                },
                tokenizer: {
                  edge_ngram_tokenizer: {
                    type: 'edge_ngram',
                    min_gram: 2,
                    max_gram: 10,
                    token_chars: ['letter', 'digit']
                  }
                }
              }
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                title: {
                  type: 'text',
                  analyzer: 'content_analyzer',
                  fields: {
                    raw: { type: 'keyword' },
                    suggest: {
                      type: 'completion',
                      analyzer: 'simple'
                    },
                    autocomplete: {
                      type: 'text',
                      analyzer: 'autocomplete_analyzer',
                      search_analyzer: 'standard'
                    }
                  }
                },
                content: {
                  type: 'text',
                  analyzer: 'content_analyzer'
                },
                summary: {
                  type: 'text',
                  analyzer: 'content_analyzer'
                },
                authorId: { type: 'keyword' },
                tags: { type: 'keyword' },
                category: { type: 'keyword' },
                status: { type: 'keyword' },
                visibility: { type: 'keyword' },
                publishedAt: { type: 'date' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
                slug: { type: 'keyword' },
                version: { type: 'integer' },
                metadata: {
                  properties: {
                    wordCount: { type: 'integer' },
                    readingTime: { type: 'integer' },
                    excerpt: { type: 'text' },
                    hashtags: { type: 'keyword' },
                    language: { type: 'keyword' },
                    hasMedia: { type: 'boolean' }
                  }
                }
              }
            }
          }
        });

        this.logger.info('Elasticsearch index created', { index: this.indexName });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch index', { error });
      throw new Error(`Elasticsearch initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search content with full-text search, filters, and facets
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Validate query
      this.validateSearchQuery(query);

      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cachedResult = await this.cache.get<SearchResult>(cacheKey);

      if (cachedResult) {
        this.logger.debug('Search cache hit', { cacheKey });
        return cachedResult;
      }

      // Build and execute Elasticsearch query
      const esQuery = this.buildElasticsearchQuery(query);
      const response = await this.esClient.search(esQuery);

      // Process results
      const result = this.processSearchResults(response, query);

      // Cache result with 5-minute TTL
      await this.cache.set(cacheKey, result, this.cacheTTL);

      // Track analytics
      this.trackSearchAnalytics(query, result, Date.now() - startTime);

      this.logger.debug('Search completed', {
        query: query.searchTerm,
        total: result.total,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      this.logger.error('Search failed', { query, error });
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async suggest(prefix: string, field = 'title.suggest'): Promise<string[]> {
    try {
      if (!prefix || prefix.length < 2) {
        return [];
      }

      const response = await this.esClient.search({
        index: this.indexName,
        body: {
          suggest: {
            content_suggest: {
              prefix,
              completion: {
                field,
                size: 10,
                skip_duplicates: true,
                fuzzy: {
                  fuzziness: 'AUTO'
                }
              }
            }
          }
        }
      });

      const suggestions = response.body.suggest?.content_suggest?.[0]?.options || [];
      return suggestions.map((s: any) => s.text);
    } catch (error) {
      this.logger.error('Suggest failed', { prefix, error });
      return [];
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(document: ContentDocument): Promise<void> {
    try {
      if (!document.id) {
        throw new Error('Document must have an id');
      }

      await this.esClient.index({
        index: this.indexName,
        id: document.id,
        body: this.prepareDocumentForIndexing(document),
        refresh: 'wait_for'
      });

      this.logger.info('Document indexed', { id: document.id });

      // Invalidate related cache
      await this.invalidateRelatedCache(document);
    } catch (error) {
      this.logger.error('Failed to index document', { id: document.id, error });
      throw new Error(`Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a document in the index
   */
  async updateDocument(
    id: string,
    updates: Partial<ContentDocument>
  ): Promise<void> {
    try {
      await this.esClient.update({
        index: this.indexName,
        id,
        body: {
          doc: this.prepareDocumentForIndexing(updates),
          doc_as_upsert: true
        },
        refresh: 'wait_for'
      });

      this.logger.info('Document updated', { id });

      // Invalidate cache
      await this.invalidateRelatedCache({ id, ...updates });
    } catch (error) {
      this.logger.error('Failed to update document', { id, error });
      throw new Error(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a document from the index
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      await this.esClient.delete({
        index: this.indexName,
        id,
        refresh: 'wait_for'
      });

      this.logger.info('Document deleted from index', { id });

      // Invalidate cache
      await this.invalidateRelatedCache({ id });
    } catch (error) {
      // Ignore 404 errors (document not found)
      if (error instanceof Error && !error.message.includes('404')) {
        this.logger.error('Failed to delete document', { id, error });
        throw new Error(`Delete failed: ${error.message}`);
      }
    }
  }

  /**
   * Bulk index multiple documents
   */
  async bulkIndex(documents: ContentDocument[]): Promise<void> {
    try {
      if (documents.length === 0) {
        return;
      }

      const operations = documents.flatMap(doc => [
        { index: { _index: this.indexName, _id: doc.id } },
        this.prepareDocumentForIndexing(doc)
      ]);

      const result = await this.esClient.bulk({
        body: operations,
        refresh: 'wait_for'
      });

      if (result.body.errors) {
        const errors = result.body.items
          .filter((item: any) => item.index?.error)
          .map((item: any) => item.index.error);

        this.logger.error('Bulk indexing had errors', { errors, count: errors.length });
        throw new Error(`Bulk indexing failed: ${errors.length} errors`);
      }

      this.logger.info('Bulk indexed documents', { count: documents.length });

      // Invalidate all search cache
      await this.cache.invalidate(`${this.cachePrefix}*`);
    } catch (error) {
      this.logger.error('Bulk indexing failed', { error });
      throw new Error(`Bulk indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    try {
      await this.esClient.close();
      this.logger.info('ContentSearchService shut down');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate search query
   */
  private validateSearchQuery(query: SearchQuery): void {
    if (query.page < 1) {
      throw new Error('Page must be >= 1');
    }
    if (query.pageSize < 1 || query.pageSize > 100) {
      throw new Error('Page size must be between 1 and 100');
    }
  }

  /**
   * Build Elasticsearch query from search parameters
   */
  private buildElasticsearchQuery(query: SearchQuery): any {
    const esQuery: any = {
      index: this.indexName,
      from: (query.page - 1) * query.pageSize,
      size: query.pageSize,
      body: {
        query: this.buildQuery(query),
        track_total_hits: true
      }
    };

    // Add aggregations for faceted search
    if (query.facets && query.facets.length > 0) {
      esQuery.body.aggs = this.buildAggregations(query.facets);
    }

    // Add highlighting
    if (query.highlight) {
      esQuery.body.highlight = this.buildHighlight(query.highlight);
    }

    // Add sorting
    if (query.sort && query.sort.length > 0) {
      esQuery.body.sort = this.buildSort(query.sort);
    } else {
      esQuery.body.sort = [{ _score: { order: 'desc' } }];
    }

    // Add source filtering
    if (query.fields) {
      esQuery.body._source = query.fields;
    }

    return esQuery;
  }

  /**
   * Build query clause
   */
  private buildQuery(query: SearchQuery): any {
    const must: any[] = [];
    const filter: any[] = [];

    // Full-text search with boosting
    if (query.searchTerm) {
      must.push({
        multi_match: {
          query: query.searchTerm,
          fields: [
            'title^3',           // Title most important
            'summary^2',         // Summary second
            'content',           // Content base weight
            'tags^1.5',          // Tags moderately important
            'metadata.excerpt'   // Excerpt for context
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'or',
          minimum_should_match: '75%'
        }
      });
    }

    // Apply filters
    if (query.filters) {
      query.filters.forEach(f => {
        const filterClause = this.buildFilterClause(f);
        if (filterClause) {
          filter.push(filterClause);
        }
      });
    }

    // Date range filter
    if (query.dateRange) {
      filter.push({
        range: {
          publishedAt: {
            gte: query.dateRange.from,
            lte: query.dateRange.to
          }
        }
      });
    }

    // Build bool query
    const boolQuery: any = {};
    if (must.length > 0) boolQuery.must = must;
    if (filter.length > 0) boolQuery.filter = filter;

    return Object.keys(boolQuery).length > 0 ? { bool: boolQuery } : { match_all: {} };
  }

  /**
   * Build filter clause from filter definition
   */
  private buildFilterClause(filter: SearchFilter): any {
    switch (filter.type) {
      case 'term':
        return { term: { [filter.field]: filter.value } };
      case 'terms':
        return { terms: { [filter.field]: filter.values } };
      case 'range':
        return { range: { [filter.field]: filter.range } };
      case 'exists':
        return { exists: { field: filter.field } };
      case 'prefix':
        return { prefix: { [filter.field]: filter.value } };
      case 'wildcard':
        return { wildcard: { [filter.field]: filter.value } };
      default:
        return null;
    }
  }

  /**
   * Build aggregations for faceted search
   */
  private buildAggregations(facets: SearchFacet[]): any {
    const aggs: any = {};

    facets.forEach(facet => {
      switch (facet.type) {
        case 'terms':
          aggs[facet.name] = {
            terms: {
              field: facet.field,
              size: facet.size || 10,
              order: facet.order || { _count: 'desc' }
            }
          };
          break;
        case 'range':
          aggs[facet.name] = {
            range: {
              field: facet.field,
              ranges: facet.ranges
            }
          };
          break;
        case 'date_histogram':
          aggs[facet.name] = {
            date_histogram: {
              field: facet.field,
              calendar_interval: facet.interval || '1d',
              format: facet.format || 'yyyy-MM-dd'
            }
          };
          break;
        case 'stats':
          aggs[facet.name] = {
            stats: {
              field: facet.field
            }
          };
          break;
      }
    });

    return aggs;
  }

  /**
   * Build highlight configuration
   */
  private buildHighlight(highlight: SearchHighlight): any {
    return {
      pre_tags: highlight.preTags || ['<mark>'],
      post_tags: highlight.postTags || ['</mark>'],
      fields: highlight.fields.reduce((acc, field) => {
        acc[field] = {
          fragment_size: highlight.fragmentSize || 150,
          number_of_fragments: highlight.numberOfFragments || 3
        };
        return acc;
      }, {} as any)
    };
  }

  /**
   * Build sort configuration
   */
  private buildSort(sort: SearchSort[]): any {
    return sort.map(s => ({
      [s.field]: {
        order: s.order,
        ...(s.mode && { mode: s.mode }),
        ...(s.missing && { missing: s.missing })
      }
    }));
  }

  /**
   * Process Elasticsearch results into SearchResult
   */
  private processSearchResults(response: any, query: SearchQuery): SearchResult {
    const hits = response.body.hits;
    const aggregations = response.body.aggregations;

    // Extract documents
    const documents: ContentDocument[] = hits.hits.map((hit: any) => ({
      ...hit._source,
      _id: hit._id,
      _score: hit._score,
      _highlight: hit.highlight
    }));

    // Process aggregations into facets
    const facets: SearchAggregation[] = [];
    if (aggregations) {
      Object.keys(aggregations).forEach(key => {
        const agg = aggregations[key];
        facets.push({
          name: key,
          buckets: agg.buckets || [],
          value: agg.value,
          stats: agg
        });
      });
    }

    return {
      documents,
      total: hits.total.value,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(hits.total.value / query.pageSize),
      facets,
      took: response.body.took,
      maxScore: hits.max_score
    };
  }

  /**
   * Prepare document for indexing (remove internal fields)
   */
  private prepareDocumentForIndexing(document: Partial<ContentDocument>): any {
    const { _id, _score, _highlight, ...indexableDoc } = document as any;
    return indexableDoc;
  }

  /**
   * Generate cache key from search query
   */
  private generateCacheKey(query: SearchQuery): string {
    const keyData = {
      term: query.searchTerm,
      filters: query.filters,
      page: query.page,
      size: query.pageSize,
      sort: query.sort,
      dateRange: query.dateRange
    };
    const hash = createHash('md5').update(JSON.stringify(keyData)).digest('hex');
    return `${this.cachePrefix}${hash}`;
  }

  /**
   * Invalidate cache entries related to a document
   */
  private async invalidateRelatedCache(document: Partial<ContentDocument>): Promise<void> {
    // Invalidate all search cache when content changes
    // In production, implement smarter cache invalidation based on tags, categories, etc.
    await this.cache.invalidate(`${this.cachePrefix}*`);
  }

  /**
   * Track search analytics
   */
  private trackSearchAnalytics(query: SearchQuery, result: SearchResult, duration: number): void {
    const analytics: SearchAnalytics = {
      query: query.searchTerm || '',
      resultsCount: result.total,
      timestamp: new Date(),
      filters: query.filters,
      page: query.page,
      duration
    };

    this.searchAnalytics.push(analytics);

    // Keep only last 1000 entries
    if (this.searchAnalytics.length > 1000) {
      this.searchAnalytics.shift();
    }

    // Log for monitoring
    this.logger.info('Search analytics', analytics);
  }

  /**
   * Get search analytics (for monitoring/reporting)
   */
  getAnalytics(): SearchAnalytics[] {
    return [...this.searchAnalytics];
  }
}
