/**
 * Lightning Payment Receipt Service
 *
 * Comprehensive receipt generation service for Lightning Network payments.
 * Handles PDF generation, email delivery, and receipt verification with
 * cryptographic validation and secure storage.
 *
 * Fix #114: Receipts persisted to JSON file (survive restart).
 * Fix #117: Browser pool for PDF generation (single browser, reused pages).
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFileSync, renameSync, copyFileSync } from 'fs';
import * as fs from 'fs/promises';
import { open as fsOpen } from 'fs/promises';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ===============================
// Interface Definitions
// ===============================

interface CreatorReceiptInfo {
  id: string;
  name: string;
  displayName: string;
  lightningAddress?: string;
  avatar?: string;
  profile: {
    bio?: string;
    website?: string;
    socialLinks?: Record<string, string>;
  };
}

interface SupporterReceiptInfo {
  id: string;
  name?: string;
  email?: string;
  anonymous: boolean;
  message?: string;
}

interface PaymentVerification {
  paymentHash: string;
  preimage: string;
  verified: boolean;
  verifiedAt: number;
  signature: string;
  blockHeight?: number;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  paymentHash: string;
  invoiceId: string;
  amount: number;
  fee: number;
  timestamp: number;
  createdAt: number;

  creator: CreatorReceiptInfo;
  supporter: SupporterReceiptInfo;

  invoice: {
    bolt11: string;
    description: string;
    memo?: string;
    expiresAt: number;
  };

  verification: PaymentVerification;

  receipt: {
    receiptNumber: string;
    pdfGenerated: boolean;
    pdfUrl?: string;
    emailSent: boolean;
    emailDeliveredAt?: number;
    downloadUrl: string;
    downloadCount: number;
    lastAccessedAt?: number;
  };

  platform: {
    name: string;
    version: string;
    environment: string;
    processedBy: string;
  };

  security: {
    hash: string;
    signature: string;
    verificationCode: string;
  };
}

interface ReceiptConfig {
  pdfTemplate: string;
  pdfOptions: {
    format: 'A4' | 'Letter';
    margin: { top: string; right: string; bottom: string; left: string };
    printBackground: boolean;
    displayHeaderFooter: boolean;
  };
  email: {
    from: string;
    subject: string;
    template: string;
    attachPdf: boolean;
  };
  storage: {
    provider: 'local' | 's3' | 'gcs';
    basePath: string;
    retention: number;
  };
  security: {
    encryptPdf: boolean;
    passwordProtected: boolean;
    signatureAlgorithm: string;
  };
}

const ReceiptGenerationRequestSchema = z.object({
  paymentId: z.string().uuid(),
  includeDetailedVerification: z.boolean().default(true),
  emailReceipt: z.boolean().default(false),
  emailAddress: z.string().email().optional(),
  pdfOptions: z
    .object({
      includeQrCode: z.boolean().default(true),
      includeSignature: z.boolean().default(true),
      watermark: z.boolean().default(false),
    })
    .optional(),
});

type ReceiptGenerationRequest = z.infer<typeof ReceiptGenerationRequestSchema>;

// ===============================
// Fix #114: Receipt Persistence
// ===============================

/**
 * Atomic JSON file persistence for receipts.
 * Uses write-to-temp-then-rename pattern matching Fix #112.
 */
class ReceiptPersistence {
  private readonly filePath: string;
  private writeMutex: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'receipts.json');
  }

  loadAll(): PaymentReceipt[] {
    const tmpPath = `${this.filePath}.tmp`;

    // Try main file first
    const mainData = this.tryParseFile(this.filePath);
    if (mainData !== null) return mainData;

    // Main file corrupted — backup and try .tmp
    if (existsSync(this.filePath)) {
      try {
        const backupPath = `${this.filePath}.corrupt.${Date.now()}`;
        copyFileSync(this.filePath, backupPath);
        console.error(`[ReceiptPersistence] Backed up corrupted receipts file to ${backupPath}`);
      } catch {
        // best-effort backup
      }
    }

    const tmpData = this.tryParseFile(tmpPath);
    if (tmpData !== null) {
      console.error('[ReceiptPersistence] Recovered receipts from .tmp file');
      return tmpData;
    }

    if (existsSync(this.filePath) || existsSync(tmpPath)) {
      console.error(
        '[ReceiptPersistence] WARNING: Both receipts.json and .tmp unreadable. Starting empty.'
      );
    }
    return [];
  }

  save(receipts: PaymentReceipt[]): Promise<void> {
    this.writeMutex = this.writeMutex.then(() => this.doWrite(receipts));
    return this.writeMutex;
  }

  private async doWrite(receipts: PaymentReceipt[]): Promise<void> {
    const tmpPath = `${this.filePath}.tmp`;
    try {
      const handle = await fsOpen(tmpPath, 'w');
      try {
        await handle.writeFile(JSON.stringify(receipts, null, 2), 'utf-8');
        await handle.datasync();
      } finally {
        await handle.close();
      }
      renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('[ReceiptPersistence] Failed to write receipts to disk:', err);
      throw err;
    }
  }

  private tryParseFile(filePath: string): PaymentReceipt[] | null {
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
}

