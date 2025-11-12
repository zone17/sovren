/**
 * GlobalErrorBoundary Component Tests
 *
 * Comprehensive test suite for global error boundary.
 * Target: 95%+ test coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalErrorBoundary } from '../GlobalErrorBoundary';
import * as sentryModule from '../../monitoring/sentry';

// Mock Sentry module
jest.mock('../../monitoring/sentry', () => ({
  captureError: jest.fn(() => 'test-error-id'),
  addBreadcrumb: jest.fn(),
}));

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({
  shouldThrow = true,
  errorMessage = 'Test error',
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

describe('GlobalErrorBoundary', () => {
  // Suppress console errors during tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <GlobalErrorBoundary>
          <div>Test Content</div>
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders error fallback UI when error is thrown', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
      expect(screen.getByText(/Something unexpected happened/i)).toBeInTheDocument();
    });

    it('displays error message in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <GlobalErrorBoundary>
          <ThrowError errorMessage="Custom error message" />
        </GlobalErrorBoundary>
      );

      const errorMessages = screen.getAllByText(/Custom error message/i);
      expect(errorMessages.length).toBeGreaterThan(0);

      process.env.NODE_ENV = originalEnv;
    });

    it('hides error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <GlobalErrorBoundary>
          <ThrowError errorMessage="Secret error" />
        </GlobalErrorBoundary>
      );

      expect(screen.queryByText(/Secret error/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Development Error Details/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('displays error reference ID', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText(/Error Reference ID:/i)).toBeInTheDocument();
      expect(screen.getByText(/test-error-id/i)).toBeInTheDocument();
    });
  });

  describe('Sentry Integration', () => {
    it('calls captureError with error details', () => {
      const testError = new Error('Sentry test error');

      render(
        <GlobalErrorBoundary>
          <ThrowError errorMessage="Sentry test error" />
        </GlobalErrorBoundary>
      );

      expect(sentryModule.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'global',
          url: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });

    it('adds breadcrumb before capturing error', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError errorMessage="Breadcrumb test" />
        </GlobalErrorBoundary>
      );

      expect(sentryModule.addBreadcrumb).toHaveBeenCalledWith(
        expect.stringContaining('Global error boundary caught'),
        'error',
        'error'
      );
    });

    it('includes error context in Sentry report', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(sentryModule.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorId: expect.any(String),
          componentStack: expect.any(String),
          userAgent: expect.any(String),
          viewport: expect.any(String),
          online: expect.any(Boolean),
        })
      );
    });
  });

  describe('Error Recovery', () => {
    it('provides retry button', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('provides reload button', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
    });

    it('provides go home button', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /go to home page/i })).toBeInTheDocument();
    });
  });

  describe('Custom Error Handler', () => {
    it('calls custom onError handler when provided', () => {
      const onErrorHandler = jest.fn();

      render(
        <GlobalErrorBoundary onError={onErrorHandler}>
          <ThrowError errorMessage="Handler test" />
        </GlobalErrorBoundary>
      );

      expect(onErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('continues normal error handling even with custom handler', () => {
      const onErrorHandler = jest.fn();

      render(
        <GlobalErrorBoundary onError={onErrorHandler}>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(onErrorHandler).toHaveBeenCalled();
      expect(sentryModule.captureError).toHaveBeenCalled();
      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible button labels', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to home page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('provides focus styles for keyboard navigation', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      // Buttons should have focus ring classes for accessibility
      buttons.forEach((button) => {
        const classes = button.className;
        expect(classes).toContain('focus:');
      });
    });
  });

  describe('Error States', () => {
    it('handles errors with missing stack traces', () => {
      const errorWithoutStack = new Error('No stack');
      errorWithoutStack.stack = undefined;

      const ThrowErrorNoStack = () => {
        throw errorWithoutStack;
      };

      render(
        <GlobalErrorBoundary>
          <ThrowErrorNoStack />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });

    it('handles errors with very long messages', () => {
      const longMessage = 'A'.repeat(1000);

      render(
        <GlobalErrorBoundary>
          <ThrowError errorMessage={longMessage} />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });

    it('handles multiple sequential errors', () => {
      const { rerender } = render(
        <GlobalErrorBoundary>
          <ThrowError errorMessage="First error" />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();

      rerender(
        <GlobalErrorBoundary>
          <ThrowError errorMessage="Second error" />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });
  });

  describe('Component Lifecycle', () => {
    it('properly cleans up on unmount', () => {
      const { unmount } = render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(() => unmount()).not.toThrow();
    });

    it('maintains error state across re-renders', () => {
      const { rerender } = render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();

      rerender(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles errors thrown during render', () => {
      render(
        <GlobalErrorBoundary>
          <ThrowError />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });

    it('handles async errors caught by error boundary', () => {
      const AsyncError: React.FC = () => {
        React.useEffect(() => {
          throw new Error('Async error');
        }, []);
        return <div>Content</div>;
      };

      // Async errors in effects won't be caught by error boundaries
      // This test documents the limitation
      expect(() => {
        render(
          <GlobalErrorBoundary>
            <AsyncError />
          </GlobalErrorBoundary>
        );
      }).not.toThrow();
    });

    it('handles component with null children', () => {
      render(<GlobalErrorBoundary>{null}</GlobalErrorBoundary>);

      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });
  });
});
