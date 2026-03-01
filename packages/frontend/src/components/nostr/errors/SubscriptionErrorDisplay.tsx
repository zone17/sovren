/**
 * 📡 ELITE COMPONENT: Subscription Error Display
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * Display subscription errors:
 * - Show filter validation errors
 * - Display timeout errors
 * - Retry subscription mechanism
 * - Close subscription option
 * - Accessible and responsive
 */

import React, { useState } from 'react';
import type { SubscriptionErrorDisplayProps, SubscriptionError } from './types';
import { ErrorMessage } from './ErrorMessage';

/**
 * Single subscription error item
 */
interface SubscriptionErrorItemProps {
  error: SubscriptionError;
  onRetry: (subscriptionId: string) => void | Promise<void>;
  onClose: (subscriptionId: string) => void;
}

const SubscriptionErrorItem: React.FC<SubscriptionErrorItemProps> = ({
  error,
  onRetry,
  onClose,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRetry = async (): Promise<void> => {
    if (isRetrying || error.isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry(error.subscriptionId);
    } catch (err) {
      console.error('[SubscriptionErrorDisplay] Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClose = (): void => {
    onClose(error.subscriptionId);
  };

  const formatTimestamp = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const formatSubscriptionId = (id: string): string => {
    if (id.length <= 12) return id;
    return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              Subscription
            </span>
            {error.isRetrying && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                Retrying...
              </span>
            )}
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
            ID: {formatSubscriptionId(error.subscriptionId)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatTimestamp(error.timestamp)}
          </p>
        </div>

        <button
          onClick={handleClose}
          className="ml-4 p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-label="Close subscription"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Affected Relays */}
      {error.affectedRelays.length > 0 && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Affected Relays ({error.affectedRelays.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {error.affectedRelays.map((relay) => {
              const hostname = (() => {
                try {
                  return new URL(relay).hostname;
                } catch {
                  return relay;
                }
              })();

              return (
                <span
                  key={relay}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  title={relay}
                >
                  {hostname}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Message */}
      <div className="mb-3">
        <ErrorMessage
          error={error.error}
          compact={false}
          showTroubleshooting={true}
          showRecoverySuggestions={false}
          showErrorCode={true}
          showTimestamp={false}
        />
      </div>

      {/* Filter Errors */}
      {error.filterErrors && error.filterErrors.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-expanded={isExpanded}
            aria-controls={`filter-errors-${error.subscriptionId}`}
          >
            <span>Filter Validation Errors ({error.filterErrors.length})</span>
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isExpanded && (
            <div
              id={`filter-errors-${error.subscriptionId}`}
              className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 rounded"
            >
              <ul className="text-xs text-red-800 dark:text-red-300 space-y-1 list-disc list-inside">
                {error.filterErrors.map((filterError, index) => (
                  <li key={index}>{filterError}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRetry}
          disabled={isRetrying || error.isRetrying}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Retry subscription"
        >
          {isRetrying || error.isRetrying ? 'Retrying...' : 'Retry Subscription'}
        </button>

        <button
          onClick={handleClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-label="Close subscription"
        >
          Close
        </button>
      </div>
    </div>
  );
};

/**
 * SubscriptionErrorDisplay Component
 */
export const SubscriptionErrorDisplay: React.FC<SubscriptionErrorDisplayProps> = ({
  errors,
  onRetry,
  onClose,
  className = '',
}) => {
  if (errors.length === 0) {
    return null;
  }

  const filterErrorCount = errors.reduce(
    (count, error) => count + (error.filterErrors?.length || 0),
    0
  );

  return (
    <div className={`${className}`} role="region" aria-label="Subscription errors">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Subscription Errors
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {errors.length} subscription{errors.length !== 1 ? 's' : ''} experiencing issues
          {filterErrorCount > 0 && ` (${filterErrorCount} filter validation errors)`}
        </p>
      </div>

      {/* Error List */}
      <div className="space-y-3">
        {errors.map((error) => (
          <SubscriptionErrorItem
            key={error.subscriptionId}
            error={error}
            onRetry={onRetry || (() => Promise.resolve())}
            onClose={onClose || (() => {})}
          />
        ))}
      </div>
    </div>
  );
};

export default SubscriptionErrorDisplay;
