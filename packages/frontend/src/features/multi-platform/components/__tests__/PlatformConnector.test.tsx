import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PlatformConnector from '../PlatformConnector';

// Mock the hooks
const mockUsePlatformStatus = jest.fn();
const mockUseConnectPlatform = jest.fn();
const mockUseDisconnectPlatform = jest.fn();

jest.mock('../../hooks/usePlatformConnections', () => ({
  usePlatformStatus: () => mockUsePlatformStatus(),
  useConnectPlatform: () => mockUseConnectPlatform(),
  useDisconnectPlatform: () => mockUseDisconnectPlatform(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('PlatformConnector', () => {
  const mockStatuses = [
    { platform: 'mastodon', connected: true, username: '@user@mastodon.social', status: 'connected' },
    { platform: 'bluesky', connected: false, username: null, status: 'disconnected' },
    { platform: 'twitter', connected: false, username: null, status: 'disconnected' },
  ];

  beforeEach(() => {
    mockUsePlatformStatus.mockReturnValue({ data: mockStatuses, isLoading: false });
    mockUseConnectPlatform.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({ data: { authorization_url: 'https://oauth.example.com' } }),
      isPending: false,
    });
    mockUseDisconnectPlatform.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
  });

  it('renders platform list with connection states', () => {
    render(<PlatformConnector />, { wrapper: createWrapper() });

    expect(screen.getByText('Mastodon')).toBeInTheDocument();
    expect(screen.getByText('@user@mastodon.social')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
    expect(screen.getAllByText('Connect')).toHaveLength(2);
  });

  it('shows loading state', () => {
    mockUsePlatformStatus.mockReturnValue({ data: undefined, isLoading: true });

    render(<PlatformConnector />, { wrapper: createWrapper() });

    expect(screen.queryByText('Mastodon')).not.toBeInTheDocument();
  });

  it('calls disconnect when clicking Disconnect', () => {
    const mockDisconnect = jest.fn();
    mockUseDisconnectPlatform.mockReturnValue({ mutate: mockDisconnect, isPending: false });

    render(<PlatformConnector />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Disconnect'));
    expect(mockDisconnect).toHaveBeenCalledWith('mastodon');
  });

  it('redirects to OAuth URL when connecting', async () => {
    const originalLocation = window.location;
    const mockLocation = { ...originalLocation, href: '' };
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true });

    const mockConnect = jest.fn().mockResolvedValue({
      data: { authorization_url: 'https://mastodon.social/oauth/authorize?state=abc' },
    });
    mockUseConnectPlatform.mockReturnValue({ mutateAsync: mockConnect, isPending: false });

    render(<PlatformConnector />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByText('Connect')[0]);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('bluesky');
    });

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });
});
