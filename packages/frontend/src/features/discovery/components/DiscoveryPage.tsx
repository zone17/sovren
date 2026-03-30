import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../../../components/ui/spinner';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { DEMO_CREATORS } from '../../../seed/demo-creators';
import { useDiscovery } from '../hooks/useDiscovery';
import { CreatorCard } from './CreatorCard';
import { CATEGORIES } from '../types';

export const DiscoveryPage = () => {
  useDocumentTitle('Discover Creators');

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

  // Distinguish between API errors and empty results
  const hasApiError = !isLoading && !!error;
  // Show demo creators only when there are no results (not on errors)
  const showDemoFallback = !isLoading && !error && creators.length === 0;

  const displayCreators = useMemo(() => {
    if (!showDemoFallback) return creators;

    let filtered = [...DEMO_CREATORS];

    // Apply category filter to demo data
    if (filters.category) {
      filtered = filtered.filter(c => c.categories.includes(filters.category!));
    }

    // Apply search filter to demo data
    if (filters.query) {
      const q = filters.query.toLowerCase();
      filtered = filtered.filter(
        c => c.displayName.toLowerCase().includes(q) || c.bio.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [showDemoFallback, creators, filters.category, filters.query]);

  return (
    <div className='min-h-screen bg-background'>
      {/* Header */}
      <div className='glass border-b border-border'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <h1 className='text-3xl font-bold text-foreground font-display'>Discover Creators</h1>
          <p className='mt-2 text-muted-foreground'>
            Find and support creators building on NOSTR and Lightning Network
          </p>

          {/* Search */}
          <div className='mt-6'>
            <label htmlFor='creator-search' className='sr-only'>
              Search creators
            </label>
            <input
              id='creator-search'
              type='text'
              placeholder='Search creators by name, topic, or tag...'
              value={filters.query ?? ''}
              onChange={e => updateFilters({ query: e.target.value })}
              className='w-full max-w-xl px-4 py-3 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-all duration-150'
            />
          </div>

          {/* Category filters */}
          <nav className='mt-4 flex flex-wrap gap-2' aria-label='Creator categories'>
            {CATEGORIES.map(category => {
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
          <div className='mt-4 flex items-center gap-2'>
            <label htmlFor='sort-select' className='text-sm text-muted-foreground'>
              Sort by:
            </label>
            <select
              id='sort-select'
              value={filters.sortBy ?? 'relevance'}
              onChange={e =>
                updateFilters({
                  sortBy: e.target.value as 'relevance' | 'followers' | 'newest',
                })
              }
              className='px-3 py-1.5 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-purple-500 transition-all duration-150'
            >
              <option value='relevance'>Relevance</option>
              <option value='followers'>Most Followers</option>
              <option value='newest'>Newest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {isLoading && (
          <div
            className='flex justify-center items-center py-16'
            role='status'
            aria-label='Loading creators'
          >
            <Spinner size='lg' />
            <span className='sr-only'>Loading creators...</span>
          </div>
        )}

        {/* Screen-reader result count announcement */}
        <div aria-live='polite' aria-atomic='true' className='sr-only'>
          {!isLoading && `${displayCreators.length} creators found`}
        </div>

        {/* API error state — show error message with retry button */}
        {hasApiError && (
          <div className='text-center py-16' role='alert'>
            <div className='w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20 flex items-center justify-center'>
              <svg
                className='w-8 h-8 text-red-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'
                />
              </svg>
            </div>
            <p className='text-lg font-semibold text-foreground'>Something went wrong</p>
            <p className='mt-2 text-muted-foreground'>
              We couldn&apos;t load creators right now. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className='mt-4 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.3)] hover:opacity-90 transition-all duration-150'
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty results with demo fallback — no matching creators after filtering */}
        {showDemoFallback && displayCreators.length === 0 && (
          <div className='text-center py-16'>
            <div className='w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center'>
              <svg
                className='w-8 h-8 text-purple-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'
                />
              </svg>
            </div>
            <p className='text-lg font-semibold text-foreground'>No creators match your search</p>
            <p className='mt-2 text-muted-foreground'>Try a different search or category filter.</p>
          </div>
        )}

        {!isLoading && displayCreators.length > 0 && (
          <>
            {/* Demo fallback banner — shown for empty results, not errors */}
            {showDemoFallback && (
              <div className='mb-6 text-center'>
                <span className='inline-block px-3 py-1 text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full'>
                  Featured Creators
                </span>
                <p className='mt-2 text-sm text-muted-foreground'>
                  Check out these creators while we grow our community
                </p>
              </div>
            )}

            {/* Subtle fetching indicator for subsequent queries */}
            {isFetching && (
              <div className='flex justify-center pb-4' role='status' aria-label='Updating results'>
                <div className='h-1 w-24 bg-purple-500/20 rounded-full overflow-hidden'>
                  <div className='h-full bg-purple-500 rounded-full animate-pulse' />
                </div>
              </div>
            )}

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {displayCreators.map(creator => (
                <div key={creator.id} className='relative'>
                  {showDemoFallback && (
                    <span className='absolute top-3 right-3 z-10 px-2 py-0.5 text-[10px] font-medium text-purple-300 bg-purple-500/20 border border-purple-500/30 rounded-full'>
                      Featured
                    </span>
                  )}
                  <CreatorCard creator={creator} />
                </div>
              ))}
            </div>

            {showDemoFallback && (
              <div className='mt-8 text-center'>
                <Link
                  to='/signup'
                  className='inline-block px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.3)] hover:opacity-90 transition-all duration-150 no-underline'
                >
                  Join Sovren as a Creator
                </Link>
              </div>
            )}

            {/* Pagination — only for real API results */}
            {!showDemoFallback && pagination && pagination.totalPages > 1 && (
              <nav aria-label='Pagination' className='mt-8 flex items-center justify-center gap-4'>
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev || isFetching}
                  className='px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150'
                >
                  Previous Page
                </button>
                <span className='text-sm text-muted-foreground'>
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext || isFetching}
                  className='px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150'
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
