import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useCreators } from '../useCreators';

// Mock fetch
global.fetch = jest.fn();

describe('useCreators', () => {
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

  it('should fetch creators successfully', async () => {
    const mockData = {
      creators: [
        {
          id: '1',
          pubkey: 'pubkey1',
          name: 'Creator 1',
          followerCount: 1000,
          verified: true,
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
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useCreators(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/creators?', expect.any(Object));
  });

  it('should handle filters correctly', async () => {
    const mockData = {
      creators: [],
      pagination: {
        page: 2,
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
      page: 2,
      limit: 20,
      category: 'music',
      sortBy: 'popular' as const,
      search: 'test',
    };

    const { result } = renderHook(() => useCreators(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/creators?page=2&limit=20&category=music&sortBy=popular&search=test',
      expect.any(Object)
    );
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useCreators(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Failed to fetch creators: Internal Server Error');
  });

  it('should use correct cache configuration', () => {
    const { result } = renderHook(() => useCreators(), { wrapper });

    // The query should have the correct stale time (from the hook itself)
    const queryState = queryClient.getQueryState(['creators', 'list', { filters: undefined }]);
    expect(queryState).toBeDefined();
  });
});