/**
 * User Profile Service Interface
 * User Story: US-E5-019
 * Defines contract for user profile management operations
 * Part of Epic 005 - Backend Service Layer Refactoring - Wave 2 (User Services)
 */

import type {
  UserProfile,
  CreateProfileRequest,
  UpdateProfileRequest,
  AvatarUploadRequest,
  AvatarUploadResult,
  VerifySocialLinkRequest,
  VerifySocialLinkResult,
  ProfileSearchQuery,
  ProfileSearchResult,
  ProfileAnalyticsFilter,
  ProfileAnalyticsResult,
  ProfileCompletion,
  ProfileValidationResult,
  SocialMediaLink,
  ProfileVisibility,
} from '../../types/user-profile';

/**
 * User Profile Service Interface
 * Provides comprehensive profile management with analytics, caching, and event emission
 */
export interface IUserProfileService {
  /**
   * Create a new user profile
   * @param request - Profile creation data
   * @returns Created profile or error
   */
  createProfile(request: CreateProfileRequest): Promise<UserProfile>;

  /**
   * Get user profile by user ID
   * @param userId - User identifier
   * @returns User profile or null if not found
   */
  getProfile(userId: string): Promise<UserProfile | null>;

  /**
   * Get user profile by username
   * @param username - Unique username
   * @returns User profile or null if not found
   */
  getProfileByUsername(username: string): Promise<UserProfile | null>;

  /**
   * Update user profile
   * @param userId - User identifier
   * @param request - Profile update data
   * @returns Updated profile
   */
  updateProfile(userId: string, request: UpdateProfileRequest): Promise<UserProfile>;

  /**
   * Delete user profile
   * @param userId - User identifier
   * @returns Success status
   */
  deleteProfile(userId: string): Promise<void>;

  /**
   * Upload and process avatar image
   * @param request - Avatar upload data with image buffer
   * @returns Upload result with avatar metadata
   */
  uploadAvatar(request: AvatarUploadRequest): Promise<AvatarUploadResult>;

  /**
   * Delete avatar image
   * @param userId - User identifier
   * @returns Success status
   */
  deleteAvatar(userId: string): Promise<void>;

  /**
   * Add social media link to profile
   * @param userId - User identifier
   * @param link - Social media link data
   * @returns Updated profile
   */
  addSocialLink(
    userId: string,
    link: Omit<SocialMediaLink, 'verified' | 'verifiedAt'>
  ): Promise<UserProfile>;

  /**
   * Remove social media link from profile
   * @param userId - User identifier
   * @param platform - Platform to remove
   * @returns Updated profile
   */
  removeSocialLink(userId: string, platform: string): Promise<UserProfile>;

  /**
   * Verify social media link
   * @param request - Verification request data
   * @returns Verification result
   */
  verifySocialLink(request: VerifySocialLinkRequest): Promise<VerifySocialLinkResult>;

  /**
   * Update profile visibility
   * @param userId - User identifier
   * @param visibility - New visibility level
   * @returns Updated profile
   */
  updateVisibility(userId: string, visibility: ProfileVisibility): Promise<UserProfile>;

  /**
   * Search profiles with filters
   * @param query - Search query and filters
   * @returns Paginated search results
   */
  searchProfiles(query: ProfileSearchQuery): Promise<ProfileSearchResult>;

  /**
   * Record profile view for analytics
   * @param profileId - Profile identifier
   * @param viewerId - Viewer identifier (optional for anonymous)
   * @param metadata - Additional view metadata
   * @returns Success status
   */
  recordProfileView(
    profileId: string,
    viewerId?: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void>;

  /**
   * Get profile analytics
   * @param userId - User identifier
   * @param filter - Analytics filter (date range, aggregation)
   * @returns Analytics data with metrics and timeline
   */
  getProfileAnalytics(
    userId: string,
    filter?: ProfileAnalyticsFilter
  ): Promise<ProfileAnalyticsResult>;

  /**
   * Calculate profile completion score
   * @param userId - User identifier
   * @returns Completion details with percentage and suggestions
   */
  getProfileCompletion(userId: string): Promise<ProfileCompletion>;

  /**
   * Validate profile data
   * @param data - Profile data to validate
   * @returns Validation result with errors if any
   */
  validateProfile(data: Partial<UserProfile>): ProfileValidationResult;

  /**
   * Check if username is available
   * @param username - Username to check
   * @param excludeUserId - User ID to exclude from check (for updates)
   * @returns Availability status
   */
  isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean>;

  /**
   * Get profiles by user IDs (batch operation)
   * @param userIds - Array of user identifiers
   * @returns Array of profiles
   */
  getProfilesBatch(userIds: string[]): Promise<UserProfile[]>;

  /**
   * Update profile verification status (admin only)
   * @param userId - User identifier
   * @param status - New verification status
   * @param adminUserId - Admin user identifier
   * @returns Updated profile
   */
  updateVerificationStatus(
    userId: string,
    status: 'verified' | 'rejected',
    adminUserId: string
  ): Promise<UserProfile>;

  /**
   * Get service health status
   * @returns Health check result
   */
  healthCheck(): Promise<{
    healthy: boolean;
    cacheConnected: boolean;
    dbConnected: boolean;
    lastUpdate?: Date;
  }>;

  /**
   * Dispose service resources
   */
  dispose(): Promise<void>;
}
