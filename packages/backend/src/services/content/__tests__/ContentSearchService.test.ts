/**
 * ContentSearchService Unit Tests
 * User Story: US-E5-014
 * Target Coverage: 95%+
 */

import { ContentSearchService } from '../ContentSearchService';
import { Client } from '@elastic/elasticsearch';
import type {
  SearchQuery,
  SearchResult,
  ContentDocument,
  ElasticsearchConfig
} from '../../../types/search';
import type { ICacheService } from '../../../interfaces/shared/ICacheService';
import type { ILogger } from '../../../interfaces/shared/ILogger';

// ============================================================================
// Mocks
// ============================================================================

class MockElasticsearchClient {
  public indices = {
    exists: vi.fn(),
    create: vi.fn()
  };
  public search = vi.fn();
  public index = vi.fn();
  public update = vi.fn();
  public delete = vi.fn();
  public bulk = vi.fn();
  public close = vi.fn();
}

class MockCacheService implements ICacheService {
  private cache = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async invalidate(pattern: string): Promise<number> {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      let count = 0;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          count++;
        }
      }
      return count;
    }
    return this.cache.delete(pattern) ? 1 : 0;
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    return 0;
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  async getTtl(key: string): Promise<number> {
    return -1;
  }

  async setTtl(key: string, ttl: number): Promise<boolean> {
    return true;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    keys.forEach(key => result.set(key, this.cache.get(key) || null));
    return result;
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    entries.forEach(entry => this.cache.set(entry.key, entry.value));
  }

  async remember<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async getStats(): Promise<any> {
    return { hits: 0, misses: 0, hitRate: 0 };
  }

  async registerWarmupStrategy(strategy: any): Promise<void> {}

  async warmup(strategyName?: string): Promise<void> {}

  async registerInvalidationPattern(pattern: any): Promise<void> {}

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async dispose(): Promise<void> {
    this.cache.clear();
  }
}

class MockLogger implements ILogger {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

// Mock the Elasticsearch client
vi.mock('@elastic/elasticsearch', () => {
  return {
    Client: vi.fn().mockImplementation(() => new MockElasticsearchClient())
  };
});

// ============================================================================
// Test Suite
// ============================================================================

describe('ContentSearchService', () => {
  let service: ContentSearchService;
  let mockCache: MockCacheService;
  let mockLogger: MockLogger;
  let mockEsClient: MockElasticsearchClient;
  let config: ElasticsearchConfig;

  beforeEach(async () => {
    // Reset mocks
    mockCache = new MockCacheService();
    mockLogger = new MockLogger();
    config = {
      node: 'http://localhost:9200'
    };

    // Setup default mock responses before creating service
    const MockedClient = vi.mocked(Client);
    const mockClient = new MockElasticsearchClient();
    mockClient.indices.exists.mockResolvedValue(true);

    // Mock the Client constructor to return our mock
    MockedClient.mockImplementation(() => mockClient);

    // Create service (this will also create mock ES client)
    service = new ContentSearchService(mockCache, mockLogger, config);
    mockEsClient = mockClient;

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  afterEach(async () => {
    await service.shutdown();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should create Elasticsearch index if it does not exist', async () => {
      const MockedClient = vi.mocked(Client);
      const newMockClient = new MockElasticsearchClient();
      newMockClient.indices.exists.mockResolvedValue(false);
      newMockClient.indices.create.mockResolvedValue({});
      MockedClient.mockImplementation(() => newMockClient);

      const newLogger = new MockLogger();
      const newService = new ContentSearchService(mockCache, newLogger, config);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(newMockClient.indices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'sovren_content'
        })
      );

      await newService.shutdown();
    });

    it('should not create index if it already exists', async () => {
      const MockedClient = vi.mocked(Client);
      const newMockClient = new MockElasticsearchClient();
      newMockClient.indices.exists.mockResolvedValue(true);
      newMockClient.indices.create.mockResolvedValue({});
      MockedClient.mockImplementation(() => newMockClient);

      const newLogger = new MockLogger();
      const newService = new ContentSearchService(mockCache, newLogger, config);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(newMockClient.indices.create).not.toHaveBeenCalled();

      await newService.shutdown();
    });

    it('should log error if index creation fails', async () => {
      const MockedClient = vi.mocked(Client);
      const newMockClient = new MockElasticsearchClient();
      newMockClient.indices.exists.mockResolvedValue(false);
      newMockClient.indices.create.mockRejectedValue(new Error('Index creation failed'));
      MockedClient.mockImplementation(() => newMockClient);

      const newLogger = new MockLogger();
      const newService = new ContentSearchService(mockCache, newLogger, config);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(newLogger.error).toHaveBeenCalledWith(
        'Failed to initialize Elasticsearch index',
        expect.any(Object)
      );

      await newService.shutdown();
    });
  });

