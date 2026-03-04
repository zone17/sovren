import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FingerprintCoverage } from '../FingerprintCoverage';

vi.mock('../../hooks/useFingerprintCoverage', () => ({
  useFingerprintCoverage: vi.fn(),
}));

import { useFingerprintCoverage } from '../../hooks/useFingerprintCoverage';
const mockUseFingerprintCoverage = useFingerprintCoverage as any;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('FingerprintCoverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while loading', () => {
    mockUseFingerprintCoverage.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = render(<FingerprintCoverage creatorId="test-creator" />, {
      wrapper: createWrapper(),
    });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockUseFingerprintCoverage.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    });
    render(<FingerprintCoverage creatorId="test-creator" />, { wrapper: createWrapper() });
    expect(screen.getByText('Failed to load fingerprint coverage.')).toBeInTheDocument();
  });

  it('renders coverage data with donut chart', () => {
    mockUseFingerprintCoverage.mockReturnValue({
      data: {
        data: {
          total_fingerprinted: 80,
          total_content: 100,
          coverage_percentage: 80,
          fingerprints: [],
        },
      },
      isLoading: false,
      error: null,
    });

    render(<FingerprintCoverage creatorId="test-creator" />, { wrapper: createWrapper() });

    expect(screen.getByText('Fingerprint Coverage')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument(); // fingerprinted count
    expect(screen.getByText('100')).toBeInTheDocument(); // total content
    expect(screen.getByText('20')).toBeInTheDocument(); // unprotected
  });

  it('shows warning for unprotected content', () => {
    mockUseFingerprintCoverage.mockReturnValue({
      data: {
        data: {
          total_fingerprinted: 50,
          total_content: 100,
          coverage_percentage: 50,
          fingerprints: [],
        },
      },
      isLoading: false,
      error: null,
    });

    render(<FingerprintCoverage creatorId="test-creator" />, { wrapper: createWrapper() });

    expect(screen.getByText(/50 pieces of content are not yet fingerprinted/)).toBeInTheDocument();
  });

  it('does not show warning when all content is fingerprinted', () => {
    mockUseFingerprintCoverage.mockReturnValue({
      data: {
        data: {
          total_fingerprinted: 100,
          total_content: 100,
          coverage_percentage: 100,
          fingerprints: [],
        },
      },
      isLoading: false,
      error: null,
    });

    render(<FingerprintCoverage creatorId="test-creator" />, { wrapper: createWrapper() });

    expect(screen.queryByText(/not yet fingerprinted/)).not.toBeInTheDocument();
  });

  it('renders accessible SVG with aria-label', () => {
    mockUseFingerprintCoverage.mockReturnValue({
      data: {
        data: {
          total_fingerprinted: 75,
          total_content: 100,
          coverage_percentage: 75,
          fingerprints: [],
        },
      },
      isLoading: false,
      error: null,
    });

    render(<FingerprintCoverage creatorId="test-creator" />, { wrapper: createWrapper() });

    const svg = screen.getByRole('img', { name: /75% fingerprint coverage/ });
    expect(svg).toBeInTheDocument();
  });
});
