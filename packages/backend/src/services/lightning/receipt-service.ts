/**
 * ⚡ Lightning Payment Receipt Service
 *
 * Comprehensive receipt generation service for Lightning Network payments.
 * Handles PDF generation, email delivery, and receipt verification with
 * cryptographic validation and secure storage.
 *
 * @author Sovren Engineering Team
 * @version 1.0.0
 * @license MIT
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ===============================
// 📋 Interface Definitions
// ===============================

/**
 * Creator information for receipt generation
 */
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

/**
 * Supporter information for receipt generation
 */
interface SupporterReceiptInfo {
  id: string;
  name?: string;
  email?: string;
  anonymous: boolean;
  message?: string;
}

/**
 * Payment verification data
 */
interface PaymentVerification {
  paymentHash: string;
  preimage: string;
  verified: boolean;
  verifiedAt: number;
  signature: string;
  blockHeight?: number;
}

/**
 * Complete payment receipt data structure
 */
export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  paymentHash: string;
  invoiceId: string;
  amount: number;
  fee: number;
  timestamp: number;
  createdAt: number;

  // Party Information
  creator: CreatorReceiptInfo;
  supporter: SupporterReceiptInfo;

  // Invoice Details
  invoice: {
    bolt11: string;
    description: string;
    memo?: string;
    expiresAt: number;
  };

  // Payment Verification
  verification: PaymentVerification;

  // Receipt Metadata
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

  // Platform Information
  platform: {
    name: string;
    version: string;
    environment: string;
    processedBy: string;
  };

  // Security
  security: {
    hash: string;
    signature: string;
    verificationCode: string;
  };
}

/**
 * Receipt generation configuration
 */
interface ReceiptConfig {
  // PDF Generation
  pdfTemplate: string;
  pdfOptions: {
    format: 'A4' | 'Letter';
    margin: { top: string; right: string; bottom: string; left: string };
    printBackground: boolean;
    displayHeaderFooter: boolean;
  };

  // Email Configuration
  email: {
    from: string;
    subject: string;
    template: string;
    attachPdf: boolean;
  };

  // Storage Configuration
  storage: {
    provider: 'local' | 's3' | 'gcs';
    basePath: string;
    retention: number; // days
  };

  // Security Configuration
  security: {
    encryptPdf: boolean;
    passwordProtected: boolean;
    signatureAlgorithm: string;
  };
}

/**
 * Receipt generation request
 */
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
// 🏗️ Receipt Service Implementation
// ===============================

/**
 * ⚡ Lightning Payment Receipt Service
 *
 * Comprehensive service for generating, managing, and delivering payment receipts
 * for Lightning Network transactions with enterprise-grade security and validation.
 */
export class LightningReceiptService extends EventEmitter {
  private config: ReceiptConfig;
  private emailTransporter: nodemailer.Transporter | null = null;
  private templateCache = new Map<string, string>();
  private receiptStorage = new Map<string, PaymentReceipt>();

  constructor(config: ReceiptConfig) {
    super();
    this.config = config;
    this.initializeEmailTransporter();
  }

  /**
   * 📧 Initialize email transporter for receipt delivery
   */
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

