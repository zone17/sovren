/**
 * Lightning Network Service Interface
 * Subset of Lightning operations used by marketplace and payment services
 */
export interface ILightningService {
  createInvoice(
    amountSats: number,
    memo: string
  ): Promise<{ invoiceId: string; paymentRequest: string; paymentHash: string }>;
  payToAddress(
    lightningAddress: string,
    amountSats: number,
    memo: string
  ): Promise<{ paymentHash: string }>;
  getInvoiceStatus(invoiceId: string): Promise<{ paid: boolean; paymentHash?: string }>;
  getSellerLightningAddress(sellerId: string): Promise<string | null>;
}
