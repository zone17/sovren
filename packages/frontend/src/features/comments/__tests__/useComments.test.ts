/**
 * Comments Hooks Tests — T17
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Tests: useComments, useReplies, useCreateComment, useDeleteComment
 *
 * Patterns:
 * - Use @testing-library/react renderHook with QueryClientProvider wrapper
 * - Test optimistic delete with snapshot rollback on error
 * - Test cache invalidation on create success
 * - Test keepPreviousData gating (only on page change)
 * - Test useReplies enabled flag
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { CommentWithAuthor, CommentsPaginatedResponse } from '@shared/types/comments';

// ============================================================================
// Mock commentsApi
// ============================================================================

const mockListComments = vi.fn();
const mockListReplies = vi.fn();
const mockCreateComment = vi.fn();
const mockDeleteComment = vi.fn();

vi.mock('../services/commentsApi', () => ({
  commentsApi: {
    listComments: (...args: unknown[]) => mockListComments(...args),
    listReplies: (...args: unknown[]) => mockListReplies(...args),
    createComment: (...args: unknown[]) => mockCreateComment(...args),
    deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  },
}));

// ============================================================================
// Import hooks after mocks
// ============================================================================

import { useComments, useReplies, useCreateComment, useDeleteComment } from '../hooks/useComments';

// ============================================================================
// Fixtures
// ============================================================================

const CONTENT_ID = 'content-1';
const COMMENT_ID = 'c-1';

function makeComment(id = COMMENT_ID): CommentWithAuthor {
  return {
    id,
    contentId: CONTENT_ID,
    userId: 'user-1',
    parentCommentId: null,
    commentText: 'Hello',
    status: 'active',
    replyCount: 0,
    createdAt: '2026-03-04T10:00:00Z',
    updatedAt: '2026-03-04T10:00:00Z',
    author: { id: 'user-1', displayName: 'Alice', avatarUrl: null, username: 'alice' },
  };
}

function makePaginatedResponse(items: CommentWithAuthor[]): CommentsPaginatedResponse {
  return {
    items,
    pagination: { page: 1, limit: 20, total: items.length, hasNext: false },
  };
}

// ============================================================================
// Wrapper factory — fresh QueryClient per test to avoid state bleed
// ============================================================================

function makeWrapper(qc?: QueryClient) {
  const client = qc ?? new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return { wrapper: Wrapper, queryClient: client };
}

// ============================================================================
// Tests: useComments
// ============================================================================

describe('useComments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches comments and returns data', async () => {
    const data = makePaginatedResponse([makeComment()]);
    mockListComments.mockResolvedValue(data);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useComments(CONTENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].id).toBe(COMMENT_ID);
  });

  it('calls commentsApi.listComments with contentId and page', async () => {
    mockListComments.mockResolvedValue(makePaginatedResponse([]));

    const { wrapper } = makeWrapper();
    renderHook(() => useComments(CONTENT_ID, { page: 2 }), { wrapper });

    await waitFor(() => expect(mockListComments).toHaveBeenCalledWith(CONTENT_ID, { page: 2 }));
  });

  it('exposes isLoading true during fetch', () => {
    mockListComments.mockReturnValue(new Promise(() => {})); // never resolves

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useComments(CONTENT_ID), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('exposes isError true on fetch failure', async () => {
    mockListComments.mockRejectedValue(new Error('Network error'));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useComments(CONTENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ============================================================================
// Tests: useReplies
// ============================================================================

describe('useReplies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not fetch when enabled=false', () => {
    mockListReplies.mockResolvedValue(makePaginatedResponse([]));

    const { wrapper } = makeWrapper();
    renderHook(() => useReplies(COMMENT_ID, { enabled: false }), { wrapper });

    expect(mockListReplies).not.toHaveBeenCalled();
  });

  it('fetches when enabled=true', async () => {
    const data = makePaginatedResponse([makeComment('reply-1')]);
    mockListReplies.mockResolvedValue(data);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useReplies(COMMENT_ID, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('does not fetch when commentId is empty string', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useReplies('', { enabled: true }), { wrapper });

    expect(mockListReplies).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: useCreateComment
// ============================================================================

describe('useCreateComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls commentsApi.createComment on mutate', async () => {
    const created = makeComment('new-c');
    mockCreateComment.mockResolvedValue(created);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateComment(CONTENT_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ commentText: 'Hello!' });
    });

    expect(mockCreateComment).toHaveBeenCalledWith(CONTENT_ID, { commentText: 'Hello!' });
  });

  it('invalidates byContent query key on success', async () => {
    mockCreateComment.mockResolvedValue(makeComment('new-c'));

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateComment(CONTENT_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ commentText: 'Hello' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['comments', 'content', CONTENT_ID]),
      })
    );
  });

  it('exposes isPending true during mutation', async () => {
    let resolveCreate!: (c: CommentWithAuthor) => void;
    mockCreateComment.mockReturnValue(
      new Promise<CommentWithAuthor>((res) => { resolveCreate = res; })
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateComment(CONTENT_ID), { wrapper });

    act(() => {
      void result.current.mutateAsync({ commentText: 'Hello' });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    resolveCreate(makeComment());
  });
});

// ============================================================================
// Tests: useDeleteComment
// ============================================================================

describe('useDeleteComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls commentsApi.deleteComment on mutate', async () => {
    mockDeleteComment.mockResolvedValue(undefined);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteComment(CONTENT_ID), { wrapper });

    await act(async () => {
      result.current.mutate(COMMENT_ID);
    });

    await waitFor(() => expect(mockDeleteComment).toHaveBeenCalledWith(COMMENT_ID));
  });

  it('optimistically removes comment from cache on mutate start', async () => {
    const comment = makeComment();
    const { wrapper, queryClient } = makeWrapper();

    // Pre-populate the cache with a page-1 list
    const { commentKeys } = await import('@/hooks/query-keys');
    queryClient.setQueryData(commentKeys.list(CONTENT_ID, {}), makePaginatedResponse([comment]));

    // Block the delete so we can inspect cache mid-flight
    let resolveFn!: () => void;
    mockDeleteComment.mockReturnValue(new Promise<void>((res) => { resolveFn = res; }));

    const { result } = renderHook(() => useDeleteComment(CONTENT_ID), { wrapper });

    act(() => {
      result.current.mutate(COMMENT_ID);
    });

    // Cache should have the comment removed before the API call resolves
    await waitFor(() => {
      const cached = queryClient.getQueryData<CommentsPaginatedResponse>(
        commentKeys.list(CONTENT_ID, {})
      );
      expect(cached?.items.find((c) => c.id === COMMENT_ID)).toBeUndefined();
    });

    resolveFn();
  });

  it('restores snapshot on delete failure', async () => {
    const comment = makeComment();
    const { wrapper, queryClient } = makeWrapper();

    const { commentKeys } = await import('@/hooks/query-keys');
    queryClient.setQueryData(commentKeys.list(CONTENT_ID, {}), makePaginatedResponse([comment]));

    mockDeleteComment.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useDeleteComment(CONTENT_ID), { wrapper });

    await act(async () => {
      result.current.mutate(COMMENT_ID);
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<CommentsPaginatedResponse>(
        commentKeys.list(CONTENT_ID, {})
      );
      // Comment should be restored after failure
      expect(cached?.items.find((c) => c.id === COMMENT_ID)).toBeDefined();
    });
  });

  it('invalidates byContent queries on settled (success)', async () => {
    mockDeleteComment.mockResolvedValue(undefined);

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteComment(CONTENT_ID), { wrapper });

    await act(async () => {
      result.current.mutate(COMMENT_ID);
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['comments', 'content', CONTENT_ID]),
        })
      )
    );
  });

  it('invalidates byContent queries on settled (failure)', async () => {
    mockDeleteComment.mockRejectedValue(new Error('Delete failed'));

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteComment(CONTENT_ID), { wrapper });

    await act(async () => {
      result.current.mutate(COMMENT_ID);
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['comments', 'content', CONTENT_ID]),
        })
      )
    );
  });
});
