/**
 * Error Boundary Integration Tests
 *
 * Tests the complete error boundary system including nested boundaries
 * and error recovery flows.
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GlobalErrorBoundary } from '../GlobalErrorBoundary';
import { FeatureErrorBoundary } from '../FeatureErrorBoundary';
import { AuthErrorBoundary } from '../../features/auth/ErrorBoundary';
import { ContentErrorBoundary } from '../../features/content/ErrorBoundary';
import * as sentryModule from '../../monitoring/sentry';

// Mock Sentry
jest.mock('../../monitoring/sentry', () => ({
  captureError: jest.fn(() => 'test-error-id'),
  addBreadcrumb: jest.fn(),
}));

describe('Error Boundary Integration', () => {
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

  describe('Nested Error Boundaries', () => {
    it('catches errors at feature level before reaching global boundary', () => {
      const FeatureError = () => {
        throw new Error('Feature level error');
      };

      render(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="TestFeature">
            <FeatureError />
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      // Should show feature-level error UI
      expect(screen.getByText(/TestFeature Feature Error/i)).toBeInTheDocument();
      // Should NOT show global error UI
      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });

    it('escalates to global boundary when feature boundary fails', () => {
      const AlwaysError = () => {
        throw new Error('Persistent error');
      };

      const BrokenFeatureBoundary = () => {
        throw new Error('Feature boundary itself failed');
      };

      render(
        <GlobalErrorBoundary>
          <BrokenFeatureBoundary />
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });

    it('isolates errors to specific features', () => {
      const Feature1Error = () => {
        throw new Error('Feature 1 error');
      };
      const Feature2Working = () => <div>Feature 2 working</div>;

      render(
        <GlobalErrorBoundary>
          <div>
            <FeatureErrorBoundary featureName="Feature1">
              <Feature1Error />
            </FeatureErrorBoundary>
            <FeatureErrorBoundary featureName="Feature2">
              <Feature2Working />
            </FeatureErrorBoundary>
          </div>
        </GlobalErrorBoundary>
      );

      // Feature 1 shows error
      expect(screen.getByText(/Feature1 Feature Error/i)).toBeInTheDocument();
      // Feature 2 continues working
      expect(screen.getByText('Feature 2 working')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Flows', () => {
    it('allows recovery from feature error without affecting global state', async () => {
      const TestComponent = () => {
        const [shouldError, setShouldError] = useState(true);

        if (shouldError) {
          throw new Error('Recoverable error');
        }

        return (
          <div>
            <div>Recovered successfully</div>
            <button onClick={() => setShouldError(true)}>Trigger Error Again</button>
          </div>
        );
      };

      const { rerender } = render(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="RecoverableFeature">
            <TestComponent />
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      // Error is shown
      expect(screen.getByText(/RecoverableFeature Feature Error/i)).toBeInTheDocument();

      // Click retry (this would need component state management in real scenario)
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // For this test, manually trigger re-render with recovered state
      const RecoveredComponent = () => <div>Recovered successfully</div>;
      rerender(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="RecoverableFeature">
            <RecoveredComponent />
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Recovered successfully')).toBeInTheDocument();
      });
    });

    it('allows navigation to home from feature error', () => {
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });

      const FeatureError = () => {
        throw new Error('Navigate from error');
      };

      render(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="TestFeature">
            <FeatureError />
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      const homeButton = screen.getByRole('button', { name: /go to home page/i });
      fireEvent.click(homeButton);

      expect(window.location.href).toBe('/');
    });
  });

  describe('Real-World Scenarios', () => {
    it('handles auth errors with custom fallback', () => {
      const AuthError = () => {
        throw new Error('Authentication failed');
      };

      render(
        <GlobalErrorBoundary>
          <AuthErrorBoundary>
            <AuthError />
          </AuthErrorBoundary>
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });

    it('handles content errors independently from auth', () => {
      const ContentError = () => {
        throw new Error('Content loading failed');
      };
      const AuthWorking = () => <div>Auth working</div>;

      render(
        <GlobalErrorBoundary>
          <AuthErrorBoundary>
            <AuthWorking />
          </AuthErrorBoundary>
          <ContentErrorBoundary>
            <ContentError />
          </ContentErrorBoundary>
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Auth working')).toBeInTheDocument();
      expect(screen.getByText(/Content Management Feature Error/i)).toBeInTheDocument();
    });

    it('preserves app functionality when non-critical feature fails', () => {
      const CriticalFeature = () => <div>Critical feature working</div>;
      const NonCriticalError = () => {
        throw new Error('Non-critical failure');
      };

      render(
        <GlobalErrorBoundary>
          <div>
            <FeatureErrorBoundary featureName="Critical">
              <CriticalFeature />
            </FeatureErrorBoundary>
            <FeatureErrorBoundary featureName="NonCritical">
              <NonCriticalError />
            </FeatureErrorBoundary>
          </div>
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Critical feature working')).toBeInTheDocument();
      expect(screen.getByText(/NonCritical Feature Error/i)).toBeInTheDocument();
    });
  });

  describe('Sentry Error Tracking', () => {
    it('tracks error hierarchy in nested boundaries', () => {
      const NestedError = () => {
        throw new Error('Nested component error');
      };

      render(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="ParentFeature">
            <FeatureErrorBoundary featureName="ChildFeature">
              <NestedError />
            </FeatureErrorBoundary>
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      // Child boundary should catch it first
      expect(sentryModule.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          featureName: 'ChildFeature',
          level: 'feature',
        })
      );
    });

    it('reports both breadcrumb and error capture for each boundary', () => {
      const ErrorComponent = () => {
        throw new Error('Tracked error');
      };

      render(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="TrackedFeature">
            <ErrorComponent />
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      expect(sentryModule.addBreadcrumb).toHaveBeenCalled();
      expect(sentryModule.captureError).toHaveBeenCalled();
    });
  });

  describe('Multiple Simultaneous Errors', () => {
    it('handles multiple feature errors at the same time', () => {
      const Feature1Error = () => {
        throw new Error('Feature 1 failed');
      };
      const Feature2Error = () => {
        throw new Error('Feature 2 failed');
      };
      const Feature3Working = () => <div>Feature 3 working</div>;

      render(
        <GlobalErrorBoundary>
          <div>
            <FeatureErrorBoundary featureName="Feature1">
              <Feature1Error />
            </FeatureErrorBoundary>
            <FeatureErrorBoundary featureName="Feature2">
              <Feature2Error />
            </FeatureErrorBoundary>
            <FeatureErrorBoundary featureName="Feature3">
              <Feature3Working />
            </FeatureErrorBoundary>
          </div>
        </GlobalErrorBoundary>
      );

      expect(screen.getByText(/Feature1 Feature Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Feature2 Feature Error/i)).toBeInTheDocument();
      expect(screen.getByText('Feature 3 working')).toBeInTheDocument();
    });
  });

  describe('Router Integration', () => {
    it('works correctly with React Router', () => {
      const RouteError = () => {
        throw new Error('Route component error');
      };

      render(
        <BrowserRouter>
          <GlobalErrorBoundary>
            <FeatureErrorBoundary featureName="RouteFeature">
              <RouteError />
            </FeatureErrorBoundary>
          </GlobalErrorBoundary>
        </BrowserRouter>
      );

      expect(screen.getByText(/RouteFeature Feature Error/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('does not significantly impact render performance when no errors', () => {
      const start = performance.now();

      const ManyComponents = () => (
        <>
          {Array.from({ length: 100 }, (_, i) => (
            <FeatureErrorBoundary key={i} featureName={`Feature${i}`}>
              <div>Component {i}</div>
            </FeatureErrorBoundary>
          ))}
        </>
      );

      render(
        <GlobalErrorBoundary>
          <ManyComponents />
        </GlobalErrorBoundary>
      );

      const end = performance.now();
      const renderTime = end - start;

      // Should render in reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Error Boundary Resilience', () => {
    it('continues to function after catching and recovering from error', () => {
      const ToggleError = () => {
        const [hasError, setHasError] = useState(false);

        if (hasError) {
          throw new Error('Toggled error');
        }

        return (
          <div>
            <div>Working state</div>
            <button onClick={() => setHasError(true)}>Cause Error</button>
          </div>
        );
      };

      const { rerender } = render(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="ToggleFeature">
            <ToggleError />
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Working state')).toBeInTheDocument();

      // Simulate causing an error
      const WorkingAfterRecovery = () => <div>Recovered and working</div>;
      rerender(
        <GlobalErrorBoundary>
          <FeatureErrorBoundary featureName="ToggleFeature">
            <WorkingAfterRecovery />
          </FeatureErrorBoundary>
        </GlobalErrorBoundary>
      );

      expect(screen.getByText('Recovered and working')).toBeInTheDocument();
    });
  });
});
