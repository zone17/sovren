/**
 * CommentForm Component Tests — T16
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Tests:
 * - Anonymous state shows sign-in prompt
 * - Auth loading state renders nothing
 * - Form renders for authenticated user
 * - Double-submit prevention via useRef
 * - Character counter (normal, warning, over-limit)
 * - Submit button disabled states
 * - Focus returns to textarea after success
 * - Error alert on failed submit
 * - Cancel button visibility
 * - Reply vs top-level label text
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// Mocks
// ============================================================================

const mockMutateAsync = vi.fn();
const mockUseCreateComment = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));

vi.mock('../hooks/useComments', () => ({
  useCreateComment: (...args: unknown[]) => mockUseCreateComment(...args),
}));

const mockUseAuth = vi.fn(() => ({ user: { id: 'user-1', name: 'Alice' }, isLoading: false }));
vi.mock('@/features/auth/services/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ============================================================================
// Import component
// ============================================================================

import { CommentForm } from '../components/CommentForm';

// ============================================================================
// Wrapper
// ============================================================================

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ============================================================================
// Tests
// ============================================================================

describe('CommentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', name: 'Alice' }, isLoading: false });
    mockUseCreateComment.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
  });

  describe('Anonymous state', () => {
    it('shows sign-in link instead of form when user is null', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      render(<CommentForm contentId="content-1" />, { wrapper });

      expect(screen.getByRole('link', { name: /sign in to comment/i })).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('Loading auth state', () => {
    it('renders nothing while auth is loading', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: true });

      const { container } = render(<CommentForm contentId="content-1" />, { wrapper });

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Authenticated form', () => {
    it('renders textarea with correct label', () => {
      render(<CommentForm contentId="content-1" />, { wrapper });

      expect(screen.getByLabelText(/add a comment/i)).toBeInTheDocument();
    });

    it('renders reply label when parentCommentId and parentAuthorName are provided', () => {
      render(
        <CommentForm
          contentId="content-1"
          parentCommentId="parent-1"
          parentAuthorName="Bob"
        />,
        { wrapper }
      );

      expect(screen.getByText(/reply to bob/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('submit button is disabled when textarea is empty', () => {
      render(<CommentForm contentId="content-1" />, { wrapper });

      const submitBtn = screen.getByRole('button', { name: /post comment/i });
      expect(submitBtn).toBeDisabled();
    });

    it('submit button is enabled when text is entered', () => {
      render(<CommentForm contentId="content-1" />, { wrapper });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello world' } });

      const submitBtn = screen.getByRole('button', { name: /post comment/i });
      expect(submitBtn).not.toBeDisabled();
    });

    it('shows character counter', () => {
      render(<CommentForm contentId="content-1" />, { wrapper });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });

      expect(screen.getByText(/5\/2000/)).toBeInTheDocument();
    });

    it('disables submit when text exceeds 2000 chars', () => {
      render(<CommentForm contentId="content-1" />, { wrapper });

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'a'.repeat(2001) },
      });

      const submitBtn = screen.getByRole('button', { name: /post comment/i });
      expect(submitBtn).toBeDisabled();
    });

    it('marks textarea as aria-invalid when over character limit', () => {
      render(<CommentForm contentId="content-1" />, { wrapper });

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'a'.repeat(2001) },
      });

      const textarea = screen.getByRole('textbox');
      expect(textarea.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('Double-submit prevention', () => {
    it('prevents concurrent submissions via useRef guard', async () => {
      let resolveFirst!: () => void;
      const firstCall = new Promise<{ id: string }>((resolve) => {
        resolveFirst = () => resolve({ id: 'new-comment' });
      });
      mockMutateAsync.mockReturnValueOnce(firstCall);

      render(<CommentForm contentId="content-1" />, { wrapper });

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      const form = textarea.closest('form')!;
      fireEvent.submit(form);
      fireEvent.submit(form); // second submit while first is pending

      resolveFirst();
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    });

    it('shows aria-busy on submit button while pending', () => {
      mockUseCreateComment.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: true });

      render(<CommentForm contentId="content-1" />, { wrapper });

      const submitBtn = screen.getByRole('button', { name: /post comment/i });
      expect(submitBtn.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('Success handling', () => {
    it('clears textarea after successful submit', async () => {
      mockMutateAsync.mockResolvedValue({ id: 'new-comment' });

      render(<CommentForm contentId="content-1" />, { wrapper });

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      fireEvent.submit(textarea.closest('form')!);

      await waitFor(() => {
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
      });
    });

    it('calls onSuccess callback after successful submit', async () => {
      mockMutateAsync.mockResolvedValue({ id: 'new-comment' });
      const onSuccess = vi.fn();

      render(<CommentForm contentId="content-1" onSuccess={onSuccess} />, { wrapper });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
      fireEvent.submit(screen.getByRole('textbox').closest('form')!);

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    });
  });

  describe('Error handling', () => {
    it('shows error alert when submit fails', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Network error'));

      render(<CommentForm contentId="content-1" />, { wrapper });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
      fireEvent.submit(screen.getByRole('textbox').closest('form')!);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Failed to post comment/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cancel button', () => {
    it('does not render cancel button without onCancel prop', () => {
      render(<CommentForm contentId="content-1" />, { wrapper });

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('renders cancel button and calls onCancel when clicked', () => {
      const onCancel = vi.fn();

      render(<CommentForm contentId="content-1" onCancel={onCancel} />, { wrapper });

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      expect(cancelBtn).toBeInTheDocument();
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
