import { existsSync, mkdirSync, readFileSync, renameSync, copyFileSync } from 'fs';
import { open } from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import type { LightningInvoice, LightningPayment } from './lightning-service';
import { Logger } from '../utils/logger';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Interface for payment persistence.
 * Implementations: JsonFilePaymentStore (MVP), SupabasePaymentStore (future).
 */
export interface PaymentPersistence {
  saveInvoice(invoice: LightningInvoice): Promise<void>;
  savePayment(payment: LightningPayment): Promise<void>;
  getInvoiceById(id: string): Promise<LightningInvoice | null>;
  getInvoiceByPaymentHash(hash: string): Promise<LightningInvoice | null>;
  getPaymentsByCreator(
    creatorId: string,
    filters?: { status?: string }
  ): Promise<LightningPayment[]>;
  getAllPayments(): Promise<LightningPayment[]>;
  getAllInvoices(): Promise<LightningInvoice[]>;
  updateInvoiceStatus(id: string, status: string): Promise<void>;
}

/**
 * JSON file-based persistence for MVP.
 * Writes to data/payments/ directory.
 *
 * Fix #112: Atomic writes via temp+rename, write mutex, corruption recovery.
 */
export class JsonFilePaymentStore extends EventEmitter implements PaymentPersistence {
  private readonly dataDir: string;
  private readonly logger = new Logger('PaymentPersistence');
  private invoices: Map<string, LightningInvoice> = new Map();
  private payments: Map<string, LightningPayment> = new Map();
  private writeMutex: Promise<void> = Promise.resolve();
  public corruptionDetected = false;

