import { apiClient, ApiError } from '../apiClient';

describe('ApiClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    apiClient.setToken(null);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
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
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await apiClient.checkHealth();

      expect(fetchSpy).toHaveBeenCalledWith(
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
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await apiClient.checkHealth();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });

    it('does not include Authorization header when token is not set', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await apiClient.checkHealth();

      const callHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });
  });

  describe('Auth Endpoints', () => {
    it('calls POST /api/auth/challenge for generateChallenge', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { challenge: 'abc123', timestamp: 123, expires_at: 456, message: 'Sign' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await apiClient.generateChallenge();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/challenge'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.data.challenge).toBe('abc123');
    });

    it('calls POST /api/auth/authenticate', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              token: 'jwt-token',
              user: { nostr_pubkey: 'a'.repeat(64), role: 'creator', signature_verified: true },
              expires_in: '24h',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

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
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: 'user-1', display_name: 'Test' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await apiClient.getUserProfile('user-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/profile/user-1'),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('Payment Endpoints', () => {
    it('calls POST /api/v1/payments/invoices', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: 'inv-1', payment_request: 'lnbc...', amount_sats: 5000, status: 'pending' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

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
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Resource not found', code: 'NOT_FOUND' }),
          { status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(apiClient.getUserProfile('nonexistent')).rejects.toThrow(ApiError);
    });

    it('includes status and code in ApiError', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Invalid token', code: 'AUTHENTICATION_ERROR' }),
          { status: 401, statusText: 'Unauthorized', headers: { 'Content-Type': 'application/json' } }
        )
      );

      try {
        await apiClient.verifyToken();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(401);
        expect(apiErr.code).toBe('AUTHENTICATION_ERROR');
        expect(apiErr.message).toBe('Invalid token');
      }
    });

    it('handles malformed JSON in error response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('not json', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      await expect(apiClient.checkHealth()).rejects.toThrow(ApiError);
    });
  });
});
