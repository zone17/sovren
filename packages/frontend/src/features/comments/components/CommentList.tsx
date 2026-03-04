/**
 * CommentList — renders paginated top-level comments for a content item.
 *
 * Accessibility:
 * - <section aria-labelledby> with <h2> for heading-based navigation
 * - <ul role="list"> for screen reader count announcement
 * - aria-live="polite" region for new comment announcements
 * - Loading spinner has role="status" with visible label
 * - Error state uses role="alert"
 */

import { useState } from 'react';
import { useComments } from '../hooks/useComments';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

interface CommentListProps {
  contentId: string;
  currentUserId?: string;
  contentCreatorId?: string;
}

export function CommentList({ contentId, currentUserId, contentCreatorId }: CommentListProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useComments(contentId, { page });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <section aria-labelledby="comments-heading" className="mt-8">
      <h2 id="comments-heading" className="text-xl font-semibold text-gray-900 mb-4">
        Comments
        {pagination && pagination.total > 0 && (
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({pagination.total})
          </span>
        )}
      </h2>

      {/* Comment form for authenticated users */}
      <div className="mb-6">
        <CommentForm contentId={contentId} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading comments..."
          className="flex items-center justify-center py-8 text-gray-500"
        >
          <svg
            className="animate-spin h-6 w-6 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Loading comments...</span>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3"
        >
          <p className="text-sm text-red-700 flex-1">
            Failed to load comments. Please try again.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-sm font-medium text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && items.length === 0 && (
        <p className="text-gray-500 text-sm py-4">No comments yet. Be the first to comment!</p>
      )}

      {/* Comment list */}
      {!isLoading && !isError && items.length > 0 && (
        <>
          {/* aria-live region announces new comments without disrupting reading */}
          <div aria-live="polite" aria-atomic="false" className="sr-only" id="comments-live-region" />

          <ul role="list" aria-label="Comments" className="space-y-4">
            {items.map((comment) => (
              <li key={comment.id}>
                <CommentItem
                  comment={comment}
                  contentId={contentId}
                  currentUserId={currentUserId}
                  contentCreatorId={contentCreatorId}
                />
              </li>
            ))}
          </ul>

          {/* Load more pagination */}
          {pagination?.hasNext && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Load more comments
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
