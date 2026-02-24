import { http } from 'msw';
import { jsonOk, TEST_TIMESTAMP } from './helpers';

export const analyticsHandlers = [
  http.get('/api/v1/metrics/summary', () => {
    return jsonOk({
      totalViews: 1500,
      totalLikes: 320,
      totalShares: 85,
      period: '30d',
    });
  }),

  http.get('/api/v1/metrics/events', () => {
    return jsonOk({ events: [] });
  }),

  http.get('/api/engagement-analytics/metrics', () => {
    return jsonOk({
      views: 1500,
      likes: 320,
      shares: 85,
      comments: 42,
      period: '30d',
    });
  }),

  http.get('/api/engagement-analytics/patterns', () => {
    return jsonOk({ patterns: [], period: '30d' });
  }),

  http.get('/api/engagement-analytics/insights', () => {
    return jsonOk({ insights: [], generatedAt: TEST_TIMESTAMP });
  }),

  http.get('/api/engagement-analytics/benchmarks', () => {
    return jsonOk({ benchmarks: [], category: 'general' });
  }),
];
