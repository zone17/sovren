import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LightningPaymentFlow } from '../LightningPaymentFlow';

describe('LightningPaymentFlow', () => {
  const defaultProps = {
    amountSats: 5000,
    recipientId: 'creator-1',
    recipientName: 'Sophia',
    paymentType: 'subscription' as const,
    description: 'Premium tier subscription',
  };

  describe('Rendering', () => {
    it('renders payment header and description', () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      expect(screen.getByText('Lightning Payment')).toBeInTheDocument();
      expect(screen.getByText(/Premium tier subscription for Sophia/)).toBeInTheDocument();
    });

    it('renders amount in sats', () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      expect(screen.getByText('5,000')).toBeInTheDocument();
      expect(screen.getByText('satoshis')).toBeInTheDocument();
    });

    it('renders Generate Invoice button in idle state', () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /Generate Lightning invoice/i })
      ).toBeInTheDocument();
    });

    it('renders Cancel button when onCancel is provided', () => {
      const onCancel = jest.fn();
      render(<LightningPaymentFlow {...defaultProps} onCancel={onCancel} />);

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelBtn).toBeInTheDocument();
    });

    it('does not render Cancel button when onCancel is not provided', () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('shows creating state when Generate Invoice is clicked', async () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      const generateBtn = screen.getByRole('button', { name: /Generate Lightning invoice/i });
      fireEvent.click(generateBtn);

      expect(screen.getByText(/Creating Lightning invoice/)).toBeInTheDocument();
    });

    it('shows pending state with invoice after creation', async () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      const generateBtn = screen.getByRole('button', { name: /Generate Lightning invoice/i });
      fireEvent.click(generateBtn);

      await waitFor(
        () => {
          expect(screen.getByText(/Waiting for payment/)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('shows BOLT11 invoice input when pending', async () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      const generateBtn = screen.getByRole('button', { name: /Generate Lightning invoice/i });
      fireEvent.click(generateBtn);

      await waitFor(
        () => {
          expect(screen.getByLabelText(/Lightning payment request string/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = jest.fn();
      render(<LightningPaymentFlow {...defaultProps} onCancel={onCancel} />);

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible Generate Invoice button', () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /Generate Lightning invoice for 5000 sats/i })
      ).toBeInTheDocument();
    });

    it('shows loading status with sr-only text during creation', async () => {
      render(<LightningPaymentFlow {...defaultProps} />);

      const generateBtn = screen.getByRole('button', { name: /Generate Lightning invoice/i });
      fireEvent.click(generateBtn);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero amount', () => {
      render(<LightningPaymentFlow {...defaultProps} amountSats={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles large amounts with formatting', () => {
      render(<LightningPaymentFlow {...defaultProps} amountSats={1000000} />);

      expect(screen.getByText('1,000,000')).toBeInTheDocument();
    });
  });
});
