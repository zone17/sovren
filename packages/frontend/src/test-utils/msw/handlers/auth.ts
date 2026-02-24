import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.get('/api/auth/user', () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'test@example.com',
      role: 'creator',
      name: 'Test User',
    });
  }),

  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: 'user-1', email: 'test@example.com', role: 'creator', name: 'Test User' },
    });
  }),

  http.post('/api/auth/signup', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: 'user-2', email: 'new@example.com', role: 'creator', name: 'New User' },
    });
  }),

  http.post('/api/auth/register', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: 'user-2', email: 'new@example.com', role: 'creator', name: 'New User' },
    });
  }),

  http.post('/api/auth/challenge', () => {
    return HttpResponse.json({ challenge: 'mock-challenge-string' });
  }),

  http.post('/api/auth/authenticate', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: 'user-1', email: 'test@example.com', role: 'creator', name: 'Test User' },
    });
  }),

  http.post('/api/auth/verify', () => {
    return HttpResponse.json({ verified: true });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),
];
