/**
 * FeedEmpty Component
 * Empty state for feed timeline
 */

import { memo } from 'react';
import { FileText } from 'lucide-react';
import type { FeedEmptyProps } from '../types';

/**
 * FeedEmpty Component
 */
export const FeedEmpty = memo<FeedEmptyProps>(
  ({
    message = 'No posts yet. Be the first to share something!',
    showCreateButton = true,
    onCreateClick,
    className = '',
  }) => {
    return (
      <div
        className={`feed-empty flex flex-col items-center justify-center py-16 px-4 ${className}`}
        role="status"
        aria-live="polite"
      >
        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" aria-hidden="true" />
        <p className="text-gray-500 dark:text-gray-400 text-center mb-6">{message}</p>
        {showCreateButton && onCreateClick && (
          <button
            onClick={onCreateClick}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create Post
          </button>
        )}
      </div>
    );
  }
);

FeedEmpty.displayName = 'FeedEmpty';
