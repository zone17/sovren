/**
 * ⚡ Lightning Receipt Service Test Suite
 *
 * Comprehensive tests for payment receipt generation, PDF creation,
 * email delivery, and verification functionality.
 *
 * @author Sovren Engineering Team
 * @version 1.0.0
 * @license MIT
 */

import fs from 'fs/promises';
import { LightningReceiptService, PaymentReceipt } from '../../services/lightning/receipt-service';

// ===============================
// 🧪 Test Configuration & Mocks
// ===============================

// Mock external dependencies
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('Mock PDF content')),
    }),
    close: jest.fn(),
  }),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      accepted: ['test@example.com'],
    }),
  }),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

// Test configuration
const testConfig = {
  pdfTemplate: 'receipt-pdf',
  pdfOptions: {
    format: 'A4' as const,
    margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
    printBackground: true,
    displayHeaderFooter: false,
  },
  email: {
    from: 'test@sovren.com',
    subject: 'Test Receipt',
    template: 'receipt-email',
    attachPdf: true,
  },
  storage: {
    provider: 'local' as const,
    basePath: './test-storage/receipts',
    retention: 365,
  },
  security: {
    encryptPdf: false,
    passwordProtected: false,
    signatureAlgorithm: 'sha256',
  },
};

// Mock payment data
const mockPaymentData = {
  paymentHash: '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29',
  preimage: '7598dd3a2f5318b8a8e9b299dabd85596c3222f3d8a42e8895378d4473c0c79e',
  invoiceId: 'test-payment-id',
  amount: 1000,
  fee: 10,
  timestamp: Date.now(),
  creator: {
    id: 'creator-123',
    name: 'Test Creator',
    displayName: 'Test Creator',
    lightningAddress: 'creator@sovren.com',
    profile: {
      bio: 'Test creator bio',
      website: 'https://test-creator.com',
    },
  },
  supporter: {
    id: 'supporter-456',
    name: 'Test Supporter',
    anonymous: false,
    message: 'Great content!',
  },
  invoice: {
    bolt11:
      'lnbc10m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpusp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgqcqpcxr...',
    description: 'Test payment',
    memo: 'Test memo',
    expiresAt: Date.now() + 3600000,
  },
};

// ===============================
// 🧪 Test Suite Implementation
// ===============================

