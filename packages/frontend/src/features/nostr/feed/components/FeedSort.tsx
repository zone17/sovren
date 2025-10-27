/**
 * FeedSort Component
 * Sort controls for feed timeline
 */

import React, { memo } from 'react';
import { TrendingUp, Clock, Heart } from 'lucide-react';
import type { FeedSortProps, FeedSort as FeedSortType } from '../types';

/**
 * Sort option configuration
 */
const SORT_OPTIONS: Array<{
  value: FeedSortType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    value: 'latest',
    label: 'Latest',
    icon: Clock,
    description: 'Most recent posts first',
  },
  {
    value: 'popular',
    label: 'Popular',
    icon: Heart,
    description: 'Most liked posts',
  },
  {
    value: 'trending',
    label: 'Trending',
    icon: TrendingUp,
    description: 'Hot topics and discussions',
  },
];

/**
 * FeedSort Component
 */
export const FeedSort = memo<FeedSortProps>(
  ({ currentSort, onChange, className = '' }) => {
    return (
      <div
        className={`feed-sort flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className}`}
        role="tablist"
        aria-label="Feed sort options"
      >
        {SORT_OPTIONS.map(option => {
          const Icon = option.icon;
          const isActive = currentSort === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              role="tab"
              aria-selected={isActive}
              aria-label={`${option.label}: ${option.description}`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
);

FeedSort.displayName = 'FeedSort';
