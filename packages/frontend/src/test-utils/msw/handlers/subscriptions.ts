import { http, HttpResponse } from 'msw';

export const subscriptionHandlers = [
  http.get('/api/subscriptions', () => {
    return HttpResponse.json({ subscriptions: [], total: 0 });
  }),

  http.get('/api/subscriptions/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      tier: 'basic',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
  }),

  http.post('/api/subscriptions', () => {
    return HttpResponse.json({ id: 'sub-new', tier: 'basic', status: 'active' });
  }),

  http.put('/api/subscriptions/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, tier: 'premium', status: 'active' });
  }),

  http.delete('/api/subscriptions/:id', () => {
    return HttpResponse.json({ success: true });
  }),
];
