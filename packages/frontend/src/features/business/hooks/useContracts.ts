import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../services/contractsApi';
import type { CreateContractPayload, UpdateContractPayload } from '../types';

const QUERY_KEY = ['business', 'contracts'];

export function useContractTemplates() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'templates'],
    queryFn: () => contractsApi.getTemplates(),
    select: (res) => res.data.items,
    staleTime: 5 * 60 * 1000,
  });
}

export function useContractTemplate(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'templates', id],
    queryFn: () => contractsApi.getTemplate(id),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useContracts() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => contractsApi.getContracts(),
    select: (res) => res.data.items,
    staleTime: 30 * 1000,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContractPayload) => contractsApi.createContract(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => {
      console.error('Create contract failed:', error);
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContractPayload }) =>
      contractsApi.updateContract(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => {
      console.error('Update contract failed:', error);
    },
  });
}

export function useAnalyzeContract() {
  return useMutation({
    mutationFn: (text: string) => contractsApi.analyzeContract(text),
    onError: (error) => {
      console.error('Analyze contract failed:', error);
    },
  });
}
