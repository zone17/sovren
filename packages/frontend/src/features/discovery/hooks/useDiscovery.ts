import { useState, useMemo, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import apiClient from '@/services/api/apiClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { DiscoveryFilters, DiscoveryResponse } from '../types';
import type { ApiResponse } from '@/services/api/types';

export function useDiscovery() {
  const [filters, setFilters] = useState<DiscoveryFilters>({ sortBy: 'relevance' });
  const [page, setPage] = useState(1);
  const prevPageRef = useRef(page);
  const debouncedQuery = useDebouncedValue(filters.query ?? '', 300);

  const effectiveFilters = useMemo(
    () => ({ ...filters, query: debouncedQuery || undefined, page }),
    [filters, debouncedQuery, page]
  );

  // Only use keepPreviousData for page changes to avoid showing stale results
  // across filter/category changes (P2 #587)
  const isPageChange = prevPageRef.current !== page;
  prevPageRef.current = page;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['discovery', 'creators', effectiveFilters],
    queryFn: () =>
      apiClient.get<ApiResponse<DiscoveryResponse>>('/api/v2/discovery/creators', {
        q: effectiveFilters.query,
        category: effectiveFilters.category,
        sortBy: effectiveFilters.sortBy,
        page: effectiveFilters.page,
        limit: effectiveFilters.limit,
      }),
    placeholderData: isPageChange ? keepPreviousData : undefined,
    staleTime: 60_000,
    enabled: !debouncedQuery || debouncedQuery.length >= 2,
  });

  const updateFilters = (patch: Partial<DiscoveryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  return {
    creators: data?.data?.creators ?? [],
    pagination: data?.data?.pagination,
    filters,
    updateFilters,
    page,
    setPage,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
