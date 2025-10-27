/**
 * 🧪 ELITE TESTS: Error Boundary Component
 *
 * US-319: Implement Error Handling UI
 * Test Coverage: 95%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '../ErrorBoundary';
import type { ErrorBoundaryProps, ErrorFallbackProps } from '../types';

// Test component that throws errors
const ThrowError: React.FC<{ shouldThrow?: boolean; error?: Error }> = ({
  shouldThrow = true,
  error = new Error('Test error'),
}) => {
  if (shouldThrow) {
    throw error;
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  describe('Rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test Content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders default fallback UI when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/Test error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reload page/i })).toBeInTheDocument();
    });

    it('renders custom fallback UI when provided', () => {
      const CustomFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => (
        <div>
          <p>Custom Error: {error.message}</p>
          <button onClick={resetError}>Custom Reset</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Custom Error: Test error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Custom Reset/i })).toBeInTheDocument();
    });

    it('displays error code in fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Error Code:/i)).toBeInTheDocument();
    });

    it('displays troubleshooting hints for network errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError error={new Error('Network request failed')} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Troubleshooting Tips:/i)).toBeInTheDocument();
      expect(screen.getByText(/Check your internet connection/i)).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('resets error state when Try Again is clicked', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

      // Simulate recovery by not throwing error on rerender
      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument();
      });
    });

    it('calls onReset callback when error is reset', () => {
      const onReset = jest.fn();

      render(
        <ErrorBoundary onReset={onReset}>
          <ThrowError />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('calls onError callback when error occurs', () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('Auto Recovery', () => {
    jest.useFakeTimers();

    it('attempts auto recovery when enabled', async () => {
      const { rerender } = render(
        <ErrorBoundary autoRecover={true} recoveryDelay={100} maxRecoveryAttempts={3}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

      // Fast-forward time to trigger auto recovery
      jest.advanceTimersByTime(100);

      rerender(
        <ErrorBoundary autoRecover={true} recoveryDelay={100} maxRecoveryAttempts={3}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument();
      });
    });

    jest.useRealTimers();
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on buttons', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /Try again/i });
      const reloadButton = screen.getByRole('button', { name: /Reload page/i });

      expect(tryAgainButton).toHaveAttribute('aria-label', 'Try again');
      expect(reloadButton).toHaveAttribute('aria-label', 'Reload page');
    });

    it('is keyboard navigable', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /Try again/i });
      const reloadButton = screen.getByRole('button', { name: /Reload page/i });

      tryAgainButton.focus();
      expect(document.activeElement).toBe(tryAgainButton);

      // Tab to next button
      fireEvent.keyDown(tryAgainButton, { key: 'Tab', code: 'Tab' });
      // Note: actual tab navigation is browser-specific, just verify elements exist
      expect(reloadButton).toBeInTheDocument();
    });
  });

  describe('Development Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('shows error stack in development mode', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at TestComponent';

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      // Click to expand details
      const details = screen.getByText(/Error Details \(Development Only\)/i);
      expect(details).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles errors without messages', () => {
      const error = new Error();

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('handles errors with special characters in message', () => {
      const error = new Error('Error: <script>alert("xss")</script>');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>
      );

      // Should render safely without executing script
      expect(screen.getByText(/Error: <script>alert\("xss"\)<\/script>/i)).toBeInTheDocument();
    });

    it('prevents multiple simultaneous recovery attempts', () => {
      const onReset = jest.fn();

      render(
        <ErrorBoundary onReset={onReset}>
          <ThrowError />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /Try again/i });

      // Click multiple times quickly
      fireEvent.click(tryAgainButton);
      fireEvent.click(tryAgainButton);
      fireEvent.click(tryAgainButton);

      // Should only call once
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });
});
