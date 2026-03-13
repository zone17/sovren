/**
 * 🤖 **AI DASHBOARD TEST SUITE - ELITE STANDARDS**
 *
 * **Purpose**: Comprehensive testing of AI analytics dashboard
 * **Architecture**: Behavior-driven development with complete coverage
 * **Standards**: Elite engineering with ZERO test violations
 * **Inspiration**: Google/Netflix/Stripe testing patterns
 *
 * @author Elite Engineering Team
 * @version 3.0.0 - Zero Violations Standard
 * @lastModified 2024-12-28
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as predictiveAnalyticsModule from '../../features/analytics/services/predictiveAnalytics';
import AIDashboard from '../../features/dashboard/components/AIDashboard';

// Mock useAuth — AIDashboard uses authenticated user ID
vi.mock('../../features/auth', () => ({
  useAuth: () => ({
    user: { id: 'user_123', email: 'test@example.com' },
    isAuthenticated: true,
    loading: false,
  }),
}));

// Mock the predictive analytics module
vi.mock('../../features/analytics/services/predictiveAnalytics', () => ({
  predictiveAnalytics: {
    predictUserBehavior: vi.fn().mockResolvedValue({
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
    forecastPerformance: vi.fn().mockResolvedValue({
      metric: 'LCP',
      currentValue: 2.1,
      predictedValue: 2.8,
      trend: 'degrading',
      confidence: 0.92,
      timeframe: '24h',
      factors: ['user_load', 'cache_efficiency', 'network_conditions'],
    }),
    analyzeFeatureUsage: vi.fn().mockResolvedValue([
      {
        feature: 'Navigation',
        usage: 85.5,
        trend: 0.05,
        userSegment: 'power_users',
        optimizationSuggestion: 'Enhance existing functionality',
        impactScore: 92.3,
      },
    ]),
    detectAnomalies: vi.fn().mockResolvedValue([
      {
        type: 'performance',
        severity: 'medium',
        description: 'Anomalous LCP: 4200ms',
        confidence: 0.9,
        suggestedActions: ['Optimize images', 'Reduce server response time'],
      },
    ]),
    getRealtimeRecommendations: vi.fn().mockResolvedValue({
      personalizedContent: [{ type: 'content', action: 'highlight_trending', confidence: 0.8 }],
      uiOptimizations: [{ type: 'ui', action: 'optimize_navigation', confidence: 0.7 }],
      performanceHints: [{ type: 'performance', action: 'preload_likely_pages', confidence: 0.8 }],
    }),
  },
}));

// Get the mocked module
const mockedPredictiveAnalytics = predictiveAnalyticsModule.predictiveAnalytics as anyed<
  typeof predictiveAnalyticsModule.predictiveAnalytics
>;

describe('🤖 AI Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      render(<AIDashboard />);

      // Check for loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Dashboard Header', () => {
    it('should render the main header correctly', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🤖 AI Analytics Dashboard')).toBeInTheDocument();
        expect(
          screen.getByText('Enterprise-grade predictive insights powered by machine learning')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Quick Stats Cards', () => {
    it('should display all quick stats cards', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Predictions Made')).toBeInTheDocument();
        expect(screen.getByText('Performance Forecasts')).toBeInTheDocument();
        expect(screen.getByText('Anomalies Detected')).toBeInTheDocument();
        expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
      });
    });

    it('should display correct stat values', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        // Use more specific selectors - check that each stat card contains the right values
        const predictionsMadeCard = screen.getByText('Predictions Made').closest('div');
        expect(predictionsMadeCard).toHaveTextContent('1');

        const performanceForecastsCard = screen.getByText('Performance Forecasts').closest('div');
        expect(performanceForecastsCard).toHaveTextContent('2');

        const anomaliesDetectedCard = screen.getByText('Anomalies Detected').closest('div');
        expect(anomaliesDetectedCard).toHaveTextContent('1');

        const aiRecommendationsCard = screen.getByText('AI Recommendations').closest('div');
        expect(aiRecommendationsCard).toHaveTextContent('3');
      });
    });
  });

  describe('Anomalies Section', () => {
    it('should display anomalies section when anomalies exist', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🚨 Anomalies Detected')).toBeInTheDocument();
        expect(screen.getByText('PERFORMANCE')).toBeInTheDocument();
        expect(screen.getByText('Anomalous LCP: 4200ms')).toBeInTheDocument();
        expect(screen.getByText('90.0% confidence')).toBeInTheDocument();
      });
    });

    it('should display suggested actions for anomalies', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suggested Actions:')).toBeInTheDocument();
        expect(screen.getByText('Optimize images')).toBeInTheDocument();
        expect(screen.getByText('Reduce server response time')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Forecasts Section', () => {
    it('should display performance forecasts', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('📈 Performance Forecasts')).toBeInTheDocument();
        // Check for LCP forecast data
        const lcpElements = screen.getAllByText('LCP');
        expect(lcpElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('User Behavior Analysis Section', () => {
    it('should display user behavior analysis', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🎯 User Behavior Analysis')).toBeInTheDocument();
        expect(screen.getByText('User: user_123')).toBeInTheDocument();
        expect(screen.getByText('low churn risk')).toBeInTheDocument();
        expect(screen.getByText('85.0%')).toBeInTheDocument(); // Conversion probability
      });
    });
  });

  describe('Feature Usage Insights Section', () => {
    it('should display feature insights', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🎨 Feature Usage Insights')).toBeInTheDocument();
        expect(screen.getByText('Navigation')).toBeInTheDocument();
        // Check for userSegment text - might be formatted differently
        expect(screen.getByText(/power.users|power_users/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading and Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock an error
      mockedPredictiveAnalytics.predictUserBehavior.mockRejectedValueOnce(new Error('API Error'));

      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('AI Dashboard Error')).toBeInTheDocument();
        expect(screen.getByText('API Error')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should retry loading when retry button is clicked', async () => {
      // Mock an error first, then success
      mockedPredictiveAnalytics.predictUserBehavior
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          userId: 'user_123',
          sessionDuration: 45000,
          clickPatterns: [1234567890],
          scrollDepth: 75,
          bounceRate: 0.2,
          conversionProbability: 0.85,
          churnRisk: 'low',
          nextAction: 'purchase',
          confidence: 0.92,
        });

      render(<AIDashboard />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Should load successfully
      await waitFor(() => {
        expect(screen.getByText('🤖 AI Analytics Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set up interval for refreshing data', async () => {
      render(<AIDashboard />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('🤖 AI Analytics Dashboard')).toBeInTheDocument();
      });

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockedPredictiveAnalytics.predictUserBehavior).toHaveBeenCalledTimes(2);
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedPredictiveAnalytics.forecastPerformance).toHaveBeenCalledTimes(4); // 2 calls per load, 2 loads
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          '🤖 AI Analytics Dashboard'
        );

        const level2Headings = screen.getAllByRole('heading', { level: 2 });
        expect(level2Headings.length).toBeGreaterThan(0);
      });
    });

    it('should have accessible button elements', async () => {
      // Mock an error to get the retry button
      mockedPredictiveAnalytics.predictUserBehavior.mockRejectedValueOnce(new Error('API Error'));

      render(<AIDashboard />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: 'Retry' });
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toBeEnabled();
      });
    });
  });

  describe('Component Utilities', () => {
    it('should display confidence badges correctly', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('90.0% confidence')).toBeInTheDocument();
      });
    });

    it('should show severity indicators for anomalies', async () => {
      render(<AIDashboard />);

      await waitFor(() => {
        expect(screen.getByText('medium')).toBeInTheDocument();
      });
    });
  });
});
