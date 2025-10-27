import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useContent } from '../useContent';

// Mock fetch
global.fetch = jest.fn();

describe('useContent', () => {
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

  it('should fetch content with infinite query', async () => {
    const mockData = {
      content: [
        {
          id: '1',
          creatorId: 'creator1',
          creatorName: 'Creator 1',
          title: 'Test Content',
          content: 'Content body',
          type: 'article',
          tags: ['test'],
          isPremium: false,
          viewCount: 100,
          likeCount: 10,
          zapCount: 5,
          commentCount: 3,
          shareCount: 2,
          status: 'published',
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

    const { result } = renderHook(() => useContent(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0]).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/content?page=1', expect.any(Object));
  });

  it('should handle filters correctly', async () => {
    const mockData = {
      content: [],
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
      creatorId: 'creator1',
      type: 'video' as const,
      category: 'tech',
      tags: ['javascript', 'react'],
      isPremium: true,
      sortBy: 'popular' as const,
    };

    const { result } = renderHook(() => useContent(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/content?page=1&creatorId=creator1&type=video&category=tech&tags=javascript,react&sortBy=popular&isPremium=true',
      expect.any(Object)
    );
  });

  it('should handle pagination with getNextPageParam', async () => {
    const page1 = {
      content: [{ id: '1' }],
      pagination: {
        page: 1,
        limit: 10,
        total: 20,
        totalPages: 2,
      },
    };

    const page2 = {
      content: [{ id: '2' }],
      pagination: {
        page: 2,
        limit: 10,
        total: 20,
        totalPages: 2,
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page2,
      });

    const { result } = renderHook(() => useContent(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    expect(result.current.data?.pages[0]).toEqual(page1);
    expect(result.current.data?.pages[1]).toEqual(page2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useContent(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Failed to fetch content: Internal Server Error');
  });
});