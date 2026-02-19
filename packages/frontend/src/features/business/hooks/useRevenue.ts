import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { revenueApi } from '../services/revenueApi';
import type { CreateRevenueEntryPayload } from '../types';

const QUERY_KEY = ['business', 'revenue'];

export function useRevenueBreakdown() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'breakdown'],
    queryFn: () => revenueApi.getBreakdown(),
    select: (res) => res.data,
    staleTime: 60 * 1000,
  });
}

export function useRevenueRisk() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'risk'],
    queryFn: () => revenueApi.getRisk(),
    select: (res) => res.data,
    staleTime: 60 * 1000,
  });
}

export function useDiversificationGoals() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'goals'],
    queryFn: () => revenueApi.getGoals(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateDiversificationGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetDistribution: Record<string, number>) =>
      revenueApi.updateGoals(targetDistribution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'goals'] });
    },
  });
}

export function useAddRevenueEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRevenueEntryPayload) => revenueApi.addRevenueEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
