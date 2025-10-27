/**
 * Search Type Definitions
 * User Story: US-E5-014
 * Comprehensive type definitions for Elasticsearch-powered content search
 */

import type { Content } from '../interfaces/content';

// ============================================================================
// Search Query Types
// ============================================================================

export interface SearchQuery {
  searchTerm?: string;
  filters?: SearchFilter[];
  facets?: SearchFacet[];
  page: number;
  pageSize: number;
  sort?: SearchSort[];
  highlight?: SearchHighlight;
  dateRange?: {
    from: Date;
    to: Date;
  };
  fields?: string[];
}

export interface SearchFilter {
  field: string;
  type: 'term' | 'terms' | 'range' | 'exists' | 'prefix' | 'wildcard';
  value?: any;
  values?: any[];
  range?: {
    gte?: any;
    lte?: any;
    gt?: any;
    lt?: any;
  };
}

export interface SearchFacet {
  name: string;
  field: string;
  type: 'terms' | 'range' | 'date_histogram' | 'stats';
  size?: number;
  order?: { [key: string]: 'asc' | 'desc' };
  ranges?: Array<{ from?: number; to?: number; key?: string }>;
  interval?: string;
  format?: string;
}

export interface SearchSort {
  field: string;
  order: 'asc' | 'desc';
  mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
  missing?: '_first' | '_last';
}

export interface SearchHighlight {
  fields: string[];
  preTags?: string[];
  postTags?: string[];
  fragmentSize?: number;
  numberOfFragments?: number;
}

// ============================================================================
// Search Result Types
// ============================================================================

export interface SearchResult {
  documents: ContentDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: SearchAggregation[];
  took?: number;
  maxScore?: number;
}

export interface ContentDocument extends Content {
  _id?: string;
  _score?: number;
  _highlight?: Record<string, string[]>;
}

export interface SearchAggregation {
  name: string;
  buckets?: Array<{
    key: string;
    doc_count: number;
    [key: string]: any;
  }>;
  value?: number;
  stats?: {
    count?: number;
    min?: number;
    max?: number;
    avg?: number;
    sum?: number;
  };
}

// ============================================================================
// Service Interface
// ============================================================================

export interface IContentSearchService {
  /**
   * Search content with full-text search and filters
   */
  search(query: SearchQuery): Promise<SearchResult>;

  /**
   * Get autocomplete suggestions
   */
  suggest(prefix: string, field?: string): Promise<string[]>;

  /**
   * Index a single document
   */
  indexDocument(document: ContentDocument): Promise<void>;

  /**
   * Update a document in the index
   */
  updateDocument(id: string, updates: Partial<ContentDocument>): Promise<void>;

  /**
   * Remove a document from the index
   */
  deleteDocument(id: string): Promise<void>;

  /**
   * Bulk index multiple documents
   */
  bulkIndex(documents: ContentDocument[]): Promise<void>;

  /**
   * Shutdown and cleanup
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ElasticsearchConfig {
  node: string;
  auth?: {
    username?: string;
    password?: string;
    apiKey?: string;
  };
  cloud?: {
    id: string;
  };
  maxRetries?: number;
  requestTimeout?: number;
  sniffOnStart?: boolean;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface SearchAnalytics {
  query: string;
  userId?: string;
  resultsCount: number;
  clickedResults?: string[];
  timestamp: Date;
  filters?: SearchFilter[];
  page: number;
  duration: number;
}

export interface SearchMetrics {
  totalSearches: number;
  averageResultsCount: number;
  averageResponseTime: number;
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
  clickThroughRate: number;
}
