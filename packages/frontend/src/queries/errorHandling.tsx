/**
 * React Query Error Handling & Recovery
 * US-E4-012: Implement Error Handling for React Query
 *
 * Comprehensive error handling with:
 * - Error boundaries for React Query
 * - Retry logic with exponential backoff
 * - Error toasts and user feedback
 * - Loading states and skeletons
 * - Error recovery strategies
 * - Global error handling
 */

import React, { Component, ErrorInfo, ReactNode, useCallback, useState } from 'react';
import { QueryClient, QueryErrorResetBoundary } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

// Type for HTTP-like errors that may have status codes
interface HttpError {
  message?: string;
  code?: string;
  status?: number;
  response?: { status?: number };
}

// Type for window with analytics tracking
interface AnalyticsWindow extends Window {
  analytics?: {
    track: (event: string, data: Record<string, unknown>) => void;
  };
}

// Error types for different handling strategies
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW', // Log only
  MEDIUM = 'MEDIUM', // Show toast
  HIGH = 'HIGH', // Show error UI
  CRITICAL = 'CRITICAL', // Full error page
}

// Classify errors by type and severity
export const classifyError = (error: unknown): { type: ErrorType; severity: ErrorSeverity } => {
  const httpError = error as HttpError | undefined;
  // Network errors
  if (!navigator.onLine || httpError?.code === 'NETWORK_ERROR') {
    return { type: ErrorType.NETWORK, severity: ErrorSeverity.HIGH };
  }

  // HTTP status-based classification
  const status = httpError?.status || httpError?.response?.status;

  if (status === 401) {
    return { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.CRITICAL };
  }

  if (status === 403) {
    return { type: ErrorType.AUTHORIZATION, severity: ErrorSeverity.HIGH };
  }

  if (status !== undefined && status >= 400 && status < 500) {
    return { type: ErrorType.VALIDATION, severity: ErrorSeverity.MEDIUM };
  }

  if (status !== undefined && status >= 500) {
    return { type: ErrorType.SERVER, severity: ErrorSeverity.HIGH };
  }

  return { type: ErrorType.UNKNOWN, severity: ErrorSeverity.MEDIUM };
};

// Error recovery strategies
export const errorRecovery = {
  // Retry with exponential backoff
  retryWithBackoff: async (
    fn: () => Promise<unknown>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<unknown> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries - 1) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd

        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
    throw lastError;
  },

  // Fallback to cached data
  fallbackToCache: (queryKey: string[], queryClient: QueryClient) => {
    const cachedData = queryClient.getQueryData(queryKey);
    if (cachedData) {
      (toast as any).info('Using cached data due to connection issues');
      return cachedData;
    }
    return null;
  },

  // Redirect to login on auth errors
  handleAuthError: () => {
    toast.error('Your session has expired. Please log in again.');
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  },

  // Show offline indicator
  handleOfflineError: () => {
    toast.error('You are offline. Please check your connection.');
    // Could trigger offline mode UI
  },
};

// Global error handler for React Query
export const globalErrorHandler = (error: unknown, query: { queryKey: unknown }) => {
  const { type, severity } = classifyError(error);
  const httpError = error as HttpError | undefined;

  // Log all errors
  console.error(`[${type}] Query error:`, {
    queryKey: query.queryKey,
    error,
    severity,
  });

  // Handle based on severity
  switch (severity) {
    case ErrorSeverity.LOW:
      // Just log, already done above
      break;

    case ErrorSeverity.MEDIUM:
      toast.error(httpError?.message || 'An error occurred');
      break;

    case ErrorSeverity.HIGH:
      // Will be caught by error boundary
      break;

    case ErrorSeverity.CRITICAL:
      // Handle critical errors
      if (type === ErrorType.AUTHENTICATION) {
        errorRecovery.handleAuthError();
      }
      break;
  }

  // Track errors for monitoring
  const win = window as AnalyticsWindow;
  if (typeof window !== 'undefined' && win.analytics) {
    win.analytics.track('query_error', {
      type,
      severity,
      queryKey: query.queryKey,
      errorMessage: httpError?.message,
    });
  }
};

