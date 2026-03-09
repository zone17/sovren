/**
 * 🔌 ELITE COMPONENT: Connection Error Display
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * Display relay connection errors:
 * - Show disconnected/error relays
 * - Connection status indicators
 * - Retry individual or all relays
 * - Real-time status updates
 * - Accessible and responsive
 */

import React, { useState } from 'react';
import type { ConnectionErrorDisplayProps, RelayConnectionError } from './types';
import { ErrorMessage } from './ErrorMessage';

/**
 * Connection status badge
 */
const StatusBadge: React.FC<{ status: 'disconnected' | 'error' | 'timeout' | 'retrying' }> = ({
  status,
}) => {
  const getStatusClasses = (): string => {
    switch (status) {
      case 'disconnected':
        return 'bg-muted text-foreground';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'timeout':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'retrying':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    }
  };

  const getStatusLabel = (): string => {
    switch (status) {
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      case 'timeout':
        return 'Timeout';
      case 'retrying':
        return 'Retrying...';
    }
  };

  return (
    <span
      className={`
        ${getStatusClasses()}
        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
      `}
    >
      {getStatusLabel()}
    </span>
  );
};

/**
 * Single relay error item
 */
interface RelayErrorItemProps {
  error: RelayConnectionError;
  onRetry: (url: string) => void | Promise<void>;
  compact?: boolean;
}

const RelayErrorItem: React.FC<RelayErrorItemProps> = ({ error, onRetry, compact }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async (): Promise<void> => {
    if (isRetrying || error.isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry(error.url);
    } catch (err) {
      console.error('[ConnectionErrorDisplay] Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const formatRelayUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  const formatLastAttempt = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm text-foreground truncate">{formatRelayUrl(error.url)}</span>
          <StatusBadge status={error.isRetrying ? 'retrying' : error.status} />
        </div>
        <button
          onClick={handleRetry}
          disabled={isRetrying || error.isRetrying}
          className="ml-2 p-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-muted-foreground/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          aria-label={`Retry connection to ${error.url}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Relay URL */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-foreground truncate">{error.url}</h4>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={error.isRetrying ? 'retrying' : error.status} />
            <span className="text-xs text-muted-foreground">
              Last attempt: {formatLastAttempt(error.lastAttempt)}
            </span>
          </div>

          {/* Retry count */}
          {error.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mb-2">Retry attempts: {error.retryCount}</p>
          )}

          {/* Error Message */}
          <ErrorMessage
            error={error.error}
            compact
            showTroubleshooting={false}
            showRecoverySuggestions={false}
            showErrorCode={false}
            showTimestamp={false}
          />
        </div>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          disabled={isRetrying || error.isRetrying}
          className="ml-4 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex-shrink-0"
          aria-label={`Retry connection to ${error.url}`}
        >
          {isRetrying || error.isRetrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    </div>
  );
};

/**
 * ConnectionErrorDisplay Component
 */
export const ConnectionErrorDisplay: React.FC<ConnectionErrorDisplayProps> = ({
  errors,
  onRetryAll,
  onRetrySingle,
  onDismiss,
  compact = false,
  className = '',
}) => {
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  const handleRetryAll = async (): Promise<void> => {
    if (!onRetryAll || isRetryingAll) return;

    setIsRetryingAll(true);
    try {
      await onRetryAll();
    } catch (error) {
      console.error('[ConnectionErrorDisplay] Retry all failed:', error);
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleRetrySingle = async (url: string): Promise<void> => {
    if (!onRetrySingle) return;
    await onRetrySingle(url);
  };

  if (errors.length === 0) {
    return null;
  }

  const disconnectedCount = errors.filter((e) => e.status === 'disconnected').length;
  const errorCount = errors.filter((e) => e.status === 'error').length;
  const timeoutCount = errors.filter((e) => e.status === 'timeout').length;

  return (
    <div className={`${className}`} role="region" aria-label="Connection errors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Connection Issues</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {disconnectedCount > 0 && `${disconnectedCount} disconnected`}
            {disconnectedCount > 0 && (errorCount > 0 || timeoutCount > 0) && ', '}
            {errorCount > 0 && `${errorCount} errors`}
            {errorCount > 0 && timeoutCount > 0 && ', '}
            {timeoutCount > 0 && `${timeoutCount} timeouts`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRetryAll && (
            <button
              onClick={handleRetryAll}
              disabled={isRetryingAll}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Retry all connections"
            >
              {isRetryingAll ? 'Retrying All...' : 'Retry All'}
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Dismiss connection errors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error List */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {errors.map((error) => (
          <RelayErrorItem
            key={error.url}
            error={error}
            onRetry={handleRetrySingle}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};

export default ConnectionErrorDisplay;
