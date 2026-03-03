import { http, HttpResponse } from 'msw';
import { TEST_USER } from './helpers';

const CHALLENGE_EXPIRES = new Date(Date.now() + 5 * 60 * 1000).toISOString();

export const authHandlers = [
  // NOSTR auth challenge — POST /api/auth/challenge
  http.post('*/api/auth/challenge', () => {
    return HttpResponse.json({
      success: true,
      data: {
        challenge: 'test-challenge-abc123',
        timestamp: Math.floor(Date.now() / 1000),
        expires_at: CHALLENGE_EXPIRES,
      },
    });
  }),

  // NOSTR authenticate — POST /api/auth/authenticate
  http.post('*/api/auth/authenticate', () => {
    return HttpResponse.json({
      success: true,
      data: {
        token: 'test-jwt-token',
        user: {
          pubkey: TEST_USER.pubkey,
          role: 'creator',
          id: TEST_USER.id,
        },
        expires_in: 86400,
      },
    });
  }),

  // Logout — DELETE /api/auth/login or POST /api/auth/logout
  http.delete('*/api/auth/login', () => {
    return HttpResponse.json({ success: true, data: null });
  }),

  http.post('*/api/auth/logout', () => {
    return HttpResponse.json({ success: true, data: null });
  }),

  // Current user session
  http.get('*/api/auth/user', () => {
    return HttpResponse.json({
      success: true,
      data: TEST_USER,
    });
  }),

  // Token verification
  http.get('*/api/auth/verify', () => {
    return HttpResponse.json({
      success: true,
      data: { valid: true, user: TEST_USER },
    });
  }),
];
