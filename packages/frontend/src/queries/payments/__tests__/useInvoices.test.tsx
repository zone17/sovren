import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useInvoices } from '../useInvoices';

// Mock fetch
global.fetch = jest.fn();

describe('useInvoices', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  it('should fetch invoices successfully', async () => {
    const mockData = {
      invoices: [
        {
          id: '1',
          creatorId: 'creator1',
          amount: 1000,
          description: 'Test payment',
          paymentRequest: 'lnbc1000...',
          paymentHash: 'hash123',
          status: 'completed',
          method: 'lightning',
          expiresAt: '2024-12-31',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
      summary: {
        totalAmount: 1000,
        completedAmount: 1000,
        pendingAmount: 0,
        failedAmount: 0,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useInvoices(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/payments/invoices?', expect.any(Object));
  });

  it('should handle filters correctly', async () => {
    const mockData = {
      invoices: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const filters = {
      userId: 'user1',
      status: 'completed' as const,
      method: 'lightning' as const,
      minAmount: 100,
      maxAmount: 1000,
      sortBy: 'amount' as const,
      sortOrder: 'desc' as const,
    };

    const { result } = renderHook(() => useInvoices(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/payments/invoices?userId=user1&status=completed&method=lightning&minAmount=100&maxAmount=1000&sortBy=amount&sortOrder=desc',
      expect.any(Object)
    );
  });

  it('should handle date filters', async () => {
    const mockData = {
      invoices: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const filters = {
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    };

    const { result } = renderHook(() => useInvoices(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/payments/invoices?dateFrom=2024-01-01&dateTo=2024-12-31',
      expect.any(Object)
    );
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
    });

    const { result } = renderHook(() => useInvoices(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Failed to fetch invoices: Unauthorized');
  });

  it('should use correct cache configuration', () => {
    const { result } = renderHook(() => useInvoices(), { wrapper });

    // The query should have the correct cache key
    const queryState = queryClient.getQueryState(['payments', 'invoices', { filters: undefined }]);
    expect(queryState).toBeDefined();
  });
});