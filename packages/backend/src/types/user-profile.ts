/**
 * User Profile Type Definitions
 * User Story: US-E5-019
 * Comprehensive type system for user profile management
 * Part of Epic 005 - Backend Service Layer Refactoring - Wave 2 (User Services)
 */

/**
 * Profile visibility levels
 */
export type ProfileVisibility = 'public' | 'private' | 'followers-only';

/**
 * Profile verification status
 */
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

/**
 * Social media platform types
 */
export type SocialMediaPlatform =
  | 'twitter'
  | 'github'
  | 'linkedin'
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'website'
  | 'blog';

/**
 * Social media link with verification
 */
export interface SocialMediaLink {
  platform: SocialMediaPlatform;
  url: string;
  username?: string;
  verified: boolean;
  verifiedAt?: Date;
}

/**
 * Avatar image metadata
 */
export interface AvatarMetadata {
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  size: number; // bytes
  mimeType: string;
  uploadedAt: Date;
}

/**
 * User profile analytics
 */
export interface ProfileAnalytics {
  profileViews: number;
  profileViewsToday: number;
  profileViewsThisWeek: number;
  profileViewsThisMonth: number;
  followersGained: number;
  followersGainedToday: number;
  followersGainedThisWeek: number;
  followersGainedThisMonth: number;
  lastViewedAt?: Date;
}

/**
 * Profile completion scoring
 */
export interface ProfileCompletion {
  percentage: number; // 0-100
  missingFields: string[];
  completedFields: string[];
  suggestions: string[];
}

/**
 * Core user profile data
 */
export interface UserProfile {
  id: string;
  userId: string; // Reference to user in auth system

  // Basic Information
  displayName?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;

  // Avatar
  avatar?: AvatarMetadata;

  // Social Links
  socialLinks: SocialMediaLink[];

  // Visibility & Privacy
  visibility: ProfileVisibility;

  // Verification
  verificationStatus: VerificationStatus;
  verificationBadge: boolean;
  verifiedAt?: Date;

  // Analytics
  analytics: ProfileAnalytics;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastProfileUpdateAt?: Date;

  // Profile Completion
  completionScore: number; // 0-100
}

/**
 * Create profile request
 */
export interface CreateProfileRequest {
  userId: string;
  displayName?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  visibility?: ProfileVisibility;
}

/**
 * Update profile request
 */
export interface UpdateProfileRequest {
  displayName?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: SocialMediaLink[];
  visibility?: ProfileVisibility;
}

/**
 * Avatar upload request
 */
export interface AvatarUploadRequest {
  userId: string;
  imageData: Buffer;
  mimeType: string;
  filename: string;
}

/**
 * Avatar upload result
 */
export interface AvatarUploadResult {
  success: boolean;
  avatar?: AvatarMetadata;
  error?: string;
}

/**
 * Social link verification request
 */
export interface VerifySocialLinkRequest {
  userId: string;
  platform: SocialMediaPlatform;
  url: string;
  username?: string;
}

/**
 * Social link verification result
 */
export interface VerifySocialLinkResult {
  success: boolean;
  verified: boolean;
  error?: string;
  verifiedAt?: Date;
}

/**
 * Profile search query
 */
export interface ProfileSearchQuery {
  query?: string; // Search term for username, displayName, bio
  location?: string;
  verifiedOnly?: boolean;
  visibility?: ProfileVisibility;
  minCompletionScore?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'relevance' | 'profileViews' | 'followersGained' | 'updatedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Profile search result
 */
export interface ProfileSearchResult {
  profiles: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Profile view event
 */
export interface ProfileViewEvent {
  profileId: string;
  viewerId?: string; // Null for anonymous views
  viewedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Profile update event
 */
export interface ProfileUpdateEvent {
  profileId: string;
  userId: string;
  changes: Partial<UserProfile>;
  updatedAt: Date;
  ipAddress?: string;
}

/**
 * Profile analytics filter
 */
export interface ProfileAnalyticsFilter {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  aggregation?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Profile analytics result
 */
export interface ProfileAnalyticsResult {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalViews: number;
    uniqueViewers: number;
    averageViewsPerDay: number;
    followersGained: number;
    followersLost: number;
    engagementRate: number;
  };
  timeline: Array<{
    date: Date;
    views: number;
    followers: number;
  }>;
}

/**
 * Profile validation error
 */
export interface ProfileValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Profile validation result
 */
export interface ProfileValidationResult {
  valid: boolean;
  errors: ProfileValidationError[];
}

/**
 * Field constraints for validation
 */
export const PROFILE_CONSTRAINTS = {
  displayName: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[\w\s\-.']+$/,
    message: 'Display name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, periods, and apostrophes'
  },
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'
  },
  bio: {
    maxLength: 500,
    message: 'Bio must not exceed 500 characters'
  },
  location: {
    maxLength: 100,
    message: 'Location must not exceed 100 characters'
  },
  website: {
    pattern: /^https?:\/\/.+\..+$/,
    message: 'Website must be a valid HTTP or HTTPS URL'
  },
  avatar: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxDimensions: { width: 2048, height: 2048 },
    message: 'Avatar must be a valid image (JPEG, PNG, WebP, GIF) and not exceed 5MB or 2048x2048 pixels'
  }
} as const;

/**
 * Profile completion weights
 * Used to calculate profile completion percentage
 */
export const PROFILE_COMPLETION_WEIGHTS = {
  displayName: 15,
  username: 15,
  bio: 20,
  avatar: 20,
  location: 10,
  website: 10,
  socialLinks: 10, // 2 points per link, max 5 links
} as const;

/**
 * Cache key patterns
 */
export const PROFILE_CACHE_KEYS = {
  profile: (userId: string) => `profile:${userId}`,
  profileByUsername: (username: string) => `profile:username:${username}`,
  profileAnalytics: (userId: string) => `profile:analytics:${userId}`,
  profileCompletion: (userId: string) => `profile:completion:${userId}`,
  profileSearch: (query: string) => `profile:search:${query}`,
  allProfiles: 'profile:*'
} as const;

/**
 * Event types for profile domain
 */
export const PROFILE_EVENT_TYPES = {
  PROFILE_CREATED: 'profile.created',
  PROFILE_UPDATED: 'profile.updated',
  PROFILE_DELETED: 'profile.deleted',
  PROFILE_VIEWED: 'profile.viewed',
  AVATAR_UPLOADED: 'profile.avatar.uploaded',
  SOCIAL_LINK_ADDED: 'profile.social_link.added',
  SOCIAL_LINK_VERIFIED: 'profile.social_link.verified',
  SOCIAL_LINK_REMOVED: 'profile.social_link.removed',
  VISIBILITY_CHANGED: 'profile.visibility.changed',
  VERIFICATION_REQUESTED: 'profile.verification.requested',
  VERIFICATION_COMPLETED: 'profile.verification.completed'
} as const;

/**
 * Audit action types
 */
export const PROFILE_AUDIT_ACTIONS = {
  CREATE: 'profile.create',
  UPDATE: 'profile.update',
  DELETE: 'profile.delete',
  VIEW: 'profile.view',
  AVATAR_UPLOAD: 'profile.avatar.upload',
  SOCIAL_LINK_ADD: 'profile.social_link.add',
  SOCIAL_LINK_VERIFY: 'profile.social_link.verify',
  SOCIAL_LINK_REMOVE: 'profile.social_link.remove',
  VISIBILITY_CHANGE: 'profile.visibility.change'
} as const;
