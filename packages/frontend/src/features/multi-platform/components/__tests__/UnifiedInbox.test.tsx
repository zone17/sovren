import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import UnifiedInbox from '../UnifiedInbox';

const mockUseInboxMessages = vi.fn();
const mockUseReplyToMessage = vi.fn();
const mockUseBatchAction = vi.fn();

vi.mock('../../hooks/useInbox', () => ({
  useInboxMessages: (params: any) => mockUseInboxMessages(params),
  useReplyToMessage: () => mockUseReplyToMessage(),
  useBatchAction: () => mockUseBatchAction(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('UnifiedInbox', () => {
  const mockMessages = {
    messages: [
      {
        id: 'msg-1',
        platform: 'mastodon',
        author: '@alice@mastodon.social',
        content: 'Great post!',
        type: 'mention',
        is_read: false,
        created_at: '2026-02-16T12:00:00Z',
      },
      {
        id: 'msg-2',
        platform: 'bluesky',
        author: 'bob.bsky.social',
        content: 'Love this content',
        type: 'reply',
        is_read: true,
        created_at: '2026-02-15T10:00:00Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  beforeEach(() => {
    mockUseInboxMessages.mockReturnValue({ data: mockMessages, isLoading: false });
    mockUseReplyToMessage.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseBatchAction.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('renders messages list', () => {
    render(<UnifiedInbox />, { wrapper: createWrapper() });

    expect(screen.getByText('Unified Inbox')).toBeInTheDocument();
    expect(screen.getByText('@alice@mastodon.social')).toBeInTheDocument();
    expect(screen.getByText('Great post!')).toBeInTheDocument();
    expect(screen.getByText('bob.bsky.social')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseInboxMessages.mockReturnValue({ data: undefined, isLoading: true });

    render(<UnifiedInbox />, { wrapper: createWrapper() });

    expect(screen.queryByText('@alice@mastodon.social')).not.toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    mockUseInboxMessages.mockReturnValue({
      data: {
        messages: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      },
      isLoading: false,
    });

    render(<UnifiedInbox />, { wrapper: createWrapper() });

    expect(screen.getByText('No messages to display.')).toBeInTheDocument();
  });

  it('opens reply input when clicking Reply', () => {
    render(<UnifiedInbox />, { wrapper: createWrapper() });

    const replyButtons = screen.getAllByText('Reply');
    fireEvent.click(replyButtons[0]);

    expect(screen.getByPlaceholderText('Write a reply...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows platform and status filters', () => {
    render(<UnifiedInbox />, { wrapper: createWrapper() });

    expect(screen.getByDisplayValue('All Platforms')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Messages')).toBeInTheDocument();
  });
});
