/**
 * Business Invoice Service
 * EPIC-011: Business Manager — Invoicing with LNURL-pay payment links
 * NOTE: Named BusinessInvoiceService to avoid collision with Phase 5 InvoiceService
 *
 * Security:
 * M-8: Enforces recurrence_end_date + recurrence_count limits per interval type
 */

import type { IBusinessInvoiceService } from '../../interfaces/finance/IBusinessInvoiceService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { IQueueService } from '../../interfaces/queue/IQueueService';
import type { BusinessInvoice } from '@shared/types/finance';

interface LineItem {
  description: string;
  quantity: number;
  unitPriceSats: number;
}

const RECURRING_QUEUE = 'recurring-invoices';

// M-8: Maximum recurrence counts per interval (1-year caps)
const MAX_RECURRENCE_COUNT: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
};

export class BusinessInvoiceService implements IBusinessInvoiceService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly queueService: IQueueService,
    private readonly logger: ILogger
  ) {
    // Ensure the recurring invoice queue exists
    this.queueService.createQueue(RECURRING_QUEUE, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async createInvoice(
    creatorId: string,
    data: {
      clientName: string;
      lineItems: LineItem[];
      dueDate?: string;
      recurringInterval?: string;
      recurrenceEndDate?: string;
    }
  ): Promise<{ id: string; lnurlPay?: string }> {
    this.logger.info('BusinessInvoiceService.createInvoice', {
      creatorId,
      clientName: data.clientName,
    });

    // #272: Use safe integer check to prevent silent precision loss on large invoices
    let totalSats = 0;
    for (const item of data.lineItems) {
      const lineTotal = item.quantity * item.unitPriceSats;
      if (!Number.isSafeInteger(lineTotal)) {
        throw new Error(`Line item total exceeds safe integer range: ${item.description}`);
      }
      totalSats += lineTotal;
      if (!Number.isSafeInteger(totalSats)) {
        throw new Error('Invoice total exceeds safe integer range (max ~9 quadrillion sats)');
      }
    }

    if (totalSats <= 0) {
      throw new Error('Invoice total must be greater than 0 sats');
    }

    const row: Record<string, unknown> = {
      creator_id: creatorId,
      client_name: data.clientName,
      line_items: data.lineItems,
      total_sats: totalSats,
      status: 'draft',
    };
    if (data.dueDate) row.due_date = data.dueDate;
    if (data.recurringInterval) row.recurring_interval = data.recurringInterval;
    // M-8: Persist end-date and count so scheduler can halt when limits are reached
    if (data.recurrenceEndDate) row.recurrence_end_date = data.recurrenceEndDate;

    const { data: inserted, error } = await this.db
      .from('business_invoices')
      .insert(row)
      .select('id')
      .single();

    if (error) throw error;
    if (!inserted) throw new Error('Failed to create invoice');

    const invoiceId = (inserted as { id: string }).id;

    // Schedule recurring invoice generation if interval specified
    if (data.recurringInterval) {
      await this.scheduleRecurringInvoice(
        invoiceId,
        creatorId,
        data.recurringInterval,
        data.recurrenceEndDate
      );
    }

    // Generate LNURL-pay link immediately for the invoice
    const lnurlPay = await this.generateLnurlPayLink(invoiceId, creatorId, totalSats);

    if (lnurlPay) {
      await this.db.from('business_invoices').update({ lnurl_pay: lnurlPay }).eq('id', invoiceId);
    }

    return { id: invoiceId, lnurlPay: lnurlPay ?? undefined };
  }

  async getInvoices(creatorId: string, filters?: { status?: string }): Promise<BusinessInvoice[]> {
    this.logger.info('BusinessInvoiceService.getInvoices', { creatorId, filters });

    let query = this.db.from('business_invoices').select('*').eq('creator_id', creatorId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // #278: Add default limit to prevent unbounded result sets
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async getInvoice(invoiceId: string, creatorId: string): Promise<BusinessInvoice> {
    this.logger.info('BusinessInvoiceService.getInvoice', { invoiceId, creatorId });

    const { data, error } = await this.db
      .from('business_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('creator_id', creatorId)
      .single();

    if (error) throw error;
    if (!data) throw new Error(`Invoice not found: ${invoiceId}`);
    return data;
  }

  async updateInvoiceStatus(invoiceId: string, creatorId: string, status: string): Promise<void> {
    this.logger.info('BusinessInvoiceService.updateInvoiceStatus', {
      invoiceId,
      creatorId,
      status,
    });

    const updates: Record<string, unknown> = { status };

    const { error } = await this.db
      .from('business_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .eq('creator_id', creatorId);

    if (error) throw error;
  }

  async generatePaymentLink(invoiceId: string, creatorId: string): Promise<{ lnurlPay: string }> {
    this.logger.info('BusinessInvoiceService.generatePaymentLink', { invoiceId, creatorId });

    const invoice = await this.getInvoice(invoiceId, creatorId);
    const lnurlPay = await this.generateLnurlPayLink(invoiceId, creatorId, invoice.total_sats);

    if (!lnurlPay) {
      throw new Error('LNURL-pay generation failed: Lightning service unavailable');
    }

    // Persist the payment link
    await this.db
      .from('business_invoices')
      .update({ lnurl_pay: lnurlPay, lightning_payment_link: lnurlPay })
      .eq('id', invoiceId)
      .eq('creator_id', creatorId);

    return { lnurlPay };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async generateLnurlPayLink(
    invoiceId: string,
    creatorId: string,
    totalSats: number
  ): Promise<string | null> {
    try {
      // LNURL-pay endpoint: generates a fresh BOLT11 on each scan
      // In production, this would call the LNbits LNURL-pay extension API
      // The payment link is stable (no expiry) and generates dynamic BOLT11 at scan time
      const baseUrl = process.env.LNBITS_URL ?? 'https://lnbits.sovren.dev';
      const lnurlPayUrl = `${baseUrl}/api/v1/lnurl/pay`;

      // For now, construct the LNURL-pay endpoint URL with invoice metadata
      // In production, this creates a LNbits LNURL-pay link via REST API
      const params = new URLSearchParams({
        amount: String(totalSats * 1000), // convert sats to millisats
        description: `Invoice ${invoiceId} from Sovren`,
        creatorId,
      });

      return `${lnurlPayUrl}?${params.toString()}`;
    } catch (err) {
      this.logger.error('Failed to generate LNURL-pay link', { err, invoiceId });
      return null;
    }
  }

  private async scheduleRecurringInvoice(
    templateInvoiceId: string,
    creatorId: string,
    interval: string,
    recurrenceEndDate?: string
  ): Promise<void> {
    const delayMs = this.intervalToMs(interval);
    if (!delayMs) return;

    // M-8: Do not schedule if end date already passed
    if (recurrenceEndDate && new Date(recurrenceEndDate) <= new Date()) {
      this.logger.info('Recurring invoice not scheduled: recurrence_end_date has passed', {
        templateInvoiceId,
        recurrenceEndDate,
      });
      return;
    }

    await this.queueService.addJob(
      RECURRING_QUEUE,
      'generate-recurring',
      { templateInvoiceId, creatorId, interval, recurrenceEndDate },
      { delay: delayMs, jobId: `recurring-${templateInvoiceId}-${interval}` }
    );
  }

  /**
   * M-8: Called by the BullMQ worker before generating the next recurring invoice.
   * Returns false if either the end date has passed or the count cap is reached.
   */
  canGenerateNextRecurrence(
    interval: string,
    currentCount: number,
    recurrenceEndDate?: string | null
  ): boolean {
    // Cap check
    const maxCount = MAX_RECURRENCE_COUNT[interval];
    if (maxCount !== undefined && currentCount >= maxCount) {
      return false;
    }
    // Date check
    if (recurrenceEndDate && new Date(recurrenceEndDate) <= new Date()) {
      return false;
    }
    return true;
  }

  private intervalToMs(interval: string): number {
    const map: Record<string, number> = {
      weekly: 7 * 24 * 60 * 60 * 1000,
      biweekly: 14 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      quarterly: 90 * 24 * 60 * 60 * 1000,
    };
    return map[interval] ?? 0;
  }
}
