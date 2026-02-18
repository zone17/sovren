import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taxApi } from '../services/taxApi';
import type { CreateExpensePayload } from '../types';

const QUERY_KEY = ['business', 'expenses'];

export function useExpenses(params?: { categoryId?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => taxApi.getExpenses(params),
    select: (res) => res.data,
    staleTime: 30 * 1000,
  });
}

export function useAddExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpensePayload) => taxApi.addExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // Also invalidate tax summary since expenses affect it
      queryClient.invalidateQueries({ queryKey: ['business', 'tax', 'summary'] });
    },
  });
}
