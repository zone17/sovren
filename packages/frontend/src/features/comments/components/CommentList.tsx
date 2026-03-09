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
import { Spinner } from '../../../components/ui/spinner';
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
  const { data, isLoading, isFetching, isError, refetch } = useComments(contentId, { page });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <section aria-labelledby="comments-heading" className="mt-8">
      <h2 id="comments-heading" className="text-xl font-semibold text-foreground mb-4 font-display">
        Comments
        {pagination && pagination.total > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
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
          className="flex items-center justify-center py-8 text-muted-foreground"
        >
          <Spinner size="md" className="mr-2" />
          <span>Loading comments...</span>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3"
        >
          <p className="text-sm text-red-700 flex-1">Failed to load comments. Please try again.</p>
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
        <p className="text-muted-foreground text-sm py-4">
          No comments yet. Be the first to comment!
        </p>
      )}

      {/* Comment list */}
      {!isLoading && !isError && items.length > 0 && (
        <>
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

          {/* Background fetch indicator (#638) */}
          {isFetching && !isLoading && (
            <div role="status" className="mt-3 flex justify-center">
              <span className="text-xs text-muted-foreground">Updating comments...</span>
            </div>
          )}

          {/* Load more pagination */}
          {pagination?.hasNext && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
                className="px-4 py-2 text-sm font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 transition-colors duration-150"
              >
                {isFetching ? 'Loading...' : 'Load more comments'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
