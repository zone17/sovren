/**
 * LIGHTNING API SERVICE - TEST SUITE
 *
 * Updated for cookie-based auth (credentials: 'include').
 * Authorization header removed — auth is via httpOnly cookies.
 * vi.spyOn for fetch (compatible with MSW global setup).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lightningApi } from './lightningApi';

describe('LightningAPI', () => {
  const mockApiUrl = 'http://localhost:3001';

  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Use vi.spyOn so MSW infrastructure stays intact
    fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Stub the env variable for the API URL
    vi.stubEnv('VITE_API_URL', mockApiUrl);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  // Helper to create a proper Response object
  const makeResponse = (body: unknown, ok = true, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;

  describe('createInvoice', () => {
    it('should create invoice with valid request', async () => {
      const mockResponse = {
        paymentRequest: 'lnbc1500n1pj4d0fz...',
        paymentHash: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
        amount: 1000,
        description: 'Test payment',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      fetchSpy.mockResolvedValueOnce(makeResponse(mockResponse));

      const result = await lightningApi.createInvoice({
        amount: 1000,
        description: 'Test payment',
      });

      expect(result).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/lightning/invoice'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            amount: 1000,
            description: 'Test payment',
          }),
        })
      );
    });

    it('should throw error when API returns 500', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        lightningApi.createInvoice({
          amount: 1000,
          description: 'Test payment',
        })
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        lightningApi.createInvoice({
          amount: 1000,
          description: 'Test payment',
        })
      ).rejects.toThrow();
    });

    it('should include optional metadata in request', async () => {
      const mockResponse = {
        paymentRequest: 'lnbc1500n1pj4d0fz...',
        paymentHash: 'hash123',
        amount: 5000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      fetchSpy.mockResolvedValueOnce(makeResponse(mockResponse));

      await lightningApi.createInvoice({
        amount: 5000,
        description: 'Premium content',
        metadata: { contentId: 'post-123', tier: 'premium' },
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/lightning/invoice'),
        expect.objectContaining({
          body: JSON.stringify({
            amount: 5000,
            description: 'Premium content',
            metadata: { contentId: 'post-123', tier: 'premium' },
          }),
        })
      );
    });
  });

  describe('checkInvoiceStatus', () => {
    it('should fetch invoice status successfully', async () => {
      const mockPaymentHash = '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29';
      const mockResponse = {
        paymentRequest: 'lnbc1500n1pj4d0fz...',
        paymentHash: mockPaymentHash,
        amount: 1000,
        settled: true,
        settledAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now() - 1000,
      };

      fetchSpy.mockResolvedValueOnce(makeResponse(mockResponse));

      const result = await lightningApi.checkInvoiceStatus(mockPaymentHash);

      expect(result).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/api/lightning/invoice/${mockPaymentHash}`),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error for invalid payment hash', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(lightningApi.checkInvoiceStatus('invalid-hash')).rejects.toThrow();
    });

    it('should handle pending invoice status', async () => {
      const mockPaymentHash = 'pending-hash-123';
      const mockResponse = {
        paymentRequest: 'lnbc1500n1pj4d0fz...',
        paymentHash: mockPaymentHash,
        amount: 2000,
        settled: false,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now() - 500,
      };

      fetchSpy.mockResolvedValueOnce(makeResponse(mockResponse));

      const result = await lightningApi.checkInvoiceStatus(mockPaymentHash);

      expect(result.settled).toBe(false);
      expect(result.settledAt).toBeUndefined();
    });
  });

  describe('getUserPaymentHistory', () => {
    it('should fetch payment history successfully', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          userId: 'user-123',
          paymentHash: 'hash-1',
          paymentRequest: 'lnbc...',
          amount: 1000,
          status: 'settled',
          createdAt: Date.now() - 3600000,
          settledAt: Date.now() - 3500000,
          expiresAt: Date.now() + 3600000,
        },
        {
          id: 'payment-2',
          userId: 'user-123',
          paymentHash: 'hash-2',
          paymentRequest: 'lnbc...',
          amount: 2000,
          status: 'pending',
          createdAt: Date.now() - 1800000,
          expiresAt: Date.now() + 1800000,
        },
      ];

      fetchSpy.mockResolvedValueOnce(makeResponse(mockPayments));

      const result = await lightningApi.getUserPaymentHistory();

      expect(result).toEqual(mockPayments);
      expect(result).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/lightning/user/payments'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('should return empty array when no payments exist', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse([]));

      const result = await lightningApi.getUserPaymentHistory();

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized errors', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(lightningApi.createInvoice({ amount: 1000 })).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      vi.useFakeTimers();

      // Mock fetch to never resolve (AbortController will abort it)
      fetchSpy.mockImplementationOnce(
        (_url: string, options?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The user aborted a request.', 'AbortError'));
            });
          })
      );

      const fetchPromise = lightningApi.createInvoice({ amount: 1000 });

      // Advance time beyond the 10s timeout in LightningApiClient
      vi.advanceTimersByTime(11000);

      await expect(fetchPromise).rejects.toThrow();

      vi.useRealTimers();
    });

    it('should handle malformed JSON responses', async () => {
      // Return a response where .json() throws
      const badResponse = new Response('not-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      fetchSpy.mockResolvedValueOnce(badResponse);

      await expect(lightningApi.createInvoice({ amount: 1000 })).rejects.toThrow();
    });
  });

  describe('Request Configuration', () => {
    it('should set correct Content-Type header', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse({ paymentHash: 'hash' }));

      await lightningApi.createInvoice({ amount: 1000 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use credentials include for cookie-based auth', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse({ settled: false }));

      await lightningApi.checkInvoiceStatus('hash-123');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });
});
