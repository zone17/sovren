/**
 * User Profile Service Implementation
 * User Story: US-E5-019
 * Full-featured profile management with analytics, caching, and event emission
 * Part of Epic 005 - Backend Service Layer Refactoring - Wave 2 (User Services)
 */

import type { IUserProfileService } from '../../interfaces/user/IUserProfileService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { DomainEvent } from '../../interfaces/shared/IEventBus';
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
  AvatarMetadata
} from '../../types/user-profile';
import {
  PROFILE_CONSTRAINTS,
  PROFILE_COMPLETION_WEIGHTS,
  PROFILE_CACHE_KEYS,
  PROFILE_EVENT_TYPES,
  PROFILE_AUDIT_ACTIONS
} from '../../types/user-profile';
import crypto from 'crypto';
import sharp from 'sharp';

/**
 * Logger interface
 */
interface ILogger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Cache Service interface
 */
interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
  flush(): Promise<void>;
  getStats(): Promise<any>;
}

/**
 * Audit Log Service interface
 */
interface IAuditLogService {
  log(entry: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    timestamp: Date;
  }): Promise<void>;
}

/**
 * UserProfileService - Enterprise-grade profile management
 *
 * Features:
 * - Full CRUD operations
 * - Avatar upload with image processing
 * - Social media link management
 * - Profile visibility controls
 * - Advanced search and discovery
 * - Profile analytics tracking
 * - Completion scoring
 * - Multi-layer caching (memory + Redis)
 * - Event-driven architecture
 * - Comprehensive audit logging
 */
