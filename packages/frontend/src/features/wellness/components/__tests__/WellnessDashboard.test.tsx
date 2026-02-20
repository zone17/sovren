import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import WellnessDashboard from '../WellnessDashboard';

// Mock all child components to test WellnessDashboard in isolation
vi.mock('../WorkPatternHeatmap', () => ({
  __esModule: true,
  default: () => <div data-testid="work-pattern-heatmap">WorkPatternHeatmap</div>,
}));
vi.mock('../BurnoutRiskGauge', () => ({
  __esModule: true,
  default: () => <div data-testid="burnout-risk-gauge">BurnoutRiskGauge</div>,
}));
vi.mock('../RestDayTracker', () => ({
  __esModule: true,
  default: () => <div data-testid="rest-day-tracker">RestDayTracker</div>,
}));
vi.mock('../SustainableScheduler', () => ({
  __esModule: true,
  default: () => <div data-testid="sustainable-scheduler">SustainableScheduler</div>,
}));
vi.mock('../WellnessTrend', () => ({
  __esModule: true,
  default: () => <div data-testid="wellness-trend">WellnessTrend</div>,
}));
vi.mock('../BoundarySettings', () => ({
  __esModule: true,
  default: () => <div data-testid="boundary-settings">BoundarySettings</div>,
}));
vi.mock('../WellnessResources', () => ({
  __esModule: true,
  default: () => <div data-testid="wellness-resources">WellnessResources</div>,
}));
vi.mock('../WellnessPulseModal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="pulse-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));
vi.mock('../../ErrorBoundary', () => ({
  WellnessErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('WellnessDashboard', () => {
  it('renders all child components', () => {
    render(<WellnessDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Creator Wellness')).toBeInTheDocument();
    expect(screen.getByTestId('burnout-risk-gauge')).toBeInTheDocument();
    expect(screen.getByTestId('rest-day-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('sustainable-scheduler')).toBeInTheDocument();
    expect(screen.getByTestId('work-pattern-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('wellness-trend')).toBeInTheDocument();
    expect(screen.getByTestId('boundary-settings')).toBeInTheDocument();
    expect(screen.getByTestId('wellness-resources')).toBeInTheDocument();
  });

  it('opens pulse modal on button click', () => {
    render(<WellnessDashboard />, { wrapper: createWrapper() });

    expect(screen.queryByTestId('pulse-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Pulse Check-In'));

    expect(screen.getByTestId('pulse-modal')).toBeInTheDocument();
  });

  it('closes pulse modal', () => {
    render(<WellnessDashboard />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Pulse Check-In'));
    expect(screen.getByTestId('pulse-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('pulse-modal')).not.toBeInTheDocument();
  });

  it('displays description text', () => {
    render(<WellnessDashboard />, { wrapper: createWrapper() });

    expect(
      screen.getByText('Monitor your work patterns and maintain sustainable habits.')
    ).toBeInTheDocument();
  });
});
