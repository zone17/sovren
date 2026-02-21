/**
 * API Response Type Definitions
 * Elite Type Safety for Frontend API Integration
 *
 * Generated: 2025-10-24
 * Epic: 001 - Type Safety Improvements
 * Story: 2 - Type API Response Handlers
 */

// ============================================
// Core API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================
// Error Response Types
// ============================================

export type ApiError =
  | { type: 'network'; message: string; status?: never }
  | { type: 'validation'; message: string; status: 400; errors: Record<string, string[]> }
  | { type: 'auth'; message: string; status: 401 | 403 }
  | { type: 'server'; message: string; status: 500 };

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

// ============================================
// User & Profile Response Types
// ============================================

export interface UserProfileResponse {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  nostrPublicKey?: string;
  nip05?: string;
  lightningAddress?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    followers: number;
    following: number;
    posts: number;
    totalEarned?: number;
  };
}

// ============================================
// Content Response Types
// ============================================

export interface PostResponse {
  id: string;
  authorId: string;
  author?: {
    username: string;
    displayName: string;
    avatar?: string;
  };
  content: string;
  mediaUrls?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  repliesCount: number;
  repostsCount: number;
  isLiked: boolean;
  isReposted: boolean;
  isPremium?: boolean;
  price?: number;
}

export interface FeedResponse extends PaginatedResponse<PostResponse> {
  lastFetchedAt: string;
}

// ============================================
// Payment Response Types
// ============================================

export interface PaymentIntentResponse {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  paymentMethod: 'lightning' | 'stripe' | 'crypto';
  invoice?: string;
  paymentRequest?: string;
  expiresAt?: string;
  metadata?: {
    contentId?: string;
    subscriptionTier?: string;
    donationMessage?: string;
  };
}

export interface SubscriptionResponse {
  id: string;
  userId: string;
  creatorId: string;
  tier: 'basic' | 'premium' | 'elite';
  status: 'active' | 'cancelled' | 'expired' | 'paused';
  startedAt: string;
  expiresAt?: string;
  renewsAt?: string;
  amount: number;
  currency: string;
  benefits: string[];
}

// ============================================
// Analytics Response Types
// ============================================

export interface AnalyticsResponse {
  period: {
    start: string;
    end: string;
  };
  metrics: {
    views: number;
    uniqueVisitors: number;
    engagement: number;
    revenue?: number;
    newFollowers: number;
    contentCreated: number;
  };
  topContent: PostResponse[];
  audienceInsights?: {
    topCountries: Array<{ country: string; count: number }>;
    topReferrers: Array<{ source: string; count: number }>;
    deviceTypes: Array<{ type: string; percentage: number }>;
  };
}

// ============================================
// NOSTR Response Types
// ============================================

export interface NostrRelayResponse {
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  latency?: number;
  supportedNips?: number[];
}

export interface NostrEventResponse {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
  verified: boolean;
}

// ============================================
// Authentication Response Types
// ============================================

export interface AuthResponse {
  user: UserProfileResponse;
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  sessionId?: string;
}

export interface ChallengeResponse {
  challenge: string;
  expiresAt: string;
}

// ============================================
// Type Guards for Runtime Validation
// ============================================

export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'type' in response &&
    'message' in response &&
    ['network', 'validation', 'auth', 'server'].includes((response as ApiError).type)
  );
}

export function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    'status' in response &&
    ['success', 'error'].includes((response as ApiResponse<T>).status)
  );
}

export function isPaginatedResponse<T>(response: unknown): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'items' in response &&
    'pagination' in response &&
    typeof (response as PaginatedResponse<T>).pagination === 'object'
  );
}

// ============================================
// Fetch Helpers with Proper Typing
// ============================================

export async function fetchWithTypes<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const message = `HTTP ${response.status}: ${response.statusText}`;
      const error: ApiError =
        response.status === 401 || response.status === 403
          ? { type: 'auth', message, status: response.status as 401 | 403 }
          : response.status === 400
            ? { type: 'validation', message, status: 400, errors: {} }
            : response.status >= 500
              ? { type: 'server', message, status: 500 }
              : { type: 'network', message };

      return {
        data: null as T,
        status: 'error',
        message: error.message
      };
    }

    const data = await response.json();

    if (isApiResponse<T>(data)) {
      return data;
    }

    // Wrap non-standard responses
    return {
      data: data as T,
      status: 'success'
    };
  } catch (error) {
    return {
      data: null as T,
      status: 'error',
      message: error instanceof Error ? error.message : 'Network error occurred'
    };
  }
}

export async function fetchPaginatedWithTypes<T>(
  url: string,
  params?: { page?: number; limit?: number },
  options?: RequestInit
): Promise<PaginatedResponse<T>> {
  const urlWithParams = new URL(url);
  if (params?.page) urlWithParams.searchParams.set('page', params.page.toString());
  if (params?.limit) urlWithParams.searchParams.set('limit', params.limit.toString());

  const response = await fetchWithTypes<PaginatedResponse<T>>(
    urlWithParams.toString(),
    options
  );

  if (response.status === 'error' || !response.data) {
    return {
      items: [],
      pagination: {
        page: params?.page || 1,
        limit: params?.limit || 20,
        total: 0,
        hasMore: false
      }
    };
  }

  return response.data;
}