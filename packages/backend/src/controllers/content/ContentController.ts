// @ts-nocheck
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
import {
  PublishContentRequestDTO,
  PublishContentResponseDTO,
  ModerateContentRequestDTO,
  ModerateContentResponseDTO,
  SearchContentRequestDTO,
  SearchContentResponseDTO,
  GetRecommendationsRequestDTO,
  GetRecommendationsResponseDTO,
  GetContentAnalyticsRequestDTO,
  ContentAnalyticsResponseDTO,
  GetVersionHistoryRequestDTO,
  GetVersionHistoryResponseDTO,
  RevertContentVersionRequestDTO,
  RevertContentVersionResponseDTO,
  ContentApiResponse,
} from '../../dtos/content';
import { asyncHandler } from '../../middleware/error-handler-middleware';
import { createApiResponse } from '../../utils/api-response';

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
        sort: (req.query.sort as any) || 'date',
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        },
      };

      const result = await this.searchService.search(requestData);

      const response: ContentApiResponse<SearchContentResponseDTO> = {
        success: true,
        data: {
          results: result.results.map((item) => ({
            contentId: item.id,
            title: item.title,
            excerpt: item.excerpt || item.content.substring(0, 200),
            contentType: item.contentType,
            authorId: item.authorId,
            authorName: item.authorName || 'Unknown',
            publishedAt: item.publishedAt.toISOString(),
            tags: item.tags,
            priceInSats: item.priceInSats,
            engagementScore: item.engagementScore || 0,
            relevanceScore: item.relevanceScore || 0,
          })),
          totalResults: result.totalResults,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          searchTime: Date.now() - startTime,
          facets: result.facets,
        },
        metadata: createApiResponse(req, null, startTime).metadata,
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

      const result = await this.creationService.getContent(contentId);

      const response: ContentApiResponse<any> = {
        success: true,
        data: result,
        metadata: createApiResponse(req, null, startTime).metadata,
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

      const result = await this.creationService.updateContent(contentId, updates);

      const response: ContentApiResponse<any> = {
        success: true,
        data: result,
        metadata: createApiResponse(req, null, startTime).metadata,
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
        metadata: createApiResponse(req, null, startTime).metadata,
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
      const userId = (req as any).user?.nostr_pubkey;

      // Publish content via service
      const result = await this.publishingService.publishContent({
        ...requestData,
        authorId: userId,
      });

      const response: ContentApiResponse<PublishContentResponseDTO> = {
        success: true,
        data: {
          contentId: result.id,
          status: result.status as any,
          nostrEventId: result.nostrEventId,
          relayPublishResults: result.relayResults,
          publishedAt: result.publishedAt.toISOString(),
          url: `/content/${result.id}`,
        },
        metadata: createApiResponse(req, null, startTime).metadata,
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

      const result = await this.moderationService.moderateContent(
        requestData.contentId,
        requestData.action,
        {
          moderatorId: requestData.moderatorId,
          reason: requestData.reason,
          notes: requestData.notes,
        }
      );

      const response: ContentApiResponse<ModerateContentResponseDTO> = {
        success: true,
        data: {
          contentId: result.contentId,
          previousStatus: result.previousStatus,
          newStatus: result.newStatus,
          moderationAction: result.action,
          moderatedAt: result.timestamp.toISOString(),
          moderatedBy: result.moderatorId,
          autoModeration: result.autoModerationData,
        },
        metadata: createApiResponse(req, null, startTime).metadata,
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
        sort: req.query.sort as any,
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        },
      };

      const result = await this.searchService.search(requestData);

      const response: ContentApiResponse<SearchContentResponseDTO> = {
        success: true,
        data: {
          results: result.results.map((item) => ({
            contentId: item.id,
            title: item.title,
            excerpt: item.excerpt || item.content.substring(0, 200),
            contentType: item.contentType,
            authorId: item.authorId,
            authorName: item.authorName || 'Unknown',
            publishedAt: item.publishedAt.toISOString(),
            tags: item.tags,
            priceInSats: item.priceInSats,
            engagementScore: item.engagementScore || 0,
            relevanceScore: item.relevanceScore || 0,
          })),
          totalResults: result.totalResults,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          searchTime: Date.now() - startTime,
          facets: result.facets,
        },
        metadata: createApiResponse(req, null, startTime).metadata,
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

      const result = await this.recommendationService.getRecommendations(
        requestData.userId,
        requestData.context
      );

      const response: ContentApiResponse<GetRecommendationsResponseDTO> = {
        success: true,
        data: {
          recommendations: result.recommendations.map((rec) => ({
            contentId: rec.contentId,
            title: rec.title,
            excerpt: rec.excerpt,
            contentType: rec.contentType,
            authorId: rec.authorId,
            authorName: rec.authorName,
            score: rec.score,
            reason: rec.reason,
            tags: rec.tags,
            priceInSats: rec.priceInSats,
            thumbnailUrl: rec.thumbnailUrl,
          })),
          algorithm: result.algorithm,
          generatedAt: result.timestamp.toISOString(),
          personalizedFor: userId,
        },
        metadata: createApiResponse(req, null, startTime).metadata,
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

      const result = await this.analyticsService.getContentAnalytics(contentId, {
        startDate: requestData.timeRange?.start ? new Date(requestData.timeRange.start) : undefined,
        endDate: requestData.timeRange?.end ? new Date(requestData.timeRange.end) : undefined,
      });

      const response: ContentApiResponse<ContentAnalyticsResponseDTO> = {
        success: true,
        data: {
          contentId: result.contentId,
          timeRange: {
            start: result.timeRange.start.toISOString(),
            end: result.timeRange.end.toISOString(),
          },
          overview: {
            totalViews: result.totalViews,
            uniqueViewers: result.uniqueViewers,
            totalEngagements: result.totalEngagements,
            averageEngagementRate: result.averageEngagementRate,
            revenue: {
              totalSats: result.revenue.totalSats,
              totalUSD: result.revenue.totalUSD,
            },
          },
          engagement: result.engagement,
          traffic: result.traffic,
          performance: result.performance,
          trends: result.trends.map((t) => ({
            timestamp: t.timestamp.toISOString(),
            views: t.views,
            engagement: t.engagement,
          })),
        },
        metadata: createApiResponse(req, null, startTime).metadata,
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

      const requestData: GetVersionHistoryRequestDTO = {
        contentId,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const result = await this.versioningService.getVersionHistory(
        contentId,
        requestData.limit,
        requestData.offset
      );

      const response: ContentApiResponse<GetVersionHistoryResponseDTO> = {
        success: true,
        data: {
          contentId: result.contentId,
          currentVersion: result.currentVersion,
          versions: result.versions.map((v) => ({
            versionId: v.id,
            contentId: v.contentId,
            versionNumber: v.versionNumber,
            createdAt: v.createdAt.toISOString(),
            createdBy: v.createdBy,
            changes: v.changes,
            changesSummary: v.changesSummary,
            size: v.size,
          })),
          totalVersions: result.totalVersions,
        },
        metadata: createApiResponse(req, null, startTime).metadata,
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

      const result = await this.versioningService.revertToVersion(
        contentId,
        requestData.targetVersionId,
        {
          reason: requestData.reason,
          userId: (req as any).user?.nostr_pubkey,
        }
      );

      const response: ContentApiResponse<RevertContentVersionResponseDTO> = {
        success: true,
        data: {
          contentId: result.contentId,
          previousVersion: result.previousVersion,
          revertedToVersion: result.revertedToVersion,
          newVersion: result.newVersion,
          revertedAt: result.timestamp.toISOString(),
          revertedBy: result.userId,
        },
        metadata: createApiResponse(req, null, startTime).metadata,
      };

      res.status(200).json(response);
    }
  );
}
