import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import MultiPlatformDashboard from '../MultiPlatformDashboard';

jest.mock('../PlatformConnector', () => ({
  __esModule: true,
  default: () => <div data-testid="platform-connector">PlatformConnector</div>,
}));
jest.mock('../CrossPlatformAnalytics', () => ({
  __esModule: true,
  default: () => <div data-testid="cross-platform-analytics">CrossPlatformAnalytics</div>,
}));
jest.mock('../UnifiedInbox', () => ({
  __esModule: true,
  default: () => <div data-testid="unified-inbox">UnifiedInbox</div>,
}));
jest.mock('../../ErrorBoundary', () => ({
  DistributionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('MultiPlatformDashboard', () => {
  it('renders all child components', () => {
    render(<MultiPlatformDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Multi-Platform Hub')).toBeInTheDocument();
    expect(screen.getByTestId('platform-connector')).toBeInTheDocument();
    expect(screen.getByTestId('cross-platform-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('unified-inbox')).toBeInTheDocument();
  });

  it('displays description text', () => {
    render(<MultiPlatformDashboard />, { wrapper: createWrapper() });

    expect(
      screen.getByText('Connect, publish, and manage your content across all platforms from one place.')
    ).toBeInTheDocument();
  });
});