// ===============================
// Fix #117: Browser Pool
// ===============================

/**
 * Manages a single Puppeteer browser instance with page reuse.
 * Limits concurrent pages and auto-recovers from browser crashes.
 */
class BrowserPool {
  private browser: puppeteer.Browser | null = null;
  private maxConcurrentPages: number;
  private activePages = 0;
  private waitQueue: Array<(value: void) => void> = [];
  private launching = false;

  constructor(maxConcurrentPages = 5) {
    this.maxConcurrentPages = maxConcurrentPages;
  }

  async acquirePage(): Promise<puppeteer.Page> {
    // Wait if at capacity
    if (this.activePages >= this.maxConcurrentPages) {
      await new Promise<void>((resolve) => {
        this.waitQueue.push(resolve);
      });
    }

    const browser = await this.getBrowser();
    this.activePages++;
    try {
      return await browser.newPage();
    } catch {
      // Browser likely crashed — relaunch and retry once
      this.browser = null;
      const freshBrowser = await this.getBrowser();
      return await freshBrowser.newPage();
    }
  }

  async releasePage(page: puppeteer.Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch {
      // page already closed or browser crashed
    }
    this.activePages--;
    // Wake next waiter
    const next = this.waitQueue.shift();
    if (next) next();
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // Prevent multiple concurrent launches
    if (this.launching) {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (this.browser && this.browser.connected) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
      return this.browser!;
    }

    this.launching = true;
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      // Auto-detect browser disconnection
      this.browser.on('disconnected', () => {
        this.browser = null;
      });

      return this.browser;
    } finally {
      this.launching = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // best-effort
      }
      this.browser = null;
    }
  }
}

// ===============================
// Receipt Service Implementation
// ===============================

export class LightningReceiptService extends EventEmitter {
  private config: ReceiptConfig;
  private emailTransporter: nodemailer.Transporter | null = null;
  private templateCache = new Map<string, string>();
  private receiptStorage = new Map<string, PaymentReceipt>();
  private receiptPersistence: ReceiptPersistence;
  private browserPool: BrowserPool;

  constructor(config: ReceiptConfig) {
    super();
    this.config = config;

    // Fix #114: Initialize persistence and load existing receipts
    const dataDir = process.env.RECEIPT_DATA_DIR || path.join(process.cwd(), 'data', 'receipts');
    this.receiptPersistence = new ReceiptPersistence(dataDir);
    this.loadReceiptsFromDisk();

    // Fix #117: Create browser pool
    this.browserPool = new BrowserPool(
      parseInt(process.env.RECEIPT_MAX_CONCURRENT_PAGES || '5', 10)
    );

    this.initializeEmailTransporter();
  }

  /**
   * Fix #114: Load persisted receipts into memory maps on startup
   */
  private loadReceiptsFromDisk(): void {
    const receipts = this.receiptPersistence.loadAll();
    for (const receipt of receipts) {
      // Restore all 3 index keys
      this.receiptStorage.set(receipt.id, receipt);
      this.receiptStorage.set(receipt.receiptNumber, receipt);
      this.receiptStorage.set(receipt.paymentHash, receipt);
    }
    if (receipts.length > 0) {
      console.log(`[ReceiptService] Loaded ${receipts.length} receipts from disk`);
    }
  }

  /**
   * Fix #114: Persist all receipts to disk.
   * Deduplicates by receipt id before writing.
   */
  private async persistReceipts(): Promise<void> {
    const seen = new Set<string>();
    const unique: PaymentReceipt[] = [];
    for (const receipt of this.receiptStorage.values()) {
      if (!seen.has(receipt.id)) {
        seen.add(receipt.id);
        unique.push(receipt);
      }
    }
    await this.receiptPersistence.save(unique);
  }

