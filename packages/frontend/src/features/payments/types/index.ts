export type PaymentStatus = 'idle' | 'creating' | 'pending' | 'paid' | 'expired' | 'error';

export interface PaymentFlowState {
  status: PaymentStatus;
  invoiceId: string | null;
  paymentRequest: string | null;
  paymentHash: string | null;
  amountSats: number;
  expiresAt: string | null;
  error: string | null;
}
