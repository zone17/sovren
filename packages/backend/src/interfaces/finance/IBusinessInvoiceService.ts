/**
 * Business Invoice Service Interface
 * EPIC-011: Business Manager — Invoicing with LNURL-pay
 * NOTE: Named BusinessInvoiceService to avoid collision with existing Phase 5 InvoiceService
 * #276: Typed return values instead of any[]
 */

import type { BusinessInvoice, LineItem } from '@shared/types/finance';

export interface IBusinessInvoiceService {
  createInvoice(
    creatorId: string,
    data: {
      clientName: string;
      lineItems: LineItem[];
      dueDate?: string;
      recurringInterval?: string;
      recurrenceEndDate?: string;
    }
  ): Promise<{ id: string; lnurlPay?: string }>;
  getInvoices(creatorId: string, filters?: { status?: string }): Promise<BusinessInvoice[]>;
  getInvoice(invoiceId: string, creatorId: string): Promise<BusinessInvoice>;
  deleteInvoice(invoiceId: string, creatorId: string): Promise<void>;
  updateInvoiceStatus(invoiceId: string, creatorId: string, status: string): Promise<void>;
  generatePaymentLink(invoiceId: string, creatorId: string): Promise<{ lnurlPay: string }>;
}
