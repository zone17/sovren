import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplyComposer } from '../ReplyComposer';

const mockUseReplyTemplates = vi.fn();

vi.mock('../../hooks/useInboxActions', () => ({
  useReplyTemplates: () => mockUseReplyTemplates(),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const defaultProps = {
  messageId: 'msg-1',
  platform: 'mastodon',
  authorName: '@alice@mastodon.social',
  isPending: false,
  onSend: vi.fn(),
  onCancel: vi.fn(),
};

describe('ReplyComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReplyTemplates.mockReturnValue({ data: [], isLoading: false });
  });

  describe('Rendering', () => {
    it('renders the reply textarea with correct placeholder', () => {
      render(<ReplyComposer {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole('textbox', { name: /reply to/i })).toBeInTheDocument();
    });

    it('shows the author name and platform', () => {
      render(<ReplyComposer {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('@alice@mastodon.social')).toBeInTheDocument();
      // "Mastodon" appears in the "via Mastodon" text (may also appear in author handle)
      expect(screen.getAllByText(/Mastodon/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows character count for Twitter', () => {
      render(<ReplyComposer {...defaultProps} platform="twitter" />, { wrapper: createWrapper() });

      expect(screen.getByText('0/280')).toBeInTheDocument();
    });

    it('does not show character count for non-Twitter platforms', () => {
      render(<ReplyComposer {...defaultProps} platform="mastodon" />, { wrapper: createWrapper() });

      expect(screen.queryByText(/\/280/)).not.toBeInTheDocument();
    });

    it('shows template button when templates exist', () => {
      mockUseReplyTemplates.mockReturnValue({
        data: [{ id: 't1', name: 'Thanks', content: 'Thank you!' }],
      });
      render(<ReplyComposer {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Use template')).toBeInTheDocument();
    });

    it('disables send button when content is empty', () => {
      render(<ReplyComposer {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Send reply')).toBeDisabled();
    });

    it('disables inputs when isPending', () => {
      render(<ReplyComposer {...defaultProps} isPending />, { wrapper: createWrapper() });

      expect(screen.getByRole('textbox', { name: /reply to/i })).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('enables send button when content is entered', () => {
      render(<ReplyComposer {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByRole('textbox', { name: /reply to/i }), {
        target: { value: 'Hello!' },
      });

      expect(screen.getByLabelText('Send reply')).not.toBeDisabled();
    });

    it('calls onSend with trimmed content when send button clicked', () => {
      const onSend = vi.fn();
      render(<ReplyComposer {...defaultProps} onSend={onSend} />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByRole('textbox', { name: /reply to/i }), {
        target: { value: '  Hello!  ' },
      });
      fireEvent.click(screen.getByLabelText('Send reply'));

      expect(onSend).toHaveBeenCalledWith('Hello!');
    });

    it('calls onCancel when Cancel clicked', () => {
      const onCancel = vi.fn();
      render(<ReplyComposer {...defaultProps} onCancel={onCancel} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('Cancel'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('sends on Ctrl+Enter keyboard shortcut', () => {
      const onSend = vi.fn();
      render(<ReplyComposer {...defaultProps} onSend={onSend} />, { wrapper: createWrapper() });

      const textarea = screen.getByRole('textbox', { name: /reply to/i });
      fireEvent.change(textarea, { target: { value: 'Hello!' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(onSend).toHaveBeenCalledWith('Hello!');
    });

    it('cancels on Escape key', () => {
      const onCancel = vi.fn();
      render(<ReplyComposer {...defaultProps} onCancel={onCancel} />, { wrapper: createWrapper() });

      const textarea = screen.getByRole('textbox', { name: /reply to/i });
      fireEvent.keyDown(textarea, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalled();
    });

    it('disables send when over Twitter char limit', () => {
      render(<ReplyComposer {...defaultProps} platform="twitter" />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByRole('textbox', { name: /reply to/i }), {
        target: { value: 'x'.repeat(281) },
      });

      expect(screen.getByLabelText('Send reply')).toBeDisabled();
      expect(screen.getByText('281/280')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('textarea is focused on mount', () => {
      render(<ReplyComposer {...defaultProps} />, { wrapper: createWrapper() });
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /reply to/i }));
    });

    it('character count is aria-live for screen readers', () => {
      render(<ReplyComposer {...defaultProps} platform="twitter" />, { wrapper: createWrapper() });

      const charCount = screen.getByText('0/280');
      expect(charCount).toHaveAttribute('aria-live', 'polite');
    });
  });
});
