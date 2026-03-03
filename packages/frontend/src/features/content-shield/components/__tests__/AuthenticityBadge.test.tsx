import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthenticityBadge } from '../AuthenticityBadge';

const mockProvenance = {
  content_id: 'test-id',
  author_pubkey: 'abc123pubkey',
  created_at: '2026-02-15T10:00:00Z',
  signature: 'sig-hex-value',
  nostr_event_id: 'event-hex-id',
  content_hash: 'sha256-hex',
  relay_confirmations: [{ relay: 'wss://relay.damus.io', confirmed_at: '2026-02-15T10:00:05Z' }],
  verification_status: 'verified' as const,
  nip05_verified: true,
};

vi.mock('../../hooks/useProvenanceChain', () => ({
  useProvenanceChain: vi.fn(),
}));

vi.mock('../ProvenanceChainViewer', () => ({
  ProvenanceChainViewer: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="provenance-viewer">
      <button onClick={onClose}>Close Viewer</button>
    </div>
  ),
}));

import { useProvenanceChain } from '../../hooks/useProvenanceChain';
const mockUseProvenanceChain = useProvenanceChain as any;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('AuthenticityBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while loading', () => {
    mockUseProvenanceChain.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<AuthenticityBadge contentId="test-id" />, {
      wrapper: createWrapper(),
    });
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders nothing when no data', () => {
    mockUseProvenanceChain.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(<AuthenticityBadge contentId="test-id" />, {
      wrapper: createWrapper(),
    });
    expect(container.querySelector('button')).not.toBeInTheDocument();
  });

  it('renders verified badge', () => {
    mockUseProvenanceChain.mockReturnValue({ data: mockProvenance, isLoading: false });
    render(<AuthenticityBadge contentId="test-id" />, { wrapper: createWrapper() });
    const badge = screen.getByRole('button', { name: /Verified/ });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('V');
  });

  it('renders unverified badge', () => {
    mockUseProvenanceChain.mockReturnValue({
      data: { ...mockProvenance, verification_status: 'unverified' },
      isLoading: false,
    });
    render(<AuthenticityBadge contentId="test-id" />, { wrapper: createWrapper() });
    const badge = screen.getByRole('button', { name: /Unverified/ });
    expect(badge).toHaveTextContent('?');
  });

  it('renders disputed badge', () => {
    mockUseProvenanceChain.mockReturnValue({
      data: { ...mockProvenance, verification_status: 'disputed' },
      isLoading: false,
    });
    render(<AuthenticityBadge contentId="test-id" />, { wrapper: createWrapper() });
    const badge = screen.getByRole('button', { name: /Disputed/ });
    expect(badge).toHaveTextContent('!');
  });

  it('opens provenance viewer on click', () => {
    mockUseProvenanceChain.mockReturnValue({ data: mockProvenance, isLoading: false });
    render(<AuthenticityBadge contentId="test-id" />, { wrapper: createWrapper() });

    expect(screen.queryByTestId('provenance-viewer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Verified/ }));

    expect(screen.getByTestId('provenance-viewer')).toBeInTheDocument();
  });

  it('closes provenance viewer', () => {
    mockUseProvenanceChain.mockReturnValue({ data: mockProvenance, isLoading: false });
    render(<AuthenticityBadge contentId="test-id" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /Verified/ }));
    expect(screen.getByTestId('provenance-viewer')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Viewer'));
    expect(screen.queryByTestId('provenance-viewer')).not.toBeInTheDocument();
  });
});
