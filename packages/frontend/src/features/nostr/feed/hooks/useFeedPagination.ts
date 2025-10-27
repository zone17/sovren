/**
 * useFeedPagination Hook
 * Manages infinite scroll pagination for feed
 */

import { useState, useCallback } from 'react';
import type { UseFeedPaginationReturn } from '../types';

/**
 * Hook for managing feed pagination
 */
export const useFeedPagination = (
  pageSize: number = 20
): UseFeedPaginationReturn => {
  const [state, setState] = useState({
    page: 0,
    pageSize,
    oldestTimestamp: null as number | null,
    isLoadingMore: false,
    hasMore: true,
  });

  /**
   * Load next page
   */
  const loadMore = useCallback(() => {
    setState(prev => ({
      ...prev,
      page: prev.page + 1,
      isLoadingMore: true,
    }));
  }, []);

  /**
   * Reset pagination to initial state
   */
  const reset = useCallback(() => {
    setState({
      page: 0,
      pageSize,
      oldestTimestamp: null,
      isLoadingMore: false,
      hasMore: true,
    });
  }, [pageSize]);

  return {
    ...state,
    loadMore,
    reset,
  };
};
