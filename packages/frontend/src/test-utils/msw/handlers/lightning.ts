import { http } from 'msw';
import { jsonOk, TEST_TIMESTAMP } from './helpers';

const sampleInvoice = {
  paymentRequest: 'lnbc10u1ptest',
  paymentHash: 'abc123def456',
  amount: 1000,
  description: 'test',
  expiresAt: '2026-01-15T13:00:00.000Z',
  createdAt: TEST_TIMESTAMP,
  settled: false,
  status: 'pending',
};

export const lightningHandlers = [
  http.post('/api/lightning/invoice', () => {
    return jsonOk(sampleInvoice);
  }),

  http.get('/api/lightning/invoice/:id', ({ params }) => {
    return jsonOk({ ...sampleInvoice, id: params.id as string });
  }),

  http.get('/api/lightning/status', () => {
    return jsonOk({ balance: 50000, pending: 0 });
  }),

  http.get('/api/lightning/payments', () => {
    return jsonOk({ payments: [], total: 0 });
  }),
];
