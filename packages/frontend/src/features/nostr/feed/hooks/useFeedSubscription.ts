/**
 * useFeedSubscription Hook
 * Manages NOSTR event subscription for feed using real relay connections.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { SimplePool } from 'nostr-tools';
import type { Event as NostrEvent } from 'nostr-tools';
import type { FeedFilters, FeedState, FeedEvent, UseFeedSubscriptionReturn } from '../types';
import { parseContent } from '../utils/contentParser';

// Default public relays — configurable via VITE_NOSTR_RELAYS env var
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];

function getRelays(): string[] {
  const env = import.meta.env.VITE_NOSTR_RELAYS as string | undefined;
  if (env)
    return env
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  return DEFAULT_RELAYS;
}

/**
 * Transform NOSTR event to FeedEvent.
 * Engagement counts are not available from relay events alone;
 * they are initialised to 0 and can be updated by the caller.
 */
const transformToFeedEvent = (event: NostrEvent): FeedEvent => {
  const parsedContent = parseContent(event.content);

  const engagement = {
    reactions: 0,
    reposts: 0,
    replies: 0,
    isLikedByUser: false,
    isRepostedByUser: false,
  };

  // Basic author profile derived from pubkey — real profile metadata
  // (kind:0 events) can be fetched separately when needed.
  const authorProfile = {
    name: undefined,
    picture: undefined,
    display_name: undefined,
  };

  return {
    event,
    engagement,
    authorProfile,
    parsedContent,
    timestamp: event.created_at,
  };
};

/**
 * Hook for subscribing to NOSTR feed events via real relay connections.
 */
export const useFeedSubscription = (): UseFeedSubscriptionReturn => {
  const [state, setState] = useState<FeedState>({
    events: [],
    isLoading: false,
    error: null,
    hasMore: true,
    subscriptionId: null,
    isSubscribed: false,
  });

  const poolRef = useRef<SimplePool | null>(null);
  const subRef = useRef<ReturnType<SimplePool['subscribeMany']> | null>(null);
  const filtersRef = useRef<FeedFilters>({});

  // Ensure pool is created once
  const getPool = useCallback((): SimplePool => {
    if (!poolRef.current) {
      poolRef.current = new SimplePool();
    }
    return poolRef.current;
  }, []);

  /**
   * Subscribe to feed with filters
   */
  const subscribe = useCallback(
    (filters: FeedFilters) => {
      // Close any existing subscription first
      subRef.current?.close();
      subRef.current = null;

      filtersRef.current = filters;
      setState((prev) => ({ ...prev, isLoading: true, error: null, events: [] }));

      const relays = getRelays();
      const pool = getPool();
      const subId = `feed_${Date.now()}`;

      // Build nostr-tools filter
      const nostrFilter: Record<string, unknown> = {
        kinds: filters.kinds ?? [1],
        limit: 50,
      };
      if (filters.authors?.length) nostrFilter['authors'] = filters.authors;
      if (filters.since) nostrFilter['since'] = filters.since;
      if (filters.until) nostrFilter['until'] = filters.until;
      if (filters.hashtags?.length) {
        nostrFilter['#t'] = filters.hashtags;
      }

      const incoming: FeedEvent[] = [];

      const sub = pool.subscribeMany(relays, [nostrFilter], {
        onevent(event: NostrEvent) {
          const feedEvent = transformToFeedEvent(event);
          incoming.push(feedEvent);
          setState((prev) => {
            // Deduplicate by event id, keep sorted newest-first
            const ids = new Set(prev.events.map((e) => e.event.id));
            if (ids.has(feedEvent.event.id)) return prev;
            const updated = [feedEvent, ...prev.events].sort((a, b) => b.timestamp - a.timestamp);
            return {
              ...prev,
              events: updated,
              isLoading: false,
              isSubscribed: true,
              subscriptionId: subId,
            };
          });
        },
        oneose() {
          // EOSE = end of stored events; transition from loading to live streaming
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isSubscribed: true,
            subscriptionId: subId,
          }));
        },
      });

      subRef.current = sub;
    },
    [getPool]
  );

  /**
   * Unsubscribe from current feed
   */
  const unsubscribe = useCallback(() => {
    subRef.current?.close();
    subRef.current = null;

    setState((prev) => ({
      ...prev,
      isSubscribed: false,
      subscriptionId: null,
    }));
  }, []);

  /**
   * Refresh feed (re-subscribe with same filters)
   */
  const refresh = useCallback(() => {
    subscribe(filtersRef.current);
  }, [subscribe]);

  /**
   * Add optimistic event update (for reactions/reposts)
   */
  const addOptimisticUpdate = useCallback((event: NostrEvent) => {
    const feedEvent = transformToFeedEvent(event);

    setState((prev) => ({
      ...prev,
      events: [feedEvent, ...prev.events],
    }));
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      subRef.current?.close();
      poolRef.current?.destroy();
    };
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    refresh,
    addOptimisticUpdate,
  };
};