describe('LightningReceiptService', () => {
  let receiptService: LightningReceiptService;

  beforeEach(() => {
    // Create fresh service instance for each test
    receiptService = new LightningReceiptService(testConfig);

    // Reset all mocks
    jest.clearAllMocks();

    // Mock environment variables
    process.env.RECEIPT_SIGNATURE_SECRET = 'test-secret';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_USER = 'test@sovren.com';
    process.env.SMTP_PASS = 'test-password';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.RECEIPT_SIGNATURE_SECRET;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  // ===============================
  // 📝 Receipt Generation Tests
  // ===============================

  describe('Receipt Generation', () => {
    it('should generate a complete payment receipt', async () => {
      // Mock the fetchPaymentData method
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      const request = {
        paymentId: 'test-payment-id',
        includeDetailedVerification: true,
        emailReceipt: false,
      };

      const receipt = await receiptService.generateReceipt(request);

      expect(receipt).toBeDefined();
      expect(receipt.receiptNumber).toMatch(/^SVR-[A-Z0-9-]+$/);
      expect(receipt.paymentHash).toBe(mockPaymentData.paymentHash);
      expect(receipt.amount).toBe(mockPaymentData.amount);
      expect(receipt.fee).toBe(mockPaymentData.fee);
      expect(receipt.creator).toEqual(mockPaymentData.creator);
      expect(receipt.supporter).toEqual(mockPaymentData.supporter);
      expect(receipt.verification.verified).toBe(true);
      expect(receipt.security.verificationCode).toMatch(/^[A-F0-9]{8}$/);

      fetchPaymentDataSpy.mockRestore();
    });

    it('should generate unique receipt numbers', async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      const request = {
        paymentId: 'test-payment-id',
      };

      const receipt1 = await receiptService.generateReceipt(request);
      const receipt2 = await receiptService.generateReceipt(request);

      expect(receipt1.receiptNumber).not.toBe(receipt2.receiptNumber);
      expect(receipt1.id).not.toBe(receipt2.id);

      fetchPaymentDataSpy.mockRestore();
    });

    it('should include all required receipt fields', async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      const request = {
        paymentId: 'test-payment-id',
      };

      const receipt = await receiptService.generateReceipt(request);

      // Check all required fields are present
      expect(receipt.id).toBeDefined();
      expect(receipt.receiptNumber).toBeDefined();
      expect(receipt.paymentHash).toBeDefined();
      expect(receipt.invoiceId).toBeDefined();
      expect(receipt.amount).toBeDefined();
      expect(receipt.timestamp).toBeDefined();
      expect(receipt.createdAt).toBeDefined();
      expect(receipt.creator).toBeDefined();
      expect(receipt.supporter).toBeDefined();
      expect(receipt.invoice).toBeDefined();
      expect(receipt.verification).toBeDefined();
      expect(receipt.receipt).toBeDefined();
      expect(receipt.platform).toBeDefined();
      expect(receipt.security).toBeDefined();

      fetchPaymentDataSpy.mockRestore();
    });

    it('should handle invalid payment IDs', async () => {
      const request = {
        paymentId: 'invalid-uuid',
      };

      await expect(receiptService.generateReceipt(request)).rejects.toThrow();
    });
  });

  // ===============================
  // 📄 PDF Generation Tests
  // ===============================

  describe('PDF Generation', () => {
    let mockReceipt: PaymentReceipt;

    beforeEach(async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      mockReceipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should generate PDF receipt successfully', async () => {
      // Mock fs operations
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const pdfBuffer = await receiptService.generatePdfReceipt(mockReceipt);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(mockReceipt.receipt.pdfGenerated).toBe(true);
      expect(mockReceipt.receipt.pdfUrl).toBeDefined();
    });

    it('should update receipt after PDF generation', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const initialPdfStatus = mockReceipt.receipt.pdfGenerated;

      await receiptService.generatePdfReceipt(mockReceipt);

      expect(initialPdfStatus).toBe(false);
      expect(mockReceipt.receipt.pdfGenerated).toBe(true);
      expect(mockReceipt.receipt.pdfUrl).toContain('receipt-');
      expect(mockReceipt.receipt.pdfUrl).toContain('.pdf');
    });

    it('should handle PDF generation errors gracefully', async () => {
      // Mock puppeteer to throw error
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockRejectedValueOnce(new Error('PDF generation failed'));

      await expect(receiptService.generatePdfReceipt(mockReceipt)).rejects.toThrow(
        'PDF generation failed'
      );
    });
  });

  // ===============================
  // 📧 Email Delivery Tests
  // ===============================

  describe('Email Delivery', () => {
    let mockReceipt: PaymentReceipt;

    beforeEach(async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      mockReceipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should send receipt email successfully', async () => {
      const email = 'test@example.com';

      await receiptService.emailReceipt(mockReceipt.id, email);

      expect(mockReceipt.receipt.emailSent).toBe(true);
      expect(mockReceipt.receipt.emailDeliveredAt).toBeDefined();
    });

    it('should handle email delivery errors', async () => {
      const nodemailer = require('nodemailer');
      const mockTransporter = nodemailer.createTransport();
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('Email delivery failed'));

      const email = 'test@example.com';

      await expect(receiptService.emailReceipt(mockReceipt.id, email)).rejects.toThrow(
        'Email delivery failed'
      );
    });

    it('should handle missing receipt for email', async () => {
      const nonExistentId = 'non-existent-id';
      const email = 'test@example.com';

      await expect(receiptService.emailReceipt(nonExistentId, email)).rejects.toThrow(
        'Receipt not found'
      );
    });

    it('should handle email transporter not configured', async () => {
      // Create service without email configuration
      const serviceWithoutEmail = new LightningReceiptService({
        ...testConfig,
        email: {
          ...testConfig.email,
          from: '',
        },
      });

      const email = 'test@example.com';

      await expect(serviceWithoutEmail.emailReceipt(mockReceipt.id, email)).rejects.toThrow();
    });
  });

  // ===============================
  // 🔍 Receipt Retrieval Tests
  // ===============================

  describe('Receipt Retrieval', () => {
    let mockReceipt: PaymentReceipt;

    beforeEach(async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      mockReceipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should retrieve receipt by payment hash', async () => {
      const retrievedReceipt = await receiptService.getReceiptByPaymentHash(
        mockReceipt.paymentHash
      );

      expect(retrievedReceipt).toBeDefined();
      expect(retrievedReceipt?.id).toBe(mockReceipt.id);
      expect(retrievedReceipt?.paymentHash).toBe(mockReceipt.paymentHash);
    });

    it('should retrieve receipt by receipt number', async () => {
      const retrievedReceipt = await receiptService.getReceiptByNumber(mockReceipt.receiptNumber);

      expect(retrievedReceipt).toBeDefined();
      expect(retrievedReceipt?.id).toBe(mockReceipt.id);
      expect(retrievedReceipt?.receiptNumber).toBe(mockReceipt.receiptNumber);
    });

    it('should return null for non-existent receipts', async () => {
      const nonExistentHash = 'non-existent-hash';
      const retrievedReceipt = await receiptService.getReceiptByPaymentHash(nonExistentHash);

      expect(retrievedReceipt).toBeNull();
    });
  });

  // ===============================
  // ✅ Receipt Verification Tests
  // ===============================

  describe('Receipt Verification', () => {
    let mockReceipt: PaymentReceipt;

    beforeEach(async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      mockReceipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should verify valid receipt successfully', async () => {
      const verificationResult = await receiptService.verifyReceipt(
        mockReceipt.id,
        mockReceipt.security.verificationCode
      );

      expect(verificationResult.valid).toBe(true);
      expect(verificationResult.receipt).toBeDefined();
      expect(verificationResult.errors).toHaveLength(0);
    });

    it('should verify receipt without verification code', async () => {
      const verificationResult = await receiptService.verifyReceipt(mockReceipt.id);

      expect(verificationResult.valid).toBe(true);
      expect(verificationResult.receipt).toBeDefined();
      expect(verificationResult.errors).toHaveLength(0);
    });

    it('should fail verification with wrong verification code', async () => {
      const wrongCode = 'WRONGCODE';
      const verificationResult = await receiptService.verifyReceipt(mockReceipt.id, wrongCode);

      expect(verificationResult.valid).toBe(false);
      expect(verificationResult.errors).toContain('Verification code mismatch');
    });

    it('should fail verification for non-existent receipt', async () => {
      const nonExistentId = 'non-existent-id';
      const verificationResult = await receiptService.verifyReceipt(nonExistentId);

      expect(verificationResult.valid).toBe(false);
      expect(verificationResult.errors).toContain('Receipt not found');
    });

    it('should verify receipt hash integrity', async () => {
      // Tamper with receipt hash
      const originalHash = mockReceipt.security.hash;
      mockReceipt.security.hash = 'tampered-hash';

      const verificationResult = await receiptService.verifyReceipt(mockReceipt.id);

      expect(verificationResult.valid).toBe(false);
      expect(verificationResult.errors).toContain('Receipt hash verification failed');

      // Restore original hash
      mockReceipt.security.hash = originalHash;
    });

    it('should verify receipt signature integrity', async () => {
      // Tamper with receipt signature
      const originalSignature = mockReceipt.security.signature;
      mockReceipt.security.signature = 'tampered-signature';

      const verificationResult = await receiptService.verifyReceipt(mockReceipt.id);

      expect(verificationResult.valid).toBe(false);
      expect(verificationResult.errors).toContain('Receipt signature verification failed');

      // Restore original signature
      mockReceipt.security.signature = originalSignature;
    });
  });

  // ===============================
  // 🔒 Security Tests
  // ===============================

  describe('Security Features', () => {
    let mockReceipt: PaymentReceipt;

    beforeEach(async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      mockReceipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should generate secure receipt hash', () => {
      expect(mockReceipt.security.hash).toBeDefined();
      expect(mockReceipt.security.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should generate secure receipt signature', () => {
      expect(mockReceipt.security.signature).toBeDefined();
      expect(mockReceipt.security.signature).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex format
    });

    it('should generate unique verification codes', async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      const receipt1 = await receiptService.generateReceipt({ paymentId: 'test-1' });
      const receipt2 = await receiptService.generateReceipt({ paymentId: 'test-2' });

      expect(receipt1.security.verificationCode).not.toBe(receipt2.security.verificationCode);
      expect(receipt1.security.verificationCode).toMatch(/^[A-F0-9]{8}$/);
      expect(receipt2.security.verificationCode).toMatch(/^[A-F0-9]{8}$/);

      fetchPaymentDataSpy.mockRestore();
    });

    it('should validate payment hash and preimage', async () => {
      // Test with invalid preimage
      const invalidPaymentData = {
        ...mockPaymentData,
        preimage: 'invalid-preimage',
      };

      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(invalidPaymentData);

      const receipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      const verificationResult = await receiptService.verifyReceipt(receipt.id);

      expect(verificationResult.valid).toBe(false);
      expect(verificationResult.errors).toContain('Payment verification failed');

      fetchPaymentDataSpy.mockRestore();
    });
  });

  // ===============================
  // 🎨 Template Rendering Tests
  // ===============================

  describe('Template Rendering', () => {
    let mockReceipt: PaymentReceipt;

    beforeEach(async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      mockReceipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should render PDF template with receipt data', async () => {
      const renderTemplateSpy = jest.spyOn(receiptService as any, 'renderTemplate');

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await receiptService.generatePdfReceipt(mockReceipt);

      expect(renderTemplateSpy).toHaveBeenCalled();
      const [template, receipt] = renderTemplateSpy.mock.calls[0];

      expect(template).toContain('Lightning Payment Receipt');
      expect(receipt).toBe(mockReceipt);

      renderTemplateSpy.mockRestore();
    });

    it('should use default template when file not found', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const loadTemplateSpy = jest.spyOn(receiptService as any, 'loadTemplate');
      const getDefaultTemplateSpy = jest.spyOn(receiptService as any, 'getDefaultTemplate');

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await receiptService.generatePdfReceipt(mockReceipt);

      expect(loadTemplateSpy).toHaveBeenCalledWith('receipt-pdf');
      expect(getDefaultTemplateSpy).toHaveBeenCalledWith('receipt-pdf');

      loadTemplateSpy.mockRestore();
      getDefaultTemplateSpy.mockRestore();
    });
  });

  // ===============================
  // 📊 Event Emission Tests
  // ===============================

  describe('Event Emission', () => {
    it('should emit receipt:generated event', async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      const eventListener = jest.fn();
      receiptService.on('receipt:generated', eventListener);

      await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener.mock.calls[0][0]).toMatchObject({
        receiptNumber: expect.stringMatching(/^SVR-[A-Z0-9-]+$/),
        paymentHash: mockPaymentData.paymentHash,
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should emit receipt:pdf:generated event', async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      const receipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      const eventListener = jest.fn();
      receiptService.on('receipt:pdf:generated', eventListener);

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await receiptService.generatePdfReceipt(receipt);

      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener.mock.calls[0][0]).toMatchObject({
        receiptId: receipt.id,
        pdfPath: expect.stringContaining('.pdf'),
      });

      fetchPaymentDataSpy.mockRestore();
    });

    it('should emit receipt:email:sent event', async () => {
      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(mockPaymentData);

      const receipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      const eventListener = jest.fn();
      receiptService.on('receipt:email:sent', eventListener);

      const email = 'test@example.com';
      await receiptService.emailReceipt(receipt.id, email);

      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener.mock.calls[0][0]).toMatchObject({
        receiptId: receipt.id,
        email,
        messageId: 'test-message-id',
      });

      fetchPaymentDataSpy.mockRestore();
    });
  });

  // ===============================
  // 🧮 Edge Cases and Error Handling
  // ===============================

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large payment amounts', async () => {
      const largePaymentData = {
        ...mockPaymentData,
        amount: 21000000 * 100000000, // 21 million BTC in satoshis
      };

      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(largePaymentData);

      const receipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      expect(receipt.amount).toBe(largePaymentData.amount);
      expect(receipt.security.hash).toBeDefined();
      expect(receipt.security.signature).toBeDefined();

      fetchPaymentDataSpy.mockRestore();
    });

    it('should handle very small payment amounts', async () => {
      const smallPaymentData = {
        ...mockPaymentData,
        amount: 1, // 1 satoshi
      };

      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(smallPaymentData);

      const receipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      expect(receipt.amount).toBe(1);
      expect(receipt.security.hash).toBeDefined();
      expect(receipt.security.signature).toBeDefined();

      fetchPaymentDataSpy.mockRestore();
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalPaymentData = {
        paymentHash: mockPaymentData.paymentHash,
        preimage: mockPaymentData.preimage,
        invoiceId: mockPaymentData.invoiceId,
        amount: mockPaymentData.amount,
        timestamp: mockPaymentData.timestamp,
        creator: {
          id: mockPaymentData.creator.id,
          name: mockPaymentData.creator.name,
          displayName: mockPaymentData.creator.displayName,
          profile: {},
        },
        supporter: {
          id: mockPaymentData.supporter.id,
          anonymous: true,
        },
        invoice: {
          bolt11: mockPaymentData.invoice.bolt11,
          description: mockPaymentData.invoice.description,
          expiresAt: mockPaymentData.invoice.expiresAt,
        },
      };

      const fetchPaymentDataSpy = jest
        .spyOn(receiptService as any, 'fetchPaymentData')
        .mockResolvedValue(minimalPaymentData);

      const receipt = await receiptService.generateReceipt({
        paymentId: 'test-payment-id',
      });

      expect(receipt).toBeDefined();
      expect(receipt.supporter.anonymous).toBe(true);
      expect(receipt.supporter.name).toBeUndefined();
      expect(receipt.invoice.memo).toBeUndefined();

      fetchPaymentDataSpy.mockRestore();
    });
  });
});

// ===============================
// 🧹 Test Cleanup
// ===============================

afterAll(() => {
  // Clean up any test artifacts
  jest.restoreAllMocks();
});
