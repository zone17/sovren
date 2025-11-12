/* eslint-env browser, node */
/**
 * Feature Error Boundary Component
 *
 * Granular error boundaries for individual features.
 * Provides feature-specific error handling with auto-retry and graceful degradation.
 *
 * @module components/FeatureErrorBoundary
 */

import React, { Component, ErrorInfo } from 'react';
import { captureError, addBreadcrumb } from '../monitoring/sentry';

interface FeatureErrorBoundaryProps {
  children: React.ReactNode;
  featureName: string;
  fallback?: React.ComponentType<FeatureErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  autoRetry?: boolean;
}

interface FeatureErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  isRetrying: boolean;
}

export interface FeatureErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  errorId: string;
  featureName: string;
  retryCount: number;
  maxRetries: number;
  onReset: () => void;
  onGoHome: () => void;
  isRetrying: boolean;
}

/**
 * Feature Error Boundary
 *
 * Catches errors within a specific feature without affecting the rest of the app.
 * Supports automatic retry with exponential backoff.
 */
export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  private retryTimeoutId: number | null = null;

  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  /**
   * Update state when error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<FeatureErrorBoundaryState> {
    // Generate temporary error ID immediately so fallback can render
    const tempErrorId = `feature-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId: tempErrorId,
    };
  }

  /**
   * Handle error and report to Sentry
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { featureName, onError, maxRetries = 3, autoRetry = true } = this.props;
    const { retryCount } = this.state;

    // Generate unique error ID
    const errorId = `feature-error-${featureName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add breadcrumb for context
    addBreadcrumb(
      `Feature error in ${featureName}: ${error.message}`,
      'feature-error',
      'error'
    );

    // Capture error with feature context
    const sentryErrorId = captureError(error, {
      level: 'feature',
      featureName,
      errorId,
      retryCount,
      componentStack: errorInfo.componentStack || '',
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
    });

    // Update state with error info
    this.setState({
      errorInfo,
      errorId: sentryErrorId || errorId,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`Feature Error Boundary (${featureName}) caught error:`, error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // Auto-retry if enabled and under max retries
    if (autoRetry && retryCount < maxRetries) {
      this.scheduleRetry();
    }
  }

  /**
   * Schedule automatic retry with exponential backoff
   */
  private scheduleRetry = (): void => {
    const { retryCount } = this.state;
    const { maxRetries = 3 } = this.props;

    if (retryCount >= maxRetries) {
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, etc. (max 10s)
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);

    this.setState({ isRetrying: true });

    this.retryTimeoutId = window.setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
        isRetrying: false,
      }));
    }, delay);
  };

  /**
   * Manual reset (user clicked retry)
   */
  private handleReset = (): void => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRetrying: false,
    });
  };

  /**
   * Navigate to home page
   */
  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  /**
   * Cleanup on unmount
   */
  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render(): React.ReactNode {
    const { hasError, error, errorInfo, errorId, retryCount, isRetrying } = this.state;
    const { children, featureName, fallback: CustomFallback, maxRetries = 3 } = this.props;

    if (hasError && error && errorId) {
      const FallbackComponent = CustomFallback || FeatureErrorFallback;

      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo}
          errorId={errorId}
          featureName={featureName}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
          isRetrying={isRetrying}
        />
      );
    }

    return children;
  }
}

/**
 * Default Feature Error Fallback UI Component
 */
export const FeatureErrorFallback: React.FC<FeatureErrorFallbackProps> = ({
  error,
  errorId,
  featureName,
  retryCount,
  maxRetries,
  onReset,
  onGoHome,
  isRetrying,
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const canRetry = retryCount < maxRetries;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6 m-4">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <svg
            className="w-8 h-8 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {featureName} Feature Error
          </h3>

          <p className="text-gray-700 mb-4">
            We encountered an issue loading the {featureName} feature. You can continue using the
            rest of the application while we work on resolving this.
          </p>

          {/* Retry Status */}
          {isRetrying && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <p className="text-sm text-blue-800">
                  Automatically retrying... (Attempt {retryCount + 1} of {maxRetries})
                </p>
              </div>
            </div>
          )}

          {/* Error Reference */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <p className="text-xs text-gray-600 mb-1">Error Reference:</p>
            <code className="text-xs font-mono text-gray-900 bg-white px-2 py-1 rounded border border-gray-300">
              {errorId}
            </code>
          </div>

          {/* Development Details */}
          {isDevelopment && (
            <details className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800 mb-2">
                Development Error Details
              </summary>
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Error:</p>
                  <pre className="text-xs text-gray-900 bg-white p-2 rounded border border-gray-300 overflow-x-auto">
                    {error.message}
                  </pre>
                </div>
                {error.stack && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Stack:</p>
                    <pre className="text-xs text-gray-900 bg-white p-2 rounded border border-gray-300 overflow-x-auto max-h-32">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {canRetry && !isRetrying && (
              <button
                onClick={onReset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={`Retry ${featureName} feature`}
              >
                Try Again
              </button>
            )}
            <button
              onClick={onGoHome}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Go to home page"
            >
              Go to Home
            </button>
            {!canRetry && !isRetrying && (
              <p className="text-sm text-gray-600 self-center">
                Maximum retry attempts reached. Please refresh the page or contact support.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureErrorBoundary;
