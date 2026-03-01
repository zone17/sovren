/**
 * FeedFilters Component
 * Filter controls for feed timeline
 */

import React, { memo, useState } from 'react';
import { Filter, X } from 'lucide-react';
import type { FeedFiltersProps } from '../types';

/**
 * FeedFilters Component
 */
export const FeedFilters = memo<FeedFiltersProps>(({ filters, onChange, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [hashtagInput, setHashtagInput] = useState('');

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange({ ...filters, search: searchInput || undefined });
  };

  // Handle hashtag add
  const handleAddHashtag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hashtagInput.trim()) return;

    const cleanTag = hashtagInput.startsWith('#') ? hashtagInput.substring(1) : hashtagInput;

    onChange({
      ...filters,
      hashtags: [...(filters.hashtags || []), cleanTag],
    });
    setHashtagInput('');
  };

  // Handle hashtag remove
  const handleRemoveHashtag = (tag: string) => {
    onChange({
      ...filters,
      hashtags: filters.hashtags?.filter((h) => h !== tag),
    });
  };

  // Handle clear all filters
  const handleClearAll = () => {
    onChange({ kinds: [1, 6, 7] }); // Reset to default
    setSearchInput('');
    setHashtagInput('');
  };

  // Check if any filters are active
  const hasActiveFilters =
    (filters.authors && filters.authors.length > 0) ||
    (filters.hashtags && filters.hashtags.length > 0) ||
    filters.search ||
    filters.since ||
    filters.until;

  return (
    <div
      className={`feed-filters border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className}`}
    >
      {/* Filter Toggle Button */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2"
          aria-expanded={isExpanded}
          aria-label="Toggle filters"
        >
          <Filter className="w-5 h-5" aria-hidden="true" />
          <span className="font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              {(filters.hashtags?.length || 0) +
                (filters.authors?.length || 0) +
                (filters.search ? 1 : 0)}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-3 py-2"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* Search */}
          <div>
            <label
              htmlFor="feed-search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Search
            </label>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                id="feed-search"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search posts..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Search
              </button>
            </form>
          </div>

          {/* Hashtags */}
          <div>
            <label
              htmlFor="feed-hashtag"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Filter by Hashtag
            </label>
            <form onSubmit={handleAddHashtag} className="flex gap-2 mb-2">
              <input
                id="feed-hashtag"
                type="text"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                placeholder="#bitcoin"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add
              </button>
            </form>

            {/* Active Hashtags */}
            {filters.hashtags && filters.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filters.hashtags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleRemoveHashtag(tag)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full text-sm hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    #{tag}
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

FeedFilters.displayName = 'FeedFilters';
