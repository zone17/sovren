/**
 * 🧪 **ENGAGEMENT ANALYTICS INTEGRATION TESTS - ELITE ENGINEERING**
 *
 * Implementation of US-176.2: Integration Tests for Complete Analytics System
 *
 * Test Coverage:
 * - Full dashboard component integration
 * - API endpoint integration and data flow
 * - Real-time data updates and caching
 * - Cross-component communication
 * - Error boundary and fallback handling
 * - Performance under realistic load
 */

import { EngagementAnalyticsDashboard } from '@/components/analytics/EngagementAnalyticsDashboard';
import { GrowthForecastingChart } from '@/components/analytics/GrowthForecastingChart';
import { OptimizationSuggestionPanel } from '@/components/analytics/OptimizationSuggestionPanel';
import { PerformancePredictionViewer } from '@/components/analytics/PerformancePredictionViewer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// =====================================================
// MOCK SERVER SETUP
// =====================================================

const mockApiResponses = {
  metrics: {
    success: true,
    data: {
      generated_at: '2024-01-15T10:30:00Z',
      total_engagement: 15420,
      engagement_rate: 0.084,
      reach: 183450,
      impressions: 247830,
      likes_count: 8920,
      comments_count: 1840,
      shares_count: 650,
      saves_count: 420,
      performance_score: 87.5,
      trend_direction: 'increasing',
      trend_percentage: 12.4,
    },
  },
  patterns: {
    success: true,
    data: [
      {
        pattern_id: '1',
        pattern_type: 'peak_engagement_time',
        description: 'Peak engagement occurs between 2:00-4:00 PM EST',
        confidence: 0.89,
        frequency: 'daily',
        impact_score: 8.7,
        recommendations: ['Schedule content during peak hours'],
      },
      {
        pattern_id: '2',
        pattern_type: 'content_length_optimization',
        description: 'Videos between 60-90 seconds perform 45% better',
        confidence: 0.82,
        frequency: 'consistent',
        impact_score: 7.3,
        recommendations: ['Optimize video length to 60-90 seconds'],
      },
    ],
  },
  insights: {
    success: true,
    data: [
      {
        insight_id: '1',
        insight_type: 'audience_behavior',
        title: 'Mobile-First Audience Engagement',
        description: '78% of your audience engages primarily on mobile devices',
        confidence_score: 0.94,
        impact_level: 'high',
        actionable_recommendation: 'Optimize content for mobile viewing',
        supporting_metrics: {
          mobile_engagement_rate: 0.092,
          desktop_engagement_rate: 0.051,
        },
      },
    ],
  },
  predictions: {
    success: true,
    data: [
      {
        prediction_id: '1',
        content_id: 'content-1',
        prediction_type: 'engagement_forecast',
        predicted_metrics: {
          total_engagement: 18500,
          engagement_rate: 0.095,
          reach: 195000,
        },
        confidence_intervals: {
          total_engagement: { min: 16200, max: 20800 },
          engagement_rate: { min: 0.088, max: 0.103 },
        },
        timeframe: '7_days',
        model_version: 'engagement_v2.1.0',
      },
    ],
  },
  forecasts: {
    success: true,
    data: {
      forecast_id: '1',
      creator_id: 'creator-1',
      forecast_type: 'follower_growth',
      scenarios: {
        conservative: { growth_rate: 0.05, projected_followers: 105000 },
        realistic: { growth_rate: 0.12, projected_followers: 112000 },
        optimistic: { growth_rate: 0.25, projected_followers: 125000 },
      },
      confidence_level: 0.83,
      timeframe: '30_days',
    },
  },
  optimizations: {
    success: true,
    data: [
      {
        suggestion_id: '1',
        content_id: 'content-1',
        category: 'content_structure',
        title: 'Add Hook in First 15 Seconds',
        description: 'Videos with strong hooks see 34% higher retention.',
        current_value: '68% retention rate',
        suggested_value: '91% retention rate',
        impact_prediction: {
          engagement_lift: 33.8,
          confidence: 0.92,
          timeframe: '7 days',
        },
        priority: 'high',
        effort_required: 'medium',
        implementation_guide: ['Analyze first 15 seconds', 'Create compelling hooks'],
        a_b_test_recommended: true,
        supporting_data: {},
        generated_at: '2024-01-15T10:30:00Z',
      },
    ],
  },
};

