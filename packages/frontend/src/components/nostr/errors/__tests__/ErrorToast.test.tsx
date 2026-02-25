/**
 * 🧪 ELITE TESTS: Error Toast System
 *
 * US-319: Implement Error Handling UI
 * Test Coverage: 95%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorToastContainer, useErrorToast, errorToast } from '../ErrorToast';
import { ErrorSeverity, ErrorCategory, NostrErrorCode } from '../types';
import type { NostrErrorMetadata, ErrorToastOptions } from '../types';

const createMockError = (overrides?: Partial<NostrErrorMetadata>): NostrErrorMetadata => ({
  code: NostrErrorCode.PUBLISH_FAILED,
  category: ErrorCategory.PUBLISHING,
  severity: ErrorSeverity.ERROR,
  title: 'Publish Failed',
  message: 'Failed to publish event to relay',
  timestamp: Date.now(),
  ...overrides,
});

// Test component using the hook
const TestComponent: React.FC<{ options: ErrorToastOptions }> = ({ options }) => {
  const { showError, dismiss, dismissAll, toasts } = useErrorToast();

  return (
    <div>
      <button onClick={() => showError(options)}>Show Toast</button>
      <button onClick={() => toasts.length > 0 && dismiss(toasts[0].id)}>Dismiss First</button>
      <button onClick={dismissAll}>Dismiss All</button>
      <div data-testid="toast-count">{toasts.length}</div>
    </div>
  );
};

describe('ErrorToast', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllTimers();
    // Clear any existing toasts
    errorToast.dismissAll();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('useErrorToast Hook', () => {
    it('shows error toast when showError is called', () => {
      const error = createMockError();

      render(
        <>
          <TestComponent options={{ error }} />
          <ErrorToastContainer />
        </>
      );

      fireEvent.click(screen.getByText('Show Toast'));

      expect(screen.getByText('Publish Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to publish event to relay')).toBeInTheDocument();
    });

    it('dismisses toast when dismiss is called', async () => {
      const error = createMockError();

      render(
        <>
          <TestComponent options={{ error }} />
          <ErrorToastContainer />
        </>
      );

      fireEvent.click(screen.getByText('Show Toast'));
      expect(screen.getByText('Publish Failed')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Dismiss First'));

      await waitFor(() => {
        expect(screen.queryByText('Publish Failed')).not.toBeInTheDocument();
      });
    });

    it('dismisses all toasts when dismissAll is called', async () => {
      const error1 = createMockError({ title: 'Error 1' });
      const error2 = createMockError({ title: 'Error 2' });

      render(
        <>
          <TestComponent options={{ error: error1 }} />
          <ErrorToastContainer />
        </>
      );

      fireEvent.click(screen.getByText('Show Toast'));

      // Manually add second toast
      act(() => {
        errorToast.show(error2);
      });

      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('Error 2')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Dismiss All'));

      await waitFor(() => {
        expect(screen.queryByText('Error 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Error 2')).not.toBeInTheDocument();
      });
    });

    it('tracks toast count correctly', () => {
      const error = createMockError();

      render(
        <>
          <TestComponent options={{ error }} />
          <ErrorToastContainer />
        </>
      );

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');

      fireEvent.click(screen.getByText('Show Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      fireEvent.click(screen.getByText('Show Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('2');
    });
  });

  describe('ErrorToastContainer', () => {
    it('renders nothing when no toasts', () => {
      const { container } = render(<ErrorToastContainer />);
      expect(container.firstChild).toBeNull();
    });

    it('renders toasts in correct order (newest first)', () => {
      const error1 = createMockError({ title: 'First Error' });
      const error2 = createMockError({ title: 'Second Error' });

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error1);
        errorToast.show(error2);
      });

      const toasts = screen.getAllByRole('alert');
      expect(toasts[0]).toHaveTextContent('Second Error');
      expect(toasts[1]).toHaveTextContent('First Error');
    });

    it('limits maximum toasts to 5', () => {
      render(<ErrorToastContainer />);

      act(() => {
        for (let i = 0; i < 10; i++) {
          errorToast.show(createMockError({ title: `Error ${i}` }));
        }
      });

      const toasts = screen.getAllByRole('alert');
      expect(toasts).toHaveLength(5);
    });

    it('auto-dismisses toasts after duration', async () => {
      const error = createMockError({ severity: ErrorSeverity.INFO });

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error);
      });

      expect(screen.getByText('Publish Failed')).toBeInTheDocument();

      // Advance time past auto-dismiss duration (3s for INFO)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Publish Failed')).not.toBeInTheDocument();
      });
    });

    it('does not auto-dismiss CRITICAL errors', async () => {
      const error = createMockError({ severity: ErrorSeverity.CRITICAL });

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error);
      });

      expect(screen.getByText('Publish Failed')).toBeInTheDocument();

      // Advance time significantly
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should still be visible
      expect(screen.getByText('Publish Failed')).toBeInTheDocument();
    });
  });

  describe('Severity Styling', () => {
    it('applies INFO severity styling', () => {
      const error = createMockError({ severity: ErrorSeverity.INFO });

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error);
      });

      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-blue-600');
    });

    it('applies WARNING severity styling', () => {
      const error = createMockError({ severity: ErrorSeverity.WARNING });

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error);
      });

      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-yellow-600');
    });

    it('applies CRITICAL severity styling', () => {
      const error = createMockError({ severity: ErrorSeverity.CRITICAL });

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error);
      });

      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('bg-red-700');
    });
  });

  describe('Retry Functionality', () => {
    it('shows retry button when retryable and onRetry provided', () => {
      const error = createMockError();
      const onRetry = vi.fn();

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { retryable: true, onRetry });
      });

      expect(screen.getByRole('button', { name: /Retry operation/i })).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const error = createMockError();
      const onRetry = vi.fn().mockResolvedValue(undefined);

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { retryable: true, onRetry });
      });

      fireEvent.click(screen.getByRole('button', { name: /Retry operation/i }));

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalledTimes(1);
      });
    });

    it('dismisses toast on successful retry', async () => {
      const error = createMockError();
      const onRetry = vi.fn().mockResolvedValue(undefined);

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { retryable: true, onRetry });
      });

      expect(screen.getByText('Publish Failed')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Retry operation/i }));

      await waitFor(() => {
        expect(screen.queryByText('Publish Failed')).not.toBeInTheDocument();
      });
    });

    it('disables retry button while retrying', async () => {
      const error = createMockError();
      const onRetry = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { retryable: true, onRetry });
      });

      const retryButton = screen.getByRole('button', { name: /Retry operation/i });
      fireEvent.click(retryButton);

      expect(retryButton).toBeDisabled();
      expect(retryButton).toHaveTextContent('Retrying...');
    });
  });

  describe('Manual Dismiss', () => {
    it('shows dismiss button when dismissible is true', () => {
      const error = createMockError();

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { dismissible: true });
      });

      expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
    });

    it('hides dismiss button when dismissible is false', () => {
      const error = createMockError();

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { dismissible: false });
      });

      expect(screen.queryByRole('button', { name: /Dismiss/i })).not.toBeInTheDocument();
    });

    it('calls onDismiss callback when dismissed', async () => {
      const error = createMockError();
      const onDismiss = vi.fn();

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { onDismiss });
      });

      fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const error = createMockError();

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error);
      });

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'assertive');
      expect(toast).toHaveAttribute('aria-atomic', 'true');
    });

    it('has accessible button labels', () => {
      const error = createMockError();
      const onRetry = vi.fn();

      render(<ErrorToastContainer />);

      act(() => {
        errorToast.show(error, { retryable: true, onRetry });
      });

      expect(screen.getByRole('button', { name: 'Retry operation' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });
  });

});
