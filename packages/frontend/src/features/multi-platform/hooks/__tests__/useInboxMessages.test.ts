import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useInboxMessages } from '../useInboxMessages';
import { inboxApi } from '../../services/inboxApi';

jest.mock('../../services/inboxApi', () => ({
  inboxApi: {
    getMessages: jest.fn(),
  },
}));

const mockGetMessages = inboxApi.getMessages as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useInboxMessages', () => {
  const mockResponse = {
    success: true,
    data: {
      messages: [
        {
          id: 'msg-1',
          platform: 'mastodon',
          author: '@alice',
          content: 'Hello',
          type: 'mention',
          is_read: false,
          created_at: '2026-02-18T00:00:00Z',
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
    mockGetMessages.mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls inboxApi.getMessages with correct params', async () => {
    const { result } = renderHook(
      () => useInboxMessages({ platform: 'mastodon', status: 'unread', page: 2, limit: 10 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetMessages).toHaveBeenCalledWith({
      platform: 'mastodon',
      sentiment: undefined,
      priority: undefined,
      status: 'unread',
      page: 2,
      limit: 10,
    });
  });

  it('returns messages data on success', async () => {
    const { result } = renderHook(() => useInboxMessages({}), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.messages).toHaveLength(1);
    expect(result.current.data?.messages[0].id).toBe('msg-1');
  });

  it('includes all filter params including sentiment and priority', async () => {
    const { result } = renderHook(
      () =>
        useInboxMessages({
          platform: 'twitter',
          sentiment: 'positive',
          priority: 'high',
          status: 'unread',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'twitter',
        sentiment: 'positive',
        priority: 'high',
        status: 'unread',
      })
    );
  });

  it('returns loading state initially', () => {
    mockGetMessages.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useInboxMessages({}), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
  });

  it('returns error state on API failure', async () => {
    mockGetMessages.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useInboxMessages({}), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
