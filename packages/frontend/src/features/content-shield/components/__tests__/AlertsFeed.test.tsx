import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AlertsFeed } from '../AlertsFeed';

const mockAlerts = [
  {
    id: 'alert-1',
    original_content_id: 'content-1',
    original_title: 'My Original Article',
    detected_copy_url: 'nostr:nevent1...',
    detected_author_pubkey: 'hex-pubkey',
    similarity_score: 0.92,
    match_level: 'derivative' as const,
    hash_type: 'simhash' as const,
    status: 'new' as const,
    detected_at: '2026-02-15T10:00:00Z',
    relay: 'wss://relay.damus.io',
  },
];

const mockPagination = {
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

vi.mock('../../hooks/useAlerts', () => ({
  useAlerts: vi.fn(),
  useAlertDetail: vi.fn(),
  useUpdateAlertStatus: vi.fn(),
}));

vi.mock('../../hooks/useDmcaReport', () => ({
  useDmcaReport: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  }),
}));

import { useAlerts } from '../../hooks/useAlerts';
const mockUseAlerts = useAlerts as any;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('AlertsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseAlerts.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<AlertsFeed />, { wrapper: createWrapper() });
    expect(screen.getByText('Copy Detection Alerts')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseAlerts.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    render(<AlertsFeed />, { wrapper: createWrapper() });
    expect(screen.getByText('Failed to load alerts.')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    mockUseAlerts.mockReturnValue({
      data: { data: [], pagination: mockPagination },
      isLoading: false,
      error: null,
    });
    render(<AlertsFeed />, { wrapper: createWrapper() });
    expect(screen.getByText('No new alerts.')).toBeInTheDocument();
  });

  it('renders alert cards', () => {
    mockUseAlerts.mockReturnValue({
      data: { data: mockAlerts, pagination: mockPagination },
      isLoading: false,
      error: null,
    });
    render(<AlertsFeed />, { wrapper: createWrapper() });
    expect(screen.getByText('My Original Article')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('switches status tabs', () => {
    mockUseAlerts.mockReturnValue({
      data: { data: [], pagination: mockPagination },
      isLoading: false,
      error: null,
    });
    render(<AlertsFeed />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('reviewed'));
    expect(mockUseAlerts).toHaveBeenCalledWith('reviewed', 1);
  });

  it('renders all status tab options', () => {
    mockUseAlerts.mockReturnValue({
      data: { data: [], pagination: mockPagination },
      isLoading: false,
      error: null,
    });
    render(<AlertsFeed />, { wrapper: createWrapper() });
    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByText('reviewed')).toBeInTheDocument();
    expect(screen.getByText('resolved')).toBeInTheDocument();
    expect(screen.getByText('false positive')).toBeInTheDocument();
    expect(screen.getByText('reported')).toBeInTheDocument();
  });
});
