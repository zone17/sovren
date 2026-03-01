import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ShieldDashboard from '../ShieldDashboard';

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      role: 'creator',
      nostr_pubkey: 'npub1test',
    },
    isLoading: false,
    isAuthenticated: true,
  }),
  useAuthStatus: () => ({ isAuthenticated: true, isLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../FingerprintCoverage', () => ({
  __esModule: true,
  default: ({ creatorId }: { creatorId: string }) => (
    <div data-testid="fingerprint-coverage">FingerprintCoverage: {creatorId}</div>
  ),
}));

vi.mock('../AlertsFeed', () => ({
  __esModule: true,
  default: () => <div data-testid="alerts-feed">AlertsFeed</div>,
}));

vi.mock('../../ErrorBoundary', () => ({
  ContentShieldErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ShieldDashboard', () => {
  it('renders header and child components', () => {
    render(<ShieldDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Content Shield')).toBeInTheDocument();
    expect(
      screen.getByText('Protect your content with cryptographic provenance and copy detection.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('fingerprint-coverage')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-feed')).toBeInTheDocument();
  });
});
