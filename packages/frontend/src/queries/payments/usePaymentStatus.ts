import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { PaymentStatus } from '@/types/payment-query';
import { paymentKeys } from './useInvoices';

interface PaymentStatusResponse {
  paymentHash: string;
  status: PaymentStatus;
  amount: number;
  description: string;
  preimage?: string;
  paidAt?: string;
  expiresAt: string;
  settledAt?: string;
}

/**
 * Fetch payment status
 */
const fetchPaymentStatus = async (paymentHash: string): Promise<PaymentStatusResponse> => {
  const response = await fetch(`/api/payments/status/${paymentHash}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Payment not found');
    }
    throw new Error(`Failed to fetch payment status: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Hook to poll payment status with automatic refetch
 * Useful for waiting for Lightning payment confirmation
 */
export const usePaymentStatus = (
  paymentHash: string,
  options?: Omit<UseQueryOptions<PaymentStatusResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<PaymentStatusResponse, Error>({
    queryKey: paymentKeys.paymentStatus(paymentHash),
    queryFn: () => fetchPaymentStatus(paymentHash),
    enabled: !!paymentHash,
    staleTime: 0, // Always fetch fresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: (query) => {
      // Poll every 2 seconds while pending, stop when completed or failed
      if ((query?.state as any)?.data?.status === 'pending') {
        return 2000;
      }
      return false;
    },
    ...options,
  });
};
