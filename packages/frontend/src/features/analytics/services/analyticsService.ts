/**
 * 📊 **ELITE ANALYTICS SERVICE - CREATOR DASHBOARD**
 *
 * Elite Engineering Standards:
 * - TDD approach with comprehensive testing
 * - Real backend integration with authentication
 * - Lightning Network payment analytics
 * - NOSTR protocol integration
 * - Type-safe error handling with Zod validation
 * - Real-time analytics with WebSocket support
 * - React Query integration for data fetching
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '../../auth/types';
import {
  AnalyticsChartData,
  AnalyticsError,
  AnalyticsEvent,
  AnalyticsExport,
  AnalyticsFilters,
  AnalyticsValidationError,
  CreatorEarnings,
  CreatorPerformanceMetrics,
  LightningPaymentAnalytics,
  MobileAnalyticsView,
  validateCreatorEarnings,
  validateLightningPayment,
} from '../types';

// 🔧 **ANALYTICS API CONFIGURATION**
const ANALYTICS_API_BASE =
  import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:3001/api/analytics';
const WEBSOCKET_URL = import.meta.env.VITE_ANALYTICS_WS_URL || 'ws://localhost:3001/analytics';

// 🔐 **AUTH HELPERS**
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

const getCurrentUser = (): User | null => {
  const demoUser = localStorage.getItem('demo_user');
  if (demoUser) {
    return JSON.parse(demoUser);
  }

  const token = getAuthToken();
  if (!token) return null;

  try {
    // Decode JWT payload (basic implementation)
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      sub?: string;
      email?: string;
      name?: string;
      nostr_pubkey?: string;
      role?: 'creator' | 'supporter' | 'admin';
      iat?: number;
    };

    return {
      id: payload.sub || payload.nostr_pubkey || 'unknown',
      email: payload.email || '',
      name: payload.name || payload.email || 'Unknown',
      nostr_pubkey: payload.nostr_pubkey,
      role: payload.role || 'supporter',
      avatar_url: undefined,
      bio: undefined,
      created_at: new Date((payload.iat || 0) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    // Invalid token
    localStorage.removeItem('auth_token');
    return null;
  }
};

// 📡 **REAL-TIME ANALYTICS WEBSOCKET**
class AnalyticsWebSocketManager {
  private ws: WebSocket | null = null;
  private eventListeners: ((event: AnalyticsEvent) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  async connect(userId: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const token = getAuthToken();
      if (!token) {
        throw new AnalyticsError(
          'Authentication required for real-time analytics',
          'AUTH_REQUIRED'
        );
      }

      const wsUrl = `${WEBSOCKET_URL}?token=${token}&userId=${userId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.log('📡 Analytics WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const analyticsEvent: AnalyticsEvent = JSON.parse(event.data);
          this.eventListeners.forEach((listener) => listener(analyticsEvent));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse analytics event:', error);
        }
      };

      this.ws.onclose = () => {
        // eslint-disable-next-line no-console
        console.log('📡 Analytics WebSocket disconnected');
        this.attemptReconnect(userId);
      };

      this.ws.onerror = (error) => {
        // eslint-disable-next-line no-console
        console.error('📡 Analytics WebSocket error:', error);
      };
    } catch (error) {
      throw new AnalyticsError('Failed to connect to analytics WebSocket', 'WEBSOCKET_ERROR', {
        error,
      });
    }
  }

  private async attemptReconnect(userId: string): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // eslint-disable-next-line no-console
      console.error('Max reconnection attempts reached for analytics WebSocket');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log(
        `Attempting to reconnect analytics WebSocket (attempt ${this.reconnectAttempts})`
      );
      this.connect(userId);
    }, delay);
  }

  subscribe(listener: (event: AnalyticsEvent) => void): () => void {
    this.eventListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventListeners = [];
  }
}

// 🏗️ **ELITE ANALYTICS SERVICE IMPLEMENTATION**
class AnalyticsServiceImpl {
  private wsManager = new AnalyticsWebSocketManager();
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = {
    earnings: 5 * 60 * 1000, // 5 minutes
    payments: 2 * 60 * 1000, // 2 minutes
    charts: 10 * 60 * 1000, // 10 minutes
    performance: 15 * 60 * 1000, // 15 minutes
  };

  // 🔐 **AUTHENTICATED REQUEST HELPER**
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const token = getAuthToken();
        if (!token) {
          throw new AnalyticsError('Authentication required', 'AUTH_REQUIRED');
        }

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${ANALYTICS_API_BASE}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // If it's an auth error, don't retry
          if (response.status === 401 || response.status === 403) {
            throw new AnalyticsError(
              errorData.message || 'Authentication failed',
              `HTTP_${response.status}`,
              { status: response.status, ...errorData }
            );
          }

          // For other errors, throw and let retry logic handle it
          throw new AnalyticsError(
            errorData.message || 'Analytics API request failed',
            `HTTP_${response.status}`,
            { status: response.status, ...errorData }
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry for auth errors or validation errors
        if (
          error instanceof AnalyticsError &&
          (error.code.includes('AUTH') || error.code.includes('VALIDATION'))
        ) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // If we get here, all retries failed
    if (lastError instanceof AnalyticsError) {
      throw lastError;
    }
    throw new AnalyticsError('Network error occurred after retries', 'NETWORK_ERROR', {
      error: lastError,
      attempts: maxRetries,
    });
  }

  // 💾 **CACHE MANAGEMENT**
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCachedData<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  // 💰 **CREATOR EARNINGS ANALYTICS**
  async getCreatorEarnings(
    period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all' = '7d'
  ): Promise<CreatorEarnings> {
    const cacheKey = `earnings-${period}`;
    const cached = this.getCachedData<CreatorEarnings>(cacheKey);
    if (cached) return cached;

    try {
      const user = getCurrentUser();
      if (!user) {
        throw new AnalyticsError('User authentication required', 'AUTH_REQUIRED');
      }

      const data = await this.makeAuthenticatedRequest<unknown>(
        `/earnings?period=${period}&userId=${user.id}`
      );

      const earnings = validateCreatorEarnings(data);
      this.setCachedData(cacheKey, earnings, this.CACHE_TTL.earnings);

      return earnings;
    } catch (error) {
      if (error instanceof AnalyticsValidationError) {
        throw error;
      }
      throw new AnalyticsError('Failed to fetch creator earnings', 'FETCH_ERROR', { error });
    }
  }

  // ⚡ **LIGHTNING PAYMENT ANALYTICS**
  async getLightningPayments(filters?: AnalyticsFilters): Promise<LightningPaymentAnalytics[]> {
    const cacheKey = `payments-${JSON.stringify(filters || {})}`;
    const cached = this.getCachedData<LightningPaymentAnalytics[]>(cacheKey);
    if (cached) return cached;

    try {
      const user = getCurrentUser();
      if (!user) {
        throw new AnalyticsError('User authentication required', 'AUTH_REQUIRED');
      }

      const queryParams = new URLSearchParams({ userId: user.id });
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, JSON.stringify(value));
          }
        });
      }

      const data = await this.makeAuthenticatedRequest<unknown[]>(
        `/payments?${queryParams.toString()}`
      );

      const payments = data.map((payment) => validateLightningPayment(payment));
      this.setCachedData(cacheKey, payments, this.CACHE_TTL.payments);

      return payments;
    } catch (error) {
      throw new AnalyticsError('Failed to fetch lightning payments', 'FETCH_ERROR', { error });
    }
  }

  // 📊 **ANALYTICS CHART DATA**
  async getChartData(
    period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all' = '7d'
  ): Promise<AnalyticsChartData> {
    const cacheKey = `charts-${period}`;
    const cached = this.getCachedData<AnalyticsChartData>(cacheKey);
    if (cached) return cached;

    try {
      const user = getCurrentUser();
      if (!user) {
        throw new AnalyticsError('User authentication required', 'AUTH_REQUIRED');
      }

      const data = await this.makeAuthenticatedRequest<AnalyticsChartData>(
        `/charts?period=${period}&userId=${user.id}`
      );

      this.setCachedData(cacheKey, data, this.CACHE_TTL.charts);
      return data;
    } catch (error) {
      throw new AnalyticsError('Failed to fetch chart data', 'FETCH_ERROR', { error });
    }
  }

  // 🎯 **CREATOR PERFORMANCE METRICS**
  async getPerformanceMetrics(): Promise<CreatorPerformanceMetrics> {
    const cacheKey = 'performance-metrics';
    const cached = this.getCachedData<CreatorPerformanceMetrics>(cacheKey);
    if (cached) return cached;

    try {
      const user = getCurrentUser();
      if (!user) {
        throw new AnalyticsError('User authentication required', 'AUTH_REQUIRED');
      }

      const data = await this.makeAuthenticatedRequest<CreatorPerformanceMetrics>(
        `/performance?userId=${user.id}`
      );

      this.setCachedData(cacheKey, data, this.CACHE_TTL.performance);
      return data;
    } catch (error) {
      throw new AnalyticsError('Failed to fetch performance metrics', 'FETCH_ERROR', { error });
    }
  }

  // 📱 **MOBILE OPTIMIZED ANALYTICS**
  async getMobileAnalytics(): Promise<MobileAnalyticsView> {
    try {
      const user = getCurrentUser();
      if (!user) {
        throw new AnalyticsError('User authentication required', 'AUTH_REQUIRED');
      }

      const data = await this.makeAuthenticatedRequest<MobileAnalyticsView>(
        `/mobile?userId=${user.id}`
      );

      return data;
    } catch (error) {
      throw new AnalyticsError('Failed to fetch mobile analytics', 'FETCH_ERROR', { error });
    }
  }

  // 📤 **ANALYTICS EXPORT**
  async exportAnalytics(exportConfig: AnalyticsExport): Promise<Blob> {
    try {
      const user = getCurrentUser();
      if (!user) {
        throw new AnalyticsError('User authentication required', 'AUTH_REQUIRED');
      }

      const token = getAuthToken();
      const response = await fetch(`${ANALYTICS_API_BASE}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...exportConfig, userId: user.id }),
      });

      if (!response.ok) {
        throw new AnalyticsError('Export request failed', `HTTP_${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      throw new AnalyticsError('Failed to export analytics', 'EXPORT_ERROR', { error });
    }
  }

  // 📡 **REAL-TIME ANALYTICS**
  async connectRealTime(): Promise<void> {
    const user = getCurrentUser();
    if (!user) {
      throw new AnalyticsError(
        'User authentication required for real-time analytics',
        'AUTH_REQUIRED'
      );
    }

    await this.wsManager.connect(user.id);
  }

  subscribeToEvents(callback: (event: AnalyticsEvent) => void): () => void {
    return this.wsManager.subscribe(callback);
  }

  disconnectRealTime(): void {
    this.wsManager.disconnect();
  }

  // 🔄 **CACHE MANAGEMENT**
  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // 🧹 **CLEANUP**
  async cleanup(): Promise<void> {
    this.disconnectRealTime();
    this.clearCache();
  }
}

// 🎯 **SINGLETON INSTANCE**
export const analyticsService = new AnalyticsServiceImpl();

// 🔄 **AUTO-CLEANUP ON PAGE UNLOAD**
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    analyticsService.cleanup();
  });
}

// 🎣 **REACT QUERY HOOKS FOR ANALYTICS**

// Query keys factory
export const analyticsKeys = {
  all: ['analytics'] as const,
  earnings: (period: string) => [...analyticsKeys.all, 'earnings', period] as const,
  payments: (filters?: AnalyticsFilters) => [...analyticsKeys.all, 'payments', filters] as const,
  charts: (period: string) => [...analyticsKeys.all, 'charts', period] as const,
  performance: () => [...analyticsKeys.all, 'performance'] as const,
  mobile: () => [...analyticsKeys.all, 'mobile'] as const,
};

// Hook for fetching creator earnings
export const useCreatorEarnings = (period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all' = '7d') => {
  return useQuery({
    queryKey: analyticsKeys.earnings(period),
    queryFn: () => analyticsService.getCreatorEarnings(period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry auth errors
      if (error instanceof AnalyticsError && error.code.includes('AUTH')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

// Hook for fetching lightning payments
export const useLightningPayments = (filters?: AnalyticsFilters) => {
  return useQuery({
    queryKey: analyticsKeys.payments(filters),
    queryFn: () => analyticsService.getLightningPayments(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (error instanceof AnalyticsError && error.code.includes('AUTH')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

// Hook for fetching chart data
export const useChartData = (period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all' = '7d') => {
  return useQuery({
    queryKey: analyticsKeys.charts(period),
    queryFn: () => analyticsService.getChartData(period),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: (failureCount, error) => {
      if (error instanceof AnalyticsError && error.code.includes('AUTH')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

// Hook for fetching performance metrics
export const usePerformanceMetrics = () => {
  return useQuery({
    queryKey: analyticsKeys.performance(),
    queryFn: () => analyticsService.getPerformanceMetrics(),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error) => {
      if (error instanceof AnalyticsError && error.code.includes('AUTH')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

// Hook for fetching mobile analytics
export const useMobileAnalytics = () => {
  return useQuery({
    queryKey: analyticsKeys.mobile(),
    queryFn: () => analyticsService.getMobileAnalytics(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (error instanceof AnalyticsError && error.code.includes('AUTH')) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

// Mutation hook for analytics export
export const useAnalyticsExport = () => {
  return useMutation({
    mutationFn: (exportConfig: AnalyticsExport) => analyticsService.exportAnalytics(exportConfig),
    retry: (failureCount, error) => {
      if (error instanceof AnalyticsError && error.code.includes('AUTH')) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

// Hook for real-time analytics
export const useRealTimeAnalytics = () => {
  const queryClient = useQueryClient();

  const connectRealTime = async () => {
    await analyticsService.connectRealTime();

    // Subscribe to events and invalidate relevant queries
    return analyticsService.subscribeToEvents((event) => {
      switch (event.type) {
        case 'payment_received':
          queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
          break;
        case 'new_subscriber':
          queryClient.invalidateQueries({ queryKey: analyticsKeys.earnings('7d') });
          break;
        case 'content_viewed':
          queryClient.invalidateQueries({ queryKey: analyticsKeys.charts('24h') });
          break;
        default:
          // Invalidate all analytics data for unknown events
          queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
      }
    });
  };

  const disconnectRealTime = () => {
    analyticsService.disconnectRealTime();
  };

  return { connectRealTime, disconnectRealTime };
};
