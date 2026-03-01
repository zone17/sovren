/**
 * Content API Validation Schemas
 *
 * Zod validation schemas for all Content API endpoints
 * Ensures type safety and input validation
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

const MetadataValueSchema = z.union([z.string().max(10000), z.number(), z.boolean(), z.null()]);

const MetadataSchema = z
  .record(z.string(), MetadataValueSchema)
  .refine((obj) => Object.keys(obj).length <= 50, {
    message: 'Metadata must have 50 or fewer keys',
  })
  .optional();

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const TimeRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

// ============================================================================
// Publishing Validation
// ============================================================================

export const PublishContentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(1000000),
  contentType: z.enum(['article', 'video', 'audio', 'image', 'nostr-event']),
  tags: z.array(z.string()).max(20).optional(),
  metadata: MetadataSchema,
  publishToNostr: z.boolean().optional().default(true),
  relayUrls: z.array(z.string().url()).max(20).optional(),
  monetization: z
    .object({
      priceInSats: z.number().int().min(0).max(100000000).optional(),
      allowTipping: z.boolean().optional().default(true),
      subscriptionTier: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// Moderation Validation
// ============================================================================

export const ModerateContentSchema = z.object({
  contentId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'flag', 'review']),
  reason: z.string().max(1000).optional(),
  moderatorId: z.string().uuid(),
  notes: z.string().max(5000).optional(),
});

// ============================================================================
// Search Validation
// ============================================================================

export const SearchContentSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z
    .object({
      contentType: z.array(z.string()).max(10).optional(),
      tags: z.array(z.string()).max(20).optional(),
      authorId: z.string().uuid().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      minPrice: z.number().int().min(0).optional(),
      maxPrice: z.number().int().min(0).optional(),
    })
    .optional(),
  sort: z.enum(['relevance', 'date', 'popularity', 'price']).optional().default('relevance'),
  pagination: PaginationSchema.optional(),
});

// ============================================================================
// Recommendations Validation
// ============================================================================

export const GetRecommendationsSchema = z.object({
  userId: z.string().uuid(),
  context: z
    .object({
      currentContentId: z.string().uuid().optional(),
      recentViewedIds: z.array(z.string().uuid()).max(50).optional(),
      interests: z.array(z.string()).max(20).optional(),
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  diversity: z.number().min(0).max(1).optional().default(0.5),
});

// ============================================================================
// Analytics Validation
// ============================================================================

export const GetContentAnalyticsSchema = z.object({
  contentId: z.string().uuid(),
  timeRange: TimeRangeSchema.optional(),
  metrics: z.array(z.string()).max(20).optional(),
});

// ============================================================================
// Versioning Validation
// ============================================================================

export const GetVersionHistorySchema = z.object({
  contentId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const RevertContentVersionSchema = z.object({
  contentId: z.string().uuid(),
  targetVersionId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

// ============================================================================
// Content CRUD Validation
// ============================================================================

export const ListContentSchema = z.object({
  query: z.string().max(500).optional(),
  sort: z.enum(['date', 'popularity', 'relevance', 'price']).optional().default('date'),
  contentType: z.enum(['article', 'video', 'audio', 'image', 'nostr-event']).optional(),
  tags: z.string().optional(), // comma-separated
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const UpdateContentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(1000000).optional(),
  summary: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(['draft', 'ready', 'scheduled']).optional(),
  metadata: MetadataSchema,
});

// ============================================================================
// Parameter Validation
// ============================================================================

export const ContentIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// Query Parameter Validation
// ============================================================================

export const ContentQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().optional().default(false),
  includeMetadata: z.coerce.boolean().optional().default(true),
});

// ============================================================================
// Validation Middleware Helper
// ============================================================================

export const ContentValidators = {
  publishContent: PublishContentSchema,
  moderateContent: ModerateContentSchema,
  searchContent: SearchContentSchema,
  getRecommendations: GetRecommendationsSchema,
  getContentAnalytics: GetContentAnalyticsSchema,
  getVersionHistory: GetVersionHistorySchema,
  revertContentVersion: RevertContentVersionSchema,
  contentIdParam: ContentIdParamSchema,
  contentQuery: ContentQuerySchema,
  listContent: ListContentSchema,
  updateContent: UpdateContentSchema,
} as const;

export type ContentValidatorKeys = keyof typeof ContentValidators;
