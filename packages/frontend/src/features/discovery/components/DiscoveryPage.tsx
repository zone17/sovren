import { Spinner } from '../../../components/ui/spinner';
import { useDiscovery } from '../hooks/useDiscovery';
import { CreatorCard } from './CreatorCard';
import { CATEGORIES } from '../types';

export const DiscoveryPage = () => {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-foreground font-display">Discover Creators</h1>
          <p className="mt-2 text-muted-foreground">
            Find and support independent creators
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
              className="w-full max-w-xl px-4 py-3 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all duration-150"
            />
          </div>

          {/* Category filters */}
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Creator categories">
            {CATEGORIES.map((category) => {
              const isActive =
                category === 'All' ? !filters.category : filters.category === category;
              return (
                <button
                  key={category}
                  onClick={() =>
                    updateFilters({ category: category === 'All' ? undefined : category })
                  }
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)]'
                      : 'bg-card text-muted-foreground hover:bg-purple-500/10 hover:text-purple-300'
                  }`}
                  aria-pressed={isActive}
                >
                  {category}
                </button>
              );
            })}
          </nav>

          {/* Sort */}
          <div className="mt-4 flex items-center gap-2">
            <label htmlFor="sort-select" className="text-sm text-muted-foreground">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={filters.sortBy ?? 'relevance'}
              onChange={(e) =>
                updateFilters({
                  sortBy: e.target.value as 'relevance' | 'followers' | 'newest',
                })
              }
              className="px-3 py-1.5 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-purple-500 transition-all duration-150"
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
            <Spinner size="lg" />
            <span className="sr-only">Loading creators...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-16" role="alert">
            <p className="text-lg font-semibold text-foreground">Something went wrong</p>
            <p className="mt-1 text-muted-foreground">Failed to load creators</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.3)] hover:opacity-90 transition-all duration-150"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && creators.length === 0 && (
          <div className="text-center py-16">
            <p className="text-lg font-semibold text-foreground">No creators found</p>
            <p className="mt-1 text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Screen-reader result count announcement */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {!isLoading && !error && `${creators.length} creators found`}
        </div>

        {!isLoading && !error && creators.length > 0 && (
          <>
            {/* Subtle fetching indicator for subsequent queries */}
            {isFetching && (
              <div className="flex justify-center pb-4" role="status" aria-label="Updating results">
                <div className="h-1 w-24 bg-purple-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full animate-pulse" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev || isFetching}
                  className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  Previous Page
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext || isFetching}
                  className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  Next Page
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
};
