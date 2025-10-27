/**
 * 📊 **ENGAGEMENT ANALYTICS HOOK - ELITE ENGINEERING**
 *
 * Implementation of US-175.6: Real API Integration Hook
 *
 * Features:
 * - Real-time data fetching with caching
 * - Error handling with retry logic
 * - TypeScript type safety with Zod validation
 * - Performance optimization with React Query
 * - Automatic refresh and invalidation
 */

import type {
  AIEngagementInsight,
  AudienceGrowthForecast,
  EngagementMetricsFramework,
  EngagementPattern,
  OptimizationSuggestion,
  PerformancePrediction,
} from '@/types/engagement-analytics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

// =====================================================
// HOOK PARAMETERS SCHEMA
// =====================================================

const UseEngagementAnalyticsParamsSchema = z.object({
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).default('week'),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }),
  contentId: z.string().uuid().optional(),
  enableRealTime: z.boolean().default(true),
  refreshInterval: z.number().min(1000).default(30000), // 30 seconds
});

type UseEngagementAnalyticsParams = z.infer<typeof UseEngagementAnalyticsParamsSchema>;

// =====================================================
// API RESPONSE INTERFACES
// =====================================================

interface EngagementAnalyticsData {
  metrics: EngagementMetricsFramework | null;
  patterns: EngagementPattern[];
  insights: AIEngagementInsight[];
  benchmarks: {
    industry_average: number;
    personal_best: number;
    content_type_average: number;
    competitor_average?: number;
  };
  predictions: PerformancePrediction[];
  forecasts: AudienceGrowthForecast | null;
  optimizations: OptimizationSuggestion[];
  metadata: {
    processing_time_ms: number;
    cache_hit: boolean;
    model_versions: Record<string, string>;
    last_updated: string;
  };
}

// =====================================================
// QUERY KEYS
// =====================================================

const engagementAnalyticsKeys = {
  all: ['engagement-analytics'] as const,
  metrics: (params: UseEngagementAnalyticsParams) =>
    [...engagementAnalyticsKeys.all, 'metrics', params] as const,
  patterns: (params: UseEngagementAnalyticsParams) =>
    [...engagementAnalyticsKeys.all, 'patterns', params] as const,
  insights: (params: UseEngagementAnalyticsParams) =>
    [...engagementAnalyticsKeys.all, 'insights', params] as const,
};

// =====================================================
// API FUNCTIONS
// =====================================================

