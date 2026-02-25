/**
 * ENGAGEMENT ANALYTICS DASHBOARD TESTS
 *
 * Test Coverage:
 * - React Query integration validation
 * - UI component rendering and functionality
 * - Analytics data fetching and display
 * - Error handling and loading states
 * - User interactions and accessibility
 */

// Vitest provides describe/it/expect/beforeEach/afterEach/vi globally — no need to declare them

import { fireEvent, screen, waitFor } from '@testing-library/react';

import {
  createMockAIInsights,
  createMockBenchmarks,
  createMockEngagementMetrics,
  createMockEngagementPatterns,
  createMockResponse,
  renderWithQueryClient,
} from '../../../test-utils/react-query-test-utils';
import { EngagementAnalyticsDashboard } from '../EngagementAnalyticsDashboard';

// Mock Recharts — jsdom does not support SVG layout so Recharts crashes with
// "Cannot read properties of undefined (reading 'fontSize')".
// Replace chart primitives with lightweight stubs that render their children.
vi.mock('recharts', async () => {
  const React = await import('react');
  const Stub = ({ children, ...props }: any) =>
    React.createElement('div', { 'data-testid': 'recharts-stub', ...props }, children);
  const StubNoChildren = (_props: any) =>
    React.createElement('div', { 'data-testid': 'recharts-element' });
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub,
    AreaChart: Stub,
    BarChart: Stub,
    PieChart: Stub,
    RadarChart: Stub,
    Line: StubNoChildren,
    Area: StubNoChildren,
    Bar: StubNoChildren,
    Pie: StubNoChildren,
    Radar: StubNoChildren,
    Cell: StubNoChildren,
    XAxis: StubNoChildren,
    YAxis: StubNoChildren,
    CartesianGrid: StubNoChildren,
    Tooltip: StubNoChildren,
    Legend: StubNoChildren,
    PolarGrid: StubNoChildren,
    PolarAngleAxis: StubNoChildren,
    PolarRadiusAxis: StubNoChildren,
    ReferenceLine: StubNoChildren,
  };
});

// Mock the useToast hook
vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the useEngagementAnalytics hook
const mockUseEngagementAnalytics = vi.fn();
vi.mock('../../../hooks/useEngagementAnalytics', () => ({
  useEngagementAnalytics: () => mockUseEngagementAnalytics(),
}));

