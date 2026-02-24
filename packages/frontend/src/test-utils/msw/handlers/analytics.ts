import { http, HttpResponse } from 'msw';

export const analyticsHandlers = [
  http.get('/api/analytics/summary', () => {
    return HttpResponse.json({
      totalViews: 1500,
      totalLikes: 320,
      totalShares: 85,
      period: '30d',
    });
  }),

  http.get('/api/analytics/events', () => {
    return HttpResponse.json({ events: [] });
  }),

  http.get('/api/engagement-analytics/metrics', () => {
    return HttpResponse.json({
      views: 1500,
      likes: 320,
      shares: 85,
      comments: 42,
      period: '30d',
    });
  }),

  http.get('/api/engagement-analytics/patterns', () => {
    return HttpResponse.json({ patterns: [], period: '30d' });
  }),

  http.get('/api/engagement-analytics/insights', () => {
    return HttpResponse.json({ insights: [], generatedAt: new Date().toISOString() });
  }),

  http.get('/api/engagement-analytics/benchmarks', () => {
    return HttpResponse.json({ benchmarks: [], category: 'general' });
  }),
];
