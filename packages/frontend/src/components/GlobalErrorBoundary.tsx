/* eslint-env browser, node */
/**
 * Global Error Boundary Component
 *
 * Top-level error boundary that catches all unhandled errors in the React tree.
 * Integrates with Sentry for error reporting and provides user-friendly fallback UI.
 *
 * @module components/GlobalErrorBoundary
 */

import React, { Component, ErrorInfo } from 'react';
import { captureError, addBreadcrumb } from '../monitoring/sentry';

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Global Error Boundary
 *
 * Catches all errors that aren't caught by feature-level boundaries.
 * Provides last line of defense against app crashes.
 */
export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  /**
   * Update state when error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Handle error and report to Sentry
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;

    // Generate unique error ID
    const errorId = `global-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add breadcrumb for context
    addBreadcrumb(
      `Global error boundary caught: ${error.message}`,
      'error',
      'error'
    );

    // Capture error with full context
    const sentryErrorId = captureError(error, {
      level: 'global',
      errorId,
      componentStack: errorInfo.componentStack || '',
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
    });

    // Update state with error info and Sentry ID
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
      // eslint-disable-next-line no-console
      console.error('Global Error Boundary caught error:', error);
      // eslint-disable-next-line no-console
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  /**
   * Reset error state
   */
  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  /**
   * Navigate to home page
   */
  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  /**
   * Reload the page
   */
  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children } = this.props;

    if (hasError && error) {
      // Import and render GlobalErrorFallback
      return (
        <GlobalErrorFallback
          error={error}
          errorInfo={errorInfo}
          errorId={errorId || 'unknown'}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
          onReload={this.handleReload}
        />
      );
    }

    return children;
  }
}

/**
 * Global Error Fallback UI Component
 */
interface GlobalErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  errorId: string;
  onReset: () => void;
  onGoHome: () => void;
  onReload: () => void;
}

const GlobalErrorFallback: React.FC<GlobalErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onReset,
  onGoHome,
  onReload,
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white p-6">
          <div className="flex items-center gap-4">
            <svg
              className="w-12 h-12 flex-shrink-0"
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
            <div>
              <h1 className="text-2xl font-bold">Application Error</h1>
              <p className="text-red-100 text-sm">Something unexpected happened</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">What happened?</h2>
            <p className="text-gray-700">
              We encountered an unexpected error. Our team has been automatically notified and will
              investigate the issue.
            </p>
          </div>

          {/* Error ID */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Error Reference ID:</p>
            <code className="text-xs font-mono text-gray-900 bg-white px-2 py-1 rounded border border-gray-300">
              {errorId}
            </code>
          </div>

          {/* Development Details */}
          {isDevelopment && (
            <details className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <summary className="cursor-pointer font-semibold text-yellow-900 mb-2">
                Development Error Details
              </summary>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-yellow-800 mb-1">Error Message:</p>
                  <pre className="text-xs text-yellow-900 bg-white p-3 rounded border border-yellow-300 overflow-x-auto">
                    {error.message}
                  </pre>
                </div>
                {error.stack && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-800 mb-1">Stack Trace:</p>
                    <pre className="text-xs text-yellow-900 bg-white p-3 rounded border border-yellow-300 overflow-x-auto max-h-48">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-800 mb-1">Component Stack:</p>
                    <pre className="text-xs text-yellow-900 bg-white p-3 rounded border border-yellow-300 overflow-x-auto max-h-48">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onReload}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Reload the page"
            >
              Reload Page
            </button>
            <button
              onClick={onGoHome}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Go to home page"
            >
              Go to Home
            </button>
            <button
              onClick={onReset}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Try again"
            >
              Try Again
            </button>
          </div>

          {/* Help Text */}
          <div className="text-center text-sm text-gray-600">
            <p>If this problem persists, please contact support with the error reference ID above.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalErrorBoundary;
