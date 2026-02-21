import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { CrossPlatformDashboard } from '../CrossPlatformDashboard';

const mockUseCrossPlatformOverview = vi.fn();

vi.mock('../../hooks/useCrossPlatformAnalytics', () => ({
  useCrossPlatformOverview: () => mockUseCrossPlatformOverview(),
  usePlatformComparison: () => ({ data: undefined, isLoading: false, isError: false }),
  usePlatformROI: () => ({ data: [], isLoading: false, isError: false }),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
}

const mockOverview = {
  total_followers: 12500,
  total_engagement_30d: 3200,
  platforms: [
    {
      platform: 'mastodon',
      followers: 5000,
      engagement_rate: 4.2,
      growth_30d: 3.1,
    },
    {
      platform: 'bluesky',
      followers: 7500,
      engagement_rate: 3.8,
      growth_30d: -1.2,
    },
  ],
};

describe('CrossPlatformDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCrossPlatformOverview.mockReturnValue({
      data: mockOverview,
      isLoading: false,
      isError: false,
    });
  });

  describe('Rendering', () => {
    it('renders the section heading', () => {
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.getByText('Cross-Platform Overview')).toBeInTheDocument();
    });

    it('renders total followers stat', () => {
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.getAllByText('12,500').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Total Followers')).toBeInTheDocument();
    });

    it('renders connected platforms count', () => {
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Connected Platforms')).toBeInTheDocument();
    });

    it('renders per-platform rows with correct data', () => {
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.getAllByText('Mastodon').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Bluesky').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('5,000 followers')).toBeInTheDocument();
      expect(screen.getByText('7,500 followers')).toBeInTheDocument();
    });

    it('renders positive growth badge with + prefix', () => {
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.getByText('+3.1%')).toBeInTheDocument();
    });

    it('renders negative growth badge without + prefix', () => {
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.getByText('-1.2%')).toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('shows skeleton loading state', () => {
      mockUseCrossPlatformOverview.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.queryByText('Cross-Platform Overview')).not.toBeInTheDocument();
    });

    it('shows error state on failure', () => {
      mockUseCrossPlatformOverview.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });
      render(<CrossPlatformDashboard />, { wrapper: createWrapper() });

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load analytics');
    });
  });
});
