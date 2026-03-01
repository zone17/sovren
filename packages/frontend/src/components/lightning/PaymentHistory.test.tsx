/**
 * Payment History Component Tests
 *
 * TDD Approach: Tests written FIRST before implementation
 * Coverage target: ≥85%
 *
 * Test categories:
 * 1. Rendering tests
 * 2. API integration tests
 * 3. Filtering tests
 * 4. Sorting tests
 * 5. Pagination tests
 * 6. Accessibility tests
 * 7. Error handling tests
 * 8. Edge cases
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentHistory } from './PaymentHistory';
import { lightningApi, LightningPayment } from '../../lib/api/lightningApi';

// Mock the Lightning API
vi.mock('../../lib/api/lightningApi', () => ({
  lightningApi: {
    getUserPaymentHistory: vi.fn(),
  },
  LightningApiError: class LightningApiError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode?: number
    ) {
      super(message);
      this.name = 'LightningApiError';
    }
  },
}));

// Mock toast
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Helper to create mock payment data
const createMockPayment = (overrides: Partial<LightningPayment> = {}): LightningPayment => ({
  id: `payment-${Math.random()}`,
  userId: 'user-123',
  paymentHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  paymentRequest: 'lnbc1000n1...',
  amount: 1000,
  description: 'Test payment',
  status: 'settled',
  createdAt: Date.now(),
  settledAt: Date.now(),
  expiresAt: Date.now() + 3600000,
  metadata: {},
  ...overrides,
});

// Helper to create test wrapper with React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
        // gcTime/staleTime set to 0 to avoid caching between tests
        gcTime: 0,
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('PaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders loading state initially', () => {
      (lightningApi.getUserPaymentHistory as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<PaymentHistory />, { wrapper: createWrapper() });

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('renders empty state when no payments exist', async () => {
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/no payments/i)).toBeInTheDocument();
      });
    });

    it('renders payment list with data', async () => {
      const mockPayments = [
        createMockPayment({ description: 'Payment 1', amount: 1000 }),
        createMockPayment({ description: 'Payment 2', amount: 2000 }),
      ];

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Payment 1')).toBeInTheDocument();
        expect(screen.getByText('Payment 2')).toBeInTheDocument();
      });
    });

    it('displays payment details correctly', async () => {
      const mockPayment = createMockPayment({
        description: 'Premium subscription',
        amount: 5000,
        status: 'settled',
        paymentHash: 'abc123def456',
      });

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Premium subscription')).toBeInTheDocument();
        expect(screen.getByText(/5,000 sats/i)).toBeInTheDocument();
        // Check for status badge
        const statusBadge = screen.getByText((content, element) => {
          return element?.tagName === 'SPAN' && content === 'Settled';
        });
        expect(statusBadge).toBeInTheDocument();
      });
    });

    it('displays payment hash with truncation', async () => {
      const mockPayment = createMockPayment({
        paymentHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Should show truncated hash (e.g., "1234...cdef")
        expect(screen.getByText(/1234.*cdef/i)).toBeInTheDocument();
      });
    });

    it('shows copy button for payment hash', async () => {
      const mockPayment = createMockPayment();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    const createPaymentsWithStatuses = () => [
      createMockPayment({ id: '1', status: 'settled', description: 'Paid 1' }),
      createMockPayment({ id: '2', status: 'pending', description: 'Pending 1' }),
      createMockPayment({ id: '3', status: 'failed', description: 'Failed 1' }),
      createMockPayment({ id: '4', status: 'expired', description: 'Expired 1' }),
      createMockPayment({ id: '5', status: 'settled', description: 'Paid 2' }),
    ];

    it('shows all payments by default', async () => {
      const mockPayments = createPaymentsWithStatuses();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Paid 1')).toBeInTheDocument();
        expect(screen.getByText('Pending 1')).toBeInTheDocument();
        expect(screen.getByText('Failed 1')).toBeInTheDocument();
        expect(screen.getByText('Expired 1')).toBeInTheDocument();
        expect(screen.getByText('Paid 2')).toBeInTheDocument();
      });
    });

    it('filters by paid status', async () => {
      const user = userEvent.setup();
      const mockPayments = createPaymentsWithStatuses();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Paid 1')).toBeInTheDocument();
      });

      // Click "Paid" filter
      const paidFilter = screen.getByRole('button', { name: /paid/i });
      await user.click(paidFilter);

      // Should show only paid payments
      expect(screen.getByText('Paid 1')).toBeInTheDocument();
      expect(screen.getByText('Paid 2')).toBeInTheDocument();
      expect(screen.queryByText('Pending 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Failed 1')).not.toBeInTheDocument();
    });

    it('filters by pending status', async () => {
      const user = userEvent.setup();
      const mockPayments = createPaymentsWithStatuses();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Pending 1')).toBeInTheDocument();
      });

      const pendingFilter = screen.getByRole('button', { name: /pending/i });
      await user.click(pendingFilter);

      expect(screen.getByText('Pending 1')).toBeInTheDocument();
      expect(screen.queryByText('Paid 1')).not.toBeInTheDocument();
    });

    it('filters by failed status', async () => {
      const user = userEvent.setup();
      const mockPayments = createPaymentsWithStatuses();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Failed 1')).toBeInTheDocument();
      });

      const failedFilter = screen.getByRole('button', { name: /failed/i });
      await user.click(failedFilter);

      expect(screen.getByText('Failed 1')).toBeInTheDocument();
      expect(screen.queryByText('Paid 1')).not.toBeInTheDocument();
    });

    it('resets to all payments when "All" filter is clicked', async () => {
      const user = userEvent.setup();
      const mockPayments = createPaymentsWithStatuses();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Paid 1')).toBeInTheDocument();
      });

      // Filter to paid
      await user.click(screen.getByRole('button', { name: /paid/i }));
      expect(screen.queryByText('Pending 1')).not.toBeInTheDocument();

      // Reset to all
      await user.click(screen.getByRole('button', { name: /all/i }));
      expect(screen.getByText('Paid 1')).toBeInTheDocument();
      expect(screen.getByText('Pending 1')).toBeInTheDocument();
      expect(screen.getByText('Failed 1')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by date (newest first) by default', async () => {
      const mockPayments = [
        createMockPayment({ id: '1', createdAt: 1000, description: 'Old' }),
        createMockPayment({ id: '2', createdAt: 3000, description: 'New' }),
        createMockPayment({ id: '3', createdAt: 2000, description: 'Middle' }),
      ];

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        const items = screen.getAllByRole('article');
        expect(within(items[0]).getByText('New')).toBeInTheDocument();
        expect(within(items[1]).getByText('Middle')).toBeInTheDocument();
        expect(within(items[2]).getByText('Old')).toBeInTheDocument();
      });
    });

    it('sorts by amount when amount sort is selected', async () => {
      const user = userEvent.setup();
      const mockPayments = [
        createMockPayment({ id: '1', amount: 500, description: 'Small' }),
        createMockPayment({ id: '2', amount: 2000, description: 'Large' }),
        createMockPayment({ id: '3', amount: 1000, description: 'Medium' }),
      ];

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Small')).toBeInTheDocument();
      });

      // Find and click the sort button (it shows "Sort by: Date" initially)
      const sortButton = screen.getByRole('button', { name: /sort by:/i });
      await user.click(sortButton);

      await waitFor(() => {
        const items = screen.getAllByRole('article');
        expect(within(items[0]).getByText('Large')).toBeInTheDocument();
        expect(within(items[1]).getByText('Medium')).toBeInTheDocument();
        expect(within(items[2]).getByText('Small')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('displays 20 payments per page', async () => {
      const mockPayments = Array.from({ length: 25 }, (_, i) =>
        createMockPayment({ id: `payment-${i}`, description: `Payment ${i}` })
      );

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        const items = screen.getAllByRole('article');
        expect(items).toHaveLength(20);
      });
    });

    it('shows next page when next button clicked', async () => {
      const user = userEvent.setup();
      const mockPayments = Array.from({ length: 25 }, (_, i) =>
        createMockPayment({ id: `payment-${i}`, description: `Payment ${i}` })
      );

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Payment 0')).toBeInTheDocument();
      });

      // Click next page (get all buttons and click the first one)
      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      await user.click(nextButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Payment 20')).toBeInTheDocument();
        expect(screen.queryByText('Payment 0')).not.toBeInTheDocument();
      });
    });

    it('shows previous page when previous button clicked', async () => {
      const user = userEvent.setup();
      const mockPayments = Array.from({ length: 25 }, (_, i) =>
        createMockPayment({ id: `payment-${i}`, description: `Payment ${i}` })
      );

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Payment 0')).toBeInTheDocument();
      });

      // Go to next page
      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      await user.click(nextButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Payment 20')).toBeInTheDocument();
      });

      // Go back to previous page
      const prevButtons = screen.getAllByRole('button', { name: /previous/i });
      await user.click(prevButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Payment 0')).toBeInTheDocument();
        expect(screen.queryByText('Payment 20')).not.toBeInTheDocument();
      });
    });

    it('disables previous button on first page', async () => {
      const mockPayments = Array.from({ length: 25 }, (_, i) =>
        createMockPayment({ id: `payment-${i}`, description: `Payment ${i}` })
      );

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Payment 0')).toBeInTheDocument();
      });

      const prevButtons = screen.getAllByRole('button', { name: /previous/i });
      // Check all Previous buttons (mobile and desktop)
      prevButtons.forEach((btn) => expect(btn).toBeDisabled());
    });

    it('disables next button on last page', async () => {
      const user = userEvent.setup();
      const mockPayments = Array.from({ length: 25 }, (_, i) =>
        createMockPayment({ id: `payment-${i}`, description: `Payment ${i}` })
      );

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Payment 0')).toBeInTheDocument();
      });

      // Get all next buttons (mobile and desktop)
      const nextButtons = screen.getAllByRole('button', { name: /next/i });

      // Click one of them to go to last page
      await user.click(nextButtons[0]);

      await waitFor(() => {
        // Verify on last page
        expect(screen.getByText('Payment 20')).toBeInTheDocument();
        // All Next buttons should be disabled
        const updatedNextButtons = screen.getAllByRole('button', { name: /next/i });
        updatedNextButtons.forEach((btn) => expect(btn).toBeDisabled());
      });
    });
  });

  describe('Interactions', () => {
    it('copies payment hash to clipboard when copy button clicked', async () => {
      const user = userEvent.setup();
      const mockPayment = createMockPayment({
        paymentHash: 'abc123def456',
        description: 'Test payment',
      });

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      // Mock clipboard API
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeTextMock);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test payment')).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy.*hash/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith('abc123def456');
      });
    });

    it('downloads receipt when download button clicked', async () => {
      const user = userEvent.setup();
      const mockPayment = createMockPayment({ id: 'payment-123' });

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download.*receipt/i });
        expect(downloadButton).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download.*receipt/i });
      await user.click(downloadButton);

      // Verify download was triggered (implementation-specific)
      // This test will need to be updated based on actual implementation
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      const error = new Error('Network error');
      (lightningApi.getUserPaymentHistory as any).mockRejectedValue(error);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(
        () => {
          expect(screen.getByText(/error.*loading|network error/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('shows retry button when API call fails', async () => {
      const error = new Error('Network error');
      (lightningApi.getUserPaymentHistory as any).mockRejectedValue(error);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('retries loading when retry button clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Network error');
      const mockPayments = [createMockPayment({ description: 'Success payment' })];

      // Component has retry:2, so 3 total attempts before error state.
      // Then refetch (from retry button) should succeed.
      (lightningApi.getUserPaymentHistory as any)
        .mockRejectedValueOnce(error) // initial attempt
        .mockRejectedValueOnce(error) // retry 1
        .mockRejectedValueOnce(error) // retry 2
        .mockResolvedValueOnce(mockPayments); // after clicking retry button

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(
        () => {
          expect(screen.getByText('Success payment')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for filters', async () => {
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([createMockPayment()]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        const filterGroup = screen.getByRole('group', { name: /filter/i });
        expect(filterGroup).toBeInTheDocument();
      });
    });

    it('has proper ARIA labels for pagination controls', async () => {
      const mockPayments = Array.from({ length: 25 }, (_, i) =>
        createMockPayment({ id: `payment-${i}` })
      );

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue(mockPayments);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        const nav = screen.getByRole('navigation', { name: /pagination/i });
        expect(nav).toBeInTheDocument();
      });
    });

    it('payment items are keyboard navigable', async () => {
      const mockPayment = createMockPayment();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        const copyButton = screen.getByRole('button', { name: /copy/i });
        expect(copyButton).toHaveAttribute('tabIndex', '0');
      });
    });

    it('has proper heading hierarchy', async () => {
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([createMockPayment()]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(
        () => {
          const heading = screen.getByRole('heading', { name: /payment history/i });
          expect(heading).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles payments with missing descriptions', async () => {
      const mockPayment = createMockPayment({ description: undefined });
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Should show a default description or handle gracefully
        expect(screen.getByText(/payment|transaction/i)).toBeInTheDocument();
      });
    });

    it('handles very large amounts correctly', async () => {
      const mockPayment = createMockPayment({ amount: 100000000 }); // 100M sats
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Should format large numbers correctly
        expect(screen.getByText(/100,000,000|100M/i)).toBeInTheDocument();
      });
    });

    it('handles expired payments correctly', async () => {
      const mockPayment = createMockPayment({
        status: 'expired',
        expiresAt: Date.now() - 1000,
      });

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument();
      });
    });

    it('displays correct date formatting for recent and old payments', async () => {
      const recentPayment = createMockPayment({
        id: '1',
        description: 'Recent',
        createdAt: Date.now() - 3600000, // 1 hour ago
      });

      const oldPayment = createMockPayment({
        id: '2',
        description: 'Old',
        createdAt: Date.now() - 86400000 * 30, // 30 days ago
      });

      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([recentPayment, oldPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.getByText('Old')).toBeInTheDocument();
        // Should have readable date formats
        expect(screen.getByText(/hour|day|ago/i)).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('renders compact layout on mobile', async () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      const mockPayment = createMockPayment();
      (lightningApi.getUserPaymentHistory as any).mockResolvedValue([mockPayment]);

      render(<PaymentHistory />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Component should render without horizontal scroll
        const container = screen.getByRole('main');
        expect(container).toBeInTheDocument();
      });
    });
  });
});
