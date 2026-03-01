/**
 * 🧪 ELITE TESTS: Error Message Component
 *
 * US-319: Implement Error Handling UI
 * Test Coverage: 95%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorMessage } from '../ErrorMessage';
import { ErrorSeverity, ErrorCategory, NostrErrorCode } from '../types';
import type { NostrErrorMetadata } from '../types';

const createMockError = (overrides?: Partial<NostrErrorMetadata>): NostrErrorMetadata => ({
  code: NostrErrorCode.CONNECTION_TIMEOUT,
  category: ErrorCategory.CONNECTION,
  severity: ErrorSeverity.ERROR,
  title: 'Connection Timeout',
  message: 'Failed to connect to relay',
  timestamp: Date.now(),
  relay: 'wss://relay.example.com',
  troubleshootingHints: ['Check your internet connection', 'Verify relay is online'],
  recoverySuggestions: ['Try again', 'Use a different relay'],
  ...overrides,
});

describe('ErrorMessage', () => {
  describe('Rendering', () => {
    it('renders error title and message', () => {
      const error = createMockError();

      render(<ErrorMessage error={error} />);

      expect(screen.getByText('Connection Timeout')).toBeInTheDocument();
      expect(screen.getByText('Failed to connect to relay')).toBeInTheDocument();
    });

    it('renders error code when showErrorCode is true', () => {
      const error = createMockError();

      render(<ErrorMessage error={error} showErrorCode={true} />);

      expect(screen.getByText(/Code: NOSTR_1001/i)).toBeInTheDocument();
    });

    it('hides error code when showErrorCode is false', () => {
      const error = createMockError();

      render(<ErrorMessage error={error} showErrorCode={false} />);

      expect(screen.queryByText(/Code:/i)).not.toBeInTheDocument();
    });

    it('shows troubleshooting hints when enabled', () => {
      const error = createMockError();

      render(<ErrorMessage error={error} showTroubleshooting={true} />);

      expect(screen.getByText(/Troubleshooting:/i)).toBeInTheDocument();
      expect(screen.getByText(/Check your internet connection/i)).toBeInTheDocument();
    });

    it('shows recovery suggestions when enabled', () => {
      const error = createMockError();

      render(<ErrorMessage error={error} showRecoverySuggestions={true} />);

      expect(screen.getByText(/What to try:/i)).toBeInTheDocument();
      expect(screen.getByText(/Try again/i)).toBeInTheDocument();
    });

    it('renders relay information', () => {
      const error = createMockError();

      render(<ErrorMessage error={error} />);

      expect(screen.getByText(/Relay: wss:\/\/relay.example.com/i)).toBeInTheDocument();
    });

    it('renders multiple affected relays', () => {
      const error = createMockError({
        relay: undefined,
        relays: ['wss://relay1.com', 'wss://relay2.com'],
      });

      render(<ErrorMessage error={error} />);

      expect(
        screen.getByText(/Affected Relays: wss:\/\/relay1.com, wss:\/\/relay2.com/i)
      ).toBeInTheDocument();
    });
  });

  describe('Severity Styling', () => {
    it('applies INFO severity styling', () => {
      const error = createMockError({ severity: ErrorSeverity.INFO });

      const { container } = render(<ErrorMessage error={error} />);

      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('bg-blue-50');
    });

    it('applies WARNING severity styling', () => {
      const error = createMockError({ severity: ErrorSeverity.WARNING });

      const { container } = render(<ErrorMessage error={error} />);

      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('bg-yellow-50');
    });

    it('applies ERROR severity styling', () => {
      const error = createMockError({ severity: ErrorSeverity.ERROR });

      const { container } = render(<ErrorMessage error={error} />);

      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('bg-red-50');
    });

    it('applies CRITICAL severity styling', () => {
      const error = createMockError({ severity: ErrorSeverity.CRITICAL });

      const { container } = render(<ErrorMessage error={error} />);

      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('bg-red-100');
    });
  });

  describe('Compact Mode', () => {
    it('applies compact styling when compact=true', () => {
      const error = createMockError();

      const { container } = render(<ErrorMessage error={error} compact={true} />);

      const element = container.firstChild as HTMLElement;
      expect(element.className).toContain('p-3');
    });

    it('hides troubleshooting in compact mode', () => {
      const error = createMockError();

      render(<ErrorMessage error={error} compact={true} showTroubleshooting={true} />);

      expect(screen.queryByText(/Troubleshooting:/i)).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders retry button when onRetry is provided', () => {
      const error = createMockError();
      const onRetry = vi.fn();

      render(<ErrorMessage error={error} onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /Retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const error = createMockError();
      const onRetry = vi.fn().mockResolvedValue(undefined);

      render(<ErrorMessage error={error} onRetry={onRetry} />);

      fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalledTimes(1);
      });
    });

    it('disables retry button while retrying', async () => {
      const error = createMockError();
      const onRetry = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(<ErrorMessage error={error} onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /Retry/i });
      fireEvent.click(retryButton);

      expect(retryButton).toBeDisabled();
      expect(retryButton).toHaveTextContent('Retrying...');
    });

    it('renders dismiss button when onDismiss is provided', () => {
      const error = createMockError();
      const onDismiss = vi.fn();

      render(<ErrorMessage error={error} onDismiss={onDismiss} />);

      expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button is clicked', () => {
      const error = createMockError();
      const onDismiss = vi.fn();

      render(<ErrorMessage error={error} onDismiss={onDismiss} />);

      fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has proper role and aria-live attributes', () => {
      const error = createMockError();

      const { container } = render(<ErrorMessage error={error} />);

      const element = container.firstChild as HTMLElement;
      expect(element).toHaveAttribute('role', 'alert');
      expect(element).toHaveAttribute('aria-live', 'polite');
      expect(element).toHaveAttribute('aria-atomic', 'true');
    });

    it('has accessible button labels', () => {
      const error = createMockError();
      const onRetry = vi.fn();
      const onDismiss = vi.fn();

      render(<ErrorMessage error={error} onRetry={onRetry} onDismiss={onDismiss} />);

      expect(screen.getByRole('button', { name: 'Retry operation' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss error' })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing troubleshooting hints', () => {
      const error = createMockError({ troubleshootingHints: undefined });

      render(<ErrorMessage error={error} showTroubleshooting={true} />);

      expect(screen.queryByText(/Troubleshooting:/i)).not.toBeInTheDocument();
    });

    it('handles empty troubleshooting hints array', () => {
      const error = createMockError({ troubleshootingHints: [] });

      render(<ErrorMessage error={error} showTroubleshooting={true} />);

      expect(screen.queryByText(/Troubleshooting:/i)).not.toBeInTheDocument();
    });

    it('handles very long error messages', () => {
      const longMessage = 'A'.repeat(1000);
      const error = createMockError({ message: longMessage });

      render(<ErrorMessage error={error} />);

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });
  });
});