describe('EngagementAnalyticsDashboard', () => {
  const mockMetrics = createMockEngagementMetrics();
  const mockPatterns = createMockEngagementPatterns();
  const mockInsights = createMockAIInsights();
  const mockBenchmarks = createMockBenchmarks();

  beforeEach(() => {
    // Re-install getComputedStyle mock after vi.clearAllMocks() clears its implementation.
    // The global setup in vitest-frontend-setup.ts installs this via vi.fn(), but
    // vi.clearAllMocks() resets all mock implementations — including getComputedStyle.
    // Without re-installing, RTL's queryAllByRole crashes with
    // "Cannot read properties of undefined (reading 'visibility')".
    globalThis.getComputedStyle = vi.fn().mockImplementation((_el: Element) => {
      const style: Record<string, string> = {};
      return new Proxy(style, {
        get(_target, prop) {
          if (prop === 'getPropertyValue') return vi.fn().mockReturnValue('');
          if (prop === 'setProperty') return vi.fn();
          if (prop === 'removeProperty') return vi.fn();
          if (prop === 'length') return 0;
          if (typeof prop === 'string') return '';
          return undefined;
        },
      });
    }) as any;

    // Setup fetch mock for API calls
    global.fetch = vi.fn().mockImplementation((url: string) => {
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
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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
        // Metric card titles may appear in both headings and tooltips; use getAllByText
        expect(screen.getAllByText('Engagement Score').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Total Views').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Quality Score').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Viral Coefficient').length).toBeGreaterThan(0);

        // Check metric values
        expect(screen.getAllByText('85.5').length).toBeGreaterThan(0); // engagement_score
        expect(screen.getAllByText('15,420').length).toBeGreaterThan(0); // views
        expect(screen.getAllByText('78.2').length).toBeGreaterThan(0); // quality_score
        expect(screen.getAllByText('1.25').length).toBeGreaterThan(0); // viral_coefficient
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
        refetch: vi.fn(),
      });

      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // When loading, the content tabs are not rendered (the LoadingSpinner div is shown instead)
      // LoadingSpinner renders a div with animate-spin class — no role="status"
      await waitFor(() => {
        // The header and title are always rendered
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });
      // Tabs are hidden during loading
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
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
        refetch: vi.fn(),
      });

      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Analytics')).toBeInTheDocument();
        expect(screen.getByText('Unable to load engagement analytics data.')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should call refetch when refresh button is clicked', async () => {
      const mockRefetch = vi.fn();
      mockUseEngagementAnalytics.mockReturnValue({
        metrics: mockMetrics,
        patterns: mockPatterns,
        insights: mockInsights,
        benchmarks: mockBenchmarks,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const refreshText = screen.getByText('Refresh');
        expect(refreshText).toBeInTheDocument();
      });

      // Use fireEvent.click via the button element — avoids userEvent getComputedStyle issue
      const refreshText = screen.getByText('Refresh');
      const refreshButton = refreshText.closest('button') ?? refreshText;
      fireEvent.click(refreshButton as HTMLElement);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Interactions', () => {
    it('should handle filter changes correctly', async () => {
      const { container } = renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // Verify filter section renders with Timeframe label
      await waitFor(() => {
        expect(screen.getByText('Timeframe')).toBeInTheDocument();
      });

      // Use querySelectorAll to find combobox triggers — avoids RTL's queryAllByRole
      // which calls getComputedStyle internally and can crash in jsdom after vi.clearAllMocks()
      const selectTriggers = container.querySelectorAll('[role="combobox"]');
      expect(selectTriggers.length).toBeGreaterThan(0);

      // Open the first select (Timeframe) using fireEvent
      fireEvent.click(selectTriggers[0]);

      await waitFor(() => {
        const dayOption = screen.getByText('Last Day');
        expect(dayOption).toBeInTheDocument();
      });
    });

    it('should handle tab navigation correctly', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const patternsTab = screen.getByText('Patterns');
        expect(patternsTab).toBeInTheDocument();
      });

      // Radix Tabs Trigger requires mousedown + click to switch tabs in jsdom
      const patternsTab = screen.getByText('Patterns');
      const triggerBtn = patternsTab.closest('button') ?? patternsTab;
      fireEvent.mouseDown(triggerBtn as HTMLElement);
      fireEvent.click(triggerBtn as HTMLElement);

      await waitFor(() => {
        // After tab switch, patterns tab content should be rendered
        expect(screen.getByText('Daily Engagement Peak')).toBeInTheDocument();
        expect(screen.getByText('Peak engagement occurs between 7-9 PM')).toBeInTheDocument();
      });
    });

    it('should handle AI insights interaction', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // Navigate to AI Insights tab — use fireEvent to avoid Radix getComputedStyle issue
      await waitFor(() => {
        const insightsTab = screen.getByText('AI Insights');
        expect(insightsTab).toBeInTheDocument();
      });

      const insightsTab = screen.getByText('AI Insights');
      const insightsTriggerBtn = insightsTab.closest('button') ?? insightsTab;
      fireEvent.mouseDown(insightsTriggerBtn as HTMLElement);
      fireEvent.click(insightsTriggerBtn as HTMLElement);

      await waitFor(() => {
        // After tab switch, AI insights content should be rendered
        expect(screen.getByText('Optimal Posting Time Detected')).toBeInTheDocument();
        expect(
          screen.getByText('Your content performs 40% better when posted between 7-9 PM')
        ).toBeInTheDocument();
      });

      // Click on insight card title to expand recommendations
      const insightTitle = screen.getByText('Optimal Posting Time Detected');
      fireEvent.click(insightTitle);

      await waitFor(() => {
        // Should show recommendations after click (selectedInsight state updates)
        const recs = screen.queryAllByText('Recommendations:', { hidden: true });
        expect(recs.length).toBeGreaterThan(0);
      });
    });

    it('should handle export functionality', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const exportCsvButton = screen.getByText('Export CSV');
        expect(exportCsvButton).toBeInTheDocument();
      });

      // Use fireEvent.click — avoids userEvent getComputedStyle issue with shadcn buttons
      const exportCsvButton = screen.getByText('Export CSV');
      const exportButton = exportCsvButton.closest('button')!;
      fireEvent.click(exportButton);

      // Button becomes disabled during the 2s export simulation (setIsExporting(true) is sync)
      await waitFor(() => {
        expect(exportButton).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      const { container } = renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        // Use querySelectorAll to avoid RTL's role queries calling getComputedStyle
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThan(0);

        // Check for tab navigation using direct DOM query
        const tablist = container.querySelector('[role="tablist"]');
        expect(tablist).toBeInTheDocument();

        const tabs = container.querySelectorAll('[role="tab"]');
        expect(tabs).toHaveLength(4); // Overview, Patterns, AI Insights, Benchmarks
      });
    });

    it('should be keyboard navigable', async () => {
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        expect(refreshButton).toBeInTheDocument();
      });

      // Test keyboard focus — find the button element containing the 'Refresh' text
      const refreshText = screen.getByText('Refresh');
      const refreshButton = refreshText.closest('button') ?? refreshText;
      (refreshButton as HTMLElement).focus();
      expect(document.activeElement).toBe(refreshButton);
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
      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      // Navigate to Benchmarks tab
      await waitFor(() => {
        const benchmarksTab = screen.getByText('Benchmarks');
        expect(benchmarksTab).toBeInTheDocument();
      });

      const benchmarksTab = screen.getByText('Benchmarks');
      const benchmarksTriggerBtn = benchmarksTab.closest('button') ?? benchmarksTab;
      fireEvent.mouseDown(benchmarksTriggerBtn as HTMLElement);
      fireEvent.click(benchmarksTriggerBtn as HTMLElement);

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
        refetch: vi.fn(),
      });

      renderWithQueryClient(<EngagementAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Engagement Analytics')).toBeInTheDocument();
      });
    });
  });
});
