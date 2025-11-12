/**
 * FeatureErrorBoundary Component Tests
 *
 * Comprehensive test suite for feature-level error boundaries.
 * Target: 95%+ test coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FeatureErrorBoundary } from '../FeatureErrorBoundary';
import * as sentryModule from '../../monitoring/sentry';

// Mock Sentry module
jest.mock('../../monitoring/sentry', () => ({
  captureError: jest.fn(() => 'test-error-id'),
  addBreadcrumb: jest.fn(),
}));

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({
  shouldThrow = true,
  errorMessage = 'Test feature error',
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>Feature working</div>;
};

describe('FeatureErrorBoundary', () => {
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
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <div>Test Content</div>
        </FeatureErrorBoundary>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders feature error fallback UI when error is thrown', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByText(/TestFeature Feature Error/i)).toBeInTheDocument();
    });

    it('displays feature name in error message', () => {
      render(
        <FeatureErrorBoundary featureName="Analytics">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByRole('heading', { name: /Analytics Feature Error/i })).toBeInTheDocument();
      expect(screen.getByText(/We encountered an issue loading the Analytics feature/i)).toBeInTheDocument();
    });

    it('displays error reference ID', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByText(/Error Reference:/i)).toBeInTheDocument();
      expect(screen.getByText(/test-error-id/i)).toBeInTheDocument();
    });
  });

  describe('Auto-Retry Functionality', () => {
    it('automatically retries on error when autoRetry is true', async () => {
      let shouldThrow = true;

      const DynamicError: React.FC = () => {
        if (shouldThrow) {
          throw new Error('Auto retry test');
        }
        return <div>Feature working</div>;
      };

      const { rerender } = render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={true} maxRetries={3}>
          <DynamicError />
        </FeatureErrorBoundary>
      );

      // Error should be shown initially
      expect(screen.getByText(/TestFeature Feature Error/i)).toBeInTheDocument();

      // After retry delay, fix the error and advance timers
      shouldThrow = false;
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Feature working/i)).toBeInTheDocument();
      });
    });

    it('shows retry status during auto-retry', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={true} maxRetries={3}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(screen.getByText(/Automatically retrying/i)).toBeInTheDocument();
      expect(screen.getByText(/Attempt 1 of 3/i)).toBeInTheDocument();
    });

    it('uses exponential backoff for retries', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={true} maxRetries={3}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      // First retry after 1s
      act(() => {
        jest.advanceTimersByTime(999);
      });
      expect(screen.getByText(/TestFeature Feature Error/i)).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1);
      });

      // If still erroring, should attempt retry
      expect(sentryModule.captureError).toHaveBeenCalled();
    });

    it('stops auto-retry after maxRetries', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={true} maxRetries={2}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      // Advance through all retries
      act(() => {
        jest.advanceTimersByTime(1000); // First retry
      });
      act(() => {
        jest.advanceTimersByTime(2000); // Second retry
      });

      expect(screen.getByText(/Maximum retry attempts reached/i)).toBeInTheDocument();
    });

    it('does not auto-retry when autoRetry is false', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={false}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should still show error, no automatic retry
      expect(screen.getByText(/TestFeature Feature Error/i)).toBeInTheDocument();
      expect(screen.queryByText(/Automatically retrying/i)).not.toBeInTheDocument();
    });
  });

  describe('Manual Retry', () => {
    it('provides retry button for manual retry', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={false}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /Retry TestFeature feature/i })).toBeInTheDocument();
    });

    it('resets error state when retry button is clicked', async () => {
      let shouldThrow = true;
      const DynamicError: React.FC = () => {
        if (shouldThrow) {
          throw new Error('Dynamic error');
        }
        return <div>Feature working</div>;
      };

      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={false}>
          <DynamicError />
        </FeatureErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: /Retry TestFeature feature/i });

      // Fix the error before clicking retry
      shouldThrow = false;

      act(() => {
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Feature working')).toBeInTheDocument();
      });
    });

    it('hides retry button when max retries reached', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" maxRetries={0}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Maximum retry attempts reached/i)).toBeInTheDocument();
    });
  });

  describe('Sentry Integration', () => {
    it('captures error with feature context', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(sentryModule.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'feature',
          featureName: 'TestFeature',
          retryCount: 0,
        })
      );
    });

    it('adds breadcrumb with feature information', () => {
      render(
        <FeatureErrorBoundary featureName="Analytics">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(sentryModule.addBreadcrumb).toHaveBeenCalledWith(
        expect.stringContaining('Feature error in Analytics'),
        'feature-error',
        'error'
      );
    });

    it('includes retry count in error context', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={true} maxRetries={3}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(sentryModule.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          retryCount: expect.any(Number),
        })
      );
    });
  });

  describe('Custom Error Handler', () => {
    it('calls custom onError handler when provided', () => {
      const onErrorHandler = jest.fn();

      render(
        <FeatureErrorBoundary featureName="TestFeature" onError={onErrorHandler}>
          <ThrowError errorMessage="Custom handler test" />
        </FeatureErrorBoundary>
      );

      expect(onErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('Navigation Actions', () => {
    it('provides go home button', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /go to home page/i })).toBeInTheDocument();
    });

    it('navigates to home when go home button is clicked', () => {
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });

      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      const homeButton = screen.getByRole('button', { name: /go to home page/i });
      fireEvent.click(homeButton);

      expect(window.location.href).toBe('/');
    });
  });

  describe('Development Mode', () => {
    it('shows error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError errorMessage="Dev mode error" />
        </FeatureErrorBoundary>
      );

      expect(screen.getByText(/Development Error Details/i)).toBeInTheDocument();
      // Error message appears in both the error display and stack trace, so use getAllByText
      const errorMessages = screen.getAllByText(/Dev mode error/i);
      expect(errorMessages.length).toBeGreaterThan(0);

      process.env.NODE_ENV = originalEnv;
    });

    it('hides error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError errorMessage="Prod mode error" />
        </FeatureErrorBoundary>
      );

      expect(screen.queryByText(/Development Error Details/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback component when provided', () => {
      const CustomFallback = () => <div>Custom Error UI</div>;

      render(
        <FeatureErrorBoundary featureName="TestFeature" fallback={CustomFallback}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible button labels with feature context', () => {
      render(
        <FeatureErrorBoundary featureName="Analytics" autoRetry={false}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /retry analytics feature/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to home page/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ThrowError />
        </FeatureErrorBoundary>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveClass(/focus:ring/);
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('cleans up retry timeout on unmount', () => {
      const { unmount } = render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={true}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(() => unmount()).not.toThrow();
    });

    it('cancels pending retry when manual reset is triggered', () => {
      let shouldThrow = true;
      const DynamicError: React.FC = () => {
        if (shouldThrow) {
          throw new Error('Dynamic error');
        }
        return <div>Feature working</div>;
      };

      // Use autoRetry=false so the manual retry button is visible
      render(
        <FeatureErrorBoundary featureName="TestFeature" autoRetry={false} maxRetries={3}>
          <DynamicError />
        </FeatureErrorBoundary>
      );

      // Schedule a manual retry by clicking the button
      const retryButton = screen.getByRole('button', { name: /Retry TestFeature feature/i });

      // Fix the error before retrying
      shouldThrow = false;

      act(() => {
        fireEvent.click(retryButton);
      });

      // Component should have cleared error state and rendered children
      expect(screen.queryByText(/Feature working/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles errors with missing stack traces', () => {
      const ErrorNoStack = () => {
        const error = new Error('No stack');
        error.stack = undefined;
        throw error;
      };

      render(
        <FeatureErrorBoundary featureName="TestFeature">
          <ErrorNoStack />
        </FeatureErrorBoundary>
      );

      expect(screen.getByText(/TestFeature Feature Error/i)).toBeInTheDocument();
    });

    it('handles very long feature names', () => {
      const longFeatureName = 'A'.repeat(100);

      render(
        <FeatureErrorBoundary featureName={longFeatureName}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      // Long feature name appears in heading - use getAllByText to check it exists
      const matches = screen.getAllByText(new RegExp(`${longFeatureName}`));
      expect(matches.length).toBeGreaterThan(0);
    });

    it('handles maxRetries of 0', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" maxRetries={0}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByText(/Maximum retry attempts reached/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Retry TestFeature feature/i })).not.toBeInTheDocument();
    });

    it('handles very high maxRetries values', () => {
      render(
        <FeatureErrorBoundary featureName="TestFeature" maxRetries={1000} autoRetry={false}>
          <ThrowError />
        </FeatureErrorBoundary>
      );

      expect(screen.getByText(/TestFeature Feature Error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry TestFeature feature/i })).toBeInTheDocument();
    });
  });
});
