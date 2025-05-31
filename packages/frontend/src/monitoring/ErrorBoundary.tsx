import React, { Component, ErrorInfo, ReactNode } from 'react';
import { addBreadcrumb, captureError } from './simpleMonitoring';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'feature';
  name?: string;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  errorId: string;
  level: string;
  name?: string;
}

// Default error fallback component
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  errorId,
  level,
  name,
}) => {
  const isPageLevel = level === 'page';

  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-lg p-6 ${isPageLevel ? 'min-h-screen flex items-center justify-center' : 'm-4'}`}
    >
      <div className="max-w-md mx-auto text-center">
        <div className="text-red-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {isPageLevel ? 'Something went wrong' : 'Component Error'}
        </h2>

        <p className="text-gray-600 mb-4">
          {isPageLevel
            ? 'We encountered an unexpected error. Our team has been notified.'
            : `There was an error loading the ${name || 'component'}.`}
        </p>

        {(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && (
          <details className="text-left mb-4 bg-red-100 p-3 rounded border">
            <summary className="cursor-pointer font-medium text-red-800">
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs text-red-700 overflow-auto">
              {error.message}
              {error.stack}
            </pre>
            <p className="text-xs text-red-600 mt-2">Error ID: {errorId}</p>
          </details>
        )}

        <button
          onClick={resetError}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
        >
          Try Again
        </button>

        {isPageLevel && (
          <button
            onClick={() => window.location.reload()}
            className="ml-3 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            Reload Page
          </button>
        )}
      </div>
    </div>
  );
};

// Class-based error boundary component
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: number | null = null;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component', name } = this.props;
    const { errorId } = this.state;

    // Add breadcrumb for context
    addBreadcrumb(
      `Error boundary caught error in ${name || level}: ${error.message}`,
      'error',
      'error'
    );

    // Capture error with context
    captureError(error, {
      errorInfo,
      level,
      name,
      errorId,
      retryCount: this.state.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });

    this.setState({ errorInfo });

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Auto-retry for non-page level errors
    if (level !== 'page' && this.state.retryCount < this.maxRetries) {
      this.scheduleRetry();
    }
  }

  private scheduleRetry = () => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff

    this.retryTimeoutId = window.setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
      }));
    }, delay);
  };

  private resetError = () => {
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
    });
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.errorId) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
          errorId={this.state.errorId}
          level={this.props.level || 'component'}
          name={this.props.name}
        />
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundaries
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// Utility for async error boundaries
export const useAsyncError = () => {
  const [, setError] = React.useState();

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
};

export default ErrorBoundary;
