import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { Invoice, CreatePaymentInput } from '@/types/payment-query';
import { paymentKeys } from './useInvoices';

/**
 * Create new payment/invoice
 */
const createPayment = async (data: CreatePaymentInput): Promise<Invoice> => {
  const response = await fetch('/api/payments/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment');
  }

  return response.json();
};

/**
 * Hook to create payment/invoice
 */
export const useCreatePayment = (
  options?: UseMutationOptions<Invoice, Error, CreatePaymentInput>
) => {
  const queryClient = useQueryClient();

  return useMutation<Invoice, Error, CreatePaymentInput>({
    mutationFn: createPayment,
    onSuccess: (invoice) => {
      // Add to cache
      queryClient.setQueryData(paymentKeys.invoiceDetail(invoice.id), invoice);

      // Invalidate invoice lists
      queryClient.invalidateQueries({
        queryKey: paymentKeys.invoices(),
        refetchType: 'active',
      });

      // If this is for a subscription, invalidate subscription queries
      if (invoice.subscriptionId) {
        queryClient.invalidateQueries({
          queryKey: paymentKeys.subscriptionDetail(invoice.subscriptionId),
        });
      }
    },
    ...options,
  });
};