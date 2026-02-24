import { http, HttpResponse } from 'msw';

export const lightningHandlers = [
  http.post('/api/lightning/invoice', () => {
    return HttpResponse.json({
      paymentRequest: 'lnbc10u1ptest',
      paymentHash: 'abc123def456',
      amount: 1000,
      description: 'test',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      settled: false,
    });
  }),

  http.get('/api/lightning/invoice/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      paymentRequest: 'lnbc10u1ptest',
      paymentHash: 'abc123def456',
      amount: 1000,
      description: 'test',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      settled: false,
      status: 'pending',
    });
  }),

  http.get('/api/lightning/status', () => {
    return HttpResponse.json({ balance: 50000, pending: 0 });
  }),

  http.get('/api/lightning/payments', () => {
    return HttpResponse.json({ payments: [], total: 0 });
  }),
];