// Error boundary component for React Query
interface QueryErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface QueryErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

class QueryErrorBoundary extends Component<QueryErrorBoundaryProps, QueryErrorBoundaryState> {
  constructor(props: QueryErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    console.error('Error boundary caught:', error, errorInfo);

    // Track in analytics
    const win = window as AnalyticsWindow;
    if (typeof window !== 'undefined' && win.analytics) {
      win.analytics.track('error_boundary_triggered', {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
      });
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <div className="text-center max-w-md">
              <span className="text-6xl">❌</span>
              <h2 className="mt-4 text-2xl font-semibold text-foreground">Something went wrong</h2>
              <p className="mt-2 text-muted-foreground">
                We encountered an error loading this content. Please try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Enhanced error boundary with React Query reset
export const ReactQueryErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <QueryErrorBoundary
          fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
              <div className="text-center max-w-md">
                <span className="text-6xl">🔄</span>
                <h2 className="mt-4 text-2xl font-semibold text-foreground">Loading Error</h2>
                <p className="mt-2 text-muted-foreground">
                  We had trouble loading this data. Let's try again.
                </p>
                <button
                  onClick={reset}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          }
        >
          {children}
        </QueryErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};

// Loading skeleton components
export const LoadingSkeleton: React.FC<{ type?: 'text' | 'card' | 'list' }> = ({
  type = 'text',
}) => {
  if (type === 'card') {
    return (
      <div className="animate-pulse">
        <div className="bg-muted rounded-lg h-48 mb-4"></div>
        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex space-x-4">
            <div className="h-10 w-10 bg-muted rounded-full"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-muted rounded w-full"></div>
      <div className="h-4 bg-muted rounded w-5/6"></div>
      <div className="h-4 bg-muted rounded w-4/6"></div>
    </div>
  );
};

// Error display component
export const ErrorDisplay: React.FC<{
  error: unknown;
  onRetry?: () => void;
  showDetails?: boolean;
}> = ({ error, onRetry, showDetails = false }) => {
  const { type } = classifyError(error);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const httpError = error as HttpError | undefined;

  const getErrorMessage = () => {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Connection problem. Please check your internet.';
      case ErrorType.AUTHENTICATION:
        return 'You need to log in to access this content.';
      case ErrorType.AUTHORIZATION:
        return "You don't have permission to view this content.";
      case ErrorType.VALIDATION:
        return httpError?.message || 'Invalid request. Please check your input.';
      case ErrorType.SERVER:
        return 'Server error. Our team has been notified.';
      default:
        return httpError?.message || 'An unexpected error occurred.';
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <span className="text-2xl mr-3">⚠️</span>
        <div className="flex-1">
          <h3 className="text-red-800 font-semibold">Error</h3>
          <p className="text-red-600 mt-1">{getErrorMessage()}</p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          )}

          {showDetails && !!error && (
            <div className="mt-3">
              <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className="text-red-600 underline text-sm"
              >
                {isDetailsExpanded ? 'Hide' : 'Show'} Details
              </button>

              {isDetailsExpanded && (
                <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                  {JSON.stringify(error, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Hook for error handling in components
export const useErrorHandler = () => {
  const handleError = useCallback((error: unknown, context?: string) => {
    const { type, severity } = classifyError(error);
    const httpError = error as HttpError | undefined;

    // Log with context
    console.error(`Error in ${context || 'component'}:`, error);

    // Show appropriate UI feedback
    if (severity >= ErrorSeverity.MEDIUM) {
      toast.error(httpError?.message || 'An error occurred');
    }

    // Special handling for specific error types
    if (type === ErrorType.AUTHENTICATION) {
      errorRecovery.handleAuthError();
    } else if (type === ErrorType.NETWORK) {
      errorRecovery.handleOfflineError();
    }
  }, []);

  return { handleError };
};

// Network status monitor
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online!');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
};

// Export everything for use across the app
export default {
  ReactQueryErrorBoundary,
  LoadingSkeleton,
  ErrorDisplay,
  useErrorHandler,
  useNetworkStatus,
  classifyError,
  errorRecovery,
  globalErrorHandler,
};
