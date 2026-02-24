import { http, HttpResponse } from 'msw';

export const platformHandlers = [
  http.get('/api/platforms', () => {
    return HttpResponse.json({ platforms: [] });
  }),

  http.get('/api/platforms/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Test Platform', connected: true });
  }),

  http.post('/api/platforms/connect', () => {
    return HttpResponse.json({ platformId: 'plat-1', connected: true });
  }),

  http.get('/api/platforms/accounts', () => {
    return HttpResponse.json({ accounts: [] });
  }),

  http.post('/api/platforms/share', () => {
    return HttpResponse.json({ shared: true, platformIds: [] });
  }),

  http.get('/api/platforms/posts', () => {
    return HttpResponse.json({ posts: [], total: 0 });
  }),

  http.post('/api/platforms/posts/:id/publish', () => {
    return HttpResponse.json({ published: true });
  }),

  http.get('/api/platforms/schedules', () => {
    return HttpResponse.json({ schedules: [] });
  }),

  http.get('/api/platforms/reports', () => {
    return HttpResponse.json({ reports: [] });
  }),

  http.post('/api/platforms/oauth/initiate', () => {
    return HttpResponse.json({ authUrl: 'https://example.com/oauth' });
  }),
];
