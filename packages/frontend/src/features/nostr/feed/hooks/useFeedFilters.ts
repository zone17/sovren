/**
 * useFeedFilters Hook
 * Manages feed filter state
 */

import { useState, useCallback } from 'react';
import type { FeedFilters, UseFeedFiltersReturn } from '../types';

/**
 * Default filter configuration
 */
const DEFAULT_FILTERS: FeedFilters = {
  kinds: [1, 6, 7], // Text notes, reposts, reactions
};

/**
 * Hook for managing feed filters
 */
export const useFeedFilters = (
  initialFilters: FeedFilters = DEFAULT_FILTERS
): UseFeedFiltersReturn => {
  const [filters, setFilters] = useState<FeedFilters>(initialFilters);

  /**
   * Update filters (merge with existing)
   */
  const updateFilters = useCallback((newFilters: Partial<FeedFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  /**
   * Clear all filters (reset to default)
   */
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Add author to filter
   */
  const addAuthor = useCallback((pubkey: string) => {
    setFilters((prev) => ({
      ...prev,
      authors: [...(prev.authors || []), pubkey],
    }));
  }, []);

  /**
   * Remove author from filter
   */
  const removeAuthor = useCallback((pubkey: string) => {
    setFilters((prev) => ({
      ...prev,
      authors: prev.authors?.filter((a) => a !== pubkey),
    }));
  }, []);

  /**
   * Add hashtag to filter
   */
  const addHashtag = useCallback((tag: string) => {
    // Remove # if present
    const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
    setFilters((prev) => ({
      ...prev,
      hashtags: [...(prev.hashtags || []), cleanTag],
    }));
  }, []);

  /**
   * Remove hashtag from filter
   */
  const removeHashtag = useCallback((tag: string) => {
    const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
    setFilters((prev) => ({
      ...prev,
      hashtags: prev.hashtags?.filter((h) => h !== cleanTag),
    }));
  }, []);

  /**
   * Set date range filter
   */
  const setDateRange = useCallback((since?: number, until?: number) => {
    setFilters((prev) => ({
      ...prev,
      since,
      until,
    }));
  }, []);

  return {
    filters,
    updateFilters,
    clearFilters,
    addAuthor,
    removeAuthor,
    addHashtag,
    removeHashtag,
    setDateRange,
  };
};
