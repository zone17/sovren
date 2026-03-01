/**
 * useFeedFilters Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useFeedFilters } from '../hooks/useFeedFilters';

describe('useFeedFilters', () => {
  describe('Initialization', () => {
    it('initializes with default filters', () => {
      const { result } = renderHook(() => useFeedFilters());

      expect(result.current.filters).toEqual({
        kinds: [1, 6, 7],
      });
    });

    it('initializes with custom filters', () => {
      const initialFilters = {
        kinds: [1],
        authors: ['pubkey123'],
        hashtags: ['bitcoin'],
      };

      const { result } = renderHook(() => useFeedFilters(initialFilters));

      expect(result.current.filters).toEqual(initialFilters);
    });
  });

  describe('updateFilters', () => {
    it('updates filters with new values', () => {
      const { result } = renderHook(() => useFeedFilters());

      act(() => {
        result.current.updateFilters({ search: 'test' });
      });

      expect(result.current.filters).toEqual({
        kinds: [1, 6, 7],
        search: 'test',
      });
    });

    it('merges new filters with existing filters', () => {
      const { result } = renderHook(() => useFeedFilters({ kinds: [1], authors: ['pubkey1'] }));

      act(() => {
        result.current.updateFilters({ hashtags: ['nostr'] });
      });

      expect(result.current.filters).toEqual({
        kinds: [1],
        authors: ['pubkey1'],
        hashtags: ['nostr'],
      });
    });

    it('overwrites existing filter values', () => {
      const { result } = renderHook(() => useFeedFilters({ kinds: [1], search: 'old' }));

      act(() => {
        result.current.updateFilters({ search: 'new' });
      });

      expect(result.current.filters.search).toBe('new');
    });
  });

  describe('clearFilters', () => {
    it('resets filters to default', () => {
      const { result } = renderHook(() =>
        useFeedFilters({
          kinds: [1],
          authors: ['pubkey1'],
          hashtags: ['bitcoin'],
          search: 'test',
        })
      );

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({
        kinds: [1, 6, 7],
      });
    });
  });

  describe('addAuthor', () => {
    it('adds author to filter', () => {
      const { result } = renderHook(() => useFeedFilters());

      act(() => {
        result.current.addAuthor('pubkey123');
      });

      expect(result.current.filters.authors).toContain('pubkey123');
    });

    it('appends to existing authors', () => {
      const { result } = renderHook(() => useFeedFilters({ kinds: [1], authors: ['pubkey1'] }));

      act(() => {
        result.current.addAuthor('pubkey2');
      });

      expect(result.current.filters.authors).toEqual(['pubkey1', 'pubkey2']);
    });
  });

  describe('removeAuthor', () => {
    it('removes author from filter', () => {
      const { result } = renderHook(() =>
        useFeedFilters({ kinds: [1], authors: ['pubkey1', 'pubkey2'] })
      );

      act(() => {
        result.current.removeAuthor('pubkey1');
      });

      expect(result.current.filters.authors).toEqual(['pubkey2']);
    });

    it('handles removing non-existent author', () => {
      const { result } = renderHook(() => useFeedFilters({ kinds: [1], authors: ['pubkey1'] }));

      act(() => {
        result.current.removeAuthor('pubkey2');
      });

      expect(result.current.filters.authors).toEqual(['pubkey1']);
    });
  });

  describe('addHashtag', () => {
    it('adds hashtag to filter', () => {
      const { result } = renderHook(() => useFeedFilters());

      act(() => {
        result.current.addHashtag('bitcoin');
      });

      expect(result.current.filters.hashtags).toContain('bitcoin');
    });

    it('removes # prefix if present', () => {
      const { result } = renderHook(() => useFeedFilters());

      act(() => {
        result.current.addHashtag('#bitcoin');
      });

      expect(result.current.filters.hashtags).toContain('bitcoin');
      expect(result.current.filters.hashtags).not.toContain('#bitcoin');
    });

    it('appends to existing hashtags', () => {
      const { result } = renderHook(() => useFeedFilters({ kinds: [1], hashtags: ['nostr'] }));

      act(() => {
        result.current.addHashtag('bitcoin');
      });

      expect(result.current.filters.hashtags).toEqual(['nostr', 'bitcoin']);
    });
  });

  describe('removeHashtag', () => {
    it('removes hashtag from filter', () => {
      const { result } = renderHook(() =>
        useFeedFilters({ kinds: [1], hashtags: ['nostr', 'bitcoin'] })
      );

      act(() => {
        result.current.removeHashtag('nostr');
      });

      expect(result.current.filters.hashtags).toEqual(['bitcoin']);
    });

    it('removes hashtag with # prefix', () => {
      const { result } = renderHook(() =>
        useFeedFilters({ kinds: [1], hashtags: ['nostr', 'bitcoin'] })
      );

      act(() => {
        result.current.removeHashtag('#nostr');
      });

      expect(result.current.filters.hashtags).toEqual(['bitcoin']);
    });
  });

  describe('setDateRange', () => {
    it('sets date range filter', () => {
      const { result } = renderHook(() => useFeedFilters());

      const since = Math.floor(Date.now() / 1000) - 86400; // 24 hours ago
      const until = Math.floor(Date.now() / 1000);

      act(() => {
        result.current.setDateRange(since, until);
      });

      expect(result.current.filters.since).toBe(since);
      expect(result.current.filters.until).toBe(until);
    });

    it('sets only since when until is undefined', () => {
      const { result } = renderHook(() => useFeedFilters());

      const since = Math.floor(Date.now() / 1000) - 86400;

      act(() => {
        result.current.setDateRange(since);
      });

      expect(result.current.filters.since).toBe(since);
      expect(result.current.filters.until).toBeUndefined();
    });

    it('clears date range when both are undefined', () => {
      const { result } = renderHook(() =>
        useFeedFilters({ kinds: [1], since: 123456, until: 123457 })
      );

      act(() => {
        result.current.setDateRange(undefined, undefined);
      });

      expect(result.current.filters.since).toBeUndefined();
      expect(result.current.filters.until).toBeUndefined();
    });
  });
});
