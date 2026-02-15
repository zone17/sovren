import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaymentFlowState } from '../types';

interface UsePaymentFlowOptions {
  amountSats: number;
  recipientId: string;
  paymentType: 'subscription' | 'tip' | 'one_time';
  description: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UsePaymentFlowReturn extends PaymentFlowState {
  createInvoice: () => Promise<void>;
  reset: () => void;
  timeRemaining: number | null;
}

const INITIAL_STATE: PaymentFlowState = {
  status: 'idle',
  invoiceId: null,
  paymentRequest: null,
  paymentHash: null,
  amountSats: 0,
  expiresAt: null,
  error: null,
};

/**
 * Hook for managing the Lightning payment flow.
 * In production, this calls apiClient.createInvoice() and polls for payment status.
 * Currently uses mock data for the UI flow.
 */
export function usePaymentFlow(options: UsePaymentFlowOptions): UsePaymentFlowReturn {
  const [state, setState] = useState<PaymentFlowState>({
    ...INITIAL_STATE,
    amountSats: options.amountSats,
  });
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState({ ...INITIAL_STATE, amountSats: options.amountSats });
    setTimeRemaining(null);
  }, [cleanup, options.amountSats]);

  const createInvoice = useCallback(async () => {
    cleanup();
    setState((prev) => ({ ...prev, status: 'creating', error: null }));

    try {
      // Simulate API call to create Lightning invoice
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockPaymentRequest =
        'lnbc' + options.amountSats + 'u1p3' + Math.random().toString(36).substring(2, 15);
      const mockPaymentHash =
        Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      setState({
        status: 'pending',
        invoiceId: 'inv-' + Date.now(),
        paymentRequest: mockPaymentRequest,
        paymentHash: mockPaymentHash,
        amountSats: options.amountSats,
        expiresAt,
        error: null,
      });

      // Start countdown timer
      const expiryTime = new Date(expiresAt).getTime();
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          setState((prev) => ({ ...prev, status: 'expired' }));
          cleanup();
        }
      }, 1000);

      // Simulate payment confirmation after a random delay (for demo)
      pollRef.current = setInterval(() => {
        // In production: poll GET /api/v1/payments/invoices/:id
        // For demo, auto-confirm after ~8 seconds
      }, 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create invoice';
      setState((prev) => ({ ...prev, status: 'error', error: errorMsg }));
      options.onError?.(errorMsg);
    }
  }, [cleanup, options]);

  // Simulate payment confirmation for demo
  const simulatePayment = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'paid' }));
    cleanup();
    options.onSuccess?.();
  }, [cleanup, options]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    createInvoice,
    reset,
    timeRemaining,
    // Expose simulatePayment for demo purposes via the status-change approach
    ...(state.status === 'pending' ? { simulatePayment } : {}),
  } as UsePaymentFlowReturn & { simulatePayment?: () => void };
}
