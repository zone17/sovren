import { apiClient, ApiError } from '../apiClient';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    apiClient.setToken(null);
  });

  describe('Token Management', () => {
    it('starts with no token', () => {
      expect(apiClient.getToken()).toBeNull();
    });

    it('sets and gets token', () => {
      apiClient.setToken('test-jwt-token');
      expect(apiClient.getToken()).toBe('test-jwt-token');
    });

    it('clears token when set to null', () => {
      apiClient.setToken('test-jwt-token');
      apiClient.setToken(null);
      expect(apiClient.getToken()).toBeNull();
    });
  });

  describe('Request Headers', () => {
    it('includes Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await apiClient.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('includes Authorization header when token is set', async () => {
      apiClient.setToken('my-jwt-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await apiClient.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });

    it('does not include Authorization header when token is not set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await apiClient.checkHealth();

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });
  });

  describe('Auth Endpoints', () => {
    it('calls POST /api/auth/challenge for generateChallenge', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { challenge: 'abc123', timestamp: 123, expires_at: 456, message: 'Sign' },
          }),
      });

      const result = await apiClient.generateChallenge();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/challenge'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.data.challenge).toBe('abc123');
    });

    it('calls POST /api/auth/authenticate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: 'jwt-token',
              user: { nostr_pubkey: 'a'.repeat(64), role: 'creator', signature_verified: true },
              expires_in: '24h',
            },
          }),
      });

      const result = await apiClient.authenticate({
        nostr_pubkey: 'a'.repeat(64),
        challenge: 'abc',
        timestamp: 123,
        signature: 'sig',
      });

      expect(result.data.token).toBe('jwt-token');
    });
  });

  describe('User Endpoints', () => {
    it('calls GET /api/v1/users/profile/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'user-1', display_name: 'Test' },
          }),
      });

      await apiClient.getUserProfile('user-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/profile/user-1'),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('Payment Endpoints', () => {
    it('calls POST /api/v1/payments/invoices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'inv-1', payment_request: 'lnbc...', amount_sats: 5000, status: 'pending' },
          }),
      });

      const result = await apiClient.createInvoice({
        amount_sats: 5000,
        recipient_id: 'creator-1',
        payment_type: 'subscription',
        description: 'Test',
      });

      expect(result.data.id).toBe('inv-1');
      expect(result.data.amount_sats).toBe(5000);
    });
  });

  describe('Error Handling', () => {
    it('throws ApiError on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Resource not found', code: 'NOT_FOUND' }),
      });

      await expect(apiClient.getUserProfile('nonexistent')).rejects.toThrow(ApiError);
    });

    it('includes status and code in ApiError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () =>
          Promise.resolve({ error: 'Invalid token', code: 'AUTHENTICATION_ERROR' }),
      });

      try {
        await apiClient.verifyToken();
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(401);
        expect(apiErr.code).toBe('AUTHENTICATION_ERROR');
        expect(apiErr.message).toBe('Invalid token');
      }
    });

    it('handles malformed JSON in error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(apiClient.checkHealth()).rejects.toThrow(ApiError);
    });
  });
});