  private async initializeEmailTransporter(): Promise<void> {
    try {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      if (this.emailTransporter) {
        await this.emailTransporter.verify();
        console.log('Email transporter initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      this.emailTransporter = null;
    }
  }

  async generateReceipt(request: ReceiptGenerationRequest): Promise<PaymentReceipt> {
    try {
      const validatedRequest = ReceiptGenerationRequestSchema.parse(request);
      const paymentData = await this.fetchPaymentData(validatedRequest.paymentId);
      const receiptNumber = this.generateReceiptNumber();
      const verification = await this.createPaymentVerification(paymentData);

      const receipt: PaymentReceipt = {
        id: uuidv4(),
        receiptNumber,
        paymentHash: paymentData.paymentHash,
        invoiceId: paymentData.invoiceId,
        amount: paymentData.amount,
        fee: paymentData.fee || 0,
        timestamp: paymentData.timestamp,
        createdAt: Date.now(),
        creator: paymentData.creator,
        supporter: paymentData.supporter,
        invoice: {
          bolt11: paymentData.invoice.bolt11,
          description: paymentData.invoice.description,
          memo: paymentData.invoice.memo,
          expiresAt: paymentData.invoice.expiresAt,
        },
        verification,
        receipt: {
          receiptNumber,
          pdfGenerated: false,
          emailSent: false,
          downloadUrl: `/api/lightning/receipt/${receiptNumber}/download`,
          downloadCount: 0,
        },
        platform: {
          name: 'Sovren',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          processedBy: 'Lightning Receipt Service',
        },
        security: {
          hash: '',
          signature: '',
          verificationCode: this.generateVerificationCode(),
        },
      };

      receipt.security.hash = this.generateReceiptHash(receipt);
      receipt.security.signature = this.generateReceiptSignature(receipt);

      // Store receipt in memory and persist to disk
      this.receiptStorage.set(receipt.id, receipt);
      this.receiptStorage.set(receipt.receiptNumber, receipt);
      this.receiptStorage.set(receipt.paymentHash, receipt);
      await this.persistReceipts();

      if (validatedRequest.pdfOptions) {
        await this.generatePdfReceipt(receipt);
      }

      if (validatedRequest.emailReceipt && validatedRequest.emailAddress) {
        await this.emailReceipt(receipt.id, validatedRequest.emailAddress);
      }

      this.emit('receipt:generated', receipt);
      console.log(`Receipt generated: ${receipt.receiptNumber}`);
      return receipt;
    } catch (error) {
      console.error('Failed to generate receipt:', error);
      throw new Error(
        `Receipt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fix #117: Generate PDF using browser pool instead of launching per-receipt
   */
  async generatePdfReceipt(receipt: PaymentReceipt): Promise<Buffer> {
    let page: puppeteer.Page | null = null;
    try {
      const htmlTemplate = await this.loadTemplate('receipt-pdf');
      const html = await this.renderTemplate(htmlTemplate, receipt);

      page = await this.browserPool.acquirePage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        ...this.config.pdfOptions,
        printBackground: true,
      });

      const pdfPath = await this.storePdfReceipt(receipt, pdfBuffer);
      receipt.receipt.pdfGenerated = true;
      receipt.receipt.pdfUrl = pdfPath;

      this.receiptStorage.set(receipt.id, receipt);
      await this.persistReceipts();

      console.log(`PDF receipt generated: ${receipt.receiptNumber}`);
      this.emit('receipt:pdf:generated', { receiptId: receipt.id, pdfPath });

      return pdfBuffer;
    } catch (error) {
      console.error('Failed to generate PDF receipt:', error);
      throw new Error(
        `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      if (page) {
        await this.browserPool.releasePage(page);
      }
    }
  }

  async emailReceipt(receiptId: string, email: string): Promise<void> {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not configured');
      }

      const receipt = this.receiptStorage.get(receiptId);
      if (!receipt) {
        throw new Error('Receipt not found');
      }

      const emailTemplate = await this.loadTemplate('receipt-email');
      const emailHtml = await this.renderTemplate(emailTemplate, receipt);

      const attachments = [];
      if (this.config.email.attachPdf && receipt.receipt.pdfGenerated && receipt.receipt.pdfUrl) {
        const pdfBuffer = await this.loadPdfReceipt(receipt.receipt.pdfUrl);
        attachments.push({
          filename: `receipt-${receipt.receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
      }

      const emailResult = await this.emailTransporter.sendMail({
        from: this.config.email.from,
        to: email,
        subject: `Payment Receipt - ${receipt.receiptNumber}`,
        html: emailHtml,
        attachments,
      });

      // Fix #114: Persist email delivery metadata
      receipt.receipt.emailSent = true;
      receipt.receipt.emailDeliveredAt = Date.now();
      this.receiptStorage.set(receipt.id, receipt);
      await this.persistReceipts();

      console.log(`Receipt emailed: ${receipt.receiptNumber} to ${email}`);
      this.emit('receipt:email:sent', {
        receiptId: receipt.id,
        email,
        messageId: emailResult.messageId,
      });
    } catch (error) {
      console.error('Failed to email receipt:', error);
      throw new Error(
        `Email delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getReceiptByPaymentHash(paymentHash: string): Promise<PaymentReceipt | null> {
    return this.receiptStorage.get(paymentHash) || null;
  }

  async getReceiptByNumber(receiptNumber: string): Promise<PaymentReceipt | null> {
    return this.receiptStorage.get(receiptNumber) || null;
  }

  async verifyReceipt(
    receiptId: string,
    verificationCode?: string
  ): Promise<{
    valid: boolean;
    receipt?: PaymentReceipt;
    errors: string[];
  }> {
    try {
      const receipt = this.receiptStorage.get(receiptId);
      if (!receipt) {
        return { valid: false, errors: ['Receipt not found'] };
      }

      const errors: string[] = [];

      const expectedHash = this.generateReceiptHash(receipt);
      if (receipt.security.hash !== expectedHash) {
        errors.push('Receipt hash verification failed');
      }

      const expectedSignature = this.generateReceiptSignature(receipt);
      if (receipt.security.signature !== expectedSignature) {
        errors.push('Receipt signature verification failed');
      }

      if (verificationCode && receipt.security.verificationCode !== verificationCode) {
        errors.push('Verification code mismatch');
      }

      const preimageHash = crypto
        .createHash('sha256')
        .update(Buffer.from(receipt.verification.preimage, 'hex'))
        .digest('hex');
      if (preimageHash !== receipt.verification.paymentHash) {
        errors.push('Payment verification failed');
      }

      const valid = errors.length === 0;
      return {
        valid,
        receipt: valid ? receipt : undefined,
        errors,
      };
    } catch (error) {
      console.error('Receipt verification failed:', error);
      return {
        valid: false,
        errors: [`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Graceful shutdown: close browser pool
   */
  async shutdown(): Promise<void> {
    await this.browserPool.shutdown();
  }

  // ===============================
  // Private Helper Methods
  // ===============================

  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().replace(/-/g, '').substring(0, 6);
    return `SVR-${timestamp}-${random}`.toUpperCase();
  }

  private generateVerificationCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  private generateReceiptHash(receipt: PaymentReceipt): string {
    const hashData = {
      receiptNumber: receipt.receiptNumber,
      paymentHash: receipt.paymentHash,
      amount: receipt.amount,
      timestamp: receipt.timestamp,
      creatorId: receipt.creator.id,
    };
    return crypto.createHash('sha256').update(JSON.stringify(hashData)).digest('hex');
  }

  private generateReceiptSignature(receipt: PaymentReceipt): string {
    const secret = this.getReceiptSigningSecret();
    const signatureData = `${receipt.receiptNumber}:${receipt.paymentHash}:${receipt.amount}`;
    return crypto.createHmac('sha256', secret).update(signatureData).digest('hex');
  }

  private getReceiptSigningSecret(): string {
    const secret = process.env.RECEIPT_SIGNATURE_SECRET;
    if (secret && secret.trim().length > 0) {
      return secret;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'RECEIPT_SIGNATURE_SECRET environment variable is required in production. ' +
        'Set it to a strong random string (32+ characters).'
      );
    }

    // Non-production: use a clearly-marked dev-only secret with warning
    console.warn(
      '[ReceiptService] WARNING: Using dev-only receipt signing secret. ' +
      'Set RECEIPT_SIGNATURE_SECRET environment variable for production.'
    );
    return 'DEV-ONLY-receipt-secret-DO-NOT-USE-IN-PRODUCTION';
  }

  private async createPaymentVerification(paymentData: any): Promise<PaymentVerification> {
    return {
      paymentHash: paymentData.paymentHash,
      preimage: paymentData.preimage,
      verified: true,
      verifiedAt: Date.now(),
      signature: crypto
        .createHash('sha256')
        .update(`${paymentData.paymentHash}:${paymentData.preimage}`)
        .digest('hex'),
    };
  }

  private async fetchPaymentData(paymentId: string): Promise<any> {
    // Mock payment data - replace with actual database fetch
    return {
      paymentHash: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
      preimage: '7598dd3a2f5318b8a8e9b299dabd85596c3222f3d8a42e8895378d4473c0c79e',
      invoiceId: paymentId,
      amount: 1000,
      fee: 10,
      timestamp: Date.now(),
      creator: {
        id: 'creator-123',
        name: 'Amazing Creator',
        displayName: 'Amazing Creator',
        lightningAddress: 'creator@sovren.com',
        profile: {
          bio: 'Creating amazing content daily',
          website: 'https://amazingcreator.com',
        },
      },
      supporter: {
        id: 'supporter-456',
        name: 'Generous Supporter',
        anonymous: false,
        message: 'Great content, keep it up!',
      },
      invoice: {
        bolt11:
          'lnbc10m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpusp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgqcqpcxr...',
        description: 'Support for amazing content',
        memo: 'Thanks for the great work!',
        expiresAt: Date.now() + 3600000,
      },
    };
  }

  private async loadTemplate(templateName: string): Promise<string> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(process.cwd(), 'templates', `${templateName}.html`);
    try {
      const template = await fs.readFile(templatePath, 'utf-8');
      this.templateCache.set(templateName, template);
      return template;
    } catch {
      return this.getDefaultTemplate(templateName);
    }
  }

  private getDefaultTemplate(templateName: string): string {
    if (templateName === 'receipt-pdf') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 40px; }
            .receipt-info { margin-bottom: 30px; }
            .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
            .verification { background: #f3f4f6; padding: 20px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Lightning Payment Receipt</h1>
            <p>Receipt #{{receiptNumber}}</p>
          </div>
          <div class="receipt-info">
            <p><strong>Amount:</strong> <span class="amount">{{amount}} satoshis</span></p>
            <p><strong>Creator:</strong> {{creator.displayName}}</p>
            <p><strong>Date:</strong> {{formattedDate}}</p>
            <p><strong>Payment Hash:</strong> {{paymentHash}}</p>
          </div>
          <div class="verification">
            <h3>Payment Verification</h3>
            <p><strong>Verified:</strong> Yes</p>
            <p><strong>Verification Code:</strong> {{security.verificationCode}}</p>
          </div>
        </body>
        </html>
      `;
    }

    if (templateName === 'receipt-email') {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Lightning Payment Receipt</h2>
          <p>Thank you for your payment! Here are the details:</p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Receipt Number:</strong> {{receiptNumber}}</p>
            <p><strong>Amount:</strong> {{amount}} satoshis</p>
            <p><strong>Creator:</strong> {{creator.displayName}}</p>
            <p><strong>Date:</strong> {{formattedDate}}</p>
          </div>
          <p>You can verify this payment using the receipt number above.</p>
          <p>Thank you for supporting creators on Sovren!</p>
        </div>
      `;
    }

    return '<p>Template not found</p>';
  }

  private async renderTemplate(template: string, receipt: PaymentReceipt): Promise<string> {
    let rendered = template;
    const formattedDate = new Date(receipt.timestamp).toLocaleString();

    rendered = rendered.replace(/\{\{receiptNumber\}\}/g, receipt.receiptNumber);
    rendered = rendered.replace(/\{\{amount\}\}/g, receipt.amount.toString());
    rendered = rendered.replace(/\{\{paymentHash\}\}/g, receipt.paymentHash);
    rendered = rendered.replace(/\{\{creator\.displayName\}\}/g, receipt.creator.displayName);
    rendered = rendered.replace(/\{\{formattedDate\}\}/g, formattedDate);
    rendered = rendered.replace(
      /\{\{security\.verificationCode\}\}/g,
      receipt.security.verificationCode
    );

    return rendered;
  }

  private async storePdfReceipt(receipt: PaymentReceipt, pdfBuffer: Buffer): Promise<string> {
    const fileName = `receipt-${receipt.receiptNumber}.pdf`;
    const storagePath = path.join(this.config.storage.basePath, fileName);
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, pdfBuffer);
    return `/receipts/${fileName}`;
  }

  private async loadPdfReceipt(pdfPath: string): Promise<Buffer> {
    const fullPath = path.join(process.cwd(), 'public', pdfPath);
    return await fs.readFile(fullPath);
  }
}

// ===============================
// Export Service
// ===============================

const defaultReceiptConfig: ReceiptConfig = {
  pdfTemplate: 'receipt-pdf',
  pdfOptions: {
    format: 'A4',
    margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
    printBackground: true,
    displayHeaderFooter: false,
  },
  email: {
    from: process.env.RECEIPT_FROM_EMAIL || 'receipts@sovren.com',
    subject: 'Payment Receipt - Sovren',
    template: 'receipt-email',
    attachPdf: true,
  },
  storage: {
    provider: 'local',
    basePath: process.env.RECEIPT_STORAGE_PATH || './storage/receipts',
    retention: 365,
  },
  security: {
    encryptPdf: false,
    passwordProtected: false,
    signatureAlgorithm: 'sha256',
  },
};

export const lightningReceiptService = new LightningReceiptService(defaultReceiptConfig);

export default lightningReceiptService;
