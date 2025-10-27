/**
 * 🧪 **REACT QUERY TEST UTILITIES - ELITE ENGINEERING**
 *
 * Purpose: Comprehensive React Query testing support for analytics components
 * Features:
 * - QueryClient provider wrapper for tests
 * - Mock server state management
 * - Custom render function with providers
 * - Query state testing utilities
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';

// Remove unsafe global declarations - use proper imports instead
// Jest and expect should be available globally in test environment

// Test-specific QueryClient configuration
export const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: 0, // Disable caching in tests
        staleTime: 0, // All queries are stale immediately in tests
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

// Test wrapper with QueryClient provider
interface TestWrapperProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export const QueryTestWrapper = ({ children, queryClient }: TestWrapperProps) => {
  const client = queryClient || createTestQueryClient();

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

// Custom render function with QueryClient provider
interface RenderWithQueryClientOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export const renderWithQueryClient = (
  ui: ReactElement,
  options: RenderWithQueryClientOptions = {}
) => {
  const { queryClient, ...renderOptions } = options;
  const client = queryClient || createTestQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryTestWrapper queryClient={client}>{children}</QueryTestWrapper>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: client,
  };
};

// Utility to wait for queries to settle
export const waitForQueriesToSettle = async (queryClient: QueryClient) => {
  await queryClient
    .getQueryCache()
    .findAll()
    .forEach((query) => {
      if (query.state.fetchStatus === 'fetching') {
        return query.promise;
      }
    });
};

// Mock fetch response helper with proper generic type
export const createMockResponse = <T = unknown>(data: T, status = 200, ok = true): Partial<Response> => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  blob: jest.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
  headers: new Headers(),
  redirected: false,
  type: 'basic' as ResponseType,
  url: '',
  body: null,
  bodyUsed: false,
  clone: jest.fn(),
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  formData: jest.fn().mockResolvedValue(new FormData()),
});

// Query state assertion utilities with proper types
export const expectQueryToBeLoading = (
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): void => {
  const queryState = queryClient.getQueryState(queryKey);
  expect(queryState?.fetchStatus).toBe('fetching');
};

export const expectQueryToBeSuccess = <T = unknown>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  expectedData?: T
): void => {
  const queryState = queryClient.getQueryState<T>(queryKey);
  expect(queryState?.status).toBe('success');
  if (expectedData !== undefined) {
    expect(queryState?.data).toEqual(expectedData);
  }
};

export const expectQueryToBeError = (
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): void => {
  const queryState = queryClient.getQueryState(queryKey);
  expect(queryState?.status).toBe('error');
};

// Analytics-specific mock data generators
export const createMockEngagementMetrics = () => ({
  metrics: {
    engagement_score: 85.5,
    quality_score: 78.2,
    viral_coefficient: 1.25,
    raw_metrics: {
      views: 15420,
      likes: 1250,
      shares: 340,
      comments: 125,
      saves: 89,
    },
  },
  previousPeriod: {
    engagement_score: 82.1,
    quality_score: 75.8,
    viral_coefficient: 1.18,
    raw_metrics: {
      views: 14200,
      likes: 1180,
      shares: 298,
      comments: 112,
      saves: 75,
    },
  },
  generated_at: new Date().toISOString(),
});

export const createMockEngagementPatterns = () => [
  {
    pattern_id: 'pattern-1',
    pattern_name: 'Daily Engagement Peak',
    pattern_type: 'daily',
    description: 'Peak engagement occurs between 7-9 PM',
    confidence: 0.92,
    significance: 'high',
    detected_at: new Date().toISOString(),
    timestamps: ['2024-01-01T19:00:00Z', '2024-01-01T20:00:00Z', '2024-01-01T21:00:00Z'],
    values: [125, 150, 135],
  },
  {
    pattern_id: 'pattern-2',
    pattern_name: 'Weekly Content Performance',
    pattern_type: 'weekly',
    description: 'Video content performs 35% better on weekends',
    confidence: 0.87,
    significance: 'medium',
    detected_at: new Date().toISOString(),
    timestamps: ['2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z', '2024-01-03T00:00:00Z'],
    values: [200, 180, 270],
  },
];

export const createMockAIInsights = () => [
  {
    insight_id: 'insight-1',
    title: 'Optimal Posting Time Detected',
    description: 'Your content performs 40% better when posted between 7-9 PM',
    insight_type: 'opportunity',
    confidence_score: 0.89,
    impact_score: 7.5,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recommendations: [
      'Schedule your next 3 posts for 7:30 PM',
      'Consider creating evening-themed content',
      'Monitor engagement during this time window',
    ],
  },
  {
    insight_id: 'insight-2',
    title: 'Content Length Optimization',
    description: 'Shorter posts (under 150 words) are getting 25% more engagement',
    insight_type: 'optimization',
    confidence_score: 0.76,
    impact_score: 6.2,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recommendations: [
      'Aim for 100-150 words in your posts',
      'Use bullet points for longer content',
      'Test different content lengths',
    ],
  },
];

export const createMockBenchmarks = () => ({
  industry_average: 65.8,
  personal_best: 92.4,
  content_type_average: 72.1,
  competitor_average: 68.9,
});

// Export all utilities
export default {
  createTestQueryClient,
  QueryTestWrapper,
  renderWithQueryClient,
  waitForQueriesToSettle,
  createMockResponse,
  expectQueryToBeLoading,
  expectQueryToBeSuccess,
  expectQueryToBeError,
  createMockEngagementMetrics,
  createMockEngagementPatterns,
  createMockAIInsights,
  createMockBenchmarks,
};
