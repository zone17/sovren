/**
 * useFeedSubscription Hook
 * Manages NOSTR event subscription for feed
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Event as NostrEvent } from 'nostr-tools';
import type { FeedFilters, FeedState, FeedEvent, UseFeedSubscriptionReturn } from '../types';
import { parseContent } from '../utils/contentParser';

/**
 * Generate mock NOSTR event for testing
 */
const generateMockEvent = (index: number): NostrEvent => {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `event_${index}_${Math.random()}`,
    pubkey: `pubkey_${index % 5}`, // Simulate 5 different authors
    created_at: now - index * 300, // Events every 5 minutes
    kind: 1, // Text note
    tags: [
      ['t', 'nostr'],
      ['t', 'bitcoin'],
    ],
    content: `This is test event #${index}. #nostr #bitcoin\n\nCheck out this cool image: https://example.com/image${index}.jpg`,
    sig: `sig_${index}`,
  };
};

/**
 * Mock event cache (in production, this would use EventCache service)
 */
const mockEventCache = new Map<string, FeedEvent>();

/**
 * Transform NOSTR event to FeedEvent with engagement data
 */
const transformToFeedEvent = (event: NostrEvent): FeedEvent => {
  // Check cache first
  if (mockEventCache.has(event.id)) {
    return mockEventCache.get(event.id)!;
  }

  // Parse content
  const parsedContent = parseContent(event.content);

  // Mock engagement metrics
  const engagement = {
    reactions: Math.floor(Math.random() * 100),
    reposts: Math.floor(Math.random() * 50),
    replies: Math.floor(Math.random() * 30),
    isLikedByUser: false,
    isRepostedByUser: false,
  };

  // Mock author profile
  const authorProfile = {
    name: `User ${event.pubkey.substring(0, 8)}`,
    picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${event.pubkey}`,
    display_name: `User ${event.pubkey.substring(0, 8)}`,
  };

  const feedEvent: FeedEvent = {
    event,
    engagement,
    authorProfile,
    parsedContent,
    timestamp: event.created_at,
  };

  // Cache it
  mockEventCache.set(event.id, feedEvent);

  return feedEvent;
};

/**
 * Hook for subscribing to NOSTR feed events
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

  const subscriptionRef = useRef<string | null>(null);

  /**
   * Subscribe to feed with filters
   */
  const subscribe = useCallback((_filters: FeedFilters) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Generate subscription ID
    const subId = `feed_${Date.now()}`;
    subscriptionRef.current = subId;

    // Simulate async subscription
    setTimeout(() => {
      // In production, this would:
      // 1. Use SubscriptionManager.subscribe() with filters
      // 2. Listen for incoming events
      // 3. Transform events using EventCache
      // 4. Update state with new events

      // Generate mock events
      const mockEvents = Array.from({ length: 20 }, (_, i) => generateMockEvent(i));

      const feedEvents = mockEvents.map(transformToFeedEvent);

      setState((prev) => ({
        ...prev,
        events: feedEvents,
        isLoading: false,
        isSubscribed: true,
        subscriptionId: subId,
      }));
    }, 500);
  }, []);

  /**
   * Unsubscribe from current feed
   */
  const unsubscribe = useCallback(() => {
    if (subscriptionRef.current) {
      // In production: SubscriptionManager.unsubscribe(subscriptionRef.current)
      subscriptionRef.current = null;

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        subscriptionId: null,
      }));
    }
  }, []);

  /**
   * Refresh feed (re-subscribe with same filters)
   */
  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, events: [], isLoading: true }));

    // Simulate refresh
    setTimeout(() => {
      const mockEvents = Array.from({ length: 20 }, (_, i) => generateMockEvent(i));
      const feedEvents = mockEvents.map(transformToFeedEvent);

      setState((prev) => ({
        ...prev,
        events: feedEvents,
        isLoading: false,
      }));
    }, 300);
  }, []);

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
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    refresh,
    addOptimisticUpdate,
  };
};
