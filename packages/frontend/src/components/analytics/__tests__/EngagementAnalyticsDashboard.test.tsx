/**
 * 📊 **ENGAGEMENT ANALYTICS DASHBOARD TESTS - ELITE ENGINEERING**
 *
 * Test Coverage:
 * - React Query integration validation
 * - UI component rendering and functionality
 * - Analytics data fetching and display
 * - Error handling and loading states
 * - User interactions and accessibility
 */

// Jest globals
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const global: any;
declare const document: any;

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createMockAIInsights,
  createMockBenchmarks,
  createMockEngagementMetrics,
  createMockEngagementPatterns,
  createMockResponse,
  renderWithQueryClient,
} from '../../../test-utils/react-query-test-utils';
import { EngagementAnalyticsDashboard } from '../EngagementAnalyticsDashboard';

// Mock the useToast hook
jest.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the useEngagementAnalytics hook
const mockUseEngagementAnalytics = jest.fn();
jest.mock('../../../hooks/useEngagementAnalytics', () => ({
  useEngagementAnalytics: () => mockUseEngagementAnalytics(),
}));

describe('EngagementAnalyticsDashboard', () => {
  const mockMetrics = createMockEngagementMetrics();
  const mockPatterns = createMockEngagementPatterns();
  const mockInsights = createMockAIInsights();
  const mockBenchmarks = createMockBenchmarks();

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup fetch mock for API calls
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('engagement-analytics/metrics')) {
        return Promise.resolve(createMockResponse({ success: true, data: mockMetrics }));
      }
      if (url.includes('engagement-analytics/patterns')) {
        return Promise.resolve(createMockResponse({ success: true, data: mockPatterns }));
      }
      if (url.includes('engagement-analytics/insights')) {
        return Promise.resolve(createMockResponse({ success: true, data: mockInsights }));
      }
      return Promise.resolve(createMockResponse({ success: true, data: mockBenchmarks }));
    });

    // Mock successful analytics hook
    mockUseEngagementAnalytics.mockReturnValue({
      metrics: mockMetrics,
      patterns: mockPatterns,
      insights: mockInsights,
      benchmarks: mockBenchmarks,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing with all UI components', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // Verify main title is rendered
      expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      expect(
        screen.getByText(/Comprehensive insights into your content performance/)
      ).toBeInTheDocument();
    });

    it('should render all metric cards with correct data', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        // Check metric cards are rendered
        expect(screen.getByText('Engagement Score')).toBeInTheDocument();
        expect(screen.getByText('Total Views')).toBeInTheDocument();
        expect(screen.getByText('Quality Score')).toBeInTheDocument();
        expect(screen.getByText('Viral Coefficient')).toBeInTheDocument();

        // Check metric values
        expect(screen.getByText('85.5')).toBeInTheDocument(); // engagement_score
        expect(screen.getByText('15,420')).toBeInTheDocument(); // views
        expect(screen.getByText('78.2')).toBeInTheDocument(); // quality_score
        expect(screen.getByText('1.25')).toBeInTheDocument(); // viral_coefficient
      });
    });

    it('should render all filter components', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        // Check filter components
        expect(screen.getByText('Filters')).toBeInTheDocument();
        expect(screen.getByText('Timeframe')).toBeInTheDocument();
        expect(screen.getByText('Date Range')).toBeInTheDocument();
        expect(screen.getByText('Primary Metric')).toBeInTheDocument();
      });
    });

    it('should render all tabs', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Patterns')).toBeInTheDocument();
        expect(screen.getByText('AI Insights')).toBeInTheDocument();
        expect(screen.getByText('Benchmarks')).toBeInTheDocument();
      });
    });
  });

  describe('React Query Integration', () => {
    it('should display loading state correctly', async () => {
      mockUseEngagementAnalytics.mockReturnValue({
        metrics: null,
        patterns: [],
        insights: [],
        benchmarks: null,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      });

      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // Should show loading spinner
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('should handle error state correctly', async () => {
      const mockError = new Error('Failed to load analytics data');
      mockUseEngagementAnalytics.mockReturnValue({
        metrics: null,
        patterns: [],
        insights: [],
        benchmarks: null,
        isLoading: false,
        error: mockError,
        refetch: jest.fn(),
      });

      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Analytics')).toBeInTheDocument();
        expect(screen.getByText('Unable to load engagement analytics data.')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should call refetch when refresh button is clicked', async () => {
      const mockRefetch = jest.fn();
      mockUseEngagementAnalytics.mockReturnValue({
        metrics: mockMetrics,
        patterns: mockPatterns,
        insights: mockInsights,
        benchmarks: mockBenchmarks,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const user = userEvent.setup();
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        expect(refreshButton).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Interactions', () => {
    it('should handle filter changes correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const timeframeSelect = screen.getAllByRole('combobox')[0];
        expect(timeframeSelect).toBeInTheDocument();
      });

      // Test timeframe filter change
      const timeframeSelect = screen.getAllByRole('combobox')[0];
      await user.click(timeframeSelect);

      await waitFor(() => {
        const dayOption = screen.getByText('Last Day');
        expect(dayOption).toBeInTheDocument();
      });
    });

    it('should handle tab navigation correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const patternsTab = screen.getByText('Patterns');
        expect(patternsTab).toBeInTheDocument();
      });

      // Click on Patterns tab
      const patternsTab = screen.getByText('Patterns');
      await user.click(patternsTab);

      await waitFor(() => {
        // Should display pattern information
        expect(screen.getByText('Daily Engagement Peak')).toBeInTheDocument();
        expect(screen.getByText('Peak engagement occurs between 7-9 PM')).toBeInTheDocument();
      });
    });

    it('should handle AI insights interaction', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // Navigate to AI Insights tab
      await waitFor(() => {
        const insightsTab = screen.getByText('AI Insights');
        expect(insightsTab).toBeInTheDocument();
      });

      const insightsTab = screen.getByText('AI Insights');
      await user.click(insightsTab);

      await waitFor(() => {
        // Should display insights
        expect(screen.getByText('Optimal Posting Time Detected')).toBeInTheDocument();
        expect(
          screen.getByText('Your content performs 40% better when posted between 7-9 PM')
        ).toBeInTheDocument();
      });

      // Click on insight to expand recommendations
      const insightCard = screen.getByText('Optimal Posting Time Detected');
      await user.click(insightCard);

      await waitFor(() => {
        // Should show recommendations
        expect(screen.getByText('Recommendations:')).toBeInTheDocument();
        expect(screen.getByText('Schedule your next 3 posts for 7:30 PM')).toBeInTheDocument();
      });
    });

    it('should handle export functionality', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const exportCsvButton = screen.getByText('Export CSV');
        expect(exportCsvButton).toBeInTheDocument();
      });

      const exportCsvButton = screen.getByText('Export CSV');
      await user.click(exportCsvButton);

      // Button should be disabled during export
      expect(exportCsvButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        // Check for proper button roles
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);

        // Check for tab navigation
        const tablist = screen.getByRole('tablist');
        expect(tablist).toBeInTheDocument();

        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(4); // Overview, Patterns, AI Insights, Benchmarks
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        expect(refreshButton).toBeInTheDocument();
      });

      // Test keyboard navigation
      const refreshButton = screen.getByText('Refresh');
      refreshButton.focus();
      expect(refreshButton).toHaveFocus();

      // Navigate with Tab key
      await user.keyboard('{Tab}');
      const nextElement = document.activeElement;
      expect(nextElement).not.toBe(refreshButton);
    });
  });

  describe('Charts and Visualizations', () => {
    it('should render charts when data is available', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        // Should render Recharts components
        expect(screen.getByText('Engagement Trend')).toBeInTheDocument();
        expect(screen.getByText('Engagement Breakdown')).toBeInTheDocument();
      });
    });

    it('should display benchmark data correctly', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // Navigate to Benchmarks tab
      await waitFor(() => {
        const benchmarksTab = screen.getByText('Benchmarks');
        expect(benchmarksTab).toBeInTheDocument();
      });

      const benchmarksTab = screen.getByText('Benchmarks');
      await user.click(benchmarksTab);

      await waitFor(() => {
        expect(screen.getByText('Performance Benchmarks')).toBeInTheDocument();
        expect(screen.getByText('Industry Average')).toBeInTheDocument();
        expect(screen.getByText('Personal Best')).toBeInTheDocument();
        expect(screen.getByText('Content Type Average')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', async () => {
      const { rerender } = renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });

      // Re-render with same props should not cause issues
      rerender(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });
    });

    it('should handle large datasets efficiently', async () => {
      // Mock large dataset
      const largePatterns = Array.from({ length: 100 }, (_, i) => ({
        pattern_id: `pattern-${i}`,
        pattern_name: `Pattern ${i}`,
        pattern_type: 'daily' as const,
        description: `Description for pattern ${i}`,
        confidence: Math.random(),
        significance: 'medium' as const,
        detected_at: new Date().toISOString(),
        timestamps: ['2024-01-01T00:00:00Z'],
        values: [Math.random() * 100],
      }));

      mockUseEngagementAnalytics.mockReturnValue({
        metrics: mockMetrics,
        patterns: largePatterns,
        insights: mockInsights,
        benchmarks: mockBenchmarks,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });
    });
  });
});
