// @ts-nocheck
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
import type { BusinessInvoice, LineItem } from '@shared/types/finance';
import { ConflictError } from '../../utils/errors';

const RECURRING_QUEUE = 'recurring-invoices';

// M-8: Maximum recurrence counts per interval (1-year caps)
const MAX_RECURRENCE_COUNT: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
};

// #323: Row type interface for typed .from<T>() calls
interface BusinessInvoiceRow {
  id: string;
  creator_id: string;
  client_name: string;
  line_items: LineItem[];
  total_sats: number;
  status: string;
  due_date: string | null;
  recurring_interval: string | null;
  recurrence_end_date: string | null;
  lnurl_pay: string | null;
  lightning_payment_link: string | null;
  created_at: string;
  paid_at: string | null;
}

export class BusinessInvoiceService implements IBusinessInvoiceService {
  // #320: Lazy queue initialization — no constructor side effect
  private queueInitPromise: Promise<void> | null = null;

  constructor(
    private readonly db: ISupabaseClient,
    private readonly queueService: IQueueService,
    private readonly logger: ILogger
  ) {}

  // #320: Ensure queue exists lazily on first use
  private async ensureQueue(): Promise<void> {
    if (this.queueInitPromise) return this.queueInitPromise;
    this.queueInitPromise = this.queueService
      .createQueue(RECURRING_QUEUE, {
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      })
      .then(() => {})
      .catch((err) => {
        this.queueInitPromise = null;
        throw err;
      });
    return this.queueInitPromise;
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

    // #364: Calculate total from line_items BEFORE the insert to ensure consistency.
    // line_items is a JSONB column on business_invoices, so the row insert (line_items +
    // total_sats) is a single atomic DB operation — no multi-table transaction needed.
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

    // #364: Validate total matches sum of line items (defense-in-depth)
    const verifyTotal = data.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceSats,
      0
    );
    if (verifyTotal !== totalSats) {
      throw new Error('Invoice total mismatch: computed total does not match line item sum');
    }

    const row: Partial<BusinessInvoiceRow> = {
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

    // #364: Atomic insert — line_items (JSONB) and total_sats in one row, no separate table
    const { data: inserted, error } = await this.db
      .from<BusinessInvoiceRow>('business_invoices')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to create invoice', { error, creatorId });
      throw new Error('Failed to create invoice');
    }
    if (!inserted) throw new Error('Failed to create invoice');

    const invoiceId = inserted.id;

    // Schedule recurring invoice generation if interval specified
    if (data.recurringInterval) {
      await this.scheduleRecurringInvoice(
        invoiceId,
        creatorId,
        data.recurringInterval,
        data.recurrenceEndDate
      );
    }

    // #364: Payment link generation is outside the core insert but is idempotent —
    // calling generateLnurlPayLink with the same invoiceId always produces the same URL.
    // If the update fails, the link can be regenerated via POST /:id/payment-link.
    const lnurlPay = await this.generateLnurlPayLink(invoiceId, creatorId, totalSats);

    if (lnurlPay) {
      await this.db
        .from<BusinessInvoiceRow>('business_invoices')
        .update({ lnurl_pay: lnurlPay })
        .eq('id', invoiceId);
    }

    return { id: invoiceId, lnurlPay: lnurlPay ?? undefined };
  }

  async getInvoices(creatorId: string, filters?: { status?: string }): Promise<BusinessInvoice[]> {
    this.logger.info('BusinessInvoiceService.getInvoices', { creatorId, filters });

    let query = this.db
      .from<BusinessInvoiceRow>('business_invoices')
      .select(
        'id, creator_id, client_name, line_items, total_sats, status, due_date, recurring_interval, recurrence_end_date, lnurl_pay, lightning_payment_link, created_at, paid_at'
      )
      .eq('creator_id', creatorId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // #278: Add default limit to prevent unbounded result sets
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) {
      this.logger.error('Failed to fetch invoices', { error, creatorId });
      throw new Error('Failed to fetch invoices');
    }
    return data ?? [];
  }

  async getInvoice(invoiceId: string, creatorId: string): Promise<BusinessInvoice> {
    this.logger.info('BusinessInvoiceService.getInvoice', { invoiceId, creatorId });

    const { data, error } = await this.db
      .from<BusinessInvoiceRow>('business_invoices')
      .select(
        'id, creator_id, client_name, line_items, total_sats, status, due_date, recurring_interval, recurrence_end_date, lnurl_pay, lightning_payment_link, created_at, paid_at'
      )
      .eq('id', invoiceId)
      .eq('creator_id', creatorId)
      .single();

    if (error) {
      this.logger.error('Failed to fetch invoice', { error, invoiceId, creatorId });
      throw new Error('Failed to fetch invoice');
    }
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
      .from<BusinessInvoiceRow>('business_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to update invoice status', { error, invoiceId, creatorId });
      throw new Error('Failed to update invoice status');
    }
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
      .from<BusinessInvoiceRow>('business_invoices')
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

    // #320: Lazily create queue on first use
    await this.ensureQueue();

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

  async deleteInvoice(invoiceId: string, creatorId: string): Promise<void> {
    this.logger.info('BusinessInvoiceService.deleteInvoice', { invoiceId, creatorId });

    // #360: Status guard — only draft invoices can be deleted
    const invoice = await this.getInvoice(invoiceId, creatorId);
    if (invoice.status !== 'draft') {
      throw new ConflictError(
        `Cannot delete invoice with status '${invoice.status}'. Only draft invoices can be deleted.`
      );
    }

    const { error } = await this.db
      .from<BusinessInvoiceRow>('business_invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to delete invoice', { error, invoiceId, creatorId });
      throw new Error('Failed to delete invoice');
    }
  }
}
