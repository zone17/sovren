import React from 'react';
import { useDiscovery } from '../hooks/useDiscovery';
import { CreatorCard } from './CreatorCard';
import { CATEGORIES } from '../types';

export const DiscoveryPage: React.FC = () => {
  const {
    creators,
    pagination,
    filters,
    updateFilters,
    page,
    setPage,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useDiscovery();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Discover Creators</h1>
          <p className="mt-2 text-gray-600">
            Find and support creators building on NOSTR and Lightning Network
          </p>

          {/* Search */}
          <div className="mt-6">
            <label htmlFor="creator-search" className="sr-only">
              Search creators
            </label>
            <input
              id="creator-search"
              type="text"
              placeholder="Search creators by name, topic, or tag..."
              value={filters.query ?? ''}
              onChange={(e) => updateFilters({ query: e.target.value })}
              className="w-full max-w-xl px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Category filters */}
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Creator categories">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() =>
                  updateFilters({ category: category === 'All' ? undefined : category })
                }
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  (filters.category ?? 'All') === (category === 'All' ? undefined : category) ||
                  (!filters.category && category === 'All')
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-pressed={
                  (!filters.category && category === 'All') || filters.category === category
                }
              >
                {category}
              </button>
            ))}
          </nav>

          {/* Sort */}
          <div className="mt-4 flex items-center gap-2">
            <label htmlFor="sort-select" className="text-sm text-gray-500">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={filters.sortBy ?? 'relevance'}
              onChange={(e) =>
                updateFilters({ sortBy: e.target.value as 'relevance' | 'followers' | 'newest' })
              }
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="relevance">Relevance</option>
              <option value="followers">Most Followers</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && (
          <div
            className="flex justify-center items-center py-16"
            role="status"
            aria-label="Loading creators"
          >
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
            <span className="sr-only">Loading creators...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-16" role="alert">
            <p className="text-lg font-semibold text-gray-900">Something went wrong</p>
            <p className="mt-1 text-gray-600">Failed to load creators</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && creators.length === 0 && (
          <div className="text-center py-16">
            <p className="text-lg font-semibold text-gray-900">No creators found</p>
            <p className="mt-1 text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}

        {!isLoading && !error && creators.length > 0 && (
          <>
            {/* Subtle fetching indicator for subsequent queries */}
            {isFetching && (
              <div className="flex justify-center pb-4">
                <div className="h-1 w-24 bg-blue-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>

            {/* Load More */}
            {pagination && page < pagination.totalPages && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setPage(page + 1)}
                  className="px-6 py-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
