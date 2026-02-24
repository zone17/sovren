import { http } from 'msw';
import { jsonOk } from './helpers';

export const platformHandlers = [
  http.get('/api/v2/platforms', () => {
    return jsonOk({ platforms: [] });
  }),

  http.get('/api/v2/platforms/:id', ({ params }) => {
    return jsonOk({ id: params.id, name: 'Test Platform', connected: true });
  }),

  http.post('/api/v2/platforms/connect', () => {
    return jsonOk({ platformId: 'plat-1', connected: true });
  }),

  http.get('/api/v2/platforms/accounts', () => {
    return jsonOk({ accounts: [] });
  }),

  http.post('/api/v2/platforms/share', () => {
    return jsonOk({ shared: true, platformIds: [] });
  }),

  http.get('/api/v2/platforms/posts', () => {
    return jsonOk({ posts: [], total: 0 });
  }),

  http.post('/api/v2/platforms/posts/:id/publish', () => {
    return jsonOk({ published: true });
  }),

  http.get('/api/v2/platforms/schedules', () => {
    return jsonOk({ schedules: [] });
  }),

  http.get('/api/v2/platforms/reports', () => {
    return jsonOk({ reports: [] });
  }),

  http.post('/api/v2/platforms/oauth/initiate', () => {
    return jsonOk({ authUrl: 'https://example.com/oauth' });
  }),
];
