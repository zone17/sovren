/**
 * Distribution API Validation Schemas
 * Zod schemas for EPIC-009 endpoints
 */

import { z } from 'zod';

const platformEnum = z.enum(['mastodon', 'bluesky', 'twitter', 'youtube']);

// ============================================================================
// Platform Connection Validators
// ============================================================================

export const PlatformParamSchema = z.object({
  platform: platformEnum,
});

export const ConnectBodySchema = z.object({
  instance_url: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
}).optional();

export const CallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// ============================================================================
// Distribution Validators
// ============================================================================

export const PublishBodySchema = z.object({
  content_id: z.string().uuid(),
  platforms: z.array(platformEnum).min(1),
  schedule: z.object({
    mastodon: z.string().datetime().optional(),
    bluesky: z.string().datetime().optional(),
    twitter: z.string().datetime().optional(),
    youtube: z.string().datetime().optional(),
  }).optional(),
  use_repurposed: z.boolean().default(false),
});

export const RepurposeBodySchema = z.object({
  content_id: z.string().uuid(),
  target_platforms: z.array(platformEnum).min(1),
});

export const ContentIdParamSchema = z.object({
  contentId: z.string().uuid(),
});

export const RepurposedIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const CrossPostIdParamSchema = z.object({
  crossPostId: z.string().uuid(),
});

// ============================================================================
// Inbox Validators
// ============================================================================

export const InboxQuerySchema = z.object({
  platform: z.enum(['all', 'mastodon', 'bluesky', 'twitter', 'youtube', 'nostr']).default('all'),
  status: z.enum(['unread', 'all', 'archived']).default('unread'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const MessageIdParamSchema = z.object({
  messageId: z.string().uuid(),
});

export const ReplyBodySchema = z.object({
  content: z.string().min(1).max(5000),
});

export const BatchBodySchema = z.object({
  message_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['mark_read', 'mark_unread', 'archive']),
});

// ============================================================================
// Analytics Validators
// ============================================================================

export const AnalyticsContentIdParamSchema = z.object({
  contentId: z.string().uuid(),
});

// ============================================================================
// Inferred types for route handlers
// ============================================================================

export type PlatformParam = z.infer<typeof PlatformParamSchema>;
export type ConnectBody = z.infer<typeof ConnectBodySchema>;
export type CallbackQuery = z.infer<typeof CallbackQuerySchema>;
export type PublishBody = z.infer<typeof PublishBodySchema>;
export type RepurposeBody = z.infer<typeof RepurposeBodySchema>;
export type ContentIdParam = z.infer<typeof ContentIdParamSchema>;
export type RepurposedIdParam = z.infer<typeof RepurposedIdParamSchema>;
export type CrossPostIdParam = z.infer<typeof CrossPostIdParamSchema>;
export type InboxQuery = z.infer<typeof InboxQuerySchema>;
export type MessageIdParam = z.infer<typeof MessageIdParamSchema>;
export type ReplyBody = z.infer<typeof ReplyBodySchema>;
export type BatchBody = z.infer<typeof BatchBodySchema>;
export type AnalyticsContentIdParam = z.infer<typeof AnalyticsContentIdParamSchema>;

// ============================================================================
// Aggregated exports for route use
// ============================================================================

export const DistributionValidators = {
  platformParam: PlatformParamSchema,
  connectBody: ConnectBodySchema,
  callbackQuery: CallbackQuerySchema,
  publishBody: PublishBodySchema,
  repurposeBody: RepurposeBodySchema,
  contentIdParam: ContentIdParamSchema,
  repurposedIdParam: RepurposedIdParamSchema,
  crossPostIdParam: CrossPostIdParamSchema,
  inboxQuery: InboxQuerySchema,
  messageIdParam: MessageIdParamSchema,
  replyBody: ReplyBodySchema,
  batchBody: BatchBodySchema,
  analyticsContentIdParam: AnalyticsContentIdParamSchema,
};
