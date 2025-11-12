/* eslint-env browser, node */
/**
 * Auth Feature Error Boundary
 *
 * Error boundary specific to authentication features.
 * Handles auth-specific error scenarios with appropriate fallback UI.
 *
 * @module features/auth/ErrorBoundary
 */

import React from 'react';
import { FeatureErrorBoundary, FeatureErrorFallbackProps } from '../../components/FeatureErrorBoundary';

interface AuthErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Custom fallback for auth errors
 */
const AuthErrorFallback: React.FC<FeatureErrorFallbackProps> = (props) => {
  const { error, onReset, onGoHome } = props;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <svg
            className="w-16 h-16 text-blue-600 mx-auto mb-4"
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600">
            We encountered an issue with the authentication system.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-mono text-yellow-800">{error.message}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={onReset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
          <button
            onClick={onGoHome}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Go to Home
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          If this problem persists, try clearing your browser cache or using a different browser.
        </p>
      </div>
    </div>
  );
};

/**
 * Auth Error Boundary Component
 */
export const AuthErrorBoundary: React.FC<AuthErrorBoundaryProps> = ({ children }) => {
  return (
    <FeatureErrorBoundary
      featureName="Authentication"
      fallback={AuthErrorFallback}
      maxRetries={2}
      autoRetry={false} // Don't auto-retry auth errors
    >
      {children}
    </FeatureErrorBoundary>
  );
};

export default AuthErrorBoundary;