const fetchEngagementMetrics = async (
  params: UseEngagementAnalyticsParams
): Promise<EngagementMetricsFramework | null> => {
  const searchParams = new URLSearchParams({
    timeframe: params.timeframe,
    from: params.dateRange.from.toISOString(),
    to: params.dateRange.to.toISOString(),
    ...(params.contentId && { content_id: params.contentId }),
  });

  const response = await fetch(`/api/engagement-analytics/metrics?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch engagement metrics: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success ? data.data : null;
};

const fetchEngagementPatterns = async (
  params: UseEngagementAnalyticsParams
): Promise<EngagementPattern[]> => {
  const searchParams = new URLSearchParams({
    timeframe: params.timeframe,
    from: params.dateRange.from.toISOString(),
    to: params.dateRange.to.toISOString(),
    ...(params.contentId && { content_id: params.contentId }),
  });

  const response = await fetch(`/api/engagement-analytics/patterns?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch engagement patterns: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success ? data.data : [];
};

const fetchAIInsights = async (
  params: UseEngagementAnalyticsParams
): Promise<AIEngagementInsight[]> => {
  const searchParams = new URLSearchParams({
    timeframe: params.timeframe,
    from: params.dateRange.from.toISOString(),
    to: params.dateRange.to.toISOString(),
    ...(params.contentId && { content_id: params.contentId }),
  });

  const response = await fetch(`/api/engagement-analytics/insights?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AI insights: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success ? data.data : [];
};

const fetchBenchmarks = async (
  params: UseEngagementAnalyticsParams
): Promise<EngagementAnalyticsData['benchmarks']> => {
  const searchParams = new URLSearchParams({
    timeframe: params.timeframe,
    ...(params.contentId && { content_id: params.contentId }),
  });

  const response = await fetch(`/api/engagement-analytics/benchmarks?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch benchmarks: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success
    ? data.data
    : {
        industry_average: 0,
        personal_best: 0,
        content_type_average: 0,
      };
};

// =====================================================
// MAIN HOOK
// =====================================================

export const useEngagementAnalytics = (params: UseEngagementAnalyticsParams) => {
  const queryClient = useQueryClient();

  // Validate parameters
  const validatedParams = useMemo(() => {
    return UseEngagementAnalyticsParamsSchema.parse(params);
  }, [params]);

  // Fetch metrics
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: engagementAnalyticsKeys.metrics(validatedParams),
    queryFn: () => fetchEngagementMetrics(validatedParams),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: validatedParams.enableRealTime ? validatedParams.refreshInterval : false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch patterns
  const {
    data: patterns = [],
    isLoading: isPatternsLoading,
    error: patternsError,
    refetch: refetchPatterns,
  } = useQuery({
    queryKey: engagementAnalyticsKeys.patterns(validatedParams),
    queryFn: () => fetchEngagementPatterns(validatedParams),
    staleTime: 5 * 60 * 1000,
    refetchInterval: validatedParams.enableRealTime ? validatedParams.refreshInterval : false,
    retry: 3,
  });

  // Fetch insights
  const {
    data: insights = [],
    isLoading: isInsightsLoading,
    error: insightsError,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: engagementAnalyticsKeys.insights(validatedParams),
    queryFn: () => fetchAIInsights(validatedParams),
    staleTime: 10 * 60 * 1000, // 10 minutes (AI insights change less frequently)
    refetchInterval: validatedParams.enableRealTime ? validatedParams.refreshInterval * 2 : false,
    retry: 3,
  });

  // Fetch benchmarks
  const {
    data: benchmarks = {
      industry_average: 0,
      personal_best: 0,
      content_type_average: 0,
    },
    isLoading: isBenchmarksLoading,
    error: benchmarksError,
    refetch: refetchBenchmarks,
  } = useQuery({
    queryKey: [
      ...engagementAnalyticsKeys.all,
      'benchmarks',
      validatedParams.timeframe,
      validatedParams.contentId,
    ],
    queryFn: () => fetchBenchmarks(validatedParams),
    staleTime: 30 * 60 * 1000, // 30 minutes (benchmarks change infrequently)
    retry: 3,
  });

  // Aggregate loading state
  const isLoading =
    isMetricsLoading || isPatternsLoading || isInsightsLoading || isBenchmarksLoading;

  // Aggregate error state
  const error = metricsError || patternsError || insightsError || benchmarksError;

  // Refetch all data
  const refetch = useCallback(async () => {
    await Promise.all([
      refetchMetrics(),
      refetchPatterns(),
      refetchInsights(),
      refetchBenchmarks(),
    ]);
  }, [refetchMetrics, refetchPatterns, refetchInsights, refetchBenchmarks]);

  // Invalidate queries (useful for real-time updates)
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: engagementAnalyticsKeys.all });
  }, [queryClient]);

  // Prefetch next timeframe data
  const prefetchNextTimeframe = useCallback(() => {
    const nextParams = { ...validatedParams };
    // Logic to calculate next timeframe would go here
    queryClient.prefetchQuery({
      queryKey: engagementAnalyticsKeys.metrics(nextParams),
      queryFn: () => fetchEngagementMetrics(nextParams),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, validatedParams]);

  // Return hook data and functions
  return {
    // Data
    metrics,
    patterns,
    insights,
    benchmarks,

    // Loading states
    isLoading,
    isMetricsLoading,
    isPatternsLoading,
    isInsightsLoading,
    isBenchmarksLoading,

    // Error states
    error,
    metricsError,
    patternsError,
    insightsError,
    benchmarksError,

    // Actions
    refetch,
    invalidate,
    prefetchNextTimeframe,

    // Metadata
    lastUpdated: metrics?.generated_at ? new Date(metrics.generated_at) : null,
    cacheStatus: {
      metrics: !!metrics,
      patterns: patterns.length > 0,
      insights: insights.length > 0,
      benchmarks: !!benchmarks,
    },
  };
};

export default useEngagementAnalytics;
