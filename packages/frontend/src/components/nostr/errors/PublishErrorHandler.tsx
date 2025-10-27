/**
 * 📤 ELITE COMPONENT: Publish Error Handler
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * Handle event publish failures:
 * - Show detailed error messages
 * - Display failed/successful relays
 * - Retry mechanism with tracking
 * - Queue failed events for later retry
 * - Accessible and responsive
 */

import React, { useState } from 'react';
import type { PublishErrorHandlerProps, EventPublishError } from './types';
import { ErrorMessage } from './ErrorMessage';

/**
 * Event kind label mapping
 */
const getEventKindLabel = (kind: number): string => {
  const kindLabels: Record<number, string> = {
    0: 'Profile',
    1: 'Note',
    2: 'Relay Recommendation',
    3: 'Contacts',
    4: 'Encrypted DM',
    5: 'Event Deletion',
    6: 'Repost',
    7: 'Reaction',
    40: 'Channel Creation',
    41: 'Channel Metadata',
    42: 'Channel Message',
    43: 'Channel Hide',
    44: 'Channel Mute',
  };

  return kindLabels[kind] || `Kind ${kind}`;
};

/**
 * Single publish error item
 */
interface PublishErrorItemProps {
  error: EventPublishError;
  onRetry: (eventId: string) => void | Promise<void>;
  onClear: (eventId: string) => void;
}

const PublishErrorItem: React.FC<PublishErrorItemProps> = ({ error, onRetry, onClear }) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRetry = async (): Promise<void> => {
    if (isRetrying || error.isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry(error.eventId);
    } catch (err) {
      console.error('[PublishErrorHandler] Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const totalRelays = error.failedRelays.length + error.successfulRelays.length;
  const successRate = totalRelays > 0
    ? Math.round((error.successfulRelays.length / totalRelays) * 100)
    : 0;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
              {getEventKindLabel(error.eventKind)}
            </span>
            {error.isRetrying && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                Retrying...
              </span>
            )}
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100 font-mono truncate">
            Event ID: {error.eventId.substring(0, 16)}...
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatTimestamp(error.timestamp)}
          </p>
        </div>

        <button
          onClick={() => onClear(error.eventId)}
          className="ml-4 p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-label="Clear error"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400">Success Rate</p>
          <p className={`text-lg font-bold ${successRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {successRate}%
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400">Failed</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {error.failedRelays.length}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400">Retries</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {error.retryCount}
          </p>
        </div>
      </div>

      {/* Error Message */}
      <div className="mb-3">
        <ErrorMessage
          error={error.error}
          compact
          showTroubleshooting={false}
          showRecoverySuggestions={false}
          showErrorCode={true}
          showTimestamp={false}
        />
      </div>

      {/* Relay Details Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-expanded={isExpanded}
        aria-controls={`relay-details-${error.eventId}`}
      >
        <span>Relay Details</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Relay Details */}
      {isExpanded && (
        <div id={`relay-details-${error.eventId}`} className="mt-3 space-y-2">
          {/* Failed Relays */}
          {error.failedRelays.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
                Failed Relays ({error.failedRelays.length})
              </h5>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {error.failedRelays.map(relay => (
                  <li key={relay} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{relay}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Successful Relays */}
          {error.successfulRelays.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
                Successful Relays ({error.successfulRelays.length})
              </h5>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {error.successfulRelays.map(relay => (
                  <li key={relay} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{relay}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleRetry}
          disabled={isRetrying || error.isRetrying}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Retry publish"
        >
          {isRetrying || error.isRetrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    </div>
  );
};

/**
 * PublishErrorHandler Component
 */
export const PublishErrorHandler: React.FC<PublishErrorHandlerProps> = ({
  errors,
  onRetry,
  onClear,
  onClearAll,
  maxErrors = 10,
  className = '',
}) => {
  const displayErrors = errors.slice(0, maxErrors);
  const hasMore = errors.length > maxErrors;

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`} role="region" aria-label="Publish errors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Publish Failures
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {errors.length} event{errors.length !== 1 ? 's' : ''} failed to publish
            {hasMore && ` (showing first ${maxErrors})`}
          </p>
        </div>

        {onClearAll && (
          <button
            onClick={onClearAll}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label="Clear all errors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Error List */}
      <div className="space-y-3">
        {displayErrors.map(error => (
          <PublishErrorItem
            key={error.eventId}
            error={error}
            onRetry={onRetry || (() => Promise.resolve())}
            onClear={onClear || (() => {})}
          />
        ))}
      </div>

      {/* Show More */}
      {hasMore && (
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-4">
          {errors.length - maxErrors} more error{errors.length - maxErrors !== 1 ? 's' : ''} not shown
        </p>
      )}
    </div>
  );
};

export default PublishErrorHandler;
