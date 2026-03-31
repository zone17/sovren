/**
 * Content API Controller
 *
 * Handles HTTP requests for content-related operations
 * Integrates with Content Services via DI container
 */

import { Request, Response, NextFunction } from 'express';
import {
  ContentPublishingService,
  ContentModerationService,
  ContentSearchService,
  ContentRecommendationService,
  ContentAnalyticsService,
  ContentVersioningService,
  ContentCreationService,
} from '../../services/content';
import type { SearchQuery, SearchResult, ContentDocument } from '../../types/search';
import type { AnalyticsQuery, AnalyticsResult, TimeSeriesData } from '../../types/analytics';
import type { Content, ContentVersion, RecommendationOptions } from '../../interfaces/content';
import type { ModerationResult } from '../../types/moderation';
import {
  PublishContentRequestDTO,
  PublishContentResponseDTO,
  ModerateContentRequestDTO,
  ModerateContentResponseDTO,
  SearchContentRequestDTO,
  SearchContentResponseDTO,
  ContentSearchResultDTO,
  GetRecommendationsRequestDTO,
  GetRecommendationsResponseDTO,
  GetContentAnalyticsRequestDTO,
  ContentAnalyticsResponseDTO,
  GetVersionHistoryResponseDTO,
  RevertContentVersionRequestDTO,
  RevertContentVersionResponseDTO,
  ContentApiResponse,
} from '../../dtos/content';
import { asyncHandler } from '../../middleware/error-handler-middleware';
import { createApiResponse } from '../../utils/api-response';

/**
 * Helper to build ContentApiResponse metadata from createApiResponse.
 * Bridges the gap between ApiResponseMetadata (processingTime optional)
 * and ContentApiResponse metadata (processingTime required).
 */
function buildMetadata(
  req: Request,
  startTime: number
): { requestId: string; timestamp: string; processingTime: number } {
  const meta = createApiResponse(req, null, startTime).metadata;
  return {
    requestId: meta.requestId,
    timestamp: meta.timestamp,
    processingTime: meta.processingTime ?? Date.now() - startTime,
  };
}

/**
 * Maps a ContentDocument from search results to a ContentSearchResultDTO
 */
function mapDocumentToSearchResult(doc: ContentDocument): ContentSearchResultDTO {
  return {
    contentId: doc.id,
    title: doc.title,
    excerpt: doc.metadata?.excerpt || doc.content.substring(0, 200),
    contentType: doc.category || 'article',
    authorId: doc.authorId,
    authorName: (doc as ContentDocument & { authorName?: string }).authorName || 'Unknown',
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : new Date().toISOString(),
    tags: doc.tags || [],
    priceInSats: undefined,
    engagementScore: doc._score || 0,
    relevanceScore: doc._score || 0,
  };
}

/**
 * Converts a SearchContentRequestDTO into a SearchQuery for the search service
 */
function toSearchQuery(dto: SearchContentRequestDTO): SearchQuery {
  return {
    searchTerm: dto.query,
    page: dto.pagination?.page ?? 1,
    pageSize: dto.pagination?.limit ?? 20,
    sort: dto.sort
      ? [{ field: dto.sort === 'date' ? 'createdAt' : dto.sort, order: 'desc' as const }]
      : undefined,
  };
}

/**
 * Content Controller
 *
 * Manages all content-related HTTP endpoints:
 * - Content CRUD (create, read, update, delete, list)
 * - Publishing content
 * - Content moderation
 * - Content search and discovery
 * - Content recommendations
 * - Content analytics
 * - Version management
 */
export class ContentController {
  constructor(
    private publishingService: ContentPublishingService,
    private moderationService: ContentModerationService,
    private searchService: ContentSearchService,
    private recommendationService: ContentRecommendationService,
    private analyticsService: ContentAnalyticsService,
    private versioningService: ContentVersioningService,
    private creationService: ContentCreationService
  ) {}

