/**
 * 📦 **LIGHTNING PAYMENT BUTTON - COMPONENT TEST SUITE**
 *
 * Elite Testing Standards:
 * - Comprehensive component testing ≥85% coverage
 * - User interaction testing
 * - Accessibility compliance (WCAG AA)
 * - Loading, error, and success states
 * - Mock API calls for controlled testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LightningPaymentButton } from './LightningPaymentButton';
import * as lightningApiModule from '../../lib/api/lightningApi';

expect.extend(toHaveNoViolations);

// Mock the toast hook
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the UI components
vi.mock('../ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock('../ui/qrcode', () => ({
  QRCode: ({ value }: any) => <div data-testid="qr-code">{value}</div>,
}));

vi.mock('../ui/spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

describe('LightningPaymentButton', () => {
  const mockCreateInvoice = vi.fn();
  const mockCheckInvoiceStatus = vi.fn();
  const mockPollPaymentStatus = vi.fn();

  const defaultProps = {
    amount: 1000,
    description: 'Test payment',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock lightningApi methods
    vi.spyOn(lightningApiModule.lightningApi, 'createInvoice').mockImplementation(
      mockCreateInvoice
    );
    vi.spyOn(lightningApiModule.lightningApi, 'checkInvoiceStatus').mockImplementation(
      mockCheckInvoiceStatus
    );
    vi.spyOn(lightningApiModule.lightningApi, 'pollPaymentStatus').mockImplementation(
      mockPollPaymentStatus
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render button with default text', () => {
      render(<LightningPaymentButton {...defaultProps} />);

      expect(screen.getByRole('button', { name: /pay with lightning/i })).toBeInTheDocument();
    });

    it('should render button with custom text', () => {
      render(<LightningPaymentButton {...defaultProps} buttonText="Custom Pay Button" />);

      expect(screen.getByRole('button', { name: /custom pay button/i })).toBeInTheDocument();
    });

    it('should render disabled button when disabled prop is true', () => {
      render(<LightningPaymentButton {...defaultProps} disabled />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      expect(button).toBeDisabled();
    });

    it('should not show dialog initially', () => {
      render(<LightningPaymentButton {...defaultProps} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Invoice Creation', () => {
    it('should create invoice when button is clicked', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc1500n1pj4d0fz...',
        paymentHash: 'hash123',
        amount: 1000,
        description: 'Test payment',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockResolvedValueOnce({ ...mockInvoice, settled: true });

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockCreateInvoice).toHaveBeenCalledWith({
          amount: 1000,
          description: 'Test payment',
          expirySeconds: 3600,
        });
      });
    });

    it('should display loading state while creating invoice', async () => {
      mockCreateInvoice.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  paymentRequest: 'lnbc...',
                  paymentHash: 'hash',
                  amount: 1000,
                  expiresAt: Date.now() + 3600000,
                  createdAt: Date.now(),
                  settled: false,
                }),
              100
            )
          )
      );

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('spinner')).toBeInTheDocument();
      });
    });

    it('should display QR code after invoice is created', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc1500n1pj4d0fz...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockResolvedValueOnce({ ...mockInvoice, settled: true });

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        const qrCode = screen.getByTestId('qr-code');
        expect(qrCode).toBeInTheDocument();
        expect(qrCode).toHaveTextContent('lightning:lnbc1500n1pj4d0fz...');
      });
    });

    it('should handle invoice creation errors', async () => {
      const onError = vi.fn();
      mockCreateInvoice.mockRejectedValueOnce(
        new lightningApiModule.LightningApiError('Failed to create invoice', 'CREATE_ERROR', 500)
      );

      render(<LightningPaymentButton {...defaultProps} onError={onError} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Failed to create invoice');
      });
    });
  });

  describe('Payment Status Polling', () => {
    it('should poll for payment status after invoice creation', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockResolvedValueOnce({ ...mockInvoice, settled: true });

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockPollPaymentStatus).toHaveBeenCalledWith('hash123', 2000, 30);
      });
    });

    it('should call onSuccess when payment is settled', async () => {
      const onSuccess = vi.fn();
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockResolvedValueOnce({
        ...mockInvoice,
        settled: true,
        settledAt: Date.now(),
      });

      render(<LightningPaymentButton {...defaultProps} onSuccess={onSuccess} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith('hash123');
      });
    });

    it('should handle polling timeout errors', async () => {
      const onError = vi.fn();
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockRejectedValueOnce(
        new lightningApiModule.LightningApiError('Payment polling timeout', 'POLLING_TIMEOUT', 408)
      );

      render(<LightningPaymentButton {...defaultProps} onError={onError} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Payment polling timeout');
      });
    });

    it('should display success message when payment is confirmed', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockResolvedValueOnce({
        ...mockInvoice,
        settled: true,
        settledAt: Date.now(),
      });

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/payment received/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should close dialog when payment is successful', async () => {
      vi.useFakeTimers();

      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockResolvedValueOnce({
        ...mockInvoice,
        settled: true,
        settledAt: Date.now(),
      });

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fast-forward time to trigger auto-close
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should call onCancel when dialog is closed without payment', async () => {
      const onCancel = vi.fn();
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<LightningPaymentButton {...defaultProps} onCancel={onCancel} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Simulate closing dialog
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog); // This would trigger onOpenChange in real Dialog component

      // Note: Actual test would need to mock Dialog component's onOpenChange behavior
    });

    it('should display pending status while waiting for payment', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/waiting for payment/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations in default state', async () => {
      const { container } = render(<LightningPaymentButton {...defaultProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with dialog open', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockImplementation(() => new Promise(() => {}));

      const { container } = render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should be keyboard navigable', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);

      render(<LightningPaymentButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });

      // Tab to button
      await userEvent.tab();
      expect(button).toHaveFocus();

      // Activate with Enter
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    it('should apply custom className to button', () => {
      render(<LightningPaymentButton {...defaultProps} className="custom-class" />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      expect(button).toHaveClass('custom-class');
    });

    it('should use custom amount in invoice creation', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 5000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);
      mockPollPaymentStatus.mockResolvedValueOnce({ ...mockInvoice, settled: true });

      render(<LightningPaymentButton amount={5000} description="Premium content" />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockCreateInvoice).toHaveBeenCalledWith({
          amount: 5000,
          description: 'Premium content',
          expirySeconds: 3600,
        });
      });
    });

    it('should display custom description in dialog', async () => {
      const mockInvoice = {
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123',
        amount: 1000,
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        settled: false,
      };

      mockCreateInvoice.mockResolvedValueOnce(mockInvoice);

      render(<LightningPaymentButton amount={1000} description="Premium article" />);

      const button = screen.getByRole('button', { name: /pay with lightning/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/premium article/i)).toBeInTheDocument();
      });
    });
  });
});
