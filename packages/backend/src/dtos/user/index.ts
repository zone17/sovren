/**
 * User API Data Transfer Objects
 *
 * Defines request and response schemas for User API endpoints
 * Used for type safety and validation in controllers
 */

// ============================================================================
// Profile DTOs
// ============================================================================

export interface GetUserProfileRequestDTO {
  userId: string;
  includeStats?: boolean;
  includeNostrProfile?: boolean;
}

export interface UpdateUserProfileRequestDTO {
  userId: string;
  profile: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    website?: string;
    location?: string;
    socialLinks?: {
      twitter?: string;
      github?: string;
      nostr?: string;
    };
  };
}

export interface UserProfileResponseDTO {
  userId: string;
  nostrPubkey?: string;
  profile: {
    displayName: string;
    bio: string;
    avatarUrl: string;
    bannerUrl?: string;
    website?: string;
    location?: string;
    socialLinks?: Record<string, string>;
  };
  stats?: {
    followersCount: number;
    followingCount: number;
    contentCount: number;
    totalEarnings: number;
    memberSince: string;
  };
  nostrProfile?: {
    nip05Verified: boolean;
    nip05Identifier?: string;
    lightningAddress?: string;
    relays: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Preferences DTOs
// ============================================================================

export interface GetUserPreferencesRequestDTO {
  userId: string;
}

export interface UpdateUserPreferencesRequestDTO {
  userId: string;
  preferences: {
    notifications?: {
      email?: boolean;
      push?: boolean;
      nostr?: boolean;
      types?: {
        newFollower?: boolean;
        newComment?: boolean;
        newPayment?: boolean;
        contentMilestone?: boolean;
      };
    };
    privacy?: {
      showEmail?: boolean;
      showLocation?: boolean;
      allowIndexing?: boolean;
      showAnalytics?: boolean;
    };
    content?: {
      defaultVisibility?: 'public' | 'followers' | 'subscribers';
      allowComments?: boolean;
      allowTipping?: boolean;
      defaultRelays?: string[];
    };
    monetization?: {
      defaultPricing?: {
        article?: number;
        video?: number;
        audio?: number;
      };
      paymentMethods?: string[];
      autoWithdraw?: boolean;
      withdrawThreshold?: number;
    };
  };
}

export interface UserPreferencesResponseDTO {
  userId: string;
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      nostr: boolean;
      types: Record<string, boolean>;
    };
    privacy: {
      showEmail: boolean;
      showLocation: boolean;
      allowIndexing: boolean;
      showAnalytics: boolean;
    };
    content: {
      defaultVisibility: string;
      allowComments: boolean;
      allowTipping: boolean;
      defaultRelays: string[];
    };
    monetization: {
      defaultPricing: Record<string, number>;
      paymentMethods: string[];
      autoWithdraw: boolean;
      withdrawThreshold: number;
    };
  };
  updatedAt: string;
}

// ============================================================================
// Activity DTOs
// ============================================================================

export interface GetUserActivityRequestDTO {
  userId: string;
  activityTypes?: ('content' | 'engagement' | 'payment' | 'social')[];
  timeRange?: {
    start: string;
    end: string;
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface UserActivityItemDTO {
  activityId: string;
  type: string;
  action: string;
  timestamp: string;
  details: {
    title?: string;
    description?: string;
    relatedId?: string;
    relatedType?: string;
    metadata?: Record<string, any>;
  };
}

export interface GetUserActivityResponseDTO {
  userId: string;
  activities: UserActivityItemDTO[];
  totalActivities: number;
  currentPage: number;
  totalPages: number;
  summary: {
    contentPublished: number;
    engagementsGiven: number;
    paymentsReceived: number;
    newFollowers: number;
  };
}

// ============================================================================
// Relationship DTOs
// ============================================================================

export interface FollowUserRequestDTO {
  followerId: string;
  followingId: string;
  notifyFollowing?: boolean;
}

export interface UnfollowUserRequestDTO {
  followerId: string;
  followingId: string;
}

export interface FollowUserResponseDTO {
  followerId: string;
  followingId: string;
  followedAt: string;
  mutualFollow: boolean;
  notificationSent: boolean;
}

export interface UnfollowUserResponseDTO {
  followerId: string;
  followingId: string;
  unfollowedAt: string;
  success: boolean;
}

export interface GetRelationshipsRequestDTO {
  userId: string;
  type: 'followers' | 'following' | 'mutual';
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface UserRelationshipDTO {
  userId: string;
  displayName: string;
  avatarUrl: string;
  bio?: string;
  followedAt?: string;
  mutualFollow: boolean;
  nostrPubkey?: string;
}

export interface GetRelationshipsResponseDTO {
  userId: string;
  type: string;
  relationships: UserRelationshipDTO[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

// ============================================================================
// User Analytics DTOs
// ============================================================================

export interface GetUserAnalyticsRequestDTO {
  userId: string;
  timeRange?: {
    start: string;
    end: string;
  };
  metrics?: string[];
}

export interface UserAnalyticsResponseDTO {
  userId: string;
  timeRange: {
    start: string;
    end: string;
  };
  overview: {
    totalContent: number;
    totalViews: number;
    totalEngagements: number;
    totalEarnings: {
      sats: number;
      usd: number;
    };
    growthRate: number;
  };
  audience: {
    totalFollowers: number;
    newFollowers: number;
    followerGrowthRate: number;
    topLocations: Record<string, number>;
    demographics: {
      ageRanges?: Record<string, number>;
      interests?: string[];
    };
  };
  content: {
    published: number;
    views: number;
    avgEngagementRate: number;
    topPerformingContent: Array<{
      contentId: string;
      title: string;
      views: number;
      engagementRate: number;
    }>;
  };
  revenue: {
    totalEarnings: number;
    earnings: Array<{
      date: string;
      amount: number;
      source: string;
    }>;
    topRevenueSources: Record<string, number>;
    avgRevenuePerContent: number;
  };
  engagement: {
    totalEngagements: number;
    engagementRate: number;
    engagementsByType: Record<string, number>;
    peakEngagementTimes: Array<{
      day: string;
      hour: number;
      count: number;
    }>;
  };
  trends: Array<{
    date: string;
    followers: number;
    views: number;
    engagements: number;
    earnings: number;
  }>;
}

// ============================================================================
// Common Response Wrapper
// ============================================================================

export interface UserApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    processingTime: number;
  };
}