const server = setupServer(
  rest.get('/api/engagement-analytics/metrics', (req, res, ctx) => {
    return res(ctx.json(mockApiResponses.metrics));
  }),
  rest.get('/api/engagement-analytics/patterns', (req, res, ctx) => {
    return res(ctx.json(mockApiResponses.patterns));
  }),
  rest.get('/api/engagement-analytics/insights', (req, res, ctx) => {
    return res(ctx.json(mockApiResponses.insights));
  }),
  rest.get('/api/engagement-analytics/predictions', (req, res, ctx) => {
    return res(ctx.json(mockApiResponses.predictions));
  }),
  rest.get('/api/engagement-analytics/forecasts', (req, res, ctx) => {
    return res(ctx.json(mockApiResponses.forecasts));
  }),
  rest.get('/api/engagement-analytics/optimizations', (req, res, ctx) => {
    return res(ctx.json(mockApiResponses.optimizations));
  }),
  rest.get('/api/engagement-analytics/benchmarks', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          industry_average: 0.067,
          personal_best: 0.095,
          content_type_average: 0.074,
        },
      })
    );
  })
);

// =====================================================
// TEST UTILITIES
// =====================================================

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        cacheTime: 0,
      },
    },
  });
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

// =====================================================
// TEST SETUP
// =====================================================

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// =====================================================
// INTEGRATION TEST SUITE
// =====================================================

