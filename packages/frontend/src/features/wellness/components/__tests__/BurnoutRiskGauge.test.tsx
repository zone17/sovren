import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BurnoutRiskGauge from '../BurnoutRiskGauge';

const mockData = {
  score: 42,
  level: 'moderate' as const,
  factors: {
    work_hours_trend: { value: 0.35, weight: 0.25, detail: 'Working 115% of baseline' },
    posting_frequency: { value: 0.5, weight: 0.2, detail: 'Posting 140% of 4-week avg' },
    engagement_drop: { value: 0.2, weight: 0.2, detail: 'Engagement at 85% of avg' },
    hour_regularity: { value: 0.6, weight: 0.15, detail: 'High schedule variance' },
    rest_day_deficit: { value: 0.45, weight: 0.2, detail: '1 rest day this week (target: 2)' },
  },
  baseline_ready: true,
  baseline_days_remaining: 0,
  history: [{ week: '2026-W06', score: 38, level: 'moderate' as const }],
  recommendations: ['Consider taking tomorrow off'],
  updated_at: '2026-02-15T00:00:00Z',
};

vi.mock('../../hooks/useBurnoutScore', () => ({
  useBurnoutScore: vi.fn(),
}));

import { useBurnoutScore } from '../../hooks/useBurnoutScore';
const mockUseBurnoutScore = useBurnoutScore as any;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('BurnoutRiskGauge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton', () => {
    mockUseBurnoutScore.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = render(<BurnoutRiskGauge />, { wrapper: createWrapper() });
    // Loading state renders Skeleton elements only (no text) — verify container renders something
    expect(container.firstChild).toBeTruthy();
    // Verify we are NOT showing the error state
    expect(screen.queryByText('Failed to load burnout risk score.')).not.toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseBurnoutScore.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    render(<BurnoutRiskGauge />, { wrapper: createWrapper() });
    expect(screen.getByText('Failed to load burnout risk score.')).toBeInTheDocument();
  });

  it('shows baseline not ready state', () => {
    mockUseBurnoutScore.mockReturnValue({
      data: { ...mockData, baseline_ready: false, baseline_days_remaining: 10, score: null },
      isLoading: false,
      error: null,
    });
    render(<BurnoutRiskGauge />, { wrapper: createWrapper() });
    expect(screen.getByText(/Building your baseline/)).toBeInTheDocument();
    expect(screen.getByText(/10 days remaining/)).toBeInTheDocument();
  });

  it('renders score and level when data loaded', () => {
    mockUseBurnoutScore.mockReturnValue({ data: mockData, isLoading: false, error: null });
    render(<BurnoutRiskGauge />, { wrapper: createWrapper() });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('shows top recommendation', () => {
    mockUseBurnoutScore.mockReturnValue({ data: mockData, isLoading: false, error: null });
    render(<BurnoutRiskGauge />, { wrapper: createWrapper() });
    expect(screen.getByText('Consider taking tomorrow off')).toBeInTheDocument();
  });

  it('expands risk factor breakdown on click', () => {
    mockUseBurnoutScore.mockReturnValue({ data: mockData, isLoading: false, error: null });
    render(<BurnoutRiskGauge />, { wrapper: createWrapper() });

    expect(screen.queryByText('Risk Factors')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Burnout score 42/ }));

    expect(screen.getByText('Risk Factors')).toBeInTheDocument();
    expect(screen.getByText('Working 115% of baseline')).toBeInTheDocument();
    expect(screen.getByText('High schedule variance')).toBeInTheDocument();
  });
});
