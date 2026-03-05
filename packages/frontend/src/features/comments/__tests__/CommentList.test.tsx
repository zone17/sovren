/**
 * CommentList Component Tests — T16
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Tests:
 * - Loading, error, empty, and populated states
 * - ARIA roles and landmark structure (section, ul[role=list], role=status, role=alert)
 * - Pagination controls
 * - Retry button on error
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// Mock hooks and child components
// ============================================================================

const mockUseComments = vi.fn();
const mockRefetch = vi.fn();

vi.mock('../hooks/useComments', () => ({
  useComments: (...args: unknown[]) => mockUseComments(...args),
  useCreateComment: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteComment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useReplies: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('@/features/auth/services/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null, isLoading: false })),
}));

// ============================================================================
// Import component (after mocks are set)
// ============================================================================

import { CommentList } from '../components/CommentList';

// ============================================================================
// Fixtures
// ============================================================================

function makeComment(overrides = {}) {
  return {
    id: 'c-1',
    contentId: 'content-1',
    userId: 'user-1',
    parentCommentId: null,
    commentText: 'Hello world',
    status: 'active' as const,
    replyCount: 0,
    createdAt: '2026-03-04T10:00:00Z',
    updatedAt: '2026-03-04T10:00:00Z',
    author: {
      id: 'user-1',
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

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
  });

  describe('Loading state', () => {
    it('renders loading spinner with role=status', () => {
      mockUseComments.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading comments...')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('renders error message with role=alert', () => {
      mockUseComments.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load comments/i)).toBeInTheDocument();
    });

    it('retry button calls refetch', () => {
      mockUseComments.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty state', () => {
    it('renders empty state message when no comments', () => {
      mockUseComments.mockReturnValue({
        data: { items: [], pagination: { page: 1, limit: 20, total: 0, hasNext: false } },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      expect(screen.getByText(/No comments yet/i)).toBeInTheDocument();
    });
  });

  describe('Populated state', () => {
    it('renders comment list as ul[role=list]', () => {
      mockUseComments.mockReturnValue({
        data: {
          items: [makeComment(), makeComment({ id: 'c-2', commentText: 'World' })],
          pagination: { page: 1, limit: 20, total: 2, hasNext: false },
        },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      const list = screen.getByRole('list', { name: /Comments/i });
      expect(list).toBeInTheDocument();
      expect(list.querySelectorAll('li')).toHaveLength(2);
    });

    it('displays total count in heading', () => {
      mockUseComments.mockReturnValue({
        data: {
          items: [makeComment()],
          pagination: { page: 1, limit: 20, total: 42, hasNext: false },
        },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      expect(screen.getByText('(42)')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('renders "Load more" button when hasNext is true', () => {
      mockUseComments.mockReturnValue({
        data: {
          items: [makeComment()],
          pagination: { page: 1, limit: 20, total: 50, hasNext: true },
        },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      expect(screen.getByRole('button', { name: /load more comments/i })).toBeInTheDocument();
    });

    it('does not render "Load more" when hasNext is false', () => {
      mockUseComments.mockReturnValue({
        data: {
          items: [makeComment()],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      expect(screen.queryByRole('button', { name: /load more comments/i })).not.toBeInTheDocument();
    });

    it('increments page on "Load more" click', () => {
      // First call returns page 1, subsequent calls can track the page arg
      mockUseComments.mockReturnValue({
        data: {
          items: [makeComment()],
          pagination: { page: 1, limit: 20, total: 50, hasNext: true },
        },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });
      fireEvent.click(screen.getByRole('button', { name: /load more comments/i }));

      // After click, useComments should be called with page=2
      const calls = mockUseComments.mock.calls;
      const lastCallPage = calls[calls.length - 1][1]?.page;
      expect(lastCallPage).toBe(2);
    });
  });

  describe('Accessibility', () => {
    it('section has aria-labelledby pointing to comments heading', () => {
      mockUseComments.mockReturnValue({
        data: { items: [], pagination: { page: 1, limit: 20, total: 0, hasNext: false } },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

      render(<CommentList contentId="content-1" />, { wrapper });

      const section = screen.getByRole('region', { name: /comments/i });
      expect(section.getAttribute('aria-labelledby')).toBe('comments-heading');
    });
  });
});
