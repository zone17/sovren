import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DMCAReportButton } from '../DMCAReportButton';

const mockMutate = vi.fn();

vi.mock('../../hooks/useDmcaReport', () => ({
  useDmcaReport: vi.fn(),
}));

import { useDmcaReport } from '../../hooks/useDmcaReport';
const mockUseDmcaReport = useDmcaReport as any;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('DMCAReportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDmcaReport.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
    });
  });

  it('renders the button with correct label', () => {
    render(<DMCAReportButton alertId="alert-1" />, { wrapper: createWrapper() });
    expect(
      screen.getByRole('button', { name: /Generate DMCA takedown report/ })
    ).toBeInTheDocument();
    expect(screen.getByText('DMCA Report')).toBeInTheDocument();
  });

  it('calls mutate with alertId on click', () => {
    render(<DMCAReportButton alertId="alert-1" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('button'));
    expect(mockMutate).toHaveBeenCalledWith({ alertId: 'alert-1', format: 'json' });
  });

  it('shows loading state when pending', () => {
    mockUseDmcaReport.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isSuccess: false,
      isError: false,
    });

    render(<DMCAReportButton alertId="alert-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows success message after report generated', () => {
    mockUseDmcaReport.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: true,
      isError: false,
    });

    render(<DMCAReportButton alertId="alert-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Report generated.')).toBeInTheDocument();
  });

  it('shows error message on failure', () => {
    mockUseDmcaReport.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: true,
    });

    render(<DMCAReportButton alertId="alert-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Report generation failed.')).toBeInTheDocument();
  });
});
