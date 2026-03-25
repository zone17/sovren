/**
 * CommentForm — textarea + submit with double-submit prevention, char counter, and anon state.
 *
 * Accessibility:
 * - <label htmlFor> explicitly associated with textarea
 * - Character counter has stable id with aria-describedby on textarea
 * - Submit button: disabled={isPending} AND aria-busy={isPending}
 * - Focus returns to textarea after successful submit
 * - Sign-in prompt is a link/button, not just text
 * - All interactive elements are native <button>
 *
 * Security: NEVER uses dangerouslySetInnerHTML (ESLint rule enforces this).
 */

import { useRef, useState } from 'react';
import { useAuth } from '@/features/auth/services/AuthContext';
import { useCreateComment } from '../hooks/useComments';

const MAX_CHARS = 2000;
const COUNTER_ID = 'comment-char-counter';

interface CommentFormProps {
  contentId: string;
  parentCommentId?: string;
  parentAuthorName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CommentForm({
  contentId,
  parentCommentId,
  parentAuthorName,
  onSuccess,
  onCancel,
}: CommentFormProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [text, setText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Double-submit prevention — common-solutions.md #1
  const isSubmittingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { mutateAsync: createComment, isPending } = useCreateComment(contentId);

  const isAnonymous = !authLoading && !user;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = text.trim().length === 0;
  const canSubmit = !isEmpty && !isOverLimit && !isPending;

  const isReply = Boolean(parentCommentId);
  const inputId = isReply ? `reply-input-${parentCommentId}` : 'comment-input';
  const labelText = isReply ? `Reply to ${parentAuthorName ?? 'comment'}` : 'Add a comment';
  const submitLabel = isReply
    ? `Post reply${parentAuthorName ? ` to ${parentAuthorName}` : ''}`
    : 'Post comment';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Double-submit guard — useRef prevents re-entrancy across renders
    if (isSubmittingRef.current || !canSubmit) return;
    isSubmittingRef.current = true;

    try {
      setSubmitError(null);
      await createComment({
        commentText: text,
        parentCommentId,
      });
      setText('');
      onSuccess?.();
      // Return focus to textarea after successful submit
      textareaRef.current?.focus();
    } catch {
      setSubmitError('Failed to post comment. Please try again.');
      textareaRef.current?.focus();
    } finally {
      isSubmittingRef.current = false;
    }
  }

  // Anonymous state — show sign-in prompt instead of form
  if (isAnonymous) {
    return (
      <div className="glass rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">
          <a
            href="/login"
            className="font-medium text-purple-400 hover:text-purple-300 underline transition-colors duration-150"
          >
            Sign in to comment
          </a>
        </p>
      </div>
    );
  }

  // Loading auth state — don't render form until auth is resolved
  if (authLoading) return null;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {labelText}
        </label>

        <div className="relative">
          <textarea
            ref={textareaRef}
            id={inputId}
            name="comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={isReply ? 3 : 4}
            maxLength={MAX_CHARS + 1}
            placeholder={isReply ? 'Write a reply...' : 'Write a comment...'}
            aria-describedby={COUNTER_ID}
            aria-required="true"
            aria-invalid={isOverLimit}
            className={[
              'w-full rounded-lg border px-3 py-2 text-sm text-foreground bg-background resize-none transition-colors duration-150',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2',
              isOverLimit
                ? 'border-red-400 focus:ring-red-400'
                : 'border-border focus:ring-purple-500',
            ].join(' ')}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Character counter — stable id so aria-describedby is always valid */}
          <span
            id={COUNTER_ID}
            aria-live="polite"
            aria-atomic="true"
            className={`text-xs ${
              isOverLimit
                ? 'text-red-600 font-medium'
                : charCount > MAX_CHARS * 0.9
                  ? 'text-purple-400'
                  : 'text-muted-foreground'
            }`}
          >
            {charCount}/{MAX_CHARS}
            {isOverLimit && <span className="sr-only"> — over character limit</span>}
          </span>

          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={isPending}
              aria-label={submitLabel}
              className={[
                'px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-150',
                canSubmit
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-[0_4px_16px_rgba(139,92,246,0.3)] focus:ring-2 focus:ring-purple-500'
                  : 'bg-card text-muted-foreground cursor-not-allowed',
              ].join(' ')}
            >
              {isPending ? 'Posting...' : isReply ? 'Post reply' : 'Post comment'}
            </button>
          </div>
        </div>

        {/* Submit error */}
        {submitError && (
          <p role="alert" className="text-sm text-red-600">
            {submitError}
          </p>
        )}
      </div>
    </form>
  );
}