  // ==========================================================================
  // Search Tests
  // ==========================================================================

  describe('search()', () => {
    it('should work with match_all query when no search term provided', async () => {
      const queryWithoutTerm: SearchQuery = {
        page: 1,
        pageSize: 10
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          hits: { total: { value: 10 }, hits: [], max_score: 1.0 },
          took: 5
        }
      });

      const result = await service.search(queryWithoutTerm);

      expect(result).toBeDefined();
      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: { match_all: {} }
          })
        })
      );
    });

    it('should handle all filter types correctly', async () => {
      const queryWithAllFilters: SearchQuery = {
        searchTerm: 'test',
        page: 1,
        pageSize: 10,
        filters: [
          { field: 'status', type: 'term', value: 'published' },
          { field: 'tags', type: 'terms', values: ['tag1', 'tag2'] },
          { field: 'views', type: 'range', range: { gte: 100, lte: 1000 } },
          { field: 'featured', type: 'exists' },
          { field: 'title', type: 'prefix', value: 'test' },
          { field: 'slug', type: 'wildcard', value: 'test*' }
        ]
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          hits: { total: { value: 0 }, hits: [], max_score: 0 },
          took: 5
        }
      });

      await service.search(queryWithAllFilters);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { term: { status: 'published' } },
                  { terms: { tags: ['tag1', 'tag2'] } },
                  { range: { views: { gte: 100, lte: 1000 } } },
                  { exists: { field: 'featured' } },
                  { prefix: { title: 'test' } },
                  { wildcard: { slug: 'test*' } }
                ])
              })
            })
          })
        })
      );
    });

    it('should handle all facet types correctly', async () => {
      const queryWithAllFacets: SearchQuery = {
        searchTerm: 'test',
        page: 1,
        pageSize: 10,
        facets: [
          { name: 'tags', field: 'tags', type: 'terms', size: 10 },
          { name: 'views_range', field: 'views', type: 'range', ranges: [{ from: 0, to: 100 }] },
          { name: 'published_date', field: 'publishedAt', type: 'date_histogram', interval: '1d' },
          { name: 'view_stats', field: 'views', type: 'stats' }
        ]
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          hits: { total: { value: 0 }, hits: [], max_score: 0 },
          took: 5,
          aggregations: {
            tags: { buckets: [] },
            views_range: { buckets: [] },
            published_date: { buckets: [] },
            view_stats: { count: 0, min: 0, max: 0, avg: 0, sum: 0 }
          }
        }
      });

      const result = await service.search(queryWithAllFacets);

      expect(result.facets).toHaveLength(4);
    });

    it('should use default sort if not provided', async () => {
      const queryWithoutSort: SearchQuery = {
        searchTerm: 'test',
        page: 1,
        pageSize: 10
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          hits: { total: { value: 0 }, hits: [], max_score: 0 },
          took: 5
        }
      });

      await service.search(queryWithoutSort);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sort: [{ _score: { order: 'desc' } }]
          })
        })
      );
    });

    it('should handle sort with mode and missing options', async () => {
      const queryWithAdvancedSort: SearchQuery = {
        searchTerm: 'test',
        page: 1,
        pageSize: 10,
        sort: [
          { field: 'views', order: 'desc', mode: 'avg', missing: '_last' }
        ]
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          hits: { total: { value: 0 }, hits: [], max_score: 0 },
          took: 5
        }
      });

      await service.search(queryWithAdvancedSort);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sort: [
              { views: { order: 'desc', mode: 'avg', missing: '_last' } }
            ]
          })
        })
      );
    });

    it('should filter fields when specified', async () => {
      const queryWithFields: SearchQuery = {
        searchTerm: 'test',
        page: 1,
        pageSize: 10,
        fields: ['id', 'title', 'summary']
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          hits: { total: { value: 0 }, hits: [], max_score: 0 },
          took: 5
        }
      });

      await service.search(queryWithFields);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            _source: ['id', 'title', 'summary']
          })
        })
      );
    });
  });

  describe('search() - continued', () => {
    const mockSearchQuery: SearchQuery = {
      searchTerm: 'test query',
      page: 1,
      pageSize: 10
    };

    const mockEsResponse = {
      body: {
        hits: {
          total: { value: 2 },
          max_score: 1.5,
          hits: [
            {
              _id: '1',
              _score: 1.5,
              _source: {
                id: '1',
                title: 'Test Content 1',
                content: 'This is test content',
                authorId: 'author1',
                tags: ['test'],
                status: 'published',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            },
            {
              _id: '2',
              _score: 1.2,
              _source: {
                id: '2',
                title: 'Test Content 2',
                content: 'More test content',
                authorId: 'author2',
                tags: ['test', 'example'],
                status: 'published',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            }
          ]
        },
        took: 15
      }
    };

    beforeEach(() => {
      mockEsClient.search.mockResolvedValue(mockEsResponse);
    });

    it('should execute search query and return results', async () => {
      const result = await service.search(mockSearchQuery);

      expect(result).toBeDefined();
      expect(result.documents).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(mockEsClient.search).toHaveBeenCalled();
    });

    it('should return cached results if available', async () => {
      // First search to populate cache
      await service.search(mockSearchQuery);

      // Reset mock
      mockEsClient.search.mockClear();

      // Second search should use cache
      const result = await service.search(mockSearchQuery);

      expect(result).toBeDefined();
      expect(mockEsClient.search).not.toHaveBeenCalled();
    });

    it('should cache results with 5-minute TTL', async () => {
      const setCacheSpy = vi.spyOn(mockCache, 'set');

      await service.search(mockSearchQuery);

      expect(setCacheSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        300 // 5 minutes
      );
    });

    it('should validate page number', async () => {
      const invalidQuery = { ...mockSearchQuery, page: 0 };

      await expect(service.search(invalidQuery)).rejects.toThrow('Page must be >= 1');
    });

    it('should validate page size', async () => {
      const invalidQuery = { ...mockSearchQuery, pageSize: 0 };

      await expect(service.search(invalidQuery)).rejects.toThrow(
        'Page size must be between 1 and 100'
      );
    });

    it('should validate maximum page size', async () => {
      const invalidQuery = { ...mockSearchQuery, pageSize: 101 };

      await expect(service.search(invalidQuery)).rejects.toThrow(
        'Page size must be between 1 and 100'
      );
    });

    it('should build correct Elasticsearch query with filters', async () => {
      const queryWithFilters: SearchQuery = {
        ...mockSearchQuery,
        filters: [
          { field: 'status', type: 'term', value: 'published' },
          { field: 'tags', type: 'terms', values: ['test', 'example'] }
        ]
      };

      await service.search(queryWithFilters);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { term: { status: 'published' } },
                  { terms: { tags: ['test', 'example'] } }
                ])
              })
            })
          })
        })
      );
    });

    it('should support faceted search', async () => {
      const queryWithFacets: SearchQuery = {
        ...mockSearchQuery,
        facets: [
          { name: 'tags', field: 'tags', type: 'terms', size: 10 }
        ]
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          ...mockEsResponse.body,
          aggregations: {
            tags: {
              buckets: [
                { key: 'test', doc_count: 5 },
                { key: 'example', doc_count: 3 }
              ]
            }
          }
        }
      });

      const result = await service.search(queryWithFacets);

      expect(result.facets).toBeDefined();
      expect(result.facets).toHaveLength(1);
      expect(result.facets![0].name).toBe('tags');
      expect(result.facets![0].buckets).toHaveLength(2);
    });

    it('should support date range filtering', async () => {
      const queryWithDateRange: SearchQuery = {
        ...mockSearchQuery,
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31')
        }
      };

      await service.search(queryWithDateRange);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  expect.objectContaining({
                    range: expect.objectContaining({
                      publishedAt: expect.any(Object)
                    })
                  })
                ])
              })
            })
          })
        })
      );
    });

    it('should support custom sorting', async () => {
      const queryWithSort: SearchQuery = {
        ...mockSearchQuery,
        sort: [
          { field: 'publishedAt', order: 'desc' },
          { field: 'title.raw', order: 'asc' }
        ]
      };

      await service.search(queryWithSort);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sort: [
              { publishedAt: { order: 'desc' } },
              { 'title.raw': { order: 'asc' } }
            ]
          })
        })
      );
    });

    it('should support highlighting', async () => {
      const queryWithHighlight: SearchQuery = {
        ...mockSearchQuery,
        highlight: {
          fields: ['title', 'content'],
          fragmentSize: 200,
          numberOfFragments: 2
        }
      };

      await service.search(queryWithHighlight);

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            highlight: expect.objectContaining({
              fields: {
                title: { fragment_size: 200, number_of_fragments: 2 },
                content: { fragment_size: 200, number_of_fragments: 2 }
              }
            })
          })
        })
      );
    });

    it('should track search analytics', async () => {
      await service.search(mockSearchQuery);

      const analytics = service.getAnalytics();
      expect(analytics).toHaveLength(1);
      expect(analytics[0].query).toBe('test query');
      expect(analytics[0].resultsCount).toBe(2);
      expect(analytics[0].page).toBe(1);
      expect(analytics[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle search errors gracefully', async () => {
      mockEsClient.search.mockRejectedValue(new Error('Search failed'));

      await expect(service.search(mockSearchQuery)).rejects.toThrow('Search failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Suggest Tests
  // ==========================================================================

  describe('suggest()', () => {
    it('should return autocomplete suggestions', async () => {
      mockEsClient.search.mockResolvedValue({
        body: {
          suggest: {
            content_suggest: [
              {
                options: [
                  { text: 'test content' },
                  { text: 'test article' },
                  { text: 'testing guide' }
                ]
              }
            ]
          }
        }
      });

      const suggestions = await service.suggest('test');

      expect(suggestions).toEqual(['test content', 'test article', 'testing guide']);
      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            suggest: expect.any(Object)
          })
        })
      );
    });

    it('should return empty array for short prefix', async () => {
      const suggestions = await service.suggest('t');

      expect(suggestions).toEqual([]);
      expect(mockEsClient.search).not.toHaveBeenCalled();
    });

    it('should handle suggest errors gracefully', async () => {
      mockEsClient.search.mockRejectedValue(new Error('Suggest failed'));

      const suggestions = await service.suggest('test');

      expect(suggestions).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Index Document Tests
  // ==========================================================================

  describe('indexDocument()', () => {
    const mockDocument: ContentDocument = {
      id: '123',
      title: 'Test Document',
      content: 'Test content',
      summary: 'Test summary',
      authorId: 'author1',
      slug: 'test-document',
      tags: ['test'],
      status: 'published',
      version: 1,
      metadata: {
        wordCount: 100,
        readingTime: 1,
        excerpt: 'Test excerpt',
        hashtags: [],
        language: 'en',
        hasMedia: false,
        lastModified: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      mockEsClient.index.mockResolvedValue({ body: { _id: '123' } });
    });

    it('should index a document successfully', async () => {
      await service.indexDocument(mockDocument);

      expect(mockEsClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'sovren_content',
          id: '123',
          refresh: 'wait_for'
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Document indexed', { id: '123' });
    });

    it('should invalidate cache after indexing', async () => {
      const invalidateSpy = vi.spyOn(mockCache, 'invalidate');

      await service.indexDocument(mockDocument);

      expect(invalidateSpy).toHaveBeenCalledWith('search:*');
    });

    it('should throw error if document has no id', async () => {
      const invalidDoc = { ...mockDocument, id: undefined } as any;

      await expect(service.indexDocument(invalidDoc)).rejects.toThrow(
        'Document must have an id'
      );
    });

    it('should handle indexing errors', async () => {
      mockEsClient.index.mockRejectedValue(new Error('Indexing failed'));

      await expect(service.indexDocument(mockDocument)).rejects.toThrow('Indexing failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Update Document Tests
  // ==========================================================================

  describe('updateDocument()', () => {
    beforeEach(() => {
      mockEsClient.update.mockResolvedValue({ body: { _id: '123' } });
    });

    it('should update a document successfully', async () => {
      await service.updateDocument('123', { title: 'Updated Title' });

      expect(mockEsClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'sovren_content',
          id: '123',
          refresh: 'wait_for'
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Document updated', { id: '123' });
    });

    it('should invalidate cache after updating', async () => {
      const invalidateSpy = vi.spyOn(mockCache, 'invalidate');

      await service.updateDocument('123', { title: 'Updated' });

      expect(invalidateSpy).toHaveBeenCalledWith('search:*');
    });

    it('should handle update errors', async () => {
      mockEsClient.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.updateDocument('123', { title: 'Updated' })).rejects.toThrow(
        'Update failed'
      );
    });
  });

  // ==========================================================================
  // Delete Document Tests
  // ==========================================================================

  describe('deleteDocument()', () => {
    beforeEach(() => {
      mockEsClient.delete.mockResolvedValue({ body: { _id: '123' } });
    });

    it('should delete a document successfully', async () => {
      await service.deleteDocument('123');

      expect(mockEsClient.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'sovren_content',
          id: '123',
          refresh: 'wait_for'
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Document deleted from index', { id: '123' });
    });

    it('should invalidate cache after deleting', async () => {
      const invalidateSpy = vi.spyOn(mockCache, 'invalidate');

      await service.deleteDocument('123');

      expect(invalidateSpy).toHaveBeenCalledWith('search:*');
    });

    it('should ignore 404 errors', async () => {
      const error = new Error('Not found - 404');
      mockEsClient.delete.mockRejectedValue(error);

      await expect(service.deleteDocument('123')).resolves.not.toThrow();
    });

    it('should throw non-404 errors', async () => {
      mockEsClient.delete.mockRejectedValue(new Error('Server error'));

      await expect(service.deleteDocument('123')).rejects.toThrow('Delete failed');
    });
  });

  // ==========================================================================
  // Bulk Index Tests
  // ==========================================================================

  describe('bulkIndex()', () => {
    const mockDocuments: ContentDocument[] = [
      {
        id: '1',
        title: 'Doc 1',
        content: 'Content 1',
        authorId: 'author1',
        slug: 'doc-1',
        tags: [],
        status: 'published',
        version: 1,
        metadata: {
          wordCount: 50,
          readingTime: 1,
          excerpt: '',
          hashtags: [],
          language: 'en',
          hasMedia: false,
          lastModified: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        title: 'Doc 2',
        content: 'Content 2',
        authorId: 'author2',
        slug: 'doc-2',
        tags: [],
        status: 'published',
        version: 1,
        metadata: {
          wordCount: 50,
          readingTime: 1,
          excerpt: '',
          hashtags: [],
          language: 'en',
          hasMedia: false,
          lastModified: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    beforeEach(() => {
      mockEsClient.bulk.mockResolvedValue({
        body: {
          errors: false,
          items: []
        }
      });
    });

    it('should bulk index multiple documents', async () => {
      await service.bulkIndex(mockDocuments);

      expect(mockEsClient.bulk).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Bulk indexed documents', { count: 2 });
    });

    it('should handle empty document array', async () => {
      await service.bulkIndex([]);

      expect(mockEsClient.bulk).not.toHaveBeenCalled();
    });

    it('should throw error if bulk operation has errors', async () => {
      mockEsClient.bulk.mockResolvedValue({
        body: {
          errors: true,
          items: [
            { index: { error: { type: 'error', reason: 'Failed to index' } } }
          ]
        }
      });

      await expect(service.bulkIndex(mockDocuments)).rejects.toThrow('Bulk indexing failed');
    });

    it('should invalidate all cache after bulk indexing', async () => {
      const invalidateSpy = vi.spyOn(mockCache, 'invalidate');

      await service.bulkIndex(mockDocuments);

      expect(invalidateSpy).toHaveBeenCalledWith('search:*');
    });
  });

  // ==========================================================================
  // Shutdown Tests
  // ==========================================================================

  describe('shutdown()', () => {
    it('should close Elasticsearch client', async () => {
      mockEsClient.close.mockResolvedValue({});

      await service.shutdown();

      expect(mockEsClient.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('ContentSearchService shut down');
    });

    it('should handle shutdown errors gracefully', async () => {
      mockEsClient.close.mockRejectedValue(new Error('Close failed'));

      await service.shutdown();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Analytics Tests
  // ==========================================================================

  describe('getAnalytics()', () => {
    it('should return search analytics', async () => {
      const mockQuery: SearchQuery = {
        searchTerm: 'test',
        page: 1,
        pageSize: 10
      };

      mockEsClient.search.mockResolvedValue({
        body: {
          hits: { total: { value: 5 }, hits: [], max_score: 1.0 },
          took: 10
        }
      });

      await service.search(mockQuery);

      const analytics = service.getAnalytics();
      expect(analytics).toHaveLength(1);
      expect(analytics[0]).toMatchObject({
        query: 'test',
        resultsCount: 5,
        page: 1
      });
    });

    it('should limit analytics to last 1000 entries', async () => {
      // Create 1010 searches
      for (let i = 0; i < 1010; i++) {
        mockEsClient.search.mockResolvedValue({
          body: {
            hits: { total: { value: 0 }, hits: [], max_score: 0 },
            took: 10
          }
        });

        await service.search({ searchTerm: `test${i}`, page: 1, pageSize: 10 });
      }

      const analytics = service.getAnalytics();
      expect(analytics.length).toBeLessThanOrEqual(1000);
    });
  });
});
