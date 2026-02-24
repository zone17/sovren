import { http, HttpResponse } from 'msw';

export const wellnessHandlers = [
  http.get('/api/wellness/score', () => {
    return HttpResponse.json({
      burnoutScore: 35,
      stressLevel: 'low',
      recommendations: [],
    });
  }),

  http.get('/api/wellness/history', () => {
    return HttpResponse.json({ history: [], period: '30d' });
  }),

  http.get('/api/wellness/metrics', () => {
    return HttpResponse.json({
      metrics: { screenTime: 120, breaks: 5, focusTime: 60 },
    });
  }),
];
