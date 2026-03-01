/**
 * FeedTimeline Component
 * Main feed container with infinite scroll and real-time updates
 */

import { memo, useEffect, useCallback, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { FeedTimelineProps, FeedSort } from '../types';
import { useFeedSubscription } from '../hooks/useFeedSubscription';
import { useFeedFilters } from '../hooks/useFeedFilters';
import { FeedItem } from './FeedItem';
import { FeedEmpty } from './FeedEmpty';
import { FeedFilters } from './FeedFilters';
import { FeedSort as FeedSortComponent } from './FeedSort';

/**
 * FeedTimeline Component
 */
export const FeedTimeline = memo<FeedTimelineProps>(
  ({
    filters: initialFilters,
    initialSort = 'latest',
    autoUpdate: _autoUpdate = true,
    pageSize: _pageSize = 20,
    emptyMessage,
    onEventClick,
    onProfileClick,
    className = '',
  }) => {
    // State
    const [currentSort, setCurrentSort] = useState<FeedSort>(initialSort);
    const [currentUserPubkey] = useState<string | undefined>(undefined); // TODO: Get from auth context

    // Hooks
    const { filters, updateFilters } = useFeedFilters(initialFilters);

    const {
      events,
      isLoading,
      error,
      hasMore,
      subscribe,
      unsubscribe,
      refresh,
      addOptimisticUpdate,
    } = useFeedSubscription();

    // Refs
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const isSubscribedRef = useRef(false);

    // Subscribe to feed on mount and when filters change
    useEffect(() => {
      if (!isSubscribedRef.current) {
        subscribe(filters);
        isSubscribedRef.current = true;
      }

      return () => {
        if (isSubscribedRef.current) {
          unsubscribe();
          isSubscribedRef.current = false;
        }
      };
    }, [filters, subscribe, unsubscribe]);

    // Setup intersection observer for infinite scroll
    useEffect(() => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !isLoading) {
            // Load more events
            // In production: call useFeedSubscription's loadMore method
            console.log('Load more events...');
          }
        },
        {
          root: null,
          rootMargin: '100px',
          threshold: 0.1,
        }
      );

      if (loadMoreRef.current) {
        observerRef.current.observe(loadMoreRef.current);
      }

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }, [hasMore, isLoading]);

    // Handle filter changes
    const handleFilterChange = useCallback(
      (newFilters: typeof filters) => {
        updateFilters(newFilters);
        // Re-subscribe with new filters
        unsubscribe();
        subscribe(newFilters);
      },
      [updateFilters, subscribe, unsubscribe]
    );

    // Handle sort change
    const handleSortChange = useCallback((newSort: FeedSort) => {
      setCurrentSort(newSort);
      // TODO: Re-sort events or re-subscribe with sort parameter
    }, []);

    // Handle like event
    const handleLike = useCallback(
      (event: any) => {
        // TODO: Publish kind 7 reaction event
        console.log('Like event:', event.id);
        // Optimistic update
        // addOptimisticUpdate(reactionEvent);
      },
      [addOptimisticUpdate]
    );

    // Handle repost event
    const handleRepost = useCallback(
      (event: any) => {
        // TODO: Publish kind 6 repost event
        console.log('Repost event:', event.id);
        // Optimistic update
        // addOptimisticUpdate(repostEvent);
      },
      [addOptimisticUpdate]
    );

    // Handle reply event
    const handleReply = useCallback((event: any) => {
      // TODO: Navigate to compose view with reply context
      console.log('Reply to event:', event.id);
    }, []);

    // Handle refresh (pull-to-refresh)
    const handleRefresh = useCallback(() => {
      refresh();
    }, [refresh]);

    // Sort events based on current sort
    const sortedEvents = [...events].sort((a, b) => {
      switch (currentSort) {
        case 'latest':
          return b.timestamp - a.timestamp;
        case 'popular':
          return b.engagement.reactions - a.engagement.reactions;
        case 'trending':
          // Trending = combination of recent + engagement
          const trendScoreA = a.engagement.reactions + a.engagement.reposts + a.engagement.replies;
          const trendScoreB = b.engagement.reactions + b.engagement.reposts + b.engagement.replies;
          const ageWeightA = Math.max(0, 1 - (Date.now() / 1000 - a.timestamp) / 86400);
          const ageWeightB = Math.max(0, 1 - (Date.now() / 1000 - b.timestamp) / 86400);
          return trendScoreB * ageWeightB - trendScoreA * ageWeightA;
        default:
          return b.timestamp - a.timestamp;
      }
    });

    return (
      <div
        className={`feed-timeline flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}
        role="feed"
        aria-busy={isLoading}
        aria-live="polite"
      >
        {/* Filters */}
        <FeedFilters filters={filters} onChange={handleFilterChange} />

        {/* Sort */}
        <FeedSortComponent currentSort={currentSort} onChange={handleSortChange} />

        {/* Refresh Button */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Refresh feed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Loading...
              </span>
            ) : (
              'Refresh Feed'
            )}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div
            className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800"
            role="alert"
          >
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Feed Items */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && events.length === 0 ? (
            // Initial loading state
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" aria-hidden="true" />
              <span className="sr-only">Loading feed...</span>
            </div>
          ) : events.length === 0 ? (
            // Empty state
            <FeedEmpty message={emptyMessage} />
          ) : (
            // Feed items
            <>
              {sortedEvents.map((feedEvent, index) => (
                <FeedItem
                  key={`${feedEvent.event.id}-${index}`}
                  feedEvent={feedEvent}
                  currentUserPubkey={currentUserPubkey}
                  onClick={onEventClick}
                  onProfileClick={onProfileClick}
                  onLike={handleLike}
                  onRepost={handleRepost}
                  onReply={handleReply}
                />
              ))}

              {/* Load More Trigger */}
              {hasMore && (
                <div ref={loadMoreRef} className="flex items-center justify-center py-8">
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-hidden="true" />
                  ) : (
                    <span className="text-sm text-gray-500">Scroll for more</span>
                  )}
                </div>
              )}

              {/* End of Feed */}
              {!hasMore && events.length > 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  You've reached the end of the feed
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

FeedTimeline.displayName = 'FeedTimeline';
