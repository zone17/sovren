/**
 * CommentItem — single comment with author info, reply toggle, delete button.
 *
 * Accessibility:
 * - Delete button: contextual aria-label (e.g., "Delete comment by {author}")
 * - Reply button: contextual aria-label (e.g., "Reply to {author}")
 * - Replies rendered as nested <ul> inside parent <li> (semantic nesting)
 * - Delete dialog: focus trap + focus return to trigger on cancel
 * - Relative timestamps include full date in <time datetime="{ISO}"> for screen readers
 *
 * Security:
 * - NEVER uses dangerouslySetInnerHTML — React default text node escaping handles XSS
 * - commentText is always rendered as a plain text node via {comment.commentText}
 */

import { useEffect, useRef, useState } from 'react';
import type { CommentWithAuthor } from '@shared/types/comments';
import { useDeleteComment, useReplies } from '../hooks/useComments';
import { CommentForm } from './CommentForm';

interface CommentItemProps {
  comment: CommentWithAuthor;
  contentId: string;
  currentUserId?: string;
  contentCreatorId?: string;
  /** Prevent recursion: replies do not render their own reply threads */
  isReply?: boolean;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function CommentItem({
  comment,
  contentId,
  currentUserId,
  contentCreatorId,
  isReply = false,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const replyButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { mutate: deleteComment, isPending: isDeleting } = useDeleteComment(contentId);
  const { data: repliesData, isLoading: repliesLoading } = useReplies(comment.id, {
    enabled: showReplies,
  });

  // Focus trap for delete confirmation dialog (#634)
  useEffect(() => {
    if (!showDeleteDialog) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDeleteCancel();
      }
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener('keydown', trap);
    return () => dialog.removeEventListener('keydown', trap);
  }, [showDeleteDialog]);

  const canDelete =
    (currentUserId && currentUserId === comment.userId) ||
    (currentUserId && currentUserId === contentCreatorId);

  const authorName = comment.author.displayName || comment.author.username || 'Anonymous';

  function handleDeleteConfirm() {
    deleteComment(comment.id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        // Focus moves to next sibling or parent region (browser handles DOM removal)
      },
    });
  }

  function handleDeleteCancel() {
    setShowDeleteDialog(false);
    // Return focus to delete trigger button
    deleteButtonRef.current?.focus();
  }

  function handleReplyCancel() {
    setShowReplyForm(false);
    // Return focus to reply trigger
    replyButtonRef.current?.focus();
  }

  return (
    <article className="flex gap-3">
      {/* Author avatar — only render img for http(s) URLs to prevent javascript: XSS (#628) */}
      {comment.author.avatarUrl && /^https?:\/\//i.test(comment.author.avatarUrl) ? (
        <img
          src={comment.author.avatarUrl}
          alt=""
          width={isReply ? 28 : 36}
          height={isReply ? 28 : 36}
          className={`rounded-full object-cover flex-shrink-0 ${isReply ? 'w-7 h-7' : 'w-9 h-9'}`}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0 ${isReply ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'}`}
        >
          {authorName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Author + timestamp header */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{authorName}</span>
          {comment.author.username && comment.author.username !== authorName && (
            <span className="text-xs text-gray-400">@{comment.author.username}</span>
          )}
          <time
            dateTime={comment.createdAt}
            className="text-xs text-gray-400"
            title={new Date(comment.createdAt).toLocaleString()}
          >
            {formatRelativeTime(comment.createdAt)}
          </time>
        </div>

        {/* Comment text — NEVER dangerouslySetInnerHTML; React escapes this automatically */}
        <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">
          {comment.commentText}
        </p>

        {/* Action bar */}
        <div className="mt-2 flex items-center gap-3">
          {/* Reply button — only for top-level comments (max 1 level of nesting) */}
          {!isReply && (
            <button
              ref={replyButtonRef}
              type="button"
              aria-label={`Reply to ${authorName}`}
              onClick={() => setShowReplyForm((v) => !v)}
              className="text-xs text-gray-500 hover:text-amber-700 font-medium transition-colors"
            >
              Reply
            </button>
          )}

          {/* Delete button — visible to comment owner OR content creator */}
          {canDelete && (
            <button
              ref={deleteButtonRef}
              type="button"
              aria-label={`Delete comment by ${authorName}`}
              onClick={() => setShowDeleteDialog(true)}
              className="text-xs text-gray-400 hover:text-red-600 font-medium transition-colors"
            >
              Delete
            </button>
          )}

          {/* Show/hide replies toggle */}
          {!isReply && comment.replyCount > 0 && (
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors"
              aria-expanded={showReplies}
            >
              {showReplies ? 'Hide' : 'Show'} {comment.replyCount}{' '}
              {comment.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {/* Inline reply form */}
        {showReplyForm && (
          <div className="mt-3">
            <CommentForm
              contentId={contentId}
              parentCommentId={comment.id}
              parentAuthorName={authorName}
              onSuccess={() => {
                setShowReplyForm(false);
                setShowReplies(true);
              }}
              onCancel={handleReplyCancel}
            />
          </div>
        )}

        {/* Nested replies — max 1 level deep (isReply=true prevents further nesting) */}
        {showReplies && !isReply && (
          <div className="mt-3">
            {repliesLoading && (
              <div
                role="status"
                aria-label="Loading replies..."
                className="text-xs text-gray-400 py-2"
              >
                Loading replies...
              </div>
            )}
            {repliesData && repliesData.items.length > 0 && (
              <ul role="list" aria-label={`Replies to ${authorName}`} className="space-y-3">
                {repliesData.items.map((reply) => (
                  <li key={reply.id}>
                    <CommentItem
                      comment={reply}
                      contentId={contentId}
                      currentUserId={currentUserId}
                      contentCreatorId={contentCreatorId}
                      isReply
                    />
                  </li>
                ))}
              </ul>
            )}
            {repliesData && repliesData.items.length === 0 && (
              <p className="text-xs text-gray-400">No replies yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-dialog-title-${comment.id}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleDeleteCancel();
          }}
        >
          <div ref={dialogRef} className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3
              id={`delete-dialog-title-${comment.id}`}
              className="text-base font-semibold text-gray-900 mb-2"
            >
              Delete comment?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone. The comment will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                aria-busy={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
