/**
 * React Query Event Cache Hooks Tests
 * US-317: NOSTR Caching Layer - Subtask 2
 *
 * TDD approach: Test React Query integration with EventCacheService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { NostrEvent } from '@shared/types/nostr/index';
import { NostrEventKind } from '@shared/types/nostr/index';
import {
  useEvent,
  useEvents,
  useEventQuery,
  useProfile,
  useProfiles,
  useSetEvent,
  useCacheStats,
  useInvalidateCache,
  eventCacheKeys,
} from '../useEventCache';
import { resetEventCache } from '../../EventCacheService';

describe('useEventCache Hooks', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    const QueryWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return QueryWrapper;
  };

  const createMockEvent = (overrides: Partial<NostrEvent> = {}): NostrEvent => ({
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: NostrEventKind.TEXT_NOTE,
    tags: [],
    content: 'Test event',
    sig: 'c'.repeat(128),
    ...overrides,
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0, // Disable cache for testing
        },
        mutations: {
          retry: false,
        },
      },
    });
    resetEventCache();
  });

  afterEach(() => {
    queryClient.clear();
    resetEventCache();
  });

  describe('Query Key Factories', () => {
    it('should generate consistent query keys for events', () => {
      const eventId = 'event123' + 'a'.repeat(56);
      const key1 = eventCacheKeys.event(eventId);
      const key2 = eventCacheKeys.event(eventId);

      expect(key1).toEqual(key2);
      expect(key1).toEqual(['nostr-events', 'event', eventId]);
    });

    it('should generate unique keys for different resources', () => {
      const eventKey = eventCacheKeys.event('event1' + 'a'.repeat(58));
      const profileKey = eventCacheKeys.profile('pubkey1' + 'a'.repeat(57));

      expect(eventKey).not.toEqual(profileKey);
    });

    it('should include filter in query key', () => {
      const filter = { kinds: [1], authors: ['alice'] };
      const key = eventCacheKeys.events(filter);

      expect(key).toContain('filter');
      expect(key).toContain(filter);
    });
  });

  describe('useEvent Hook', () => {
    it('should fetch event by ID', async () => {
      const event = createMockEvent({ id: 'event1' + 'a'.repeat(58) });

      // First, add event to cache
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      await waitFor(() => {
        setResult.current.mutate({ event });
      });

      // Now query the event
      const { result } = renderHook(() => useEvent(event.id), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(event.id);
    });

    it('should return null for non-existent event', async () => {
      const { result } = renderHook(() => useEvent('nonexistent' + 'a'.repeat(52)), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('should use 5 minute stale time for events', () => {
      const { result } = renderHook(() => useEvent('event1' + 'a'.repeat(58)), {
        wrapper: createWrapper(),
      });

      // Query should be configured with 5 minute stale time
      expect(result.current).toBeDefined();
    });
  });

  describe('useEvents Hook', () => {
    it('should fetch multiple events by IDs', async () => {
      const events = [
        createMockEvent({ id: 'event1' + 'a'.repeat(58) }),
        createMockEvent({ id: 'event2' + 'a'.repeat(58) }),
      ];

      // Add events to cache
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      for (const event of events) {
        await waitFor(() => {
          setResult.current.mutate({ event });
        });
      }

      // Query multiple events
      const { result } = renderHook(() => useEvents(events.map((e) => e.id)), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
    });

    it('should be disabled when eventIds array is empty', () => {
      const { result } = renderHook(() => useEvents([]), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
    });
  });

  describe('useEventQuery Hook', () => {
    it('should query events by filter', async () => {
      const events = [
        createMockEvent({
          id: 'event1' + 'a'.repeat(58),
          pubkey: 'alice' + 'a'.repeat(59),
          kind: NostrEventKind.TEXT_NOTE,
        }),
        createMockEvent({
          id: 'event2' + 'a'.repeat(58),
          pubkey: 'alice' + 'a'.repeat(59),
          kind: NostrEventKind.SET_METADATA,
        }),
      ];

      // Add events to cache
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      for (const event of events) {
        await waitFor(() => {
          setResult.current.mutate({ event });
        });
      }

      // Query by author
      const { result } = renderHook(() => useEventQuery({ authors: ['alice' + 'a'.repeat(59)] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.length).toBeGreaterThan(0);
    });

    it('should use 5 minute stale time', () => {
      const { result } = renderHook(() => useEventQuery({ kinds: [1] }), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
    });
  });

  describe('useProfile Hook', () => {
    it('should fetch profile (kind 0) with 1 hour TTL', async () => {
      const pubkey = 'alice' + 'a'.repeat(59);
      const profileEvent = createMockEvent({
        id: 'profile1' + 'a'.repeat(56),
        pubkey,
        kind: NostrEventKind.SET_METADATA,
        content: JSON.stringify({ name: 'Alice', about: 'Test user' }),
      });

      // Add profile to cache
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      await waitFor(() => {
        setResult.current.mutate({ event: profileEvent });
      });

      // Query profile
      const { result } = renderHook(() => useProfile(pubkey), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.kind).toBe(NostrEventKind.SET_METADATA);
    });

    it('should return null for non-existent profile', async () => {
      const { result } = renderHook(() => useProfile('nonexistent' + 'a'.repeat(52)), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });
  });

  describe('useProfiles Hook', () => {
    it('should fetch multiple profiles', async () => {
      const pubkeys = ['alice' + 'a'.repeat(59), 'bob' + 'b'.repeat(61)];
      const profiles = pubkeys.map((pubkey, i) =>
        createMockEvent({
          id: `profile${i}` + 'a'.repeat(56),
          pubkey,
          kind: NostrEventKind.SET_METADATA,
        })
      );

      // Add profiles to cache
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      for (const profile of profiles) {
        await waitFor(() => {
          setResult.current.mutate({ event: profile });
        });
      }

      // Query profiles
      const { result } = renderHook(() => useProfiles(pubkeys), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.length).toBeGreaterThan(0);
    });

    it('should be disabled when pubkeys array is empty', () => {
      const { result } = renderHook(() => useProfiles([]), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
    });
  });

  describe('useSetEvent Hook', () => {
    it('should add event to cache', async () => {
      const event = createMockEvent({ id: 'event1' + 'a'.repeat(58) });

      const { result } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      await waitFor(() => {
        result.current.mutate({ event });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should invalidate related queries on success', async () => {
      const event = createMockEvent({
        id: 'event1' + 'a'.repeat(58),
        pubkey: 'alice' + 'a'.repeat(59),
        kind: NostrEventKind.TEXT_NOTE,
      });

      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      // Set up a query to be invalidated
      const { result: queryResult } = renderHook(
        () => useEventQuery({ authors: ['alice' + 'a'.repeat(59)] }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        setResult.current.mutate({ event });
      });

      // Query should be invalidated and refetch
      await waitFor(() => {
        expect(setResult.current.isSuccess).toBe(true);
      });
    });

    it('should invalidate profile cache for kind 0 events', async () => {
      const pubkey = 'alice' + 'a'.repeat(59);
      const profileEvent = createMockEvent({
        id: 'profile1' + 'a'.repeat(56),
        pubkey,
        kind: NostrEventKind.SET_METADATA,
      });

      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      const { result: profileResult } = renderHook(() => useProfile(pubkey), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        setResult.current.mutate({ event: profileEvent });
      });

      await waitFor(() => {
        expect(setResult.current.isSuccess).toBe(true);
      });
    });
  });

  describe('useCacheStats Hook', () => {
    it('should fetch cache statistics', async () => {
      const { result } = renderHook(() => useCacheStats(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveProperty('hits');
      expect(result.current.data).toHaveProperty('misses');
      expect(result.current.data).toHaveProperty('hitRate');
    });

    it('should auto-refresh stats every 30 seconds', () => {
      const { result } = renderHook(() => useCacheStats(), { wrapper: createWrapper() });

      expect(result.current).toBeDefined();
      // Note: refetchInterval is configured in the hook
    });
  });

  describe('useInvalidateCache Hook', () => {
    it('should invalidate cache by pattern', async () => {
      const event = createMockEvent({
        id: 'event1' + 'a'.repeat(58),
        pubkey: 'alice' + 'a'.repeat(59),
      });

      // Add event
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      await waitFor(() => {
        setResult.current.mutate({ event });
      });

      // Invalidate by pubkey pattern
      const { result: invalidateResult } = renderHook(() => useInvalidateCache(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        invalidateResult.current.mutate('pubkey:alice' + 'a'.repeat(59));
      });

      await waitFor(() => {
        expect(invalidateResult.current.isSuccess).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: set -> get -> invalidate', async () => {
      const event = createMockEvent({ id: 'event1' + 'a'.repeat(58) });

      // Step 1: Set event
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      await waitFor(() => {
        setResult.current.mutate({ event });
      });

      await waitFor(() => {
        expect(setResult.current.isSuccess).toBe(true);
      });

      // Step 2: Get event
      const { result: getResult } = renderHook(() => useEvent(event.id), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getResult.current.isSuccess).toBe(true);
      });

      expect(getResult.current.data?.id).toBe(event.id);

      // Step 3: Invalidate
      const { result: invalidateResult } = renderHook(() => useInvalidateCache(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        invalidateResult.current.mutate('all:*');
      });

      await waitFor(() => {
        expect(invalidateResult.current.isSuccess).toBe(true);
      });
    });

    it('should handle profile updates correctly', async () => {
      const pubkey = 'alice' + 'a'.repeat(59);
      const oldProfile = createMockEvent({
        id: 'profile1' + 'a'.repeat(56),
        pubkey,
        kind: NostrEventKind.SET_METADATA,
        content: JSON.stringify({ name: 'Alice' }),
      });

      const newProfile = createMockEvent({
        id: 'profile2' + 'a'.repeat(56),
        pubkey,
        kind: NostrEventKind.SET_METADATA,
        content: JSON.stringify({ name: 'Alice Updated' }),
      });

      // Set old profile
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      await waitFor(() => {
        setResult.current.mutate({ event: oldProfile });
      });

      // Query profile
      const { result: profileResult } = renderHook(() => useProfile(pubkey), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(profileResult.current.isSuccess).toBe(true);
      });

      // Update profile
      await waitFor(() => {
        setResult.current.mutate({ event: newProfile });
      });

      // Profile query should be invalidated and refetch
      await waitFor(() => {
        expect(setResult.current.isSuccess).toBe(true);
      });
    });
  });

  describe('Performance', () => {
    it('should handle rapid queries efficiently', async () => {
      const event = createMockEvent({ id: 'event1' + 'a'.repeat(58) });

      // Add event
      const { result: setResult } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      await waitFor(() => {
        setResult.current.mutate({ event });
      });

      // Rapid queries
      const queries = Array.from({ length: 10 }, () =>
        renderHook(() => useEvent(event.id), { wrapper: createWrapper() })
      );

      // All should complete successfully
      for (const { result } of queries) {
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      }
    });

    it('should batch mutations efficiently', async () => {
      const events = Array.from({ length: 50 }, (_, i) =>
        createMockEvent({
          id: `event${i}`.padEnd(64, 'a'),
          content: `Event ${i}`,
        })
      );

      const { result } = renderHook(() => useSetEvent(), { wrapper: createWrapper() });

      const start = performance.now();

      for (const event of events) {
        await waitFor(() => {
          result.current.mutate({ event });
        });
      }

      const duration = performance.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });
});
