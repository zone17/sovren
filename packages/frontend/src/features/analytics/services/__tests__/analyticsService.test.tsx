/**
 * 🧪 **ANALYTICS SERVICE COMPREHENSIVE TESTS**
 *
 * Uses MSW for HTTP-layer mocking (Phase 9 migration).
 * WebSocket mocking uses vi.fn() with proper static constants.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import {
  analyticsService,
  useCreatorEarnings,
  analyticsKeys
} from '../analyticsService';
import { AnalyticsError, AnalyticsEvent } from '../../types';
import { server } from '../../../../test-utils/msw/server';

const API_BASE = 'http://localhost:3001/api/analytics';

// 🎭 **TEST FIXTURES**
const createMockUser = () => ({
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'creator' as const,
  nostr_pubkey: 'npub1testuser123',
  avatar_url: undefined,
  bio: undefined,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  email_verified: true,
  nostr_verified: true,
  permissions: ['content.create'],
});

const createMockEarnings = () => ({
  period: '7d' as const,
  start_date: '2024-01-01T00:00:00.000Z',
  end_date: '2024-01-08T00:00:00.000Z',
  lightning: {
    total_sats: 50000,
    total_invoices: 25,
    paid_invoices: 24,
    success_rate: 96,
    average_payment: 2083,
    largest_payment: 10000,
    payment_velocity: 3.5,
  },
  content: {
    total_posts: 15,
    premium_posts: 8,
    average_engagement: 75.5,
    top_performing_content: ['post1', 'post2', 'post3'],
  },
  subscribers: {
    total_count: 1250,
    new_subscribers: 45,
    churn_rate: 5.2,
    retention_rate: 94.8,
    subscriber_growth: 40,
  },
  geography: [
    { country: 'US', subscriber_count: 500, earnings_sats: 25000 },
    { country: 'UK', subscriber_count: 300, earnings_sats: 15000 },
  ],
  realtime: {
    active_supporters: 12,
    pending_payments: 2,
    last_payment_time: '2024-01-08T10:30:00.000Z',
    current_session_earnings: 1500,
  },
});

const createMockPayments = () => [
  {
    id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
    amount_sats: 2100,
    description: 'Premium content access',
    paid_at: '2024-01-08T10:00:00.000Z',
    supporter_id: 'supporter_123',
    supporter_nostr_pubkey: 'npub1supporter123',
    content_id: 'b2c3d4e5-f6a7-4901-bcde-f12345678901',
    payment_hash: 'hash123',
    fee_sats: 21,
    settlement_time_ms: 250,
  },
];

const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

interface WrapperProps {
  children: React.ReactNode;
}

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper: React.FC<WrapperProps> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock WebSocket with proper static constants (WebSocket.OPEN etc.)
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // WebSocket.OPEN
  onopen: null as ((ev: Event) => void) | null,
  onmessage: null as ((ev: MessageEvent) => void) | null,
  onerror: null as ((ev: Event) => void) | null,
  onclose: null as ((ev: CloseEvent) => void) | null,
};

const MockWebSocket = vi.fn(() => mockWebSocket) as any;
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;
// WebSocket is stubbed in beforeEach to run after setup file's vi.clearAllMocks()

// 🎯 **TEST SETUP**
describe('📊 Analytics Service Comprehensive Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();

    // Reset mocks
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
    localStorageMock.removeItem.mockReset();
    localStorageMock.clear.mockReset();
    mockWebSocket.send.mockClear();
    mockWebSocket.close.mockClear();
    mockWebSocket.addEventListener.mockClear();
    mockWebSocket.removeEventListener.mockClear();
    mockWebSocket.onopen = null;
    mockWebSocket.onmessage = null;
    mockWebSocket.onerror = null;
    mockWebSocket.onclose = null;
    MockWebSocket.mockClear();
    MockWebSocket.mockImplementation(() => mockWebSocket);
    vi.stubGlobal('WebSocket', MockWebSocket);

    analyticsService.clearCache();
    analyticsService.retryDelay = () => 0;

    // Mock successful auth
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'demo_user') return JSON.stringify(createMockUser());
      if (key === 'auth_token') return 'mock-jwt-token';
      return null;
    });
  });

  afterEach(() => {
    analyticsService.disconnectRealTime();
    analyticsService.retryDelay = (attempt) => Math.pow(2, attempt) * 1000;
    queryClient.clear();
  });

  // 🔐 **AUTHENTICATION TESTS**
  describe('Authentication Handling', () => {
    test('should handle missing authentication gracefully', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      await expect(analyticsService.getCreatorEarnings('7d')).rejects.toThrow(
        'User authentication required'
      );
    });

    test('should handle invalid token gracefully', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth_token') return 'invalid-token';
        return null;
      });

      await expect(analyticsService.getCreatorEarnings('7d')).rejects.toThrow(
        AnalyticsError
      );
    });

    test('should use demo user when available', async () => {
      const mockEarnings = createMockEarnings();
      server.use(
        http.get(`${API_BASE}/earnings`, () => HttpResponse.json(mockEarnings))
      );

      const result = await analyticsService.getCreatorEarnings('7d');
      expect(result).toEqual(mockEarnings);
    });
  });

  // 💰 **CREATOR EARNINGS TESTS**
  describe('Creator Earnings Analytics', () => {
    test('should fetch earnings data with proper timeout handling', async () => {
      const mockEarnings = createMockEarnings();
      server.use(
        http.get(`${API_BASE}/earnings`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json(mockEarnings);
        })
      );

      const startTime = Date.now();
      const result = await analyticsService.getCreatorEarnings('7d');
      const duration = Date.now() - startTime;

      expect(result).toEqual(mockEarnings);
      expect(duration).toBeLessThan(5000);
    }, 10000);

    test('should implement proper caching strategy', async () => {
      let fetchCount = 0;
      server.use(
        http.get(`${API_BASE}/earnings`, () => {
          fetchCount++;
          return HttpResponse.json(createMockEarnings());
        })
      );

      const result1 = await analyticsService.getCreatorEarnings('7d');
      const result2 = await analyticsService.getCreatorEarnings('7d');

      expect(result1).toEqual(result2);
      expect(fetchCount).toBe(1);
    });

    test('should handle cache invalidation correctly', async () => {
      let fetchCount = 0;
      server.use(
        http.get(`${API_BASE}/earnings`, () => {
          fetchCount++;
          return HttpResponse.json(createMockEarnings());
        })
      );

      await analyticsService.getCreatorEarnings('7d');
      analyticsService.invalidateCache('earnings');
      await analyticsService.getCreatorEarnings('7d');

      expect(fetchCount).toBe(2);
    });

    test('should retry failed requests with exponential backoff', async () => {
      let callCount = 0;
      server.use(
        http.get(`${API_BASE}/earnings`, () => {
          callCount++;
          if (callCount < 3) return HttpResponse.error();
          return HttpResponse.json(createMockEarnings());
        })
      );

      const result = await analyticsService.getCreatorEarnings('7d');

      expect(result).toBeDefined();
      expect(callCount).toBe(3);
    });
  });

  // ⚡ **LIGHTNING PAYMENTS TESTS**
  describe('Lightning Payment Analytics', () => {
    test('should fetch payments with filters', async () => {
      const mockPayments = createMockPayments();
      server.use(
        http.get(`${API_BASE}/payments`, () => HttpResponse.json(mockPayments))
      );

      const filters = {
        dateRange: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-08T23:59:59.000Z',
        },
        paymentRange: { min_sats: 1000, max_sats: 5000 },
        contentTypes: ['premium' as const],
        subscriberTypes: ['premium' as const],
      };

      const result = await analyticsService.getLightningPayments(filters);
      expect(result).toEqual(mockPayments);
    });

    test('should handle empty payments response', async () => {
      server.use(
        http.get(`${API_BASE}/payments`, () => HttpResponse.json([]))
      );

      const result = await analyticsService.getLightningPayments();
      expect(result).toEqual([]);
    });
  });

  // 📊 **REACT QUERY INTEGRATION TESTS**
  describe('React Query Integration', () => {
    test('useCreatorEarnings hook should work with proper error handling', async () => {
      const mockEarnings = createMockEarnings();
      server.use(
        http.get(`${API_BASE}/earnings`, () => HttpResponse.json(mockEarnings))
      );

      const { result } = renderHook(
        () => useCreatorEarnings('7d'),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEarnings);
      expect(result.current.error).toBeNull();
    });

    test('should handle query errors gracefully', async () => {
      const spy = vi.spyOn(analyticsService, 'getCreatorEarnings').mockRejectedValue(
        new AnalyticsError('Auth failed', 'AUTH_REQUIRED')
      );

      const { result } = renderHook(
        () => useCreatorEarnings('7d'),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      spy.mockRestore();
    });

    test('should implement proper query key strategies', () => {
      const earningsKey = analyticsKeys.earnings('7d');
      const paymentsKey = analyticsKeys.payments({
        dateRange: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-08T00:00:00.000Z',
        },
        paymentRange: { min_sats: 0, max_sats: 10000 },
        contentTypes: [],
        subscriberTypes: [],
      });

      expect(earningsKey).toEqual(['analytics', 'earnings', '7d']);
      expect(paymentsKey[0]).toBe('analytics');
      expect(paymentsKey[1]).toBe('payments');
    });
  });

  // 📡 **REAL-TIME ANALYTICS TESTS**
  describe('Real-time Analytics', () => {
    test('should connect to WebSocket successfully', async () => {
      await analyticsService.connectRealTime();

      expect(MockWebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://localhost:3001/analytics?token=mock-jwt-token&userId=test-user-123')
      );
    });

    test('should handle WebSocket events', async () => {
      const events: AnalyticsEvent[] = [];
      const unsubscribe = analyticsService.subscribeToEvents((event) => {
        events.push(event);
      });

      await analyticsService.connectRealTime();

      const mockEvent: AnalyticsEvent = {
        type: 'payment_received',
        timestamp: new Date().toISOString(),
        data: {
          amount_sats: 2100,
          content_id: 'content_123',
          supporter_id: 'supporter_456',
        },
      };

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify(mockEvent),
        } as MessageEvent);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(mockEvent);

      unsubscribe();
    });
  });

  // 📤 **EXPORT FUNCTIONALITY TESTS**
  describe('Analytics Export', () => {
    test('should export analytics data as blob', async () => {
      server.use(
        http.post(`${API_BASE}/export`, () => {
          return new HttpResponse(JSON.stringify({ test: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      const exportConfig = {
        format: 'json' as const,
        data_types: ['earnings', 'payments'] as Array<'content' | 'subscribers' | 'earnings' | 'payments'>,
        date_range: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-08T00:00:00.000Z',
        },
        include_personal_data: false,
      };

      const result = await analyticsService.exportAnalytics(exportConfig);

      expect(result).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    });
  });

  // 🚨 **ERROR HANDLING TESTS**
  describe('Error Handling', () => {
    test('should handle network errors with proper retry logic', async () => {
      let attempts = 0;
      server.use(
        http.get(`${API_BASE}/earnings`, () => {
          attempts++;
          if (attempts <= 2) return HttpResponse.error();
          return HttpResponse.json(createMockEarnings());
        })
      );

      const result = await analyticsService.getCreatorEarnings('7d');

      expect(result).toBeDefined();
      expect(attempts).toBe(3);
    });

    test('should handle authentication errors without retry', async () => {
      server.use(
        http.get(`${API_BASE}/earnings`, () => {
          return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
        })
      );

      await expect(analyticsService.getCreatorEarnings('7d')).rejects.toThrow(AnalyticsError);
    });

    test('should handle malformed response data', async () => {
      server.use(
        http.get(`${API_BASE}/earnings`, () => HttpResponse.json({ invalid: 'data' }))
      );

      await expect(analyticsService.getCreatorEarnings('7d')).rejects.toThrow();
    });
  });

  // ⚡ **PERFORMANCE TESTS**
  describe('Performance Tests', () => {
    test('should complete operations within acceptable time limits', async () => {
      server.use(
        http.get(`${API_BASE}/earnings`, () => HttpResponse.json(createMockEarnings()))
      );

      const startTime = Date.now();
      await analyticsService.getCreatorEarnings('7d');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });

    test('should handle concurrent requests efficiently', async () => {
      server.use(
        http.get(`${API_BASE}/earnings`, () => HttpResponse.json(createMockEarnings()))
      );

      const startTime = Date.now();
      const results = await Promise.all([
        analyticsService.getCreatorEarnings('7d'),
        analyticsService.getCreatorEarnings('30d'),
        analyticsService.getCreatorEarnings('90d'),
      ]);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  // 🔄 **CLEANUP TESTS**
  describe('Service Cleanup', () => {
    test('should cleanup resources properly', async () => {
      server.use(
        http.get(`${API_BASE}/earnings`, () => HttpResponse.json(createMockEarnings()))
      );

      await analyticsService.connectRealTime();
      await analyticsService.getCreatorEarnings('7d');
      await analyticsService.cleanup();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('should clear cache on cleanup', async () => {
      let fetchCount = 0;
      server.use(
        http.get(`${API_BASE}/earnings`, () => {
          fetchCount++;
          return HttpResponse.json(createMockEarnings());
        })
      );

      await analyticsService.getCreatorEarnings('7d');
      analyticsService.clearCache();
      await analyticsService.getCreatorEarnings('7d');

      expect(fetchCount).toBe(2);
    });
  });

  // 🧪 **INTEGRATION TESTS**
  describe('Integration Tests', () => {
    test('should work end-to-end for creator dashboard flow', async () => {
      const mockEarnings = createMockEarnings();
      const mockPayments = createMockPayments();

      server.use(
        http.get(`${API_BASE}/earnings`, () => HttpResponse.json(mockEarnings)),
        http.get(`${API_BASE}/payments`, () => HttpResponse.json(mockPayments))
      );

      const [earnings, payments] = await Promise.all([
        analyticsService.getCreatorEarnings('7d'),
        analyticsService.getLightningPayments(),
      ]);

      expect(earnings).toEqual(mockEarnings);
      expect(payments).toEqual(mockPayments);
    }, 10000);
  });
});
