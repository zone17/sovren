import { http } from 'msw';
import { jsonOk } from './helpers';

export const wellnessHandlers = [
  http.get('/api/v2/wellness/score', () => {
    return jsonOk({
      burnoutScore: 35,
      stressLevel: 'low',
      recommendations: [],
    });
  }),

  http.get('/api/v2/wellness/history', () => {
    return jsonOk({ history: [], period: '30d' });
  }),

  http.get('/api/v2/wellness/metrics', () => {
    return jsonOk({
      metrics: { screenTime: 120, breaks: 5, focusTime: 60 },
    });
  }),
];
