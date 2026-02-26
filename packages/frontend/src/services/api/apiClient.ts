/**
 * API Client Service
 *
 * Typed HTTP client matching the Phase 1 API contract (docs/api-spec.md).
 * All server data fetching should go through this service.
 */

import type {
  ApiResponse,
  AuthChallenge,
  AuthenticateRequest,
  AuthToken,
  CancelSubscriptionRequest,
  ContentAnalytics,
  ContentPublishRequest,
  ContentRecommendation,
  ContentSearchParams,
  ContentSearchResult,
  CreateInvoiceRequest,
  CreateSubscriptionRequest,
  CurrencyConversion,
  Invoice,
  PaginatedResponse,
  PaymentAnalytics,
  PaymentResult,
  SubscriptionResponse,
  UserAnalytics,
  UserProfile,
  UserProfileUpdate,
} from './types';

const DEFAULT_BASE_URL = 'http://localhost:3001';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type QueryParams = Record<string, string | number | boolean | undefined>;

class ApiClient {
  private baseUrl: string;
  private _token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Lazy token accessor — checks localStorage on every call so tokens
   * set after module initialization (e.g. by auth setup) are picked up.
   */
  private getEffectiveToken(): string | null {
    if (this._token) return this._token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  setToken(token: string | null): void {
    this._token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    return this.getEffectiveToken();
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    params?: QueryParams
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getEffectiveToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: response.statusText,
        code: 'UNKNOWN_ERROR',
      }));
      throw new ApiError(
        errorData.error || response.statusText,
        response.status,
        errorData.code
      );
    }

    return response.json() as Promise<T>;
  }

  // -- Typed HTTP methods --

  get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>('POST', path, body, params);
  }

  put<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>('PUT', path, body, params);
  }

  delete<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>('DELETE', path, body, params);
  }

  // -- Auth --

  async generateChallenge(): Promise<ApiResponse<AuthChallenge>> {
    return this.request('POST', '/api/auth/challenge');
  }

  async authenticate(data: AuthenticateRequest): Promise<ApiResponse<AuthToken>> {
    return this.request('POST', '/api/auth/authenticate', data);
  }

  async refreshToken(): Promise<ApiResponse<{ token: string; expires_in: string }>> {
    return this.request('POST', '/api/auth/refresh');
  }

  async verifyToken(): Promise<ApiResponse<{ user: AuthToken['user']; valid: boolean }>> {
    return this.request('GET', '/api/auth/verify');
  }

  async logout(): Promise<ApiResponse<{ instructions: string }>> {
    return this.request('POST', '/api/auth/logout');
  }

  // -- Users --

  async getUserProfile(id: string): Promise<ApiResponse<UserProfile>> {
    return this.request('GET', `/api/v1/users/profile/${id}`);
  }

  async updateUserProfile(
    id: string,
    data: UserProfileUpdate
  ): Promise<ApiResponse<Partial<UserProfile>>> {
    return this.request('PUT', `/api/v1/users/profile/${id}`, data);
  }

  async followUser(targetUserId: string): Promise<ApiResponse<{ follower_id: string; following_id: string; created_at: string }>> {
    return this.request('POST', '/api/v1/users/relationships/follow', {
      target_user_id: targetUserId,
    });
  }

  async unfollowUser(targetUserId: string): Promise<ApiResponse<void>> {
    return this.request('DELETE', '/api/v1/users/relationships/unfollow', {
      target_user_id: targetUserId,
    });
  }

  async getUserAnalytics(id: string): Promise<ApiResponse<UserAnalytics>> {
    return this.request('GET', `/api/v1/users/analytics/${id}`);
  }

  // -- Content --

  async publishContent(
    data: ContentPublishRequest
  ): Promise<ApiResponse<{ id: string; status: string; nostr_event_id: string }>> {
    return this.request('POST', '/api/v1/content/publish', data);
  }

  async searchContent(
    params: ContentSearchParams
  ): Promise<PaginatedResponse<ContentSearchResult>> {
    return this.request('GET', '/api/v1/content/search', undefined, params as QueryParams);
  }

  async getContentRecommendations(
    limit?: number,
    category?: string
  ): Promise<ApiResponse<ContentRecommendation[]>> {
    return this.request('GET', '/api/v1/content/recommendations', undefined, {
      limit,
      category,
    });
  }

  async getContentAnalytics(id: string): Promise<ApiResponse<ContentAnalytics>> {
    return this.request('GET', `/api/v1/content/analytics/${id}`);
  }

  // -- Payments --

  async createInvoice(data: CreateInvoiceRequest): Promise<ApiResponse<Invoice>> {
    return this.request('POST', '/api/v1/payments/invoices', data);
  }

  async getInvoice(id: string): Promise<ApiResponse<Invoice>> {
    return this.request('GET', `/api/v1/payments/invoices/${id}`);
  }

  async payInvoice(
    id: string,
    paymentRequest: string
  ): Promise<ApiResponse<PaymentResult>> {
    return this.request('POST', `/api/v1/payments/invoices/${id}/pay`, {
      payment_request: paymentRequest,
    });
  }

  async convertCurrency(
    amount: number,
    from: string,
    to: string
  ): Promise<ApiResponse<CurrencyConversion>> {
    return this.request('GET', '/api/v1/payments/currency/convert', undefined, {
      amount,
      from,
      to,
    });
  }

  // -- Subscriptions --

  async createSubscription(
    data: CreateSubscriptionRequest
  ): Promise<ApiResponse<SubscriptionResponse>> {
    return this.request('POST', '/api/v1/payments/subscriptions', data);
  }

  async cancelSubscription(
    id: string,
    data: CancelSubscriptionRequest
  ): Promise<ApiResponse<{ id: string; status: string; cancelled_at: string; access_until: string }>> {
    return this.request('DELETE', `/api/v1/payments/subscriptions/${id}`, data);
  }

  // -- Payment Analytics --

  async getPaymentAnalytics(
    timeframe?: string,
    type?: string
  ): Promise<ApiResponse<PaymentAnalytics>> {
    return this.request('GET', '/api/v1/payments/analytics', undefined, {
      timeframe,
      type,
    });
  }

  // -- Health --

  async checkHealth(): Promise<ApiResponse<{ status: string; services: Record<string, string> }>> {
    return this.request('GET', '/health');
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient(DEFAULT_BASE_URL);

export default apiClient;
