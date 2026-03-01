/**
 * User API Validation Schemas
 *
 * Zod validation schemas for all User API endpoints
 * Ensures type safety and input validation
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const TimeRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

// ============================================================================
// Profile Validation
// ============================================================================

export const GetUserProfileSchema = z.object({
  userId: z.string().uuid(),
  includeStats: z.coerce.boolean().optional().default(true),
  includeNostrProfile: z.coerce.boolean().optional().default(true),
});

export const UpdateUserProfileSchema = z.object({
  userId: z.string().uuid(),
  profile: z.object({
    displayName: z.string().min(1).max(100).optional(),
    bio: z.string().max(5000).optional(),
    avatarUrl: z.string().url().max(2000).optional(),
    bannerUrl: z.string().url().max(2000).optional(),
    website: z.string().url().max(2000).optional(),
    location: z.string().max(200).optional(),
    socialLinks: z
      .object({
        twitter: z.string().max(200).optional(),
        github: z.string().max(200).optional(),
        nostr: z
          .string()
          .regex(/^npub[0-9a-z]+$/)
          .optional(),
      })
      .optional(),
  }),
});

// ============================================================================
// Preferences Validation
// ============================================================================

export const GetUserPreferencesSchema = z.object({
  userId: z.string().uuid(),
});

export const UpdateUserPreferencesSchema = z.object({
  userId: z.string().uuid(),
  preferences: z.object({
    notifications: z
      .object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
        nostr: z.boolean().optional(),
        types: z
          .object({
            newFollower: z.boolean().optional(),
            newComment: z.boolean().optional(),
            newPayment: z.boolean().optional(),
            contentMilestone: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
    privacy: z
      .object({
        showEmail: z.boolean().optional(),
        showLocation: z.boolean().optional(),
        allowIndexing: z.boolean().optional(),
        showAnalytics: z.boolean().optional(),
      })
      .optional(),
    content: z
      .object({
        defaultVisibility: z.enum(['public', 'followers', 'subscribers']).optional(),
        allowComments: z.boolean().optional(),
        allowTipping: z.boolean().optional(),
        defaultRelays: z.array(z.string().url()).max(20).optional(),
      })
      .optional(),
    monetization: z
      .object({
        defaultPricing: z
          .object({
            article: z.number().int().min(0).optional(),
            video: z.number().int().min(0).optional(),
            audio: z.number().int().min(0).optional(),
          })
          .optional(),
        paymentMethods: z.array(z.string()).max(10).optional(),
        autoWithdraw: z.boolean().optional(),
        withdrawThreshold: z.number().int().min(0).optional(),
      })
      .optional(),
  }),
});

// ============================================================================
// Activity Validation
// ============================================================================

export const GetUserActivitySchema = z.object({
  userId: z.string().uuid(),
  activityTypes: z.array(z.enum(['content', 'engagement', 'payment', 'social'])).optional(),
  timeRange: TimeRangeSchema.optional(),
  pagination: PaginationSchema.optional(),
});

// ============================================================================
// Relationship Validation
// ============================================================================

export const FollowUserSchema = z.object({
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
  notifyFollowing: z.boolean().optional().default(true),
});

export const UnfollowUserSchema = z.object({
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
});

export const GetRelationshipsSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['followers', 'following', 'mutual']),
  pagination: PaginationSchema.optional(),
});

// ============================================================================
// Analytics Validation
// ============================================================================

export const GetUserAnalyticsSchema = z.object({
  userId: z.string().uuid(),
  timeRange: TimeRangeSchema.optional(),
  metrics: z.array(z.string()).max(20).optional(),
});

// ============================================================================
// Parameter Validation
// ============================================================================

export const UserIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// Query Parameter Validation
// ============================================================================

export const UserQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().optional().default(false),
  includePrivate: z.coerce.boolean().optional().default(false),
});

// ============================================================================
// Validation Middleware Helper
// ============================================================================

export const UserValidators = {
  getUserProfile: GetUserProfileSchema,
  updateUserProfile: UpdateUserProfileSchema,
  getUserPreferences: GetUserPreferencesSchema,
  updateUserPreferences: UpdateUserPreferencesSchema,
  getUserActivity: GetUserActivitySchema,
  followUser: FollowUserSchema,
  unfollowUser: UnfollowUserSchema,
  getRelationships: GetRelationshipsSchema,
  getUserAnalytics: GetUserAnalyticsSchema,
  userIdParam: UserIdParamSchema,
  userQuery: UserQuerySchema,
} as const;

export type UserValidatorKeys = keyof typeof UserValidators;