  constructor(dataDir?: string) {
    super();
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'payments');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.loadFromDisk();
  }

  async saveInvoice(invoice: LightningInvoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
    await this.writeToDisk('invoices');
  }

  async savePayment(payment: LightningPayment): Promise<void> {
    this.payments.set(payment.id, payment);
    await this.writeToDisk('payments');
  }

  async getInvoiceById(id: string): Promise<LightningInvoice | null> {
    return this.invoices.get(id) || null;
  }

  async getInvoiceByPaymentHash(hash: string): Promise<LightningInvoice | null> {
    for (const invoice of this.invoices.values()) {
      if (invoice.payment_hash === hash) {
        return invoice;
      }
    }
    return null;
  }

  async getPaymentsByCreator(
    creatorId: string,
    filters?: { status?: string }
  ): Promise<LightningPayment[]> {
    // TODO: When backed by a real database, apply filters as WHERE clauses in the query
    // instead of filtering in-memory for better performance at scale
    return Array.from(this.payments.values()).filter((p) => {
      if (p.creator_id !== creatorId) return false;
      if (filters?.status && p.status !== filters.status) return false;
      return true;
    });
  }

  async getAllPayments(): Promise<LightningPayment[]> {
    return Array.from(this.payments.values());
  }

  async getAllInvoices(): Promise<LightningInvoice[]> {
    return Array.from(this.invoices.values());
  }

  async updateInvoiceStatus(id: string, status: string): Promise<void> {
    const invoice = this.invoices.get(id);
    if (invoice) {
      const updated = { ...invoice, status } as LightningInvoice;
      this.invoices.set(id, updated);
      await this.writeToDisk('invoices');
    }
  }

  /**
   * Load data from disk with corruption recovery.
   * If the main file is corrupted, backs it up and attempts recovery from .tmp file.
   */
  private loadFromDisk(): void {
    this.loadCollection('invoices', this.invoices);
    this.loadCollection('payments', this.payments);
  }

  private loadCollection<T extends { id: string }>(type: string, target: Map<string, T>): void {
    const filePath = path.join(this.dataDir, `${type}.json`);
    const tmpPath = `${filePath}.tmp`;

    // Try main file first
    const mainData = this.tryParseFile(filePath);
    if (mainData !== null) {
      for (const item of mainData) {
        target.set(item.id, item);
      }
      return;
    }

    // Main file missing or corrupted — try .tmp recovery
    if (existsSync(filePath)) {
      this.corruptionDetected = true;
      this.backupCorruptedFile(filePath, type);
      this.emit('corruption:detected', { type, filePath, recoveredFromTmp: false });
    }

    const tmpData = this.tryParseFile(tmpPath);
    if (tmpData !== null) {
      this.logger.error(`Recovered ${type} from .tmp file after main file corruption`, {
        type,
        filePath,
        tmpPath,
      });
      this.emit('corruption:detected', { type, filePath, recoveredFromTmp: true });
      for (const item of tmpData) {
        target.set(item.id, item);
      }
      return;
    }

    // Neither file usable — start fresh
    if (existsSync(filePath) || existsSync(tmpPath)) {
      this.corruptionDetected = true;
      this.logger.error(
        `Both ${type}.json and .tmp are unreadable. Starting with empty ${type}. Data may have been lost.`,
        { type, filePath, tmpPath }
      );
      this.emit('corruption:detected', { type, filePath, recoveredFromTmp: false, dataLost: true });
    }
  }

  private tryParseFile(filePath: string): any[] | null {
    try {
      if (!existsSync(filePath)) return null;
      const raw = readFileSync(filePath, 'utf-8');
      if (raw.length === 0) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return null;
      return data;
    } catch {
      return null;
    }
  }

  private backupCorruptedFile(filePath: string, type: string): void {
    try {
      const timestamp = Date.now();
      const backupPath = `${filePath}.corrupt.${timestamp}`;
      copyFileSync(filePath, backupPath);
      this.logger.error(`Backed up corrupted ${type} file`, { backupPath });
    } catch (err) {
      this.logger.error(`Failed to backup corrupted ${type} file`, { filePath, error: err });
    }
  }

  /**
   * Atomic write: serialize through mutex, write to .tmp, then rename.
   * Errors are propagated to the caller.
   */
  private writeToDisk(type: 'invoices' | 'payments'): Promise<void> {
    this.writeMutex = this.writeMutex.then(() => this.doWrite(type));
    return this.writeMutex;
  }

  private async doWrite(type: 'invoices' | 'payments'): Promise<void> {
    const filePath = path.join(this.dataDir, `${type}.json`);
    const tmpPath = `${filePath}.tmp`;
    const data =
      type === 'invoices' ? Array.from(this.invoices.values()) : Array.from(this.payments.values());

    try {
      const handle = await open(tmpPath, 'w');
      try {
        await handle.writeFile(JSON.stringify(data, null, 2), 'utf-8');
        await handle.datasync();
      } finally {
        await handle.close();
      }
      renameSync(tmpPath, filePath);
    } catch (err) {
      this.logger.error(`Failed to write ${type} to disk`, { type, filePath, error: err });
      throw err;
    }
  }
}

/**
 * Supabase-backed payment persistence for production.
 * Implements PaymentPersistence using the Supabase REST API.
 *
 * P1-PAY-002: Replaces JsonFilePaymentStore which throws in production.
 */
export class SupabasePaymentStore implements PaymentPersistence {
  private readonly supabase: SupabaseClient;
  private readonly logger = new Logger('SupabasePaymentStore');

