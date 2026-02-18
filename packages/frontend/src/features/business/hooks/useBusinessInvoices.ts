import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../services/invoicesApi';
import type { CreateInvoicePayload } from '../types';

const QUERY_KEY = ['business', 'invoices'];

export function useBusinessInvoices() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => invoicesApi.getInvoices(),
    select: (res) => res.data,
    staleTime: 30 * 1000,
  });
}

export function useBusinessInvoice(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => invoicesApi.getInvoice(id),
    select: (res) => res.data,
    enabled: Boolean(id),
  });
}

export function useCreateBusinessInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoicePayload) => invoicesApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      invoicesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useGeneratePaymentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.generatePaymentLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
