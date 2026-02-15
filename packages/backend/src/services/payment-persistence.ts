import { existsSync, mkdirSync, readFileSync, renameSync, copyFileSync } from 'fs';
import { open } from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import type { LightningInvoice, LightningPayment } from './lightning-service';
import { Logger } from '../utils/logger';

/**
 * Interface for payment persistence.
 * Implementations: JsonFilePaymentStore (MVP), SupabasePaymentStore (future).
 */
export interface PaymentPersistence {
  saveInvoice(invoice: LightningInvoice): Promise<void>;
  savePayment(payment: LightningPayment): Promise<void>;
  getInvoiceById(id: string): Promise<LightningInvoice | null>;
  getInvoiceByPaymentHash(hash: string): Promise<LightningInvoice | null>;
  getPaymentsByCreator(creatorId: string, filters?: { status?: string }): Promise<LightningPayment[]>;
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

  async getPaymentsByCreator(creatorId: string, filters?: { status?: string }): Promise<LightningPayment[]> {
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
      this.logger.error(
        `Recovered ${type} from .tmp file after main file corruption`,
        { type, filePath, tmpPath }
      );
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
      this.logger.error(
        `Failed to write ${type} to disk`,
        { type, filePath, error: err }
      );
      throw err;
    }
  }
}
