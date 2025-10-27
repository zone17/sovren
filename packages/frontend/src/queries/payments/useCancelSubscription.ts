import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { Subscription } from '@/types/payment-query';
import { paymentKeys } from './useInvoices';

interface CancelSubscriptionInput {
  subscriptionId: string;
  reason?: string;
  immediate?: boolean; // Cancel immediately vs at end of billing period
}

/**
 * Cancel subscription
 */
const cancelSubscription = async ({
  subscriptionId,
  reason,
  immediate = false,
}: CancelSubscriptionInput): Promise<Subscription> => {
  const response = await fetch(`/api/payments/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason, immediate }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel subscription');
  }

  return response.json();
};

/**
 * Hook to cancel subscription
 */
export const useCancelSubscription = (
  options?: UseMutationOptions<Subscription, Error, CancelSubscriptionInput>
) => {
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, CancelSubscriptionInput>({
    mutationFn: cancelSubscription,
    onSuccess: (subscription, { subscriptionId }) => {
      // Update cache
      queryClient.setQueryData(paymentKeys.subscriptionDetail(subscriptionId), subscription);

      // Invalidate subscription lists
      queryClient.invalidateQueries({
        queryKey: paymentKeys.subscriptions(),
        refetchType: 'active',
      });
    },
    ...options,
  });
};