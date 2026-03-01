/**
 * Simple Lightning Receipt Service Test
 *
 * Tests that the receipt service actually works with valid data
 */

// Mock dependencies
vi.mock('puppeteer', () => ({
  launch: vi.fn().mockResolvedValue({
    newPage: vi.fn().mockResolvedValue({
      setContent: vi.fn(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
      close: vi.fn(),
    }),
    close: vi.fn(),
  }),
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('mock-template-content'),
  mkdir: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue({
    writeFile: vi.fn().mockResolvedValue(undefined),
    datasync: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('[]'),
  renameSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

// Import after mocks
import { lightningReceiptService } from '../../services/lightning/receipt-service';

describe('Lightning Receipt Service - Simple Test', () => {
  const receiptService = lightningReceiptService;

  beforeEach(() => {
    // Clear any existing receipts
    (receiptService as any).receiptStorage.clear();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.RECEIPT_FROM_EMAIL;
    delete process.env.RECEIPT_SIGNATURE_SECRET;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it('should generate a receipt with valid UUID', async () => {
    const validPaymentId = '550e8400-e29b-41d4-a716-446655440000';

    const receipt = await receiptService.generateReceipt({
      paymentId: validPaymentId,
      includeDetailedVerification: false,
      emailReceipt: false,
    });

    // Test that receipt was generated successfully
    expect(receipt).toBeDefined();
    expect(receipt.id).toBeDefined();
    expect(receipt.receiptNumber).toMatch(/^SVR-[A-Z0-9]+-[A-Z0-9]+$/);
    expect(receipt.paymentHash).toBeDefined();
    expect(receipt.amount).toBeGreaterThan(0);
    expect(receipt.timestamp).toBeGreaterThan(0);
    expect(receipt.security.hash).toBeDefined();
    expect(receipt.security.signature).toBeDefined();
    expect(receipt.security.verificationCode).toMatch(/^[A-Z0-9]{8}$/);

    console.log('✅ Receipt generated successfully!');
    console.log(`📄 Receipt Number: ${receipt.receiptNumber}`);
    console.log(`💰 Amount: ${receipt.amount} sats`);
    console.log(`🔐 Verification Code: ${receipt.security.verificationCode}`);
  });

  it('should verify generated receipt', async () => {
    const validPaymentId = '550e8400-e29b-41d4-a716-446655440001';
    // Preimage and its SHA-256 hash must match for verification to pass
    const preimage = '7598dd3a2f5318b8a8e9b299dabd85596c3222f3d8a42e8895378d4473c0c79e';
    const paymentHash = '498336b26fb6b08af6b878f0f85fe5e2492a43a8039ec2bb4ef94335359eb85c';

    // Override fetchPaymentData to provide matching preimage/hash pair
    const fetchSpy = vi.spyOn(receiptService as any, 'fetchPaymentData').mockResolvedValue({
      paymentHash,
      preimage,
      invoiceId: validPaymentId,
      amount: 1000,
      fee: 10,
      timestamp: Date.now(),
      creator: {
        id: 'c1',
        name: 'Creator',
        displayName: 'Creator',
        lightningAddress: 'c@test.com',
        profile: {},
      },
      supporter: { id: 's1', name: 'Supporter', anonymous: false, message: 'Thanks!' },
      invoice: {
        bolt11: 'lnbc...',
        description: 'Test',
        memo: 'Test',
        expiresAt: Date.now() + 3600000,
      },
    });

    // Generate receipt
    const receipt = await receiptService.generateReceipt({
      paymentId: validPaymentId,
      includeDetailedVerification: false,
      emailReceipt: false,
    });

    fetchSpy.mockRestore();

    // Verify receipt
    const verification = await receiptService.verifyReceipt(receipt.id);

    expect(verification.valid).toBe(true);
    expect(verification.receipt).toBeDefined();
    expect(verification.errors).toHaveLength(0);

    console.log('✅ Receipt verification successful!');
  });

  it('should handle service initialization', () => {
    expect(receiptService).toBeDefined();
    expect(typeof receiptService.generateReceipt).toBe('function');
    expect(typeof receiptService.getReceiptByPaymentHash).toBe('function');
    expect(typeof receiptService.verifyReceipt).toBe('function');

    console.log('✅ Receipt service initialized correctly!');
  });
});
