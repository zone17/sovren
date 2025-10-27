import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Invoice, PaymentFilters, InvoicesResponse } from '@/types/payment-query';

/**
 * Fetch invoices with pagination and filters
 */
const fetchInvoices = async (filters?: PaymentFilters): Promise<InvoicesResponse> => {
  const params = new URLSearchParams();

  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.creatorId) params.append('creatorId', filters.creatorId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.method) params.append('method', filters.method);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  if (filters?.minAmount) params.append('minAmount', filters.minAmount.toString());
  if (filters?.maxAmount) params.append('maxAmount', filters.maxAmount.toString());
  if (filters?.contentId) params.append('contentId', filters.contentId);
  if (filters?.subscriptionId) params.append('subscriptionId', filters.subscriptionId);
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);
  if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

  const response = await fetch(`/api/payments/invoices?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch invoices: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Query key factory for payments
 */
export const paymentKeys = {
  all: ['payments'] as const,
  invoices: () => [...paymentKeys.all, 'invoices'] as const,
  invoice: (filters?: PaymentFilters) => [...paymentKeys.invoices(), { filters }] as const,
  invoiceDetail: (id: string) => [...paymentKeys.invoices(), id] as const,
  subscriptions: () => [...paymentKeys.all, 'subscriptions'] as const,
  subscription: (filters?: any) => [...paymentKeys.subscriptions(), { filters }] as const,
  subscriptionDetail: (id: string) => [...paymentKeys.subscriptions(), id] as const,
  paymentStatus: (paymentHash: string) => [...paymentKeys.all, 'status', paymentHash] as const,
};

/**
 * Hook to fetch invoices with pagination
 */
export const useInvoices = (
  filters?: PaymentFilters,
  options?: Omit<UseQueryOptions<InvoicesResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<InvoicesResponse, Error>({
    queryKey: paymentKeys.invoice(filters),
    queryFn: () => fetchInvoices(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
    ...options,
  });
};