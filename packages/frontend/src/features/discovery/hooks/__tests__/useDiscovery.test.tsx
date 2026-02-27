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
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
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

  it('passes filter params to the API', async () => {
    fetchSpy.mockResolvedValue(mockResponse(mockDiscoveryData));

    const { result } = renderHook(() => useDiscovery(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateFilters({ category: 'Art', sortBy: 'followers' });
    });

    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('category=Art');
      expect(lastCall).toContain('sort=followers');
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
    fetchSpy.mockResolvedValueOnce(
      mockResponse({ error: 'Server Error', code: 'INTERNAL_ERROR' }, 500)
    );

    const { result } = renderHook(() => useDiscovery(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.creators).toEqual([]);
  });
});
