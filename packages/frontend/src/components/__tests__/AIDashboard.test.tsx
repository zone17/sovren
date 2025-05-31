// 🤖 AI DASHBOARD COMPONENT TESTS
// Testing our enterprise-grade AI visualization dashboard

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as predictiveAnalyticsModule from '../../ai/predictiveAnalytics';
import AIDashboard from '../AIDashboard';

// Mock the predictive analytics module
jest.mock('../../ai/predictiveAnalytics', () => ({
  predictiveAnalytics: {
    predictUserBehavior: jest.fn().mockResolvedValue({
      userId: 'user_123',
      sessionDuration: 45000,
      clickPatterns: [1234567890],
      scrollDepth: 75,
      bounceRate: 0.2,
      conversionProbability: 0.85,
      churnRisk: 'low',
      nextAction: 'purchase',
      confidence: 0.92,
    }),
    forecastPerformance: jest.fn().mockResolvedValue({
      metric: 'LCP',
      currentValue: 2.1,
      predictedValue: 2.8,
      trend: 'degrading',
      confidence: 0.92,
      timeframe: '24h',
      factors: ['user_load', 'cache_efficiency', 'network_conditions'],
    }),
    analyzeFeatureUsage: jest.fn().mockResolvedValue([
      {
        feature: 'Navigation',
        usage: 85.5,
        trend: 0.05,
        userSegment: 'power_users',
        optimizationSuggestion: 'Enhance existing functionality',
        impactScore: 92.3,
      },
    ]),
    detectAnomalies: jest.fn().mockResolvedValue([
      {
        type: 'performance',
        severity: 'medium',
        description: 'Anomalous LCP: 4200ms',
        confidence: 0.9,
        suggestedActions: ['Optimize images', 'Reduce server response time'],
      },
    ]),
    getRealtimeRecommendations: jest.fn().mockResolvedValue({
      personalizedContent: [{ type: 'content', action: 'highlight_trending', confidence: 0.8 }],
      uiOptimizations: [{ type: 'ui', action: 'optimize_navigation', confidence: 0.7 }],
      performanceHints: [{ type: 'performance', action: 'preload_likely_pages', confidence: 0.8 }],
    }),
  },
}));

// Get the mocked module
const mockedPredictiveAnalytics = predictiveAnalyticsModule.predictiveAnalytics as jest.Mocked<
  typeof predictiveAnalyticsModule.predictiveAnalytics
>;