  constructor(supabase?: SupabaseClient) {
    if (supabase) {
      this.supabase = supabase;
    } else {
      const url = process.env.SUPABASE_URL;
      // Uses service role key — bypasses RLS. Only use for admin/background operations.
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error('SupabasePaymentStore requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      }
      this.supabase = createClient(url, key);
    }
  }

  async saveInvoice(invoice: LightningInvoice): Promise<void> {
    const { error } = await this.supabase.from('lightning_invoices').upsert({
      id: invoice.id,
      bolt11: invoice.bolt11,
      amount: invoice.amount,
      description: invoice.description,
      created_at: new Date(invoice.created_at).toISOString(),
      expires_at: new Date(invoice.expires_at).toISOString(),
      status: invoice.status,
      payment_hash: invoice.payment_hash,
      payment_request: invoice.payment_request,
      metadata: invoice.metadata ?? null,
    });

    if (error) {
      this.logger.error('Failed to save invoice to Supabase', {
        invoiceId: invoice.id,
        error: error.message,
      });
      throw new Error(`Failed to save invoice: ${error.message}`);
    }
  }

  async savePayment(payment: LightningPayment): Promise<void> {
    const { error } = await this.supabase.from('lightning_payments').upsert({
      id: payment.id,
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      fee: payment.fee,
      status: payment.status,
      settled_at: payment.settled_at ? new Date(payment.settled_at).toISOString() : null,
      preimage: payment.preimage ?? null,
      memo: payment.memo ?? null,
      creator_id: payment.creator_id,
      supporter_id: payment.supporter_id,
      nostr_event_id: payment.nostr_event_id ?? null,
    });

    if (error) {
      this.logger.error('Failed to save payment to Supabase', {
        paymentId: payment.id,
        error: error.message,
      });
      throw new Error(`Failed to save payment: ${error.message}`);
    }
  }

  async getInvoiceById(id: string): Promise<LightningInvoice | null> {
    const { data, error } = await this.supabase
      .from('lightning_invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      this.logger.error('Failed to fetch invoice by id', { id, error: error.message });
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }

    return data ? this.rowToInvoice(data) : null;
  }

  async getInvoiceByPaymentHash(hash: string): Promise<LightningInvoice | null> {
    const { data, error } = await this.supabase
      .from('lightning_invoices')
      .select('*')
      .eq('payment_hash', hash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error('Failed to fetch invoice by payment_hash', { hash, error: error.message });
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }

    return data ? this.rowToInvoice(data) : null;
  }

  async getPaymentsByCreator(
    creatorId: string,
    filters?: { status?: string }
  ): Promise<LightningPayment[]> {
    let query = this.supabase.from('lightning_payments').select('*').eq('creator_id', creatorId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to fetch payments by creator', { creatorId, error: error.message });
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    return (data ?? []).map((row) => this.rowToPayment(row));
  }

  async getAllPayments(): Promise<LightningPayment[]> {
    const { data, error } = await this.supabase
      .from('lightning_payments')
      .select('*')
      .order('settled_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch all payments', { error: error.message });
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    return (data ?? []).map((row) => this.rowToPayment(row));
  }

  async getAllInvoices(): Promise<LightningInvoice[]> {
    const { data, error } = await this.supabase
      .from('lightning_invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch all invoices', { error: error.message });
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    return (data ?? []).map((row) => this.rowToInvoice(row));
  }

  async updateInvoiceStatus(id: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('lightning_invoices')
      .update({ status })
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to update invoice status', { id, status, error: error.message });
      throw new Error(`Failed to update invoice status: ${error.message}`);
    }
  }

  private rowToInvoice(row: Record<string, unknown>): LightningInvoice {
    return {
      id: row.id as string,
      bolt11: row.bolt11 as string,
      amount: row.amount as number,
      description: row.description as string,
      created_at: new Date(row.created_at as string).getTime(),
      expires_at: new Date(row.expires_at as string).getTime(),
      status: row.status as LightningInvoice['status'],
      payment_hash: row.payment_hash as string,
      payment_request: row.payment_request as string,
      metadata: (row.metadata as Record<string, string> | undefined) ?? undefined,
    };
  }

  private rowToPayment(row: Record<string, unknown>): LightningPayment {
    return {
      id: row.id as string,
      invoice_id: row.invoice_id as string,
      amount: row.amount as number,
      fee: (row.fee as number) ?? 0,
      status: row.status as LightningPayment['status'],
      settled_at: row.settled_at ? new Date(row.settled_at as string).getTime() : undefined,
      preimage: (row.preimage as string | undefined) ?? undefined,
      memo: (row.memo as string | undefined) ?? undefined,
      creator_id: row.creator_id as string,
      supporter_id: row.supporter_id as string,
      nostr_event_id: (row.nostr_event_id as string | undefined) ?? undefined,
    };
  }
}

/**
 * Factory: returns SupabasePaymentStore in production, JsonFilePaymentStore in development.
 */
export function createPaymentStore(supabase?: SupabaseClient): PaymentPersistence {
  if (process.env.NODE_ENV === 'production') {
    return new SupabasePaymentStore(supabase);
  }
  return new JsonFilePaymentStore();
}
