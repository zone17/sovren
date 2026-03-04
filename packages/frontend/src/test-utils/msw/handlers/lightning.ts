import { http } from 'msw';
import { jsonOk } from './helpers';

/** Matches FrontendInvoiceShape from backend lightning routes */
const sampleInvoice = {
  paymentRequest: 'lnbc10u1ptest',
  paymentHash: 'abc123def456',
  amount: 1000,
  description: 'Sovren Creator Support',
  createdAt: 1705312800,
  expiresAt: 1705316400,
  settled: false,
};

export const lightningHandlers = [
  http.post('/api/lightning/invoice', () => {
    return jsonOk(sampleInvoice);
  }),

  http.get('/api/lightning/invoice/:paymentHash', () => {
    return jsonOk(sampleInvoice);
  }),

  http.get('/api/lightning/node-info', () => {
    return jsonOk({ totalInvoices: 10, totalPaid: 5, balance: 50000 });
  }),

  http.get('/api/lightning/user/payments', () => {
    return jsonOk([]);
  }),

  http.get('/api/lightning/user/subscriptions', () => {
    return jsonOk([]);
  }),

  http.post('/api/lightning/subscription', () => {
    return jsonOk(sampleInvoice);
  }),
];
