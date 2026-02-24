import { http } from 'msw';
import { jsonOk, TEST_USER, TEST_TIMESTAMP } from './helpers';

export const authHandlers = [
  http.get('/api/auth/user', () => {
    return jsonOk(TEST_USER);
  }),

  http.post('/api/auth/challenge', () => {
    return jsonOk({
      challenge: 'mock-challenge-string',
      expiry: TEST_TIMESTAMP,
    });
  }),

  http.post('/api/auth/authenticate', () => {
    return jsonOk({
      token: 'mock-jwt-token',
      user: TEST_USER,
    });
  }),

  http.get('/api/auth/verify', () => {
    return jsonOk({ verified: true, user: TEST_USER });
  }),

  http.post('/api/auth/refresh', () => {
    return jsonOk({ token: 'mock-refreshed-jwt-token' });
  }),

  http.post('/api/auth/logout', () => {
    return jsonOk({ loggedOut: true });
  }),
];
