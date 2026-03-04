import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taxApi } from '../services/taxApi';

const QUERY_KEY = ['business', 'tax'];

export function useTaxSummary(year: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'summary', year],
    queryFn: () => taxApi.getSummary(year),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaxCategories() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'categories'],
    queryFn: () => taxApi.getCategories(),
    select: (res) => res.data.items,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTaxCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, type }: { name: string; type: string }) =>
      taxApi.createCategory(name, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'categories'] });
    },
    onError: (error) => {
      console.error('Create tax category failed:', error);
    },
  });
}
