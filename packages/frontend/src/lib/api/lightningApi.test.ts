/**
 * 📦 **LIGHTNING API SERVICE - TEST SUITE**
 *
 * Elite Testing Standards:
 * - TDD approach (tests written first)
 * - Comprehensive coverage ≥95%
 * - Real API integration patterns
 * - Type-safe error handling
 * - Mock fetch for controlled testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lightningApi } from './lightningApi';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

describe('LightningAPI', () => {
  const mockAuthToken = 'mock-auth-token-12345';
  const mockApiUrl = 'http://localhost:3001';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('auth_token', mockAuthToken);

    // Mock environment variable
    vi.stubEnv('VITE_API_URL', mockApiUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await lightningApi.createInvoice({
        amount: 1000,
        description: 'Test payment',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/lightning/invoice`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockAuthToken}`,
          },
          body: JSON.stringify({
            amount: 1000,
            description: 'Test payment',
          }),
        })
      );
    });

    it('should throw error when authentication is missing', async () => {
      localStorageMock.clear();

      await expect(
        lightningApi.createInvoice({
          amount: 1000,
          description: 'Test payment',
        })
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when API returns 500', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(
        lightningApi.createInvoice({
          amount: 1000,
          description: 'Test payment',
        })
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

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

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await lightningApi.createInvoice({
        amount: 5000,
        description: 'Premium content',
        metadata: { contentId: 'post-123', tier: 'premium' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/lightning/invoice`,
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

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await lightningApi.checkInvoiceStatus(mockPaymentHash);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/lightning/invoice/${mockPaymentHash}`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockAuthToken}`,
          },
        })
      );
    });

    it('should throw error for invalid payment hash', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Invoice not found' }),
      });

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

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

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

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      });

      const result = await lightningApi.getUserPaymentHistory();

      expect(result).toEqual(mockPayments);
      expect(result).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/lightning/user/payments`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return empty array when no payments exist', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await lightningApi.getUserPaymentHistory();

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(
        lightningApi.createInvoice({ amount: 1000 })
      ).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      vi.useFakeTimers();

      const fetchPromise = lightningApi.createInvoice({ amount: 1000 });

      // Fast-forward time beyond timeout
      vi.advanceTimersByTime(15000);

      await expect(fetchPromise).rejects.toThrow();

      vi.useRealTimers();
    });

    it('should handle malformed JSON responses', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(
        lightningApi.createInvoice({ amount: 1000 })
      ).rejects.toThrow();
    });
  });

  describe('Request Configuration', () => {
    it('should set correct Content-Type header', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paymentHash: 'hash' }),
      });

      await lightningApi.createInvoice({ amount: 1000 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should include auth token in all requests', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settled: false }),
      });

      await lightningApi.checkInvoiceStatus('hash-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAuthToken}`,
          }),
        })
      );
    });
  });
});