      // Verify transporter configuration
      if (this.emailTransporter) {
        await this.emailTransporter.verify();
        console.log('✅ Email transporter initialized successfully');
      }
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
      this.emailTransporter = null;
    }
  }

  /**
   * ⚡ Generate comprehensive payment receipt
   *
   * @param request - Receipt generation request
   * @returns Complete payment receipt with verification
   */
  async generateReceipt(request: ReceiptGenerationRequest): Promise<PaymentReceipt> {
    try {
      // Validate request
      const validatedRequest = ReceiptGenerationRequestSchema.parse(request);

      // Fetch payment data (mock implementation - replace with actual data fetching)
      const paymentData = await this.fetchPaymentData(validatedRequest.paymentId);

      // Generate receipt number
      const receiptNumber = this.generateReceiptNumber();

      // Create receipt verification
      const verification = await this.createPaymentVerification(paymentData);

      // Build complete receipt
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

      // Generate security signatures
      receipt.security.hash = this.generateReceiptHash(receipt);
      receipt.security.signature = this.generateReceiptSignature(receipt);

      // Store receipt
      this.receiptStorage.set(receipt.id, receipt);
      this.receiptStorage.set(receipt.receiptNumber, receipt);
      this.receiptStorage.set(receipt.paymentHash, receipt);

      // Generate PDF if requested
      if (validatedRequest.pdfOptions) {
        await this.generatePdfReceipt(receipt);
      }

      // Send email if requested
      if (validatedRequest.emailReceipt && validatedRequest.emailAddress) {
        await this.emailReceipt(receipt.id, validatedRequest.emailAddress);
      }

      // Emit receipt generated event
      this.emit('receipt:generated', receipt);

      console.log(`✅ Receipt generated: ${receipt.receiptNumber}`);
      return receipt;
    } catch (error) {
      console.error('❌ Failed to generate receipt:', error);
      throw new Error(
        `Receipt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 📄 Generate PDF receipt document
   *
   * @param receipt - Payment receipt data
   * @returns PDF buffer
   */
  async generatePdfReceipt(receipt: PaymentReceipt): Promise<Buffer> {
    try {
      // Load HTML template
      const htmlTemplate = await this.loadTemplate('receipt-pdf');

      // Render HTML with receipt data
      const html = await this.renderTemplate(htmlTemplate, receipt);

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        ...this.config.pdfOptions,
        printBackground: true,
      });

      await browser.close();

      // Store PDF
      const pdfPath = await this.storePdfReceipt(receipt, pdfBuffer);
      receipt.receipt.pdfGenerated = true;
      receipt.receipt.pdfUrl = pdfPath;

      // Update receipt in storage
      this.receiptStorage.set(receipt.id, receipt);

      console.log(`✅ PDF receipt generated: ${receipt.receiptNumber}`);
      this.emit('receipt:pdf:generated', { receiptId: receipt.id, pdfPath });

      return pdfBuffer;
    } catch (error) {
      console.error('❌ Failed to generate PDF receipt:', error);
      throw new Error(
        `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 📧 Email receipt to user
   *
   * @param receiptId - Receipt identifier
   * @param email - Email address
   */
  async emailReceipt(receiptId: string, email: string): Promise<void> {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not configured');
      }

      const receipt = this.receiptStorage.get(receiptId);
      if (!receipt) {
        throw new Error('Receipt not found');
      }

      // Load email template
      const emailTemplate = await this.loadTemplate('receipt-email');
      const emailHtml = await this.renderTemplate(emailTemplate, receipt);

      // Prepare email attachments
      const attachments = [];
      if (this.config.email.attachPdf && receipt.receipt.pdfGenerated && receipt.receipt.pdfUrl) {
        const pdfBuffer = await this.loadPdfReceipt(receipt.receipt.pdfUrl);
        attachments.push({
          filename: `receipt-${receipt.receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
      }

      // Send email
      const emailResult = await this.emailTransporter.sendMail({
        from: this.config.email.from,
        to: email,
        subject: `Payment Receipt - ${receipt.receiptNumber}`,
        html: emailHtml,
        attachments,
      });

      // Update receipt status
      receipt.receipt.emailSent = true;
      receipt.receipt.emailDeliveredAt = Date.now();
      this.receiptStorage.set(receipt.id, receipt);

      console.log(`✅ Receipt emailed: ${receipt.receiptNumber} to ${email}`);
      this.emit('receipt:email:sent', {
        receiptId: receipt.id,
        email,
        messageId: emailResult.messageId,
      });
    } catch (error) {
      console.error('❌ Failed to email receipt:', error);
      throw new Error(
        `Email delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 🔍 Get receipt by payment hash
   *
   * @param paymentHash - Payment hash
   * @returns Payment receipt
   */
  async getReceiptByPaymentHash(paymentHash: string): Promise<PaymentReceipt | null> {
    return this.receiptStorage.get(paymentHash) || null;
  }

  /**
   * 🔍 Get receipt by receipt number
   *
   * @param receiptNumber - Receipt number
   * @returns Payment receipt
   */
  async getReceiptByNumber(receiptNumber: string): Promise<PaymentReceipt | null> {
    return this.receiptStorage.get(receiptNumber) || null;
  }

  /**
   * ✅ Verify receipt authenticity
   *
   * @param receiptId - Receipt identifier
   * @param verificationCode - Verification code
   * @returns Verification result
   */
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

      // Verify receipt hash
      const expectedHash = this.generateReceiptHash(receipt);
      if (receipt.security.hash !== expectedHash) {
        errors.push('Receipt hash verification failed');
      }

      // Verify receipt signature
      const expectedSignature = this.generateReceiptSignature(receipt);
      if (receipt.security.signature !== expectedSignature) {
        errors.push('Receipt signature verification failed');
      }

      // Verify verification code if provided
      if (verificationCode && receipt.security.verificationCode !== verificationCode) {
        errors.push('Verification code mismatch');
      }

      // Verify payment hash and preimage
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
      console.error('❌ Receipt verification failed:', error);
      return {
        valid: false,
        errors: [`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  // ===============================
  // 🔧 Private Helper Methods
  // ===============================

  /**
   * Generate unique receipt number
   */
  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `SVR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Generate verification code for receipt
   */
  private generateVerificationCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Generate receipt hash for integrity verification
   */
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

  /**
   * Generate receipt signature for authenticity verification
   */
  private generateReceiptSignature(receipt: PaymentReceipt): string {
    const secret = process.env.RECEIPT_SIGNATURE_SECRET || 'sovren-receipt-secret';
    const signatureData = `${receipt.receiptNumber}:${receipt.paymentHash}:${receipt.amount}`;

    return crypto.createHmac('sha256', secret).update(signatureData).digest('hex');
  }

  /**
   * Create payment verification data
   */
  private async createPaymentVerification(paymentData: any): Promise<PaymentVerification> {
    const verification: PaymentVerification = {
      paymentHash: paymentData.paymentHash,
      preimage: paymentData.preimage,
      verified: true,
      verifiedAt: Date.now(),
      signature: crypto
        .createHash('sha256')
        .update(`${paymentData.paymentHash}:${paymentData.preimage}`)
        .digest('hex'),
    };

    return verification;
  }

  /**
   * Fetch payment data (mock implementation)
   */
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
        expiresAt: Date.now() + 3600000, // 1 hour from now
      },
    };
  }

  /**
   * Load template from file system
   */
  private async loadTemplate(templateName: string): Promise<string> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(process.cwd(), 'templates', `${templateName}.html`);
    try {
      const template = await fs.readFile(templatePath, 'utf-8');
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      // Return default template if file not found
      return this.getDefaultTemplate(templateName);
    }
  }

  /**
   * Get default template if file not found
   */
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
            <h1>⚡ Lightning Payment Receipt</h1>
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
            <p><strong>Verified:</strong> ✅ Yes</p>
            <p><strong>Verification Code:</strong> {{security.verificationCode}}</p>
          </div>
        </body>
        </html>
      `;
    }

    if (templateName === 'receipt-email') {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>⚡ Lightning Payment Receipt</h2>
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

  /**
   * Render template with data
   */
  private async renderTemplate(template: string, receipt: PaymentReceipt): Promise<string> {
    let rendered = template;

    // Add formatted date
    const formattedDate = new Date(receipt.timestamp).toLocaleString();

    // Simple template replacement (in production, use a proper template engine)
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

  /**
   * Store PDF receipt
   */
  private async storePdfReceipt(receipt: PaymentReceipt, pdfBuffer: Buffer): Promise<string> {
    const fileName = `receipt-${receipt.receiptNumber}.pdf`;
    const storagePath = path.join(this.config.storage.basePath, fileName);

    // Ensure directory exists
    await fs.mkdir(path.dirname(storagePath), { recursive: true });

    // Write PDF file
    await fs.writeFile(storagePath, pdfBuffer);

    return `/receipts/${fileName}`;
  }

  /**
   * Load PDF receipt from storage
   */
  private async loadPdfReceipt(pdfPath: string): Promise<Buffer> {
    const fullPath = path.join(process.cwd(), 'public', pdfPath);
    return await fs.readFile(fullPath);
  }
}

// ===============================
// 📤 Export Service
// ===============================

/**
 * Default receipt service configuration
 */
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
    retention: 365, // 1 year
  },
  security: {
    encryptPdf: false,
    passwordProtected: false,
    signatureAlgorithm: 'sha256',
  },
};

/**
 * Singleton receipt service instance
 */
export const lightningReceiptService = new LightningReceiptService(defaultReceiptConfig);

export default lightningReceiptService;
