import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { LightningInvoice, LightningPayment } from './lightning-service';

/**
 * Interface for payment persistence.
 * Implementations: JsonFilePaymentStore (MVP), SupabasePaymentStore (future).
 */
export interface PaymentPersistence {
  saveInvoice(invoice: LightningInvoice): Promise<void>;
  savePayment(payment: LightningPayment): Promise<void>;
  getInvoiceById(id: string): Promise<LightningInvoice | null>;
  getInvoiceByPaymentHash(hash: string): Promise<LightningInvoice | null>;
  getPaymentsByCreator(creatorId: string): Promise<LightningPayment[]>;
  getAllPayments(): Promise<LightningPayment[]>;
  getAllInvoices(): Promise<LightningInvoice[]>;
  updateInvoiceStatus(id: string, status: string): Promise<void>;
}

/**
 * JSON file-based persistence for MVP.
 * Writes to data/payments/ directory.
 * Thread-safe for single-instance use (not suitable for multi-instance).
 */
export class JsonFilePaymentStore implements PaymentPersistence {
  private readonly dataDir: string;
  private invoices: Map<string, LightningInvoice> = new Map();
  private payments: Map<string, LightningPayment> = new Map();

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'payments');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.loadFromDisk();
  }

  async saveInvoice(invoice: LightningInvoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
    this.writeToDisk('invoices');
  }

  async savePayment(payment: LightningPayment): Promise<void> {
    this.payments.set(payment.id, payment);
    this.writeToDisk('payments');
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

  async getPaymentsByCreator(creatorId: string): Promise<LightningPayment[]> {
    return Array.from(this.payments.values()).filter(
      (p) => p.creator_id === creatorId
    );
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
      (invoice as any).status = status;
      this.invoices.set(id, invoice);
      this.writeToDisk('invoices');
    }
  }

  private loadFromDisk(): void {
    try {
      const invoicesPath = path.join(this.dataDir, 'invoices.json');
      if (existsSync(invoicesPath)) {
        const data = JSON.parse(readFileSync(invoicesPath, 'utf-8'));
        for (const invoice of data) {
          this.invoices.set(invoice.id, invoice);
        }
      }
    } catch (err) {
      console.error('[PaymentPersistence] Failed to load invoices from disk:', err);
    }

    try {
      const paymentsPath = path.join(this.dataDir, 'payments.json');
      if (existsSync(paymentsPath)) {
        const data = JSON.parse(readFileSync(paymentsPath, 'utf-8'));
        for (const payment of data) {
          this.payments.set(payment.id, payment);
        }
      }
    } catch (err) {
      console.error('[PaymentPersistence] Failed to load payments from disk:', err);
    }
  }

  private writeToDisk(type: 'invoices' | 'payments'): void {
    try {
      const filePath = path.join(this.dataDir, `${type}.json`);
      const data = type === 'invoices'
        ? Array.from(this.invoices.values())
        : Array.from(this.payments.values());
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[PaymentPersistence] Failed to write ${type} to disk:`, err);
    }
  }
}
