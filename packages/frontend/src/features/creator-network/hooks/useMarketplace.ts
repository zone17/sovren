import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '../services/marketplaceApi';
import type { ServiceType } from '@shared/types/community';

export function useListings(params?: { serviceType?: ServiceType; page?: number }) {
  return useQuery({
    queryKey: ['creator-network', 'marketplace', 'listings', params],
    queryFn: () => marketplaceApi.getListings(params),
    select: (res) => res.data,
    staleTime: 60 * 1000,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: marketplaceApi.createListing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'marketplace', 'listings'] });
    },
    onError: (error) => {
      console.error('Create listing failed:', error);
    },
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { listingId: string; idempotencyKey: string }) =>
      marketplaceApi.placeOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'marketplace', 'orders'] });
    },
    onError: (error) => {
      console.error('Place order failed:', error);
    },
  });
}

export function useStartOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => marketplaceApi.startOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'marketplace', 'orders'] });
    },
    onError: (error) => {
      console.error('Start order failed:', error);
    },
  });
}

export function useCompleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => marketplaceApi.completeOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'marketplace', 'orders'] });
    },
    onError: (error) => {
      console.error('Complete order failed:', error);
    },
  });
}

export function useDisputeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      marketplaceApi.disputeOrder(orderId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'marketplace', 'orders'] });
    },
    onError: (error) => {
      console.error('Dispute order failed:', error);
    },
  });
}

export function useReviewOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      rating,
      reviewText,
    }: {
      orderId: string;
      rating: number;
      reviewText?: string;
    }) => marketplaceApi.reviewOrder(orderId, { rating, reviewText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'marketplace', 'orders'] });
    },
    onError: (error) => {
      console.error('Review order failed:', error);
    },
  });
}
