/**
 * Business Invoice Service Interface
 * EPIC-011: Business Manager — Invoicing with LNURL-pay
 * NOTE: Named BusinessInvoiceService to avoid collision with existing Phase 5 InvoiceService
 */

export interface IBusinessInvoiceService {
  createInvoice(
    creatorId: string,
    data: {
      clientName: string;
      lineItems: Array<{ description: string; quantity: number; unitPriceSats: number }>;
      dueDate?: string;
      recurringInterval?: string;
    }
  ): Promise<{ id: string; lnurlPay?: string }>;
  getInvoices(creatorId: string, filters?: { status?: string }): Promise<any[]>;
  getInvoice(invoiceId: string, creatorId: string): Promise<any>;
  updateInvoiceStatus(invoiceId: string, creatorId: string, status: string): Promise<void>;
  generatePaymentLink(invoiceId: string, creatorId: string): Promise<{ lnurlPay: string }>;
}
