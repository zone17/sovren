/**
 * 🌐 **SOCIAL MEDIA SERVICE HOOK**
 *
 * Elite React Hook providing:
 * - Type-safe API calls for social media operations
 * - Caching and optimistic updates
 * - Error handling and retry logic
 * - Real-time updates and notifications
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  AnalyticsReport,
  CreateSocialPostRequest,
  CrossPlatformAnalytics,
  CrossPlatformPost,
  GetAnalyticsRequest,
  PostingSchedule,
  SocialAccount,
  SocialLoginRequest,
  SocialPlatform,
  SocialShareRequest,
  SocialShareResponse,
} from '../../../backend/src/types/social-media-integration';

// =====================================================
// API CLIENT FUNCTIONS
// =====================================================

const API_BASE = '/api/social-media';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const apiClient = {
  async shareContent(request: SocialShareRequest): Promise<SocialShareResponse> {
    const response = await fetch(`${API_BASE}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result: ApiResponse<SocialShareResponse> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Share failed');
    }

    return result.data;
  },

  async createCrossPlatformPost(request: CreateSocialPostRequest): Promise<CrossPlatformPost> {
    const response = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result: ApiResponse<CrossPlatformPost> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create post');
    }

    return result.data;
  },

  async getAnalytics(request: GetAnalyticsRequest): Promise<CrossPlatformAnalytics> {
    const params = new URLSearchParams();

    if (request.platforms) {
      params.append('platforms', request.platforms.join(','));
    }
    if (request.timeRange) {
      params.append('startDate', request.timeRange.start.toISOString());
      params.append('endDate', request.timeRange.end.toISOString());
    }
    if (request.contentId) {
      params.append('contentId', request.contentId);
    }

    const response = await fetch(`${API_BASE}/analytics?${params}`);
    const result: ApiResponse<CrossPlatformAnalytics> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get analytics');
    }

    return result.data;
  },

  async connectSocialAccount(request: SocialLoginRequest): Promise<SocialAccount> {
    const response = await fetch(`${API_BASE}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result: ApiResponse<SocialAccount> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to connect account');
    }

    return result.data;
  },

  async getSocialAccounts(): Promise<SocialAccount[]> {
    const response = await fetch(`${API_BASE}/accounts`);
    const result: ApiResponse<SocialAccount[]> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get accounts');
    }

    return result.data;
  },

  async getCrossPlatformPosts(): Promise<CrossPlatformPost[]> {
    const response = await fetch(`${API_BASE}/posts`);
    const result: ApiResponse<CrossPlatformPost[]> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get posts');
    }

    return result.data;
  },

  async publishPost(postId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/posts/${postId}/publish`, {
      method: 'POST',
    });

    const result: ApiResponse<void> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to publish post');
    }
  },

  async deletePost(postId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'DELETE',
    });

    const result: ApiResponse<void> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete post');
    }
  },

  async createSchedule(
    schedule: Omit<PostingSchedule, 'id' | 'createdAt'>
  ): Promise<PostingSchedule> {
    const response = await fetch(`${API_BASE}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });

    const result: ApiResponse<PostingSchedule> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create schedule');
    }

    return result.data;
  },

  async generateReport(
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    timeRange?: { start: Date; end: Date },
    platforms?: SocialPlatform[]
  ): Promise<AnalyticsReport> {
    const response = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, timeRange, platforms }),
    });

    const result: ApiResponse<AnalyticsReport> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate report');
    }

    return result.data;
  },

  async initiateOAuth(
    platform: SocialPlatform,
    redirectUri: string
  ): Promise<{ authUrl: string; state: string }> {
    const response = await fetch(`${API_BASE}/oauth/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, redirectUri }),
    });

    const result: ApiResponse<{ authUrl: string; state: string }> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to initiate OAuth');
    }

    return result.data;
  },
};

// =====================================================
// MAIN HOOK
// =====================================================

export interface UseSocialMediaServiceReturn {
  // Sharing
  shareContent: (request: SocialShareRequest) => Promise<SocialShareResponse>;
  isSharing: boolean;
  shareError: Error | null;

  // Cross-platform posting
  createPost: (request: CreateSocialPostRequest) => Promise<CrossPlatformPost>;
  publishPost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  posts: CrossPlatformPost[] | undefined;
  isCreatingPost: boolean;
  isPublishingPost: boolean;
  postError: Error | null;

  // Analytics
  getAnalytics: (request: GetAnalyticsRequest) => Promise<CrossPlatformAnalytics>;
  generateReport: (
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    timeRange?: { start: Date; end: Date },
    platforms?: SocialPlatform[]
  ) => Promise<AnalyticsReport>;
  analytics: CrossPlatformAnalytics | undefined;
  isLoadingAnalytics: boolean;
  analyticsError: Error | null;

  // Social accounts
  connectAccount: (request: SocialLoginRequest) => Promise<SocialAccount>;
  socialAccounts: SocialAccount[] | undefined;
  isConnectingAccount: boolean;
  accountError: Error | null;

  // Scheduling
  createSchedule: (schedule: Omit<PostingSchedule, 'id' | 'createdAt'>) => Promise<PostingSchedule>;
  isCreatingSchedule: boolean;
  scheduleError: Error | null;

  // OAuth
  initiateOAuth: (
    platform: SocialPlatform,
    redirectUri: string
  ) => Promise<{ authUrl: string; state: string }>;
  isInitiatingOAuth: boolean;
  oauthError: Error | null;

  // Share analytics
  getShareAnalytics: (contentId?: string) => Promise<any>;

  // Refresh functions
  refreshPosts: () => void;
  refreshAccounts: () => void;
  refreshAnalytics: () => void;
}

export const useSocialMediaService = (): UseSocialMediaServiceReturn => {
  const queryClient = useQueryClient();

  // =====================================================
  // QUERIES
  // =====================================================

  const {
    data: posts,
    error: postsError,
    refetch: refreshPosts,
  } = useQuery({
    queryKey: ['social-media', 'posts'],
    queryFn: apiClient.getCrossPlatformPosts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const {
    data: socialAccounts,
    error: accountsError,
    refetch: refreshAccounts,
  } = useQuery({
    queryKey: ['social-media', 'accounts'],
    queryFn: apiClient.getSocialAccounts,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const {
    data: analytics,
    error: analyticsQueryError,
    isLoading: isLoadingAnalytics,
    refetch: refreshAnalytics,
  } = useQuery({
    queryKey: ['social-media', 'analytics'],
    queryFn: () => apiClient.getAnalytics({}),
    staleTime: 1000 * 60 * 15, // 15 minutes
    enabled: false, // Manual trigger
  });

  // =====================================================
  // MUTATIONS
  // =====================================================

  const shareMutation = useMutation({
    mutationFn: apiClient.shareContent,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['social-media', 'analytics'] });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: apiClient.createCrossPlatformPost,
    onSuccess: (newPost) => {
      // Optimistically update the posts list
      queryClient.setQueryData(['social-media', 'posts'], (old: CrossPlatformPost[] = []) => [
        newPost,
        ...old,
      ]);
    },
  });

  const publishPostMutation = useMutation({
    mutationFn: apiClient.publishPost,
    onSuccess: (_, postId) => {
      // Update the specific post status
      queryClient.setQueryData(['social-media', 'posts'], (old: CrossPlatformPost[] = []) =>
        old.map((post) =>
          post.id === postId
            ? { ...post, status: 'published' as const, publishedAt: new Date() }
            : post
        )
      );
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: apiClient.deletePost,
    onSuccess: (_, postId) => {
      // Remove the post from the list
      queryClient.setQueryData(['social-media', 'posts'], (old: CrossPlatformPost[] = []) =>
        old.filter((post) => post.id !== postId)
      );
    },
  });

  const connectAccountMutation = useMutation({
    mutationFn: apiClient.connectSocialAccount,
    onSuccess: (newAccount) => {
      // Add the new account to the list
      queryClient.setQueryData(['social-media', 'accounts'], (old: SocialAccount[] = []) => [
        newAccount,
        ...old,
      ]);
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: apiClient.createSchedule,
  });

  const generateReportMutation = useMutation({
    mutationFn: ({
      type,
      timeRange,
      platforms,
    }: {
      type: 'daily' | 'weekly' | 'monthly' | 'custom';
      timeRange?: { start: Date; end: Date };
      platforms?: SocialPlatform[];
    }) => apiClient.generateReport(type, timeRange, platforms),
  });

  const getAnalyticsMutation = useMutation({
    mutationFn: apiClient.getAnalytics,
  });

  const initiateOAuthMutation = useMutation({
    mutationFn: ({ platform, redirectUri }: { platform: SocialPlatform; redirectUri: string }) =>
      apiClient.initiateOAuth(platform, redirectUri),
  });

  // =====================================================
  // WRAPPED FUNCTIONS
  // =====================================================

  const shareContent = useCallback(
    async (request: SocialShareRequest): Promise<SocialShareResponse> => {
      return shareMutation.mutateAsync(request);
    },
    [shareMutation]
  );

  const createPost = useCallback(
    async (request: CreateSocialPostRequest): Promise<CrossPlatformPost> => {
      return createPostMutation.mutateAsync(request);
    },
    [createPostMutation]
  );

  const publishPost = useCallback(
    async (postId: string): Promise<void> => {
      return publishPostMutation.mutateAsync(postId);
    },
    [publishPostMutation]
  );

  const deletePost = useCallback(
    async (postId: string): Promise<void> => {
      return deletePostMutation.mutateAsync(postId);
    },
    [deletePostMutation]
  );

  const connectAccount = useCallback(
    async (request: SocialLoginRequest): Promise<SocialAccount> => {
      return connectAccountMutation.mutateAsync(request);
    },
    [connectAccountMutation]
  );

  const createSchedule = useCallback(
    async (schedule: Omit<PostingSchedule, 'id' | 'createdAt'>): Promise<PostingSchedule> => {
      return createScheduleMutation.mutateAsync(schedule);
    },
    [createScheduleMutation]
  );

  const generateReport = useCallback(
    async (
      type: 'daily' | 'weekly' | 'monthly' | 'custom',
      timeRange?: { start: Date; end: Date },
      platforms?: SocialPlatform[]
    ): Promise<AnalyticsReport> => {
      return generateReportMutation.mutateAsync({ type, timeRange, platforms });
    },
    [generateReportMutation]
  );

  const getAnalytics = useCallback(
    async (request: GetAnalyticsRequest): Promise<CrossPlatformAnalytics> => {
      return getAnalyticsMutation.mutateAsync(request);
    },
    [getAnalyticsMutation]
  );

  const initiateOAuth = useCallback(
    async (
      platform: SocialPlatform,
      redirectUri: string
    ): Promise<{ authUrl: string; state: string }> => {
      return initiateOAuthMutation.mutateAsync({ platform, redirectUri });
    },
    [initiateOAuthMutation]
  );

  const getShareAnalytics = useCallback(
    async (contentId?: string): Promise<any> => {
      // Implement share-specific analytics
      const request: GetAnalyticsRequest = {
        contentId,
        timeRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
        },
      };
      return getAnalytics(request);
    },
    [getAnalytics]
  );

  // =====================================================
  // RETURN OBJECT
  // =====================================================

  return useMemo(
    () => ({
      // Sharing
      shareContent,
      isSharing: shareMutation.isPending,
      shareError: shareMutation.error,

      // Cross-platform posting
      createPost,
      publishPost,
      deletePost,
      posts,
      isCreatingPost: createPostMutation.isPending,
      isPublishingPost: publishPostMutation.isPending,
      postError:
        createPostMutation.error ||
        publishPostMutation.error ||
        deletePostMutation.error ||
        postsError,

      // Analytics
      getAnalytics,
      generateReport,
      analytics,
      isLoadingAnalytics: isLoadingAnalytics || getAnalyticsMutation.isPending,
      analyticsError: analyticsQueryError || getAnalyticsMutation.error,

      // Social accounts
      connectAccount,
      socialAccounts,
      isConnectingAccount: connectAccountMutation.isPending,
      accountError: connectAccountMutation.error || accountsError,

      // Scheduling
      createSchedule,
      isCreatingSchedule: createScheduleMutation.isPending,
      scheduleError: createScheduleMutation.error,

      // OAuth
      initiateOAuth,
      isInitiatingOAuth: initiateOAuthMutation.isPending,
      oauthError: initiateOAuthMutation.error,

      // Share analytics
      getShareAnalytics,

      // Refresh functions
      refreshPosts,
      refreshAccounts,
      refreshAnalytics,
    }),
    [
      shareContent,
      shareMutation.isPending,
      shareMutation.error,
      createPost,
      publishPost,
      deletePost,
      posts,
      createPostMutation.isPending,
      publishPostMutation.isPending,
      createPostMutation.error,
      publishPostMutation.error,
      deletePostMutation.error,
      postsError,
      getAnalytics,
      generateReport,
      analytics,
      isLoadingAnalytics,
      getAnalyticsMutation.isPending,
      analyticsQueryError,
      getAnalyticsMutation.error,
      connectAccount,
      socialAccounts,
      connectAccountMutation.isPending,
      connectAccountMutation.error,
      accountsError,
      createSchedule,
      createScheduleMutation.isPending,
      createScheduleMutation.error,
      initiateOAuth,
      initiateOAuthMutation.isPending,
      initiateOAuthMutation.error,
      getShareAnalytics,
      refreshPosts,
      refreshAccounts,
      refreshAnalytics,
    ]
  );
};

export default useSocialMediaService;
