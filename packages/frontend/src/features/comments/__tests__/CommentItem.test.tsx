/**
 * CommentItem Component Tests — T16
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Tests:
 * - Author info and timestamp rendering
 * - Comment text rendered as plain text (no dangerouslySetInnerHTML)
 * - Delete button visible only to owner or content creator
 * - Delete button hidden for strangers
 * - Reply button hidden for replies (isReply=true)
 * - Delete dialog flow: open → confirm → cancel
 * - Reply form toggle
 * - Show/hide replies toggle (only when replyCount > 0)
 * - Replies list rendered as nested ul[role=list]
 * - Two-level threading: reply items don't render reply button
 * - Avatar fallback: initial letter when avatarUrl is null
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CommentWithAuthor } from '@shared/types/comments';

// ============================================================================
// Mocks
// ============================================================================

const mockUseDeleteComment = vi.fn(() => ({ mutate: vi.fn(), isPending: false }));
const mockUseReplies = vi.fn(() => ({ data: undefined, isLoading: false }));
const mockUseCreateComment = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('../hooks/useComments', () => ({
  useDeleteComment: (...args: unknown[]) => mockUseDeleteComment(...args),
  useReplies: (...args: unknown[]) => mockUseReplies(...args),
  useCreateComment: (...args: unknown[]) => mockUseCreateComment(...args),
}));

vi.mock('@/features/auth/services/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null, isLoading: false })),
}));

import { CommentItem } from '../components/CommentItem';

// ============================================================================
// Fixtures
// ============================================================================

const CONTENT_ID = 'content-1';
const USER_ID = 'user-1';
const CREATOR_ID = 'creator-1';

function makeComment(overrides: Partial<CommentWithAuthor> = {}): CommentWithAuthor {
  return {
    id: 'c-1',
    contentId: CONTENT_ID,
    userId: USER_ID,
    parentCommentId: null,
    commentText: 'Hello world',
    status: 'active',
    replyCount: 0,
    createdAt: '2026-03-04T10:00:00Z',
    updatedAt: '2026-03-04T10:00:00Z',
    author: {
      id: USER_ID,
      displayName: 'Alice',
      avatarUrl: null,
      username: 'alice',
    },
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ============================================================================
// Tests
// ============================================================================

describe('CommentItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeleteComment.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseReplies.mockReturnValue({ data: undefined, isLoading: false });
    mockUseCreateComment.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  describe('Content rendering', () => {
    it('renders author display name', () => {
      render(<CommentItem comment={makeComment()} contentId={CONTENT_ID} />, { wrapper });
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('renders comment text as plain text (no XSS)', () => {
      const xssAttempt = '<script>alert(1)</script>';
      render(
        <CommentItem comment={makeComment({ commentText: xssAttempt })} contentId={CONTENT_ID} />,
        { wrapper }
      );

      // Text node should be present as literal string — no script execution
      expect(screen.getByText(xssAttempt)).toBeInTheDocument();
      // Ensure no actual script tag was injected into DOM
      expect(document.querySelector('script')).toBeNull();
    });

    it('renders username @handle when displayName differs from username', () => {
      const comment = makeComment({
        author: {
          id: USER_ID,
          displayName: 'Alice Smith',
          avatarUrl: null,
          username: 'alicesmith',
        },
      });

      render(<CommentItem comment={comment} contentId={CONTENT_ID} />, { wrapper });

      expect(screen.getByText('@alicesmith')).toBeInTheDocument();
    });

    it('renders time element with datetime attribute', () => {
      render(<CommentItem comment={makeComment()} contentId={CONTENT_ID} />, { wrapper });

      const timeEl = document.querySelector('time');
      expect(timeEl).not.toBeNull();
      expect(timeEl!.getAttribute('dateTime')).toBe('2026-03-04T10:00:00Z');
    });

    it('renders avatar fallback initial when avatarUrl is null', () => {
      render(<CommentItem comment={makeComment()} contentId={CONTENT_ID} />, { wrapper });

      // The initial div has aria-hidden — look via text content
      expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('A');
    });

    it('renders avatar img when avatarUrl is set', () => {
      const comment = makeComment({
        author: {
          id: USER_ID,
          displayName: 'Alice',
          avatarUrl: 'https://example.com/alice.jpg',
          username: 'alice',
        },
      });

      render(<CommentItem comment={comment} contentId={CONTENT_ID} />, { wrapper });

      const img = screen.getByRole('img');
      expect(img.getAttribute('src')).toBe('https://example.com/alice.jpg');
    });
  });

  describe('Delete button visibility', () => {
    it('shows delete button for comment owner', () => {
      render(
        <CommentItem comment={makeComment()} contentId={CONTENT_ID} currentUserId={USER_ID} />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /delete comment by alice/i })).toBeInTheDocument();
    });

    it('shows delete button for content creator', () => {
      render(
        <CommentItem
          comment={makeComment({ userId: 'other-user' })}
          contentId={CONTENT_ID}
          currentUserId={CREATOR_ID}
          contentCreatorId={CREATOR_ID}
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
    });

    it('hides delete button for non-owner non-creator', () => {
      render(
        <CommentItem
          comment={makeComment()}
          contentId={CONTENT_ID}
          currentUserId="stranger"
          contentCreatorId="original-creator"
        />,
        { wrapper }
      );

      expect(screen.queryByRole('button', { name: /delete comment/i })).not.toBeInTheDocument();
    });

    it('hides delete button when currentUserId is undefined', () => {
      render(<CommentItem comment={makeComment()} contentId={CONTENT_ID} />, { wrapper });

      expect(screen.queryByRole('button', { name: /delete comment/i })).not.toBeInTheDocument();
    });
  });

  describe('Delete dialog', () => {
    it('opens delete dialog on delete button click', () => {
      render(
        <CommentItem comment={makeComment()} contentId={CONTENT_ID} currentUserId={USER_ID} />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /delete comment by alice/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/delete comment\?/i)).toBeInTheDocument();
    });

    it('closes dialog on Cancel click', () => {
      render(
        <CommentItem comment={makeComment()} contentId={CONTENT_ID} currentUserId={USER_ID} />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /delete comment by alice/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls deleteComment mutation on Confirm click', () => {
      const mockMutate = vi.fn();
      mockUseDeleteComment.mockReturnValue({ mutate: mockMutate, isPending: false });

      render(
        <CommentItem comment={makeComment()} contentId={CONTENT_ID} currentUserId={USER_ID} />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /delete comment by alice/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

      expect(mockMutate).toHaveBeenCalledWith('c-1', expect.any(Object));
    });

    it('shows aria-busy on confirm button while deleting', () => {
      mockUseDeleteComment.mockReturnValue({ mutate: vi.fn(), isPending: true });

      render(
        <CommentItem comment={makeComment()} contentId={CONTENT_ID} currentUserId={USER_ID} />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /delete comment by alice/i }));

      const confirmBtn = screen.getByRole('button', { name: /deleting/i });
      expect(confirmBtn.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('Reply button', () => {
    it('shows reply button for top-level comment', () => {
      render(<CommentItem comment={makeComment()} contentId={CONTENT_ID} />, { wrapper });

      expect(screen.getByRole('button', { name: /reply to alice/i })).toBeInTheDocument();
    });

    it('hides reply button for reply items (two-level enforcement)', () => {
      render(
        <CommentItem
          comment={makeComment({ parentCommentId: 'parent-1' })}
          contentId={CONTENT_ID}
          isReply
        />,
        { wrapper }
      );

      expect(screen.queryByRole('button', { name: /reply to/i })).not.toBeInTheDocument();
    });

    it('toggles inline reply form on reply button click', () => {
      render(<CommentItem comment={makeComment()} contentId={CONTENT_ID} />, { wrapper });

      fireEvent.click(screen.getByRole('button', { name: /reply to alice/i }));

      expect(screen.getByLabelText(/reply to alice/i)).toBeInTheDocument();
    });
  });

  describe('Show/hide replies', () => {
    it('shows replies toggle button when replyCount > 0', () => {
      render(<CommentItem comment={makeComment({ replyCount: 3 })} contentId={CONTENT_ID} />, {
        wrapper,
      });

      expect(screen.getByRole('button', { name: /show 3 replies/i })).toBeInTheDocument();
    });

    it('hides replies toggle when replyCount is 0', () => {
      render(<CommentItem comment={makeComment({ replyCount: 0 })} contentId={CONTENT_ID} />, {
        wrapper,
      });

      expect(screen.queryByRole('button', { name: /replies/i })).not.toBeInTheDocument();
    });

    it('renders loaded replies as nested ul[role=list]', () => {
      const reply = makeComment({
        id: 'reply-1',
        parentCommentId: 'c-1',
        commentText: 'Nice!',
        author: { id: 'user-2', displayName: 'Bob', avatarUrl: null, username: 'bob' },
      });

      mockUseReplies.mockReturnValue({
        data: { items: [reply], pagination: { page: 1, limit: 50, total: 1, hasNext: false } },
        isLoading: false,
      });

      render(<CommentItem comment={makeComment({ replyCount: 1 })} contentId={CONTENT_ID} />, {
        wrapper,
      });

      fireEvent.click(screen.getByRole('button', { name: /show 1 reply/i }));

      const replyList = screen.getByRole('list', { name: /replies to alice/i });
      expect(replyList).toBeInTheDocument();
      expect(replyList.querySelectorAll('li')).toHaveLength(1);
    });

    it('shows loading state while fetching replies', () => {
      mockUseReplies.mockReturnValue({ data: undefined, isLoading: true });

      render(<CommentItem comment={makeComment({ replyCount: 2 })} contentId={CONTENT_ID} />, {
        wrapper,
      });

      fireEvent.click(screen.getByRole('button', { name: /show 2 replies/i }));

      expect(screen.getByRole('status', { name: /loading replies/i })).toBeInTheDocument();
    });

    it('toggles aria-expanded on show/hide replies button', () => {
      mockUseReplies.mockReturnValue({
        data: { items: [], pagination: { page: 1, limit: 50, total: 0, hasNext: false } },
        isLoading: false,
      });

      render(<CommentItem comment={makeComment({ replyCount: 1 })} contentId={CONTENT_ID} />, {
        wrapper,
      });

      const toggleBtn = screen.getByRole('button', { name: /show 1 reply/i });
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    });
  });
});