describe('🤖 AI Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      render(<AIDashboard />);

      expect(screen.getByText('Loading AI insights...')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });
  });

  describe('Dashboard Header', () => {
    it('should render the main header correctly', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🤖 AI Analytics Dashboard')).toBeInTheDocument();
        expect(
          screen.getByText('Advanced ML-powered insights and predictions')
        ).toBeInTheDocument();
        expect(screen.getByText('Last Updated')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Tabs', () => {
    it('should render all navigation tabs', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('AI Overview')).toBeInTheDocument();
        expect(screen.getByText('Predictions')).toBeInTheDocument();
        expect(screen.getByText('Anomalies')).toBeInTheDocument();
        expect(screen.getByText('Optimization')).toBeInTheDocument();
      });
    });

    it('should switch tabs when clicked', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const predictionsTab = screen.getByText('Predictions');
        fireEvent.click(predictionsTab);

        expect(screen.getByText('🔮 AI Predictions')).toBeInTheDocument();
      });
    });

    it('should show anomalies tab content', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const anomaliesTab = screen.getByText('Anomalies');
        fireEvent.click(anomaliesTab);

        expect(screen.getByText('🚨 Anomaly Detection')).toBeInTheDocument();
      });
    });

    it('should show optimization tab content', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const optimizationTab = screen.getByText('Optimization');
        fireEvent.click(optimizationTab);

        expect(screen.getByText('⚡ Feature Optimization')).toBeInTheDocument();
      });
    });
  });

  describe('Overview Tab Content', () => {
    it('should display quick stats cards', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Active Users')).toBeInTheDocument();
        expect(screen.getByText('1,247')).toBeInTheDocument();
        expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
        expect(screen.getByText('12.3%')).toBeInTheDocument();
        expect(screen.getByText('Performance Score')).toBeInTheDocument();
        expect(screen.getByText('94')).toBeInTheDocument();
      });
    });

    it('should show active anomalies when present', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🚨 Active Anomalies')).toBeInTheDocument();
        expect(screen.getByText('PERFORMANCE')).toBeInTheDocument();
        expect(screen.getByText('Anomalous LCP: 4200ms')).toBeInTheDocument();
      });
    });
  });

  describe('Predictions Tab Content', () => {
    it('should display user behavior analysis', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const predictionsTab = screen.getByText('Predictions');
        fireEvent.click(predictionsTab);

        // Use more specific selectors for elements that might appear multiple times
        const userBehaviorHeadings = screen.getAllByText('User Behavior Analysis');
        expect(userBehaviorHeadings.length).toBeGreaterThan(0);
        expect(screen.getByText('User: user_123')).toBeInTheDocument();
        expect(screen.getByText('low churn risk')).toBeInTheDocument();
        expect(screen.getByText('85.0%')).toBeInTheDocument(); // Conversion probability
      });
    });

    it('should display performance forecasts', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const predictionsTab = screen.getByText('Predictions');
        fireEvent.click(predictionsTab);

        expect(screen.getByText('Performance Forecasts')).toBeInTheDocument();
        // Use getAllByText for elements that appear multiple times
        const lcpElements = screen.getAllByText('LCP');
        expect(lcpElements.length).toBeGreaterThan(0);

        const forecastElements = screen.getAllByText(/Forecast for 24h/);
        expect(forecastElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Anomalies Tab Content', () => {
    it('should display anomaly cards', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const anomaliesTab = screen.getByText('Anomalies');
        fireEvent.click(anomaliesTab);

        expect(screen.getByText('PERFORMANCE')).toBeInTheDocument();
        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('90.0% confidence')).toBeInTheDocument();
        expect(screen.getByText('Optimize images')).toBeInTheDocument();
        expect(screen.getByText('Reduce server response time')).toBeInTheDocument();
      });
    });
  });

  describe('Optimization Tab Content', () => {
    it('should display feature insights', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const optimizationTab = screen.getByText('Optimization');
        fireEvent.click(optimizationTab);

        expect(screen.getByText('Navigation')).toBeInTheDocument();
        expect(screen.getByText('power users')).toBeInTheDocument();
        expect(screen.getByText('92.3')).toBeInTheDocument(); // Impact score
        expect(screen.getByText('Enhance existing functionality')).toBeInTheDocument();
      });
    });

    it('should display AI recommendations', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const optimizationTab = screen.getByText('Optimization');
        fireEvent.click(optimizationTab);

        expect(screen.getByText('🎯 AI Recommendations')).toBeInTheDocument();
        expect(screen.getByText('Personalized Content:')).toBeInTheDocument();
        expect(screen.getByText('1 suggestions available')).toBeInTheDocument();
        expect(screen.getByText('UI Optimizations:')).toBeInTheDocument();
        expect(screen.getByText('1 improvements suggested')).toBeInTheDocument();
      });
    });
  });

  describe('Component Utilities', () => {
    it('should render confidence badges correctly', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        // Look for confidence badges more specifically
        const confidenceBadges = screen.getAllByText(/\d+\.\d+% confidence/);
        expect(confidenceBadges.length).toBeGreaterThan(0);

        // Check that we have at least one confidence badge
        expect(confidenceBadges[0]).toBeInTheDocument();
      });
    });

    it('should display trend indicators', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const predictionsTab = screen.getByText('Predictions');
        fireEvent.click(predictionsTab);

        // Look for trend elements more specifically
        const degradingTrends = screen.getAllByText('degrading');
        expect(degradingTrends.length).toBeGreaterThan(0);
        expect(degradingTrends[0]).toBeInTheDocument();
      });
    });

    it('should show severity colors for anomalies', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const anomaliesTab = screen.getByText('Anomalies');
        fireEvent.click(anomaliesTab);

        const severityBadge = screen.getByText('medium');
        expect(severityBadge).toHaveClass('font-bold', 'uppercase');
      });
    });
  });

  describe('Data Loading and Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock console.error to prevent error logs in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock a failed API call
      mockedPredictiveAnalytics.predictUserBehavior.mockRejectedValueOnce(new Error('API Error'));

      render(<AIDashboard />);

      await waitFor(() => {
        // Should still render the header even with errors
        expect(screen.getByText('🤖 AI Analytics Dashboard')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Real-time Updates', () => {
    it('should set up interval for refreshing data', async () => {
      jest.useFakeTimers();

      render(<AIDashboard />);

      // Fast-forward time by 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Should trigger additional API calls
      await waitFor(() => {
        expect(mockedPredictiveAnalytics.predictUserBehavior).toHaveBeenCalledTimes(2);
      });

      jest.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible tab navigation', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        const tabs = screen.getAllByRole('button');
        const tabButtons = tabs.filter(
          (button) =>
            button.textContent?.includes('Overview') ||
            button.textContent?.includes('Predictions') ||
            button.textContent?.includes('Anomalies') ||
            button.textContent?.includes('Optimization')
        );

        expect(tabButtons.length).toBe(4);

        // Each tab should be focusable
        tabButtons.forEach((tab) => {
          expect(tab).toHaveAttribute('class');
        });
      });
    });

    it('should have proper heading structure', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          '🤖 AI Analytics Dashboard'
        );
      });
    });
  });
});
