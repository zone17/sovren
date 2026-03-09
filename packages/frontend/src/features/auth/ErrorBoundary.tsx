import React from 'react';
import { ErrorBoundary } from '../../monitoring/ErrorBoundary';

interface AuthErrorBoundaryProps {
  children: React.ReactNode;
}

interface AuthErrorFallbackProps {
  error: Error;
  resetError: () => void;
  errorId: string;
  level: string;
  name?: string;
}

const AuthErrorFallback: React.FC<AuthErrorFallbackProps> = ({ error, resetError }) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 border border-border">
        <div className="text-center mb-6">
          <svg
            className="w-16 h-16 text-destructive mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-foreground mb-2">Authentication Error</h2>
          <p className="text-muted-foreground">
            We encountered an issue with the authentication system.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted border border-border rounded-lg p-3 mb-4">
            <p className="text-xs font-mono text-muted-foreground">{error.message}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={resetError}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Go to Home
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          If this problem persists, try clearing your browser cache or using a different browser.
        </p>
      </div>
    </div>
  );
};

export const AuthErrorBoundary: React.FC<AuthErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary level="feature" featureName="Authentication" fallback={AuthErrorFallback}>
      {children}
    </ErrorBoundary>
  );
};

export default AuthErrorBoundary;
