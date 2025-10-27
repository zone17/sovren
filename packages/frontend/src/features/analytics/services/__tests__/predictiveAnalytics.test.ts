/**
 * Predictive Analytics Tests
 * Testing the actual analytics service with proper types
 */

import {
    analyzeFeatureUsage,
    detectAnomalies,
    forecastPerformance,
    getRealtimeRecommendations,
    predictUserBehavior
} from '../predictiveAnalytics';

describe('Predictive Analytics Service', () => {
  describe('User Behavior Prediction', () => {
    it('should predict user behavior', async () => {
      const userId = 'test_user_123';
      const sessionData = {
        duration: 45000,
        clickSequence: [1000, 2000, 3000],
        maxScrollDepth: 75,
        pageViews: 3,
        interactions: [
          { type: 'click' as const, element: 'button', timestamp: Date.now() },
          { type: 'scroll' as const, element: 'page', timestamp: Date.now() + 1000 },
        ],
        timestamp: Date.now(),
        userAgent: 'test-agent',
      };

      const prediction = await predictUserBehavior(userId, sessionData);

      expect(prediction.userId).toBe(userId);
      expect(typeof prediction.sessionDuration).toBe('number');
      expect(typeof prediction.scrollDepth).toBe('number');
      expect(typeof prediction.bounceRate).toBe('number');
      expect(typeof prediction.conversionProbability).toBe('number');
      expect(['low', 'medium', 'high']).toContain(prediction.churnRisk);
      expect(typeof prediction.confidence).toBe('number');
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance Forecasting', () => {
    it('should forecast performance metrics', async () => {
      const forecast = await forecastPerformance('LCP', '24h');

      expect(forecast.metric).toBe('LCP');
      expect(typeof forecast.currentValue).toBe('number');
      expect(typeof forecast.predictedValue).toBe('number');
      expect(['improving', 'degrading', 'stable']).toContain(forecast.trend);
      expect(typeof forecast.confidence).toBe('number');
    });
  });

  describe('Feature Usage Analysis', () => {
    it('should analyze feature usage', async () => {
      const insights = await analyzeFeatureUsage();

      expect(Array.isArray(insights)).toBe(true);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies', async () => {
      const anomalies = await detectAnomalies();

      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Real-time Recommendations', () => {
    it('should provide recommendations', async () => {
      const userId = 'test_user';

      // First, create a user session by predicting behavior
      const sessionData = {
        duration: 30000,
        clickSequence: [1000, 2000],
        maxScrollDepth: 50,
        pageViews: 2,
        interactions: [
          { type: 'click' as const, element: 'button', timestamp: Date.now() },
        ],
        timestamp: Date.now(),
        userAgent: 'test-agent',
      };

      // This will create the user pattern
      await predictUserBehavior(userId, sessionData);

      // Now we can get recommendations
      const recommendations = await getRealtimeRecommendations(userId);

      expect(typeof recommendations).toBe('object');
      expect(recommendations).not.toBeNull();
    });
  });
});