  /**
   * GET /api/v1/content
   *
   * List content with optional filters (discovery feed)
   */
  public listContent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const requestData: SearchContentRequestDTO = {
        query: (req.query.query as string) || '*',
        sort: (req.query.sort as SearchContentRequestDTO['sort']) || 'date',
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        },
      };

      const searchQuery = toSearchQuery(requestData);
      const result: SearchResult = await this.searchService.search(searchQuery);

      const response: ContentApiResponse<SearchContentResponseDTO> = {
        success: true,
        data: {
          results: result.documents.map(mapDocumentToSearchResult),
          totalResults: result.total,
          currentPage: result.page,
          totalPages: result.totalPages,
          searchTime: Date.now() - startTime,
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * GET /api/v1/content/:id
   *
   * Get a single content item by ID
   */
  public getContent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const contentId = req.params.id;

      const result: Content = await this.creationService.getContent(contentId);

      const response: ContentApiResponse<Content> = {
        success: true,
        data: result,
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * PUT /api/v1/content/:id
   *
   * Update an existing content item
   */
  public updateContent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const contentId = req.params.id;
      const updates = req.body;

      const result: Content = await this.creationService.updateContent(contentId, updates);

      const response: ContentApiResponse<Content> = {
        success: true,
        data: result,
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * DELETE /api/v1/content/:id
   *
   * Delete a content item
   */
  public deleteContent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const contentId = req.params.id;

      await this.creationService.deleteContent(contentId);

      const response: ContentApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * POST /api/v1/content/publish
   *
   * Publish new content to the platform and NOSTR network
   */
  public publishContent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const requestData: PublishContentRequestDTO = req.body;
      // Publish content via service — publish() takes contentId + options
      const contentId = requestData.contentId;
      const result = await this.publishingService.publish(contentId, {
        distributeToNostr: requestData.publishToNostr,
      });

      const response: ContentApiResponse<PublishContentResponseDTO> = {
        success: true,
        data: {
          contentId: result.id,
          status: result.status === 'published' ? 'published' : 'pending',
          nostrEventId: result.nostrEventId,
          publishedAt: result.publishedAt
            ? result.publishedAt.toISOString()
            : new Date().toISOString(),
          url: `/content/${result.id}`,
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(201).json(response);
    }
  );

  /**
   * POST /api/v1/content/moderate
   *
   * Moderate content (approve, reject, flag)
   */
  public moderateContent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const requestData: ModerateContentRequestDTO = req.body;

      // Fetch actual content text — moderate() runs analysis on the string passed to it
      const contentToModerate = await this.creationService.getContent(requestData.contentId);

      // moderate() takes contentId, content string, metadata, options
      const result: ModerationResult = await this.moderationService.moderate(
        requestData.contentId,
        contentToModerate.content,
        {
          moderatorId: requestData.moderatorId,
          reason: requestData.reason,
          notes: requestData.notes,
          action: requestData.action,
        }
      );

      const response: ContentApiResponse<ModerateContentResponseDTO> = {
        success: true,
        data: {
          contentId: requestData.contentId,
          previousStatus: (result.metadata?.previousStatus as string) || 'pending',
          newStatus: result.status,
          moderationAction: result.action,
          moderatedAt: result.timestamp.toISOString(),
          moderatedBy: requestData.moderatorId,
          autoModeration:
            result.confidence > 0
              ? {
                  aiScore: result.confidence,
                  flags: result.reasons,
                  confidence: result.confidence,
                }
              : undefined,
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * GET /api/v1/content/search
   *
   * Search for content across the platform
   */
  public searchContent = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const requestData: SearchContentRequestDTO = {
        query: req.query.query as string,
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : undefined,
        sort: req.query.sort as SearchContentRequestDTO['sort'],
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        },
      };

      const searchQuery = toSearchQuery(requestData);
      const result: SearchResult = await this.searchService.search(searchQuery);

      const response: ContentApiResponse<SearchContentResponseDTO> = {
        success: true,
        data: {
          results: result.documents.map(mapDocumentToSearchResult),
          totalResults: result.total,
          currentPage: result.page,
          totalPages: result.totalPages,
          searchTime: Date.now() - startTime,
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * GET /api/v1/content/recommendations
   *
   * Get personalized content recommendations
   */
  public getRecommendations = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const userId = req.query.userId as string;

      const requestData: GetRecommendationsRequestDTO = {
        userId,
        context: req.query.context ? JSON.parse(req.query.context as string) : undefined,
        limit: parseInt(req.query.limit as string) || 10,
        diversity: parseFloat(req.query.diversity as string) || 0.5,
      };

      // getRecommendations returns Content[], not a wrapper object
      const options: RecommendationOptions = {
        limit: requestData.limit,
        algorithm: 'hybrid',
      };
      const contents: Content[] = await this.recommendationService.getRecommendations(
        requestData.userId,
        options
      );

      const response: ContentApiResponse<GetRecommendationsResponseDTO> = {
        success: true,
        data: {
          recommendations: contents.map((c: Content) => ({
            contentId: c.id,
            title: c.title,
            excerpt: c.metadata?.excerpt || c.content.substring(0, 200),
            contentType: c.category || 'article',
            authorId: c.authorId,
            authorName: (c as Content & { authorName?: string }).authorName || 'Unknown',
            // TODO: Content[] from recommendationService lacks per-item relevance scores;
            // integrate scoring when recommendation service returns scored results
            score: 0,
            reason: 'recommended',
            tags: c.tags || [],
          })),
          algorithm: 'hybrid',
          generatedAt: new Date().toISOString(),
          personalizedFor: userId,
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * GET /api/v1/content/analytics/:id
   *
   * Get analytics for specific content
   */
  public getContentAnalytics = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const contentId = req.params.id;

      const requestData: GetContentAnalyticsRequestDTO = {
        contentId,
        timeRange: req.query.timeRange ? JSON.parse(req.query.timeRange as string) : undefined,
        metrics: req.query.metrics ? (req.query.metrics as string).split(',') : undefined,
      };

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const analyticsQuery: AnalyticsQuery = {
        contentIds: [contentId],
        startDate: requestData.timeRange?.start
          ? new Date(requestData.timeRange.start)
          : thirtyDaysAgo,
        endDate: requestData.timeRange?.end ? new Date(requestData.timeRange.end) : now,
        includeTimeSeries: true,
      };

      const result: AnalyticsResult = await this.analyticsService.getAnalytics(analyticsQuery);

      const response: ContentApiResponse<ContentAnalyticsResponseDTO> = {
        success: true,
        data: {
          contentId,
          timeRange: {
            start: analyticsQuery.startDate.toISOString(),
            end: analyticsQuery.endDate.toISOString(),
          },
          overview: {
            totalViews: (result.metrics['views'] as number) || 0,
            uniqueViewers: result.uniqueUsers,
            totalEngagements: result.totalEvents,
            averageEngagementRate: (result.metrics['engagementRate'] as number) || 0,
            revenue: {
              totalSats: (result.metrics['revenueSats'] as number) || 0,
              totalUSD: (result.metrics['revenueUsd'] as number) || 0,
            },
          },
          engagement: {
            likes: (result.metrics['likes'] as number) || 0,
            shares: (result.metrics['shares'] as number) || 0,
            comments: (result.metrics['comments'] as number) || 0,
            saves: (result.metrics['saves'] as number) || 0,
          },
          traffic: {
            sources: (result.metrics['trafficSources'] as Record<string, number>) || {},
            devices: (result.metrics['devices'] as Record<string, number>) || {},
            geoLocations: (result.metrics['geoLocations'] as Record<string, number>) || {},
          },
          performance: {
            averageReadTime: (result.metrics['avgReadTime'] as number) || 0,
            completionRate: result.performance?.completionRate || 0,
            bounceRate: 0,
          },
          trends: (result.timeSeries || []).map((t: TimeSeriesData) => ({
            timestamp: t.timestamp.toISOString(),
            views: t.metrics['views'] || 0,
            engagement: t.metrics['engagement'] || 0,
          })),
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * GET /api/v1/content/versions/:id
   *
   * Get version history for content
   */
  public getVersionHistory = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const contentId = req.params.id;

      // getVersions returns ContentVersion[]
      const versions: ContentVersion[] = await this.versioningService.getVersions(contentId);

      const response: ContentApiResponse<GetVersionHistoryResponseDTO> = {
        success: true,
        data: {
          contentId,
          currentVersion: versions.length > 0 ? versions[0].versionNumber : 0,
          versions: versions.map((v: ContentVersion) => ({
            versionId: v.id,
            contentId: v.contentId,
            versionNumber: v.versionNumber,
            createdAt: v.createdAt.toISOString(),
            createdBy: v.createdBy,
            changes: v.delta
              ? (Array.isArray(v.delta) ? v.delta : []).map(
                  (op: { path: string; value?: unknown; from?: string }) => ({
                    field: op.path,
                    oldValue: op.from || null,
                    newValue: op.value || null,
                  })
                )
              : [],
            changesSummary: v.message || '',
            size: 0,
          })),
          totalVersions: versions.length,
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );

  /**
   * POST /api/v1/content/versions/:id/revert
   *
   * Revert content to a previous version
   */
  public revertContentVersion = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const contentId = req.params.id;
      const requestData: RevertContentVersionRequestDTO = {
        ...req.body,
        contentId,
      };

      // revert() takes contentId + versionId, returns Content
      const result: Content = await this.versioningService.revert(
        contentId,
        requestData.targetVersionId
      );

      const response: ContentApiResponse<RevertContentVersionResponseDTO> = {
        success: true,
        data: {
          contentId: result.id,
          previousVersion: result.version,
          revertedToVersion: 0, // The version number we reverted to
          newVersion: result.version,
          revertedAt: new Date().toISOString(),
          revertedBy:
            (req as unknown as { user?: { nostr_pubkey?: string } }).user?.nostr_pubkey || '',
        },
        metadata: buildMetadata(req, startTime),
      };

      res.status(200).json(response);
    }
  );
}
