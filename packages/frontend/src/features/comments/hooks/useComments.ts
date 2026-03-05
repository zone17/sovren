/**
 * Comments React Query hooks
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Patterns applied:
 * - common-solutions.md #58: keepPreviousData gated to page changes only
 * - common-solutions.md #1: double-submit prevention is in CommentForm (useRef + disabled)
 * - D9: useCreateComment uses UI approach (isPending + variables), useDeleteComment uses cache approach
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { commentKeys } from '@/hooks/query-keys';
import type { CommentWithAuthor, CreateCommentBody } from '@shared/types/comments';
import { commentsApi } from '../services/commentsApi';

const STALE_TIME = 30_000; // 30s — comments change frequently
const GC_TIME = 5 * 60_000; // 5 min

// ---------------------------------------------------------------------------
// useComments — paginated list of top-level comments for a content item
// ---------------------------------------------------------------------------

export function useComments(contentId: string, { page = 1 }: { page?: number } = {}) {
  const prevPageRef = useRef(page);
  const isPageChange = prevPageRef.current !== page;
  prevPageRef.current = page;

  return useQuery({
    queryKey: commentKeys.list(contentId, { page }),
    queryFn: () => commentsApi.listComments(contentId, { page }),
    // Gate keepPreviousData to page changes only — not filter/sort changes (common #58)
    placeholderData: isPageChange ? keepPreviousData : undefined,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ---------------------------------------------------------------------------
// useReplies — lazy-loaded replies for a specific top-level comment
// ---------------------------------------------------------------------------

export function useReplies(commentId: string, { enabled = false }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: commentKeys.replies(commentId),
    queryFn: () => commentsApi.listReplies(commentId, { page: 1, limit: 50 }),
    enabled: Boolean(commentId) && enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ---------------------------------------------------------------------------
// useCreateComment — UI-based optimistic insert (D9)
// Optimistic item is rendered from `variables` while `isPending` is true.
// No cache manipulation required — list invalidation on success pulls fresh data.
// ---------------------------------------------------------------------------

export function useCreateComment(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCommentBody) => commentsApi.createComment(contentId, payload),
    onSuccess: () => {
      // Invalidate the full content key to refresh all comment lists and counts
      queryClient.invalidateQueries({ queryKey: commentKeys.byContent(contentId) });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteComment — cache-based optimistic delete with snapshot rollback (D9)
// Immediately removes the comment from the cache; restores on error.
// ---------------------------------------------------------------------------

export function useDeleteComment(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => commentsApi.deleteComment(commentId),

    onMutate: async (commentId: string) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: commentKeys.byContent(contentId) });

      // Snapshot ALL cached comment pages for this content so we can roll back every page
      const snapshots = queryClient.getQueriesData<{ items: CommentWithAuthor[] }>({
        queryKey: commentKeys.byContent(contentId),
      });

      // Optimistically remove the comment from every cached page
      queryClient.setQueriesData<{ items: CommentWithAuthor[] }>(
        { queryKey: commentKeys.byContent(contentId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((c) => c.id !== commentId),
          };
        }
      );

      return { snapshots };
    },

    onError: (_err, _commentId, context) => {
      // Restore ALL page snapshots on error
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
    },

    onSettled: () => {
      // Always refetch to ensure server state is canonical
      queryClient.invalidateQueries({ queryKey: commentKeys.byContent(contentId) });
    },
  });
}