describe('Engagement Analytics Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  // =====================================================
  // FULL DASHBOARD INTEGRATION
  // =====================================================

  describe('Complete Dashboard Integration', () => {
    it('loads and displays full dashboard with all components', async () => {
      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Wait for all components to load
      await waitFor(
        () => {
          expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Verify all main sections are present
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      expect(screen.getByText('AI Insights')).toBeInTheDocument();
      expect(screen.getByText('Predictions')).toBeInTheDocument();
      expect(screen.getByText('Optimization Suggestions')).toBeInTheDocument();
    });

    it('handles cross-component communication correctly', async () => {
      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });

      // Test date range change propagation
      const dateRangePicker = screen.getByTestId('date-range-picker');
      await user.click(dateRangePicker);

      // Verify all components refresh with new data
      await waitFor(() => {
        // All API endpoints should be called again
        expect(fetch).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/engagement-analytics\/metrics/)
        );
      });
    });

    it('maintains state consistency across components', async () => {
      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument(); // Performance score
      });

      // Verify data consistency between components
      const metricsSection = screen.getByTestId('engagement-metrics');
      const predictionsSection = screen.getByTestId('performance-predictions');

      // Both should show related data
      expect(within(metricsSection).getByText('15,420')).toBeInTheDocument(); // Total engagement
      expect(within(predictionsSection).getByText('18,500')).toBeInTheDocument(); // Predicted engagement
    });
  });

  // =====================================================
  // API INTEGRATION TESTS
  // =====================================================

  describe('API Integration', () => {
    it('handles successful API responses correctly', async () => {
      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Wait for all API calls to complete
      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument();
        expect(screen.getByText('15,420')).toBeInTheDocument();
        expect(screen.getByText('+12.4%')).toBeInTheDocument();
      });

      // Verify all data is displayed correctly
      expect(screen.getByText('8.4%')).toBeInTheDocument(); // Engagement rate
      expect(screen.getByText('183,450')).toBeInTheDocument(); // Reach
    });

    it('handles API errors gracefully', async () => {
      // Mock API error
      server.use(
        rest.get('/api/engagement-analytics/metrics', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Internal Server Error' }));
        })
      );

      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/Error loading/)).toBeInTheDocument();
      });

      // Other components should still work
      expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
    });

    it('implements proper caching and stale-while-revalidate', async () => {
      const { rerender } = renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument();
      });

      // Track API calls
      const initialCallCount = vi.mocked(fetch).mock.calls.length;

      // Rerender with same props
      rerender(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Should use cached data (no additional API calls)
      expect(vi.mocked(fetch).mock.calls.length).toBe(initialCallCount);
      expect(screen.getByText('87.5')).toBeInTheDocument();
    });
  });

  // =====================================================
  // REAL-TIME UPDATES TESTS
  // =====================================================

  describe('Real-Time Updates', () => {
    it('refreshes data at specified intervals', async () => {
      vi.useFakeTimers();

      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          enableRealTime={true}
          refreshInterval={30000}
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument();
      });

      const initialCallCount = vi.mocked(fetch).mock.calls.length;

      // Fast-forward time
      vi.advanceTimersByTime(30000);

      // Should trigger refresh
      await waitFor(() => {
        expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      vi.useRealTimers();
    });

    it('handles WebSocket updates for real-time data', async () => {
      // Mock WebSocket for real-time updates
      const mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);

      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          enableRealTime={true}
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument();
      });

      // Simulate WebSocket message
      const mockMessage = {
        type: 'engagement_update',
        data: {
          total_engagement: 16000,
          performance_score: 89.2,
        },
      };

      // Trigger WebSocket message handler
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        messageHandler({ data: JSON.stringify(mockMessage) });
      }

      // Should update with new data
      await waitFor(() => {
        expect(screen.getByText('89.2')).toBeInTheDocument();
        expect(screen.getByText('16,000')).toBeInTheDocument();
      });
    });
  });

  // =====================================================
  // PERFORMANCE TESTS
  // =====================================================

  describe('Performance Integration', () => {
    it('renders large datasets efficiently', async () => {
      // Mock large dataset
      const largeDataset = {
        ...mockApiResponses.patterns,
        data: Array.from({ length: 1000 }, (_, i) => ({
          pattern_id: `pattern-${i}`,
          pattern_type: 'engagement_pattern',
          description: `Pattern ${i}`,
          confidence: 0.8 + (i % 20) / 100,
          frequency: 'daily',
          impact_score: 5 + (i % 5),
          recommendations: [`Recommendation ${i}`],
        })),
      };

      server.use(
        rest.get('/api/engagement-analytics/patterns', (req, res, ctx) => {
          return res(ctx.json(largeDataset));
        })
      );

      const startTime = performance.now();

      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });

      const endTime = performance.now();

      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('handles concurrent API requests efficiently', async () => {
      const promises = Array.from({ length: 10 }, () =>
        renderWithProviders(
          <EngagementAnalyticsDashboard
            creatorId="creator-1"
            dateRange={{
              from: new Date('2024-01-01'),
              to: new Date('2024-01-15'),
            }}
          />
        )
      );

      // All should complete without issues
      await Promise.all(
        promises.map(() =>
          waitFor(() => {
            expect(screen.getAllByText('Engagement Analytics')).toHaveLength(10);
          })
        )
      );
    });
  });

  // =====================================================
  // ERROR BOUNDARY TESTS
  // =====================================================

  describe('Error Boundaries', () => {
    it('isolates component errors without breaking entire dashboard', async () => {
      // Mock component error
      const ConsoleError = console.error;
      console.error = vi.fn();

      // Force an error in one component
      server.use(
        rest.get('/api/engagement-analytics/predictions', (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );

      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Main dashboard should still work
      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });

      // Metrics should still load
      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument();
      });

      // Predictions component should show error
      expect(screen.getByText(/Error loading predictions/)).toBeInTheDocument();

      console.error = ConsoleError;
    });

    it('provides fallback UI for failed components', async () => {
      server.use(
        rest.get('/api/engagement-analytics/optimizations', (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );

      renderWithProviders(<OptimizationSuggestionPanel contentId="content-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load suggestions/)).toBeInTheDocument();
        expect(screen.getByText(/Try again later/)).toBeInTheDocument();
      });
    });
  });

  // =====================================================
  // ACCESSIBILITY INTEGRATION
  // =====================================================

  describe('Accessibility Integration', () => {
    it('maintains proper focus management across components', async () => {
      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });

      // Tab through components
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role');

      await user.tab();
      expect(document.activeElement).toBeVisible();
    });

    it('announces dynamic content changes to screen readers', async () => {
      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      // Wait for load
      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument();
      });

      // Check for aria-live regions
      const liveRegions = screen.getAllByRole('status');
      expect(liveRegions.length).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // DATA FLOW VALIDATION
  // =====================================================

  describe('Data Flow Validation', () => {
    it('validates data transformation pipeline', async () => {
      renderWithProviders(
        <EngagementAnalyticsDashboard
          creatorId="creator-1"
          dateRange={{
            from: new Date('2024-01-01'),
            to: new Date('2024-01-15'),
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument();
      });

      // Verify data transformations
      expect(screen.getByText('15,420')).toBeInTheDocument(); // Formatted number
      expect(screen.getByText('8.4%')).toBeInTheDocument(); // Percentage
      expect(screen.getByText('+12.4%')).toBeInTheDocument(); // Trend
    });

    it('ensures data consistency between related components', async () => {
      renderWithProviders(
        <div>
          <PerformancePredictionViewer contentId="content-1" />
          <GrowthForecastingChart creatorId="creator-1" />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('Performance Predictions')).toBeInTheDocument();
        expect(screen.getByText('Growth Forecast')).toBeInTheDocument();
      });

      // Both components should show consistent timeframes
      const predictionElements = screen.getAllByText(/7 days/);
      expect(predictionElements.length).toBeGreaterThan(0);
    });
  });
});
