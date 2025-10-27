/**
 * 🛡️ ELITE COMPONENT: Error Boundary
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * React Error Boundary for catching unhandled errors:
 * - Catches component tree errors
 * - Displays fallback UI
 * - Logs errors to console/Sentry
 * - Provides recovery mechanism
 * - Automatic recovery with backoff
 */

import React, { Component } from 'react';
import type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorFallbackProps,
  NostrErrorMetadata,
} from './types';
import { ErrorCategory, ErrorSeverity, NostrErrorCode } from './types';

/**
 * Default error fallback UI
 */
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorMetadata,
  resetError,
  isRecovering,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {/* Error Icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full">
          <svg
            className="w-6 h-6 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Title */}
        <h2 className="mt-4 text-xl font-bold text-center text-gray-900 dark:text-gray-100">
          {errorMetadata?.title || 'Something went wrong'}
        </h2>

        {/* Error Message */}
        <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
          {errorMetadata?.message || error.message || 'An unexpected error occurred'}
        </p>

        {/* Error Code */}
        {errorMetadata?.code && (
          <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-500 font-mono">
            Error Code: {errorMetadata.code}
          </p>
        )}

        {/* Troubleshooting Hints */}
        {errorMetadata?.troubleshootingHints && errorMetadata.troubleshootingHints.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Troubleshooting Tips:
            </h3>
            <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
              {errorMetadata.troubleshootingHints.map((hint, index) => (
                <li key={index}>{hint}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={resetError}
            disabled={isRecovering}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Try again"
          >
            {isRecovering ? 'Recovering...' : 'Try Again'}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label="Reload page"
          >
            Reload Page
          </button>
        </div>

        {/* Development Info */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="text-xs text-gray-500 dark:text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 p-3 rounded-md overflow-auto max-h-48">
              {error.stack || error.toString()}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

/**
 * Error Boundary Component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private recoveryAttempts = 0;
  private recoveryTimer?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isRecovering: false,
    };
  }

  /**
   * Static method to derive state from error
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Component did catch error
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Create error metadata
    const errorMetadata = this.createErrorMetadata(error);

    // Update state
    this.setState({
      errorInfo,
      errorMetadata,
    });

    // Log error
    this.logError(error, errorInfo, errorMetadata);

    // Call onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorMetadata);
    }

    // Auto-recover if enabled
    if (this.props.autoRecover && this.shouldAttemptRecovery()) {
      this.attemptAutoRecovery();
    }
  }

  /**
   * Create error metadata from error object
   */
  private createErrorMetadata(error: Error): NostrErrorMetadata {
    // Try to infer error type from message
    const errorMessage = error.message.toLowerCase();
    let code = NostrErrorCode.UNKNOWN_ERROR;
    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.CRITICAL;

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      code = NostrErrorCode.NETWORK_ERROR;
      category = ErrorCategory.NETWORK;
      severity = ErrorSeverity.ERROR;
    } else if (errorMessage.includes('timeout')) {
      code = NostrErrorCode.CONNECTION_TIMEOUT;
      category = ErrorCategory.CONNECTION;
      severity = ErrorSeverity.WARNING;
    } else if (errorMessage.includes('websocket')) {
      code = NostrErrorCode.WEBSOCKET_ERROR;
      category = ErrorCategory.CONNECTION;
      severity = ErrorSeverity.ERROR;
    }

    return {
      code,
      category,
      severity,
      title: 'Application Error',
      message: error.message,
      timestamp: Date.now(),
      originalError: error,
      troubleshootingHints: this.getTroubleshootingHints(code),
      recoverySuggestions: [
        'Try refreshing the page',
        'Check your internet connection',
        'Clear your browser cache',
        'Try again in a few moments',
      ],
    };
  }

  /**
   * Get troubleshooting hints based on error code
   */
  private getTroubleshootingHints(code: NostrErrorCode): string[] {
    switch (code) {
      case NostrErrorCode.NETWORK_ERROR:
        return [
          'Check your internet connection',
          'Verify that relay servers are accessible',
          'Disable VPN or proxy if enabled',
        ];
      case NostrErrorCode.CONNECTION_TIMEOUT:
        return [
          'The connection is taking too long to establish',
          'Try again in a few moments',
          'Check if relay servers are online',
        ];
      case NostrErrorCode.WEBSOCKET_ERROR:
        return [
          'WebSocket connection failed',
          'Check browser console for more details',
          'Verify relay URLs are correct',
        ];
      default:
        return [
          'An unexpected error occurred',
          'Try refreshing the page',
          'Contact support if the issue persists',
        ];
    }
  }

  /**
   * Log error to console and monitoring services
   */
  private logError(
    error: Error,
    errorInfo: React.ErrorInfo,
    metadata: NostrErrorMetadata
  ): void {
    console.error('[ErrorBoundary] Caught error:', {
      error,
      errorInfo,
      metadata,
    });

    // Log to Sentry in production
    if (process.env.NODE_ENV === 'production' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorCode: metadata.code,
          errorCategory: metadata.category,
          errorSeverity: metadata.severity,
        },
      });
    }
  }

  /**
   * Check if should attempt auto-recovery
   */
  private shouldAttemptRecovery(): boolean {
    const maxAttempts = this.props.maxRecoveryAttempts || 3;
    return this.recoveryAttempts < maxAttempts;
  }

  /**
   * Attempt automatic recovery
   */
  private attemptAutoRecovery(): void {
    const delay = this.props.recoveryDelay || 1000;
    const backoffDelay = delay * Math.pow(2, this.recoveryAttempts);

    this.setState({ isRecovering: true });

    this.recoveryTimer = setTimeout(() => {
      this.recoveryAttempts++;
      this.resetError();
    }, backoffDelay);
  }

  /**
   * Reset error state
   */
  private resetError = (): void => {
    // Clear recovery timer
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    // Reset state
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorMetadata: undefined,
      isRecovering: false,
    });

    // Call onReset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  /**
   * Component will unmount
   */
  componentWillUnmount(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          errorMetadata: this.state.errorMetadata,
          resetError: this.resetError,
          isRecovering: this.state.isRecovering,
        });
      }

      // Use default fallback
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorMetadata={this.state.errorMetadata}
          resetError={this.resetError}
          isRecovering={this.state.isRecovering}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