export class UserProfileService implements IUserProfileService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache: ICacheService;
  private readonly auditLog: IAuditLogService;

  // In-memory storage (would be database in production)
  private profiles: Map<string, UserProfile> = new Map();
  private usernameIndex: Map<string, string> = new Map(); // username -> userId mapping
  private viewCounts: Map<string, number> = new Map();

  // Cache TTLs
  private readonly CACHE_TTL = {
    PROFILE: 3600, // 1 hour
    ANALYTICS: 300, // 5 minutes
    SEARCH: 600, // 10 minutes
    COMPLETION: 1800 // 30 minutes
  };

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    cache: ICacheService,
    auditLog: IAuditLogService
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.auditLog = auditLog;

    this.logger.info('UserProfileService initialized');
  }

  /**
   * Create a new user profile
   */
  async createProfile(request: CreateProfileRequest): Promise<UserProfile> {
    this.logger.info('Creating profile', { userId: request.userId });

    // Validate request
    const validation = this.validateProfile(request);
    if (!validation.valid) {
      const error = new Error(`Profile validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      this.logger.error('Profile validation failed', error);
      throw error;
    }

    // Check if profile already exists
    const existing = await this.getProfile(request.userId);
    if (existing) {
      throw new Error(`Profile already exists for user ${request.userId}`);
    }

    // Check username availability
    if (request.username) {
      const available = await this.isUsernameAvailable(request.username);
      if (!available) {
        throw new Error(`Username ${request.username} is already taken`);
      }
    }

    // Create profile
    const now = new Date();
    const profile: UserProfile = {
      id: this.generateId(),
      userId: request.userId,
      displayName: request.displayName,
      username: request.username,
      bio: request.bio,
      location: request.location,
      website: request.website,
      socialLinks: [],
      visibility: request.visibility || 'public',
      verificationStatus: 'unverified',
      verificationBadge: false,
      analytics: {
        profileViews: 0,
        profileViewsToday: 0,
        profileViewsThisWeek: 0,
        profileViewsThisMonth: 0,
        followersGained: 0,
        followersGainedToday: 0,
        followersGainedThisWeek: 0,
        followersGainedThisMonth: 0
      },
      createdAt: now,
      updatedAt: now,
      completionScore: this.calculateCompletionScore(request)
    };

    // Store profile
    this.profiles.set(profile.userId, profile);
    if (profile.username) {
      this.usernameIndex.set(profile.username.toLowerCase(), profile.userId);
    }

    // Cache profile
    await this.cache.set(
      PROFILE_CACHE_KEYS.profile(profile.userId),
      profile,
      this.CACHE_TTL.PROFILE
    );

    // Audit log
    await this.auditLog.log({
      userId: profile.userId,
      action: PROFILE_AUDIT_ACTIONS.CREATE,
      entityType: 'profile',
      entityId: profile.id,
      newValue: profile,
      timestamp: now
    });

    // Emit event
    await this.emitEvent(PROFILE_EVENT_TYPES.PROFILE_CREATED, profile.id, 'profile', {
      userId: profile.userId,
      profile
    });

    this.logger.info('Profile created successfully', { userId: profile.userId, profileId: profile.id });

    return profile;
  }

  /**
   * Get user profile by user ID
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    // Check cache first
    const cacheKey = PROFILE_CACHE_KEYS.profile(userId);
    const cached = await this.cache.get<UserProfile>(cacheKey);
    if (cached) {
      this.logger.debug('Profile cache hit', { userId });
      return cached;
    }

    // Get from storage
    const profile = this.profiles.get(userId) || null;

    // Cache if found
    if (profile) {
      await this.cache.set(cacheKey, profile, this.CACHE_TTL.PROFILE);
    }

    return profile;
  }

  /**
   * Get user profile by username
   */
  async getProfileByUsername(username: string): Promise<UserProfile | null> {
    const normalizedUsername = username.toLowerCase();

    // Check cache
    const cacheKey = PROFILE_CACHE_KEYS.profileByUsername(normalizedUsername);
    const cachedUserId = await this.cache.get<string>(cacheKey);
    if (cachedUserId) {
      return this.getProfile(cachedUserId);
    }

    // Lookup userId
    const userId = this.usernameIndex.get(normalizedUsername);
    if (!userId) {
      return null;
    }

    // Cache the username -> userId mapping
    await this.cache.set(cacheKey, userId, this.CACHE_TTL.PROFILE);

    return this.getProfile(userId);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, request: UpdateProfileRequest): Promise<UserProfile> {
    this.logger.info('Updating profile', { userId });

    // Get existing profile
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    // Validate updates
    const validation = this.validateProfile(request);
    if (!validation.valid) {
      throw new Error(`Profile validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Check username availability if changing
    if (request.username && request.username !== profile.username) {
      const available = await this.isUsernameAvailable(request.username, userId);
      if (!available) {
        throw new Error(`Username ${request.username} is already taken`);
      }
    }

    // Store old values for audit
    const oldValues = { ...profile };

    // Update username index if changed
    if (request.username && request.username !== profile.username) {
      if (profile.username) {
        this.usernameIndex.delete(profile.username.toLowerCase());
      }
      this.usernameIndex.set(request.username.toLowerCase(), userId);
    }

    // Apply updates
    const updatedProfile: UserProfile = {
      ...profile,
      ...request,
      updatedAt: new Date(),
      lastProfileUpdateAt: new Date()
    };

    // Recalculate completion score
    updatedProfile.completionScore = this.calculateCompletionScore(updatedProfile);

    // Store updated profile
    this.profiles.set(userId, updatedProfile);

    // Invalidate caches
    await this.invalidateProfileCaches(userId, profile.username, request.username);

    // Audit log
    await this.auditLog.log({
      userId,
      action: PROFILE_AUDIT_ACTIONS.UPDATE,
      entityType: 'profile',
      entityId: profile.id,
      oldValue: oldValues,
      newValue: request,
      timestamp: new Date()
    });

    // Emit event
    await this.emitEvent(PROFILE_EVENT_TYPES.PROFILE_UPDATED, profile.id, 'profile', {
      userId,
      changes: request,
      profile: updatedProfile
    });

    this.logger.info('Profile updated successfully', { userId, profileId: profile.id });

    return updatedProfile;
  }

  /**
   * Delete user profile
   */
  async deleteProfile(userId: string): Promise<void> {
    this.logger.info('Deleting profile', { userId });

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    // Remove from storage
    this.profiles.delete(userId);
    if (profile.username) {
      this.usernameIndex.delete(profile.username.toLowerCase());
    }

    // Invalidate caches
    await this.invalidateProfileCaches(userId, profile.username);

    // Audit log
    await this.auditLog.log({
      userId,
      action: PROFILE_AUDIT_ACTIONS.DELETE,
      entityType: 'profile',
      entityId: profile.id,
      oldValue: profile,
      timestamp: new Date()
    });

    // Emit event
    await this.emitEvent(PROFILE_EVENT_TYPES.PROFILE_DELETED, profile.id, 'profile', {
      userId,
      profile
    });

    this.logger.info('Profile deleted successfully', { userId, profileId: profile.id });
  }

  /**
   * Upload and process avatar image
   */
  async uploadAvatar(request: AvatarUploadRequest): Promise<AvatarUploadResult> {
    this.logger.info('Uploading avatar', { userId: request.userId });

    try {
      // Get profile
      const profile = await this.getProfile(request.userId);
      if (!profile) {
        throw new Error(`Profile not found for user ${request.userId}`);
      }

      // Validate image
      const allowedTypes = PROFILE_CONSTRAINTS.avatar.allowedTypes as readonly string[];
      if (!allowedTypes.includes(request.mimeType)) {
        throw new Error('Invalid image type. Allowed: JPEG, PNG, WebP, GIF');
      }

      if (request.imageData.length > PROFILE_CONSTRAINTS.avatar.maxSize) {
        throw new Error(`Image size exceeds maximum of ${PROFILE_CONSTRAINTS.avatar.maxSize / 1024 / 1024}MB`);
      }

      // Process image with sharp
      const image = sharp(request.imageData);
      const metadata = await image.metadata();

      // Validate dimensions
      if (
        metadata.width && metadata.height &&
        (metadata.width > PROFILE_CONSTRAINTS.avatar.maxDimensions.width ||
         metadata.height > PROFILE_CONSTRAINTS.avatar.maxDimensions.height)
      ) {
        throw new Error('Image dimensions exceed maximum of 2048x2048 pixels');
      }

      // Resize and optimize
      const processedImage = await image
        .resize(512, 512, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Create thumbnail
      const thumbnail = await sharp(request.imageData)
        .resize(128, 128, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // In production, upload to S3/Cloud Storage
      // For now, generate mock URLs
      const avatarId = this.generateId();
      const avatar: AvatarMetadata = {
        url: `https://cdn.sovren.app/avatars/${avatarId}.jpg`,
        thumbnailUrl: `https://cdn.sovren.app/avatars/${avatarId}_thumb.jpg`,
        width: 512,
        height: 512,
        size: processedImage.length,
        mimeType: 'image/jpeg',
        uploadedAt: new Date()
      };

      // Update profile
      profile.avatar = avatar;
      profile.updatedAt = new Date();
      profile.completionScore = this.calculateCompletionScore(profile);
      this.profiles.set(request.userId, profile);

      // Invalidate caches
      await this.invalidateProfileCaches(request.userId, profile.username);

      // Audit log
      await this.auditLog.log({
        userId: request.userId,
        action: PROFILE_AUDIT_ACTIONS.AVATAR_UPLOAD,
        entityType: 'profile',
        entityId: profile.id,
        newValue: avatar,
        timestamp: new Date()
      });

      // Emit event
      await this.emitEvent(PROFILE_EVENT_TYPES.AVATAR_UPLOADED, profile.id, 'profile', {
        userId: request.userId,
        avatar
      });

      this.logger.info('Avatar uploaded successfully', { userId: request.userId });

      return {
        success: true,
        avatar
      };
    } catch (error) {
      this.logger.error('Avatar upload failed', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Delete avatar image
   */
  async deleteAvatar(userId: string): Promise<void> {
    this.logger.info('Deleting avatar', { userId });

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    const oldAvatar = profile.avatar;

    // Remove avatar
    profile.avatar = undefined;
    profile.updatedAt = new Date();
    profile.completionScore = this.calculateCompletionScore(profile);
    this.profiles.set(userId, profile);

    // Invalidate caches
    await this.invalidateProfileCaches(userId, profile.username);

    // Audit log
    await this.auditLog.log({
      userId,
      action: 'profile.avatar.delete',
      entityType: 'profile',
      entityId: profile.id,
      oldValue: oldAvatar,
      timestamp: new Date()
    });

    this.logger.info('Avatar deleted successfully', { userId });
  }

  /**
   * Add social media link to profile
   */
  async addSocialLink(
    userId: string,
    link: Omit<SocialMediaLink, 'verified' | 'verifiedAt'>
  ): Promise<UserProfile> {
    this.logger.info('Adding social link', { userId, platform: link.platform });

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    // Check if platform already exists
    const existingIndex = profile.socialLinks.findIndex(l => l.platform === link.platform);
    if (existingIndex !== -1) {
      // Replace existing link
      profile.socialLinks[existingIndex] = {
        ...link,
        verified: false
      };
    } else {
      // Add new link
      profile.socialLinks.push({
        ...link,
        verified: false
      });
    }

    profile.updatedAt = new Date();
    profile.completionScore = this.calculateCompletionScore(profile);
    this.profiles.set(userId, profile);

    // Invalidate caches
    await this.invalidateProfileCaches(userId, profile.username);

    // Audit log
    await this.auditLog.log({
      userId,
      action: PROFILE_AUDIT_ACTIONS.SOCIAL_LINK_ADD,
      entityType: 'profile',
      entityId: profile.id,
      newValue: link,
      timestamp: new Date()
    });

    // Emit event
    await this.emitEvent(PROFILE_EVENT_TYPES.SOCIAL_LINK_ADDED, profile.id, 'profile', {
      userId,
      link
    });

    return profile;
  }

  /**
   * Remove social media link from profile
   */
  async removeSocialLink(userId: string, platform: string): Promise<UserProfile> {
    this.logger.info('Removing social link', { userId, platform });

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    const removedLink = profile.socialLinks.find(l => l.platform === platform);
    profile.socialLinks = profile.socialLinks.filter(l => l.platform !== platform);

    profile.updatedAt = new Date();
    profile.completionScore = this.calculateCompletionScore(profile);
    this.profiles.set(userId, profile);

    // Invalidate caches
    await this.invalidateProfileCaches(userId, profile.username);

    // Audit log
    await this.auditLog.log({
      userId,
      action: PROFILE_AUDIT_ACTIONS.SOCIAL_LINK_REMOVE,
      entityType: 'profile',
      entityId: profile.id,
      oldValue: removedLink,
      timestamp: new Date()
    });

    // Emit event
    await this.emitEvent(PROFILE_EVENT_TYPES.SOCIAL_LINK_REMOVED, profile.id, 'profile', {
      userId,
      platform
    });

    return profile;
  }

  /**
   * Verify social media link
   */
  async verifySocialLink(request: VerifySocialLinkRequest): Promise<VerifySocialLinkResult> {
    this.logger.info('Verifying social link', { userId: request.userId, platform: request.platform });

    try {
      const profile = await this.getProfile(request.userId);
      if (!profile) {
        throw new Error(`Profile not found for user ${request.userId}`);
      }

      const linkIndex = profile.socialLinks.findIndex(l => l.platform === request.platform);
      if (linkIndex === -1) {
        throw new Error(`Social link for platform ${request.platform} not found`);
      }

      // In production, this would perform actual verification
      // (e.g., check for verification token in social media bio)
      const verified = true;
      const verifiedAt = new Date();

      profile.socialLinks[linkIndex].verified = verified;
      profile.socialLinks[linkIndex].verifiedAt = verifiedAt;
      profile.updatedAt = new Date();
      this.profiles.set(request.userId, profile);

      // Invalidate caches
      await this.invalidateProfileCaches(request.userId, profile.username);

      // Audit log
      await this.auditLog.log({
        userId: request.userId,
        action: PROFILE_AUDIT_ACTIONS.SOCIAL_LINK_VERIFY,
        entityType: 'profile',
        entityId: profile.id,
        newValue: { platform: request.platform, verified, verifiedAt },
        timestamp: new Date()
      });

      // Emit event
      await this.emitEvent(PROFILE_EVENT_TYPES.SOCIAL_LINK_VERIFIED, profile.id, 'profile', {
        userId: request.userId,
        platform: request.platform,
        verifiedAt
      });

      return {
        success: true,
        verified,
        verifiedAt
      };
    } catch (error) {
      this.logger.error('Social link verification failed', error as Error);
      return {
        success: false,
        verified: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Update profile visibility
   */
  async updateVisibility(userId: string, visibility: ProfileVisibility): Promise<UserProfile> {
    this.logger.info('Updating profile visibility', { userId, visibility });

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    const oldVisibility = profile.visibility;
    profile.visibility = visibility;
    profile.updatedAt = new Date();
    this.profiles.set(userId, profile);

    // Invalidate caches
    await this.invalidateProfileCaches(userId, profile.username);

    // Audit log
    await this.auditLog.log({
      userId,
      action: PROFILE_AUDIT_ACTIONS.VISIBILITY_CHANGE,
      entityType: 'profile',
      entityId: profile.id,
      oldValue: oldVisibility,
      newValue: visibility,
      timestamp: new Date()
    });

    // Emit event
    await this.emitEvent(PROFILE_EVENT_TYPES.VISIBILITY_CHANGED, profile.id, 'profile', {
      userId,
      oldVisibility,
      newVisibility: visibility
    });

    return profile;
  }

  /**
   * Search profiles with filters
   */
  async searchProfiles(query: ProfileSearchQuery): Promise<ProfileSearchResult> {
    this.logger.debug('Searching profiles', query);

    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100); // Max 100 results
    const offset = (page - 1) * pageSize;

    // Generate cache key
    const cacheKey = PROFILE_CACHE_KEYS.profileSearch(JSON.stringify(query));
    const cached = await this.cache.get<ProfileSearchResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Filter profiles
    let profiles = Array.from(this.profiles.values());

    // Apply filters
    if (query.query) {
      const searchTerm = query.query.toLowerCase();
      profiles = profiles.filter(p =>
        p.username?.toLowerCase().includes(searchTerm) ||
        p.displayName?.toLowerCase().includes(searchTerm) ||
        p.bio?.toLowerCase().includes(searchTerm)
      );
    }

    if (query.location) {
      profiles = profiles.filter(p =>
        p.location?.toLowerCase().includes(query.location!.toLowerCase())
      );
    }

    if (query.verifiedOnly) {
      profiles = profiles.filter(p => p.verificationBadge);
    }

    if (query.visibility) {
      profiles = profiles.filter(p => p.visibility === query.visibility);
    }

    if (query.minCompletionScore !== undefined) {
      profiles = profiles.filter(p => p.completionScore >= query.minCompletionScore!);
    }

    // Sort
    const sortBy = query.sortBy || 'relevance';
    const sortOrder = query.sortOrder || 'desc';

    profiles.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'profileViews':
          comparison = a.analytics.profileViews - b.analytics.profileViews;
          break;
        case 'followersGained':
          comparison = a.analytics.followersGained - b.analytics.followersGained;
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        default: // relevance
          comparison = a.completionScore - b.completionScore;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const total = profiles.length;
    const paginatedProfiles = profiles.slice(offset, offset + pageSize);

    const result: ProfileSearchResult = {
      profiles: paginatedProfiles,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total
    };

    // Cache result
    await this.cache.set(cacheKey, result, this.CACHE_TTL.SEARCH);

    return result;
  }

  /**
   * Record profile view for analytics
   */
  async recordProfileView(
    profileId: string,
    viewerId?: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    this.logger.debug('Recording profile view', { profileId, viewerId });

    // Find profile by ID
    const profile = Array.from(this.profiles.values()).find(p => p.id === profileId);
    if (!profile) {
      return; // Silently ignore if profile not found
    }

    // Increment view counts
    profile.analytics.profileViews++;
    profile.analytics.profileViewsToday++;
    profile.analytics.profileViewsThisWeek++;
    profile.analytics.profileViewsThisMonth++;
    profile.analytics.lastViewedAt = new Date();

    this.profiles.set(profile.userId, profile);

    // Invalidate analytics cache
    await this.cache.delete(PROFILE_CACHE_KEYS.profileAnalytics(profile.userId));

    // Emit event (don't block on this)
    this.emitEvent(PROFILE_EVENT_TYPES.PROFILE_VIEWED, profileId, 'profile', {
      profileId,
      viewerId,
      timestamp: new Date(),
      ...metadata
    }).catch(err => this.logger.error('Failed to emit profile view event', err));
  }

  /**
   * Get profile analytics
   */
  async getProfileAnalytics(
    userId: string,
    filter?: ProfileAnalyticsFilter
  ): Promise<ProfileAnalyticsResult> {
    this.logger.debug('Getting profile analytics', { userId });

    // Check cache
    const cacheKey = PROFILE_CACHE_KEYS.profileAnalytics(userId);
    const cached = await this.cache.get<ProfileAnalyticsResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    // Calculate metrics
    const now = new Date();
    const startDate = filter?.startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = filter?.endDate || now;

    const result: ProfileAnalyticsResult = {
      userId,
      period: {
        start: startDate,
        end: endDate
      },
      metrics: {
        totalViews: profile.analytics.profileViews,
        uniqueViewers: Math.floor(profile.analytics.profileViews * 0.7), // Estimate
        averageViewsPerDay: profile.analytics.profileViewsThisMonth / 30,
        followersGained: profile.analytics.followersGained,
        followersLost: 0,
        engagementRate: profile.analytics.profileViews > 0
          ? (profile.analytics.followersGained / profile.analytics.profileViews) * 100
          : 0
      },
      timeline: [] // Would be populated from time-series data
    };

    // Cache result
    await this.cache.set(cacheKey, result, this.CACHE_TTL.ANALYTICS);

    return result;
  }

  /**
   * Calculate profile completion score
   */
  async getProfileCompletion(userId: string): Promise<ProfileCompletion> {
    // Check cache
    const cacheKey = PROFILE_CACHE_KEYS.profileCompletion(userId);
    const cached = await this.cache.get<ProfileCompletion>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    const completedFields: string[] = [];
    const missingFields: string[] = [];
    const suggestions: string[] = [];

    // Check each field
    if (profile.displayName) {
      completedFields.push('displayName');
    } else {
      missingFields.push('displayName');
      suggestions.push('Add a display name to help others recognize you');
    }

    if (profile.username) {
      completedFields.push('username');
    } else {
      missingFields.push('username');
      suggestions.push('Choose a unique username');
    }

    if (profile.bio) {
      completedFields.push('bio');
    } else {
      missingFields.push('bio');
      suggestions.push('Write a bio to tell others about yourself');
    }

    if (profile.avatar) {
      completedFields.push('avatar');
    } else {
      missingFields.push('avatar');
      suggestions.push('Upload a profile picture');
    }

    if (profile.location) {
      completedFields.push('location');
    } else {
      missingFields.push('location');
      suggestions.push('Add your location');
    }

    if (profile.website) {
      completedFields.push('website');
    } else {
      missingFields.push('website');
      suggestions.push('Add your website or portfolio');
    }

    if (profile.socialLinks.length > 0) {
      completedFields.push('socialLinks');
    } else {
      missingFields.push('socialLinks');
      suggestions.push('Connect your social media accounts');
    }

    const result: ProfileCompletion = {
      percentage: profile.completionScore,
      missingFields,
      completedFields,
      suggestions
    };

    // Cache result
    await this.cache.set(cacheKey, result, this.CACHE_TTL.COMPLETION);

    return result;
  }

  /**
   * Validate profile data
   */
  validateProfile(data: Partial<UserProfile>): ProfileValidationResult {
    const errors: Array<{ field: string; message: string; code: string }> = [];

    // Display name validation
    if (data.displayName !== undefined) {
      if (data.displayName.length < PROFILE_CONSTRAINTS.displayName.minLength ||
          data.displayName.length > PROFILE_CONSTRAINTS.displayName.maxLength) {
        errors.push({
          field: 'displayName',
          message: PROFILE_CONSTRAINTS.displayName.message,
          code: 'INVALID_DISPLAY_NAME'
        });
      } else if (!PROFILE_CONSTRAINTS.displayName.pattern.test(data.displayName)) {
        errors.push({
          field: 'displayName',
          message: PROFILE_CONSTRAINTS.displayName.message,
          code: 'INVALID_DISPLAY_NAME_FORMAT'
        });
      }
    }

    // Username validation
    if (data.username !== undefined) {
      if (data.username.length < PROFILE_CONSTRAINTS.username.minLength ||
          data.username.length > PROFILE_CONSTRAINTS.username.maxLength) {
        errors.push({
          field: 'username',
          message: PROFILE_CONSTRAINTS.username.message,
          code: 'INVALID_USERNAME'
        });
      } else if (!PROFILE_CONSTRAINTS.username.pattern.test(data.username)) {
        errors.push({
          field: 'username',
          message: PROFILE_CONSTRAINTS.username.message,
          code: 'INVALID_USERNAME_FORMAT'
        });
      }
    }

    // Bio validation
    if (data.bio !== undefined && data.bio.length > PROFILE_CONSTRAINTS.bio.maxLength) {
      errors.push({
        field: 'bio',
        message: PROFILE_CONSTRAINTS.bio.message,
        code: 'BIO_TOO_LONG'
      });
    }

    // Location validation
    if (data.location !== undefined && data.location.length > PROFILE_CONSTRAINTS.location.maxLength) {
      errors.push({
        field: 'location',
        message: PROFILE_CONSTRAINTS.location.message,
        code: 'LOCATION_TOO_LONG'
      });
    }

    // Website validation
    if (data.website !== undefined && !PROFILE_CONSTRAINTS.website.pattern.test(data.website)) {
      errors.push({
        field: 'website',
        message: PROFILE_CONSTRAINTS.website.message,
        code: 'INVALID_WEBSITE_URL'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    const existingUserId = this.usernameIndex.get(normalizedUsername);

    if (!existingUserId) {
      return true;
    }

    // If excluding a user (for updates), check if it's the same user
    return existingUserId === excludeUserId;
  }

  /**
   * Get profiles by user IDs (batch operation)
   */
  async getProfilesBatch(userIds: string[]): Promise<UserProfile[]> {
    const profiles: UserProfile[] = [];

    for (const userId of userIds) {
      const profile = await this.getProfile(userId);
      if (profile) {
        profiles.push(profile);
      }
    }

    return profiles;
  }

  /**
   * Update profile verification status (admin only)
   */
  async updateVerificationStatus(
    userId: string,
    status: 'verified' | 'rejected',
    adminUserId: string
  ): Promise<UserProfile> {
    this.logger.info('Updating verification status', { userId, status, adminUserId });

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    const oldStatus = profile.verificationStatus;
    profile.verificationStatus = status;
    profile.verificationBadge = status === 'verified';
    if (status === 'verified') {
      profile.verifiedAt = new Date();
    }
    profile.updatedAt = new Date();
    this.profiles.set(userId, profile);

    // Invalidate caches
    await this.invalidateProfileCaches(userId, profile.username);

    // Audit log
    await this.auditLog.log({
      userId: adminUserId,
      action: 'profile.verification.update',
      entityType: 'profile',
      entityId: profile.id,
      oldValue: oldStatus,
      newValue: status,
      metadata: { targetUserId: userId },
      timestamp: new Date()
    });

    // Emit event
    await this.emitEvent(PROFILE_EVENT_TYPES.VERIFICATION_COMPLETED, profile.id, 'profile', {
      userId,
      status,
      adminUserId
    });

    return profile;
  }

  /**
   * Get service health status
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    cacheConnected: boolean;
    dbConnected: boolean;
    lastUpdate?: Date;
  }> {
    let cacheConnected = false;
    const dbConnected = true; // Using in-memory storage for now

    try {
      await this.cache.getStats();
      cacheConnected = true;
    } catch {
      cacheConnected = false;
    }

    return {
      healthy: cacheConnected && dbConnected,
      cacheConnected,
      dbConnected,
      lastUpdate: new Date()
    };
  }

  /**
   * Dispose service resources
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing UserProfileService');
    this.profiles.clear();
    this.usernameIndex.clear();
    this.viewCounts.clear();
  }

  // Private helper methods

  /**
   * Calculate completion score
   */
  private calculateCompletionScore(profile: Partial<UserProfile>): number {
    let score = 0;
    const weights = PROFILE_COMPLETION_WEIGHTS;

    if (profile.displayName) score += weights.displayName;
    if (profile.username) score += weights.username;
    if (profile.bio) score += weights.bio;
    if (profile.avatar) score += weights.avatar;
    if (profile.location) score += weights.location;
    if (profile.website) score += weights.website;
    if (profile.socialLinks && profile.socialLinks.length > 0) {
      score += Math.min(profile.socialLinks.length * 2, weights.socialLinks);
    }

    return Math.min(score, 100);
  }

  /**
   * Invalidate profile-related caches
   */
  private async invalidateProfileCaches(
    userId: string,
    oldUsername?: string,
    newUsername?: string
  ): Promise<void> {
    const keysToDelete = [
      PROFILE_CACHE_KEYS.profile(userId),
      PROFILE_CACHE_KEYS.profileAnalytics(userId),
      PROFILE_CACHE_KEYS.profileCompletion(userId)
    ];

    if (oldUsername) {
      keysToDelete.push(PROFILE_CACHE_KEYS.profileByUsername(oldUsername.toLowerCase()));
    }
    if (newUsername) {
      keysToDelete.push(PROFILE_CACHE_KEYS.profileByUsername(newUsername.toLowerCase()));
    }

    await Promise.all(keysToDelete.map(key => this.cache.delete(key)));

    // Invalidate search cache
    await this.cache.deletePattern('profile:search:*');
  }

  /**
   * Emit domain event
   */
  private async emitEvent(
    type: string,
    aggregateId: string,
    aggregateType: string,
    payload: any
  ): Promise<void> {
    const event: DomainEvent = {
      id: this.generateId(),
      type: type as any,
      aggregateId,
      aggregateType,
      payload,
      metadata: {
        timestamp: new Date(),
        version: '1.0.0',
        source: 'UserProfileService'
      }
    };

    await this.eventBus.publish(event);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }
}
