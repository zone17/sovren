import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useDiscovery } from '../useDiscovery';

describe('useDiscovery', () => {
  let queryClient: QueryClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const mockDiscoveryData = {
    success: true,
    data: {
      creators: [
        {
          id: '1',
          displayName: 'Sophia',
          username: 'sophia_art',
          avatarUrl: null,
          bio: 'Digital illustrator',
          nip05Verified: true,
          categories: ['Art'],
          tags: ['bitcoin'],
          followerCount: 1500,
          contentCount: 45,
          verified: true,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
      },
    });
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
    queryClient.clear();
  });

  it('fetches creators on mount', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(mockDiscoveryData));

    const { result } = renderHook(() => useDiscovery(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.creators).toHaveLength(1);
    expect(result.current.creators[0].displayName).toBe('Sophia');
    expect(result.current.pagination).toEqual(mockDiscoveryData.data.pagination);
  });

  it('passes sortBy param to the API', async () => {
    fetchSpy.mockResolvedValue(mockResponse(mockDiscoveryData));

    const { result } = renderHook(() => useDiscovery(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateFilters({ category: 'Art', sortBy: 'followers' });
    });

    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('category=Art');
      expect(lastCall).toContain('sortBy=followers');
    });
  });

  it('resets page when filters change', async () => {
    fetchSpy.mockResolvedValue(mockResponse(mockDiscoveryData));

    const { result } = renderHook(() => useDiscovery(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);

    act(() => {
      result.current.updateFilters({ category: 'Music' });
    });
    expect(result.current.page).toBe(1);
  });

  it('handles API errors', async () => {
    // The hook sets retry: 1, so we need to mock both the initial call and the retry.
    // React Query uses exponential backoff delays between retries, so we must
    // advance fake timers past the retry delay for the error state to settle.
    fetchSpy.mockRejectedValue(new Error('Server Error'));

    const { result } = renderHook(() => useDiscovery(), { wrapper });

    // Advance timers repeatedly to allow retry backoff to complete
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
    }

    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 });

    expect(result.current.creators).toEqual([]);
  });

  it('does not fetch when debounced query is 1 character', async () => {
    fetchSpy.mockResolvedValue(mockResponse(mockDiscoveryData));

    const { result } = renderHook(() => useDiscovery(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCountBefore = fetchSpy.mock.calls.length;

    act(() => {
      result.current.updateFilters({ query: 'a' });
    });

    // Advance past debounce timer
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Should not have made a new call for 1-char query
    expect(fetchSpy.mock.calls.length).toBe(callCountBefore);
  });
});
