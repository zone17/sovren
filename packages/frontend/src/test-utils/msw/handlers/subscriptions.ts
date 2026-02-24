import { http } from 'msw';
import { jsonOk, TEST_TIMESTAMP } from './helpers';

export const subscriptionHandlers = [
  http.get('/api/subscription-tiers', () => {
    return jsonOk({ subscriptions: [], total: 0 });
  }),

  http.get('/api/subscription-tiers/:id', ({ params }) => {
    return jsonOk({
      id: params.id,
      tier: 'basic',
      status: 'active',
      startDate: TEST_TIMESTAMP,
      endDate: '2026-02-15T12:00:00.000Z',
    });
  }),

  http.post('/api/subscription-tiers', () => {
    return jsonOk({ id: 'sub-new', tier: 'basic', status: 'active' });
  }),

  http.put('/api/subscription-tiers/:id', ({ params }) => {
    return jsonOk({ id: params.id, tier: 'premium', status: 'active' });
  }),

  http.delete('/api/subscription-tiers/:id', () => {
    return jsonOk({ deleted: true });
  }),
];
