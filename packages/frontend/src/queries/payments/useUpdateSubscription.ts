import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { Subscription, UpdateSubscriptionInput } from '@/types/payment-query';
import { paymentKeys } from './useInvoices';

/**
 * Update subscription
 */
const updateSubscription = async ({
  subscriptionId,
  data,
}: {
  subscriptionId: string;
  data: UpdateSubscriptionInput;
}): Promise<Subscription> => {
  const response = await fetch(`/api/payments/subscriptions/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update subscription');
  }

  return response.json();
};

/**
 * Hook to update subscription with optimistic updates
 */
export const useUpdateSubscription = (
  options?: UseMutationOptions<
    Subscription,
    Error,
    { subscriptionId: string; data: UpdateSubscriptionInput },
    { previousSubscription?: Subscription }
  >
) => {
  const queryClient = useQueryClient();

  return useMutation<
    Subscription,
    Error,
    { subscriptionId: string; data: UpdateSubscriptionInput },
    { previousSubscription?: Subscription }
  >({
    mutationFn: updateSubscription,
    onMutate: async ({ subscriptionId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: paymentKeys.subscriptionDetail(subscriptionId),
      });

      // Snapshot the previous value
      const previousSubscription = queryClient.getQueryData<Subscription>(
        paymentKeys.subscriptionDetail(subscriptionId)
      );

      // Optimistically update
      if (previousSubscription) {
        queryClient.setQueryData<Subscription>(paymentKeys.subscriptionDetail(subscriptionId), {
          ...previousSubscription,
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousSubscription };
    },
    onError: (err, { subscriptionId }, context) => {
      // Rollback on error
      if (context?.previousSubscription) {
        queryClient.setQueryData(
          paymentKeys.subscriptionDetail(subscriptionId),
          context.previousSubscription
        );
      }
    },
    onSuccess: (data, { subscriptionId }) => {
      // Update cache with server response
      queryClient.setQueryData(paymentKeys.subscriptionDetail(subscriptionId), data);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: paymentKeys.subscriptions() });
    },
    ...options,
  });
};
