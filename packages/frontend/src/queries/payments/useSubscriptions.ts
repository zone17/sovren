import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Subscription, SubscriptionFilters, SubscriptionsResponse } from '@/types/payment-query';
import { paymentKeys } from './useInvoices';

/**
 * Fetch subscriptions with pagination and filters
 */
const fetchSubscriptions = async (filters?: SubscriptionFilters): Promise<SubscriptionsResponse> => {
  const params = new URLSearchParams();

  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.creatorId) params.append('creatorId', filters.creatorId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.tier) params.append('tier', filters.tier);
  if (filters?.autoRenew !== undefined) params.append('autoRenew', filters.autoRenew.toString());
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);
  if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

  const response = await fetch(`/api/payments/subscriptions?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Hook to fetch subscriptions with caching
 */
export const useSubscriptions = (
  filters?: SubscriptionFilters,
  options?: Omit<UseQueryOptions<SubscriptionsResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<SubscriptionsResponse, Error>({
    queryKey: paymentKeys.subscription(filters),
    queryFn: () => fetchSubscriptions(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
    ...options,
  });
};