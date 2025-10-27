/**
 * 📋 ELITE COMPONENT: Generic Error Message
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * Reusable error display component:
 * - Shows error with appropriate severity styling
 * - Displays error code and details
 * - Shows troubleshooting hints
 * - Provides retry mechanism
 * - Accessible and responsive
 */

import React, { useState } from 'react';
import type { ErrorMessageProps } from './types';
import { ErrorSeverity } from './types';

/**
 * Severity icon mapping
 */
const SeverityIcon: React.FC<{ severity: ErrorSeverity }> = ({ severity }) => {
  const iconClasses = 'w-5 h-5';

  switch (severity) {
    case ErrorSeverity.INFO:
      return (
        <svg className={`${iconClasses} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case ErrorSeverity.WARNING:
      return (
        <svg className={`${iconClasses} text-yellow-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case ErrorSeverity.ERROR:
      return (
        <svg className={`${iconClasses} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case ErrorSeverity.CRITICAL:
      return (
        <svg className={`${iconClasses} text-red-700`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

/**
 * Severity color classes
 */
const getSeverityClasses = (severity: ErrorSeverity): string => {
  switch (severity) {
    case ErrorSeverity.INFO:
      return 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800';
    case ErrorSeverity.WARNING:
      return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800';
    case ErrorSeverity.ERROR:
      return 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800';
    case ErrorSeverity.CRITICAL:
      return 'bg-red-100 border-red-300 dark:bg-red-900/20 dark:border-red-700';
  }
};

const getSeverityTextClasses = (severity: ErrorSeverity): string => {
  switch (severity) {
    case ErrorSeverity.INFO:
      return 'text-blue-900 dark:text-blue-300';
    case ErrorSeverity.WARNING:
      return 'text-yellow-900 dark:text-yellow-300';
    case ErrorSeverity.ERROR:
      return 'text-red-900 dark:text-red-300';
    case ErrorSeverity.CRITICAL:
      return 'text-red-950 dark:text-red-200';
  }
};

const getSeveritySecondaryTextClasses = (severity: ErrorSeverity): string => {
  switch (severity) {
    case ErrorSeverity.INFO:
      return 'text-blue-700 dark:text-blue-400';
    case ErrorSeverity.WARNING:
      return 'text-yellow-700 dark:text-yellow-400';
    case ErrorSeverity.ERROR:
      return 'text-red-700 dark:text-red-400';
    case ErrorSeverity.CRITICAL:
      return 'text-red-800 dark:text-red-300';
  }
};

/**
 * ErrorMessage Component
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  showTroubleshooting = true,
  showRecoverySuggestions = true,
  showErrorCode = true,
  showTimestamp = false,
  compact = false,
  className = '',
  onRetry,
  onDismiss,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async (): Promise<void> => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (error) {
      console.error('[ErrorMessage] Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const containerClasses = `
    ${getSeverityClasses(error.severity)}
    border rounded-lg
    ${compact ? 'p-3' : 'p-4'}
    ${className}
  `.trim();

  const titleClasses = `
    ${getSeverityTextClasses(error.severity)}
    ${compact ? 'text-sm' : 'text-base'}
    font-semibold
  `.trim();

  const messageClasses = `
    ${getSeveritySecondaryTextClasses(error.severity)}
    ${compact ? 'text-xs' : 'text-sm'}
    mt-1
  `.trim();

  return (
    <div
      className={containerClasses}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className="flex-shrink-0">
          <SeverityIcon severity={error.severity} />
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          {/* Title */}
          <h3 className={titleClasses}>
            {error.title}
          </h3>

          {/* Message */}
          <p className={messageClasses}>
            {error.message}
          </p>

          {/* Error Code */}
          {showErrorCode && (
            <p className={`${messageClasses} font-mono mt-1`}>
              Code: {error.code}
            </p>
          )}

          {/* Timestamp */}
          {showTimestamp && (
            <p className={`${messageClasses} text-xs mt-1`}>
              {new Date(error.timestamp).toLocaleString()}
            </p>
          )}

          {/* Relay Info */}
          {error.relay && (
            <p className={`${messageClasses} text-xs mt-1`}>
              Relay: {error.relay}
            </p>
          )}

          {error.relays && error.relays.length > 0 && (
            <p className={`${messageClasses} text-xs mt-1`}>
              Affected Relays: {error.relays.join(', ')}
            </p>
          )}

          {/* Troubleshooting Hints */}
          {!compact && showTroubleshooting && error.troubleshootingHints && error.troubleshootingHints.length > 0 && (
            <div className="mt-3">
              <h4 className={`${titleClasses} text-xs mb-1`}>
                Troubleshooting:
              </h4>
              <ul className={`${messageClasses} space-y-0.5 list-disc list-inside`}>
                {error.troubleshootingHints.map((hint, index) => (
                  <li key={index}>{hint}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recovery Suggestions */}
          {!compact && showRecoverySuggestions && error.recoverySuggestions && error.recoverySuggestions.length > 0 && (
            <div className="mt-3">
              <h4 className={`${titleClasses} text-xs mb-1`}>
                What to try:
              </h4>
              <ul className={`${messageClasses} space-y-0.5 list-disc list-inside`}>
                {error.recoverySuggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Documentation Link */}
          {!compact && error.docsLink && (
            <a
              href={error.docsLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`${getSeveritySecondaryTextClasses(error.severity)} text-xs underline hover:no-underline mt-2 inline-block`}
            >
              View Documentation →
            </a>
          )}

          {/* Actions */}
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex items-center gap-2">
              {onRetry && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={`
                    px-3 py-1 text-xs font-medium rounded
                    ${error.severity === ErrorSeverity.INFO ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400' : ''}
                    ${error.severity === ErrorSeverity.WARNING ? 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400' : ''}
                    ${error.severity === ErrorSeverity.ERROR || error.severity === ErrorSeverity.CRITICAL ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400' : ''}
                    text-white transition-colors
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${error.severity === ErrorSeverity.INFO ? 'focus:ring-blue-500' : ''}
                    ${error.severity === ErrorSeverity.WARNING ? 'focus:ring-yellow-500' : ''}
                    ${error.severity === ErrorSeverity.ERROR || error.severity === ErrorSeverity.CRITICAL ? 'focus:ring-red-500' : ''}
                  `.trim()}
                  aria-label="Retry operation"
                >
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </button>
              )}

              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className={`
                    px-3 py-1 text-xs font-medium rounded
                    bg-gray-200 hover:bg-gray-300
                    dark:bg-gray-700 dark:hover:bg-gray-600
                    text-gray-900 dark:text-gray-100
                    transition-colors
                    focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                  `.trim()}
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dismiss Button (Icon Only) */}
        {onDismiss && compact && (
          <button
            onClick={onDismiss}
            className={`
              ml-3 flex-shrink-0 p-1 rounded
              ${getSeveritySecondaryTextClasses(error.severity)}
              hover:bg-black/5 dark:hover:bg-white/5
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${error.severity === ErrorSeverity.INFO ? 'focus:ring-blue-500' : ''}
              ${error.severity === ErrorSeverity.WARNING ? 'focus:ring-yellow-500' : ''}
              ${error.severity === ErrorSeverity.ERROR || error.severity === ErrorSeverity.CRITICAL ? 'focus:ring-red-500' : ''}
            `.trim()}
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
