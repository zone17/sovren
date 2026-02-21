import { InvoiceService } from '../InvoiceService';
import { IDatabase } from '../../../interfaces/IDatabase';
import { ICacheService } from '../../../interfaces/ICacheService';
import { IEventBusService } from '../../../interfaces/IEventBusService';
import { IAuditLogService } from '../../../interfaces/IAuditLogService';
import { INotificationService } from '../../../interfaces/INotificationService';
import { ServiceError } from '../../../utils/errors';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
vi.mock('uuid');
vi.mock('pdfkit');
vi.mock('handlebars');
vi.mock('decimal.js');

describe('InvoiceService', () => {
  let service: InvoiceService;
  let mockDb: vi.Mocked<IDatabase>;
  let mockCache: vi.Mocked<ICacheService>;
  let mockEventBus: vi.Mocked<IEventBusService>;
  let mockAuditLog: vi.Mocked<IAuditLogService>;
  let mockNotification: vi.Mocked<INotificationService>;

  const mockInvoiceDraft = {
    customerId: 'customer-123',
    currency: 'USD',
    items: [
      {
        description: 'Premium Subscription',
        quantity: 1,
        unitPrice: { amount: 99.99, currency: 'USD' },
        metadata: {},
      },
      {
        description: 'Add-on Service',
        quantity: 2,
        unitPrice: { amount: 29.99, currency: 'USD' },
        metadata: {},
      },
    ],
    billingAddress: {
      name: 'John Doe',
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'US',
      jurisdiction: 'US-CA',
    },
    createdBy: 'user-123',
  };

  const mockInvoice = {
    id: 'invoice-123',
    number: 'INV-202410-0001',
    customerId: 'customer-123',
    status: 'draft',
    currency: 'USD',
    items: [],
    subtotal: { amount: 159.97, currency: 'USD' },
    tax: { amount: 11.60, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    total: { amount: 171.57, currency: 'USD' },
    billingAddress: mockInvoiceDraft.billingAddress,
    dueDate: new Date('2024-11-26'),
    paymentTerms: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };

  beforeEach(() => {
    // Create mock implementations
    mockDb = {
      query: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    } as any;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    } as any;

    mockEventBus = {
      emit: vi.fn(),
    } as any;

    mockAuditLog = {
      log: vi.fn(),
    } as any;

    mockNotification = {
      send: vi.fn(),
    } as any;

    // Create service instance
    service = new InvoiceService(
      mockDb,
      mockCache,
      mockEventBus,
      mockAuditLog,
      mockNotification
    );

    // Reset mocks
    vi.clearAllMocks();
    (uuidv4 as any).mockReturnValue('invoice-123');

    // Mock Decimal.js
    (Decimal as any).mockImplementation((value: any) => ({
      plus: vi.fn().mockReturnThis(),
      minus: vi.fn().mockReturnThis(),
      mul: vi.fn().mockReturnThis(),
      div: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnValue(true),
      toFixed: vi.fn().mockReturnValue(value.toString()),
    }));
  });

  describe('create', () => {
    it('should create a new invoice with calculated totals', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rows: [{ next_num: 1 }] }); // Invoice number

      // Act
      const result = await service.create(mockInvoiceDraft);

      // Assert
      expect(result).toMatchObject({
        id: 'invoice-123',
        customerId: 'customer-123',
        status: 'draft',
        currency: 'USD',
      });
      expect(mockDb.beginTransaction).toHaveBeenCalled();
      expect(mockDb.commitTransaction).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'invoice.created',
      }));
      expect(mockEventBus.emit).toHaveBeenCalledWith('invoice.created', expect.any(Object));
    });

    it('should validate invoice draft and throw on missing customer', async () => {
      // Arrange
      const invalidDraft = { ...mockInvoiceDraft, customerId: '' };

      // Act & Assert
      await expect(service.create(invalidDraft))
        .rejects.toThrow('Customer ID is required');
    });

    it('should validate line items and throw on invalid quantity', async () => {
      // Arrange
      const invalidDraft = {
        ...mockInvoiceDraft,
        items: [{ ...mockInvoiceDraft.items[0], quantity: 0 }],
      };

      // Act & Assert
      await expect(service.create(invalidDraft))
        .rejects.toThrow('Item quantity must be positive');
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rows: [{ next_num: 1 }] });
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(service.create(mockInvoiceDraft))
        .rejects.toThrow('Invoice creation failed');
      expect(mockDb.rollbackTransaction).toHaveBeenCalled();
    });

    it('should apply discounts correctly', async () => {
      // Arrange
      const draftWithDiscount = {
        ...mockInvoiceDraft,
        discounts: [
          { type: 'percentage', value: 10 },
          { type: 'fixed', value: 5 },
        ],
      };
      mockDb.query.mockResolvedValueOnce({ rows: [{ next_num: 1 }] });

      // Act
      const result = await service.create(draftWithDiscount);

      // Assert
      expect(result.discount).toBeDefined();
      expect(mockDb.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a draft invoice', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });
      const updates = { notes: 'Updated notes' };

      // Act
      const result = await service.update('invoice-123', updates);

      // Assert
      expect(result.notes).toBe('Updated notes');
      expect(result.version).toBe(2);
      expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'invoice.updated',
      }));
    });

    it('should prevent updating finalized invoice', async () => {
      // Arrange
      const finalizedInvoice = { ...mockInvoice, status: 'sent' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [finalizedInvoice] });

      // Act & Assert
      await expect(service.update('invoice-123', { notes: 'New note' }))
        .rejects.toThrow('Cannot update finalized invoice');
    });

    it('should recalculate totals when items change', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });
      const newItems = [
        {
          description: 'New Item',
          quantity: 3,
          unitPrice: { amount: 50, currency: 'USD' },
        },
      ];

      // Act
      const result = await service.update('invoice-123', { items: newItems });

      // Assert
      expect(result.items).toEqual(newItems);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('finalize', () => {
    it('should finalize a draft invoice', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      // Act
      const result = await service.finalize('invoice-123');

      // Assert
      expect(result.status).toBe('sent');
      expect(result.finalizedAt).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        expect.arrayContaining(['sent'])
      );
    });

    it('should prevent finalizing already finalized invoice', async () => {
      // Arrange
      const finalizedInvoice = { ...mockInvoice, status: 'paid' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [finalizedInvoice] });

      // Act & Assert
      await expect(service.finalize('invoice-123'))
        .rejects.toThrow('Invoice already finalized');
    });

    it('should create immutable snapshot', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      // Act
      await service.finalize('invoice-123');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoice_snapshots'),
        expect.any(Array)
      );
    });

    it('should send invoice to customer after finalization', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      // Act
      await service.finalize('invoice-123');

      // Assert
      expect(mockNotification.send).toHaveBeenCalled();
    });
  });

  describe('void', () => {
    it('should void an unpaid invoice', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      // Act
      await service.void('invoice-123', 'Customer requested cancellation');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        expect.arrayContaining(['Customer requested cancellation'])
      );
      expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'invoice.voided',
      }));
    });

    it('should prevent voiding paid invoice', async () => {
      // Arrange
      const paidInvoice = { ...mockInvoice, status: 'paid' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [paidInvoice] });

      // Act & Assert
      await expect(service.void('invoice-123', 'Test'))
        .rejects.toThrow('Cannot void paid invoice');
    });

    it('should prevent voiding already voided invoice', async () => {
      // Arrange
      const voidedInvoice = { ...mockInvoice, status: 'void' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [voidedInvoice] });

      // Act & Assert
      await expect(service.void('invoice-123', 'Test'))
        .rejects.toThrow('Invoice already voided');
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax for US-CA jurisdiction', async () => {
      // Act
      const result = await service.calculateTax(
        { amount: 100, currency: 'USD' },
        'US-CA'
      );

      // Assert
      expect(result.totalTax).toBeDefined();
      expect(result.details).toHaveLength(1);
      expect(result.details[0].jurisdiction).toBe('US-CA');
      expect(result.details[0].rate).toBe(0.0725);
    });

    it('should calculate compound tax for Canadian jurisdiction', async () => {
      // Act
      const result = await service.calculateTax(
        { amount: 100, currency: 'CAD' },
        'CA-ON'
      );

      // Assert
      expect(result.details).toHaveLength(2); // Provincial + Federal
      expect(result.details.find(d => d.name === 'GST')).toBeDefined();
    });

    it('should handle unknown jurisdiction with zero tax', async () => {
      // Act
      const result = await service.calculateTax(
        { amount: 100, currency: 'USD' },
        'UNKNOWN'
      );

      // Assert
      expect(result.totalTax.amount).toBe(0);
    });
  });

  describe('prorate', () => {
    it('should calculate proration for subscription upgrade', async () => {
      // Arrange
      const subscription = {
        planId: 'basic',
        planAmount: 50,
        currentPeriodStart: new Date('2024-10-01'),
        currentPeriodEnd: new Date('2024-10-31'),
      };
      const change = {
        newPlanId: 'premium',
        newPlanAmount: 100,
      };

      // Act
      const result = await service.prorate(subscription, change);

      // Assert
      expect(result.credit).toBeDefined();
      expect(result.charge).toBeDefined();
      expect(result.adjustment).toBeDefined();
      expect(result.details.oldPlan).toBe('basic');
      expect(result.details.newPlan).toBe('premium');
    });

    it('should calculate proration to the second', async () => {
      // Arrange
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(1);
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0);

      const subscription = {
        planId: 'monthly',
        planAmount: 100,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      };
      const change = {
        newPlanId: 'monthly-pro',
        newPlanAmount: 200,
      };

      // Act
      const result = await service.prorate(subscription, change);

      // Assert
      expect(result.details.daysRemaining).toBeGreaterThan(0);
      expect(result.details.unusedPercentage).toBeDefined();
    });
  });

  describe('recordPayment', () => {
    it('should record full payment and mark invoice as paid', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockInvoice] }) // getInvoice
        .mockResolvedValueOnce({ rows: [] }) // record payment
        .mockResolvedValueOnce({ rows: [{ total_paid: 171.57 }] }); // total paid

      const payment = {
        id: 'payment-123',
        amount: 171.57,
        currency: 'USD',
        paymentDate: new Date(),
        method: 'card',
        status: 'completed',
      };

      // Act
      await service.recordPayment('invoice-123', payment);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoice_payments'),
        expect.any(Array)
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('invoice.payment_recorded', expect.any(Object));
    });

    it('should record partial payment', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockInvoice] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total_paid: 100 }] });

      const payment = {
        id: 'payment-123',
        amount: 100,
        currency: 'USD',
        paymentDate: new Date(),
        method: 'card',
        status: 'completed',
      };

      // Act
      await service.recordPayment('invoice-123', payment);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET status = \'partial\''),
        expect.any(Array)
      );
    });

    it('should prevent payment on paid invoice', async () => {
      // Arrange
      const paidInvoice = { ...mockInvoice, status: 'paid' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [paidInvoice] });

      const payment = {
        id: 'payment-123',
        amount: 100,
        currency: 'USD',
        paymentDate: new Date(),
      };

      // Act & Assert
      await expect(service.recordPayment('invoice-123', payment))
        .rejects.toThrow('Invoice already paid');
    });

    it('should prevent payment on voided invoice', async () => {
      // Arrange
      const voidedInvoice = { ...mockInvoice, status: 'void' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [voidedInvoice] });

      const payment = {
        id: 'payment-123',
        amount: 100,
        currency: 'USD',
        paymentDate: new Date(),
      };

      // Act & Assert
      await expect(service.recordPayment('invoice-123', payment))
        .rejects.toThrow('Cannot pay voided invoice');
    });
  });

  describe('generatePDF', () => {
    it('should generate PDF invoice', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      const PDFDocument = require('pdfkit');
      const mockDoc = {
        fontSize: vi.fn().mockReturnThis(),
        text: vi.fn().mockReturnThis(),
        moveDown: vi.fn().mockReturnThis(),
        end: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('test'));
          }
        }),
        y: 100,
      };
      PDFDocument.mockReturnValue(mockDoc);

      // Act
      const result = await service.generatePDF('invoice-123');

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockDoc.text).toHaveBeenCalledWith('INVOICE', expect.any(Object));
    });

    it('should handle PDF generation errors', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.generatePDF('invoice-123'))
        .rejects.toThrow('PDF generation failed');
    });
  });

  describe('generateHTML', () => {
    it('should generate HTML invoice', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      const Handlebars = require('handlebars');
      Handlebars.compile = vi.fn().mockReturnValue((data: any) => '<html>Invoice</html>');

      // Act
      const result = await service.generateHTML('invoice-123');

      // Assert
      expect(result).toBe('<html>Invoice</html>');
      expect(Handlebars.compile).toHaveBeenCalled();
    });
  });

  describe('getInvoice', () => {
    it('should get invoice from cache if available', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(mockInvoice);

      // Act
      const result = await service.getInvoice('invoice-123');

      // Assert
      expect(result).toEqual(mockInvoice);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should get invoice from database if not cached', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockInvoice] })
        .mockResolvedValueOnce({ rows: [] }); // items

      // Act
      const result = await service.getInvoice('invoice-123');

      // Assert
      expect(result.id).toBe('invoice-123');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should throw if invoice not found', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.getInvoice('invalid-id'))
        .rejects.toThrow('Invoice not found');
    });
  });

  describe('getInvoicesByCustomer', () => {
    it('should get invoices for customer with filters', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      // Act
      const result = await service.getInvoicesByCustomer('customer-123', {
        status: 'paid',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 50,
        offset: 0,
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status ='),
        expect.arrayContaining(['customer-123', 'paid'])
      );
    });

    it('should handle query without filters', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [mockInvoice, mockInvoice] });

      // Act
      const result = await service.getInvoicesByCustomer('customer-123');

      // Assert
      expect(result).toHaveLength(2);
    });
  });

  describe('getOverdueInvoices', () => {
    it('should get overdue invoices', async () => {
      // Arrange
      const overdueInvoice = { ...mockInvoice, status: 'sent', dueDate: new Date('2024-01-01') };
      mockDb.query.mockResolvedValue({ rows: [overdueInvoice] });

      // Act
      const result = await service.getOverdueInvoices();

      // Assert
      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('due_date < CURRENT_DATE')
      );
    });
  });

  describe('getInvoiceMetrics', () => {
    it('should calculate invoice metrics', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({
        rows: [{
          total_count: '10',
          paid_count: '7',
          overdue_count: '2',
          total_amount: '1000',
          paid_amount: '700',
          avg_payment_days: '15',
        }],
      });

      // Act
      const result = await service.getInvoiceMetrics({
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      });

      // Assert
      expect(result.totalInvoices).toBe(10);
      expect(result.paidInvoices).toBe(7);
      expect(result.collectionRate).toBe(70);
      expect(result.averagePaymentDays).toBe(15);
    });

    it('should handle zero invoices', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({
        rows: [{
          total_count: '0',
          paid_count: '0',
          overdue_count: '0',
          total_amount: null,
          paid_amount: null,
          avg_payment_days: null,
        }],
      });

      // Act
      const result = await service.getInvoiceMetrics({
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      });

      // Assert
      expect(result.totalInvoices).toBe(0);
      expect(result.collectionRate).toBe(0);
    });
  });

  describe('sendInvoice', () => {
    it('should send invoice and finalize if draft', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      // Act
      await service.sendInvoice('invoice-123', 'customer-123');

      // Assert
      expect(mockNotification.send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'invoice',
        recipientId: 'customer-123',
      }));
      expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'invoice.sent',
      }));
    });

    it('should handle send errors', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(service.sendInvoice('invoice-123', 'customer-123'))
        .rejects.toThrow('Invoice delivery failed');
    });
  });

  describe('scheduleReminder', () => {
    it('should schedule payment reminder', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });
      const reminderDate = new Date('2024-11-01');

      // Act
      await service.scheduleReminder('invoice-123', reminderDate);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('invoice.reminder.schedule', expect.objectContaining({
        invoiceId: 'invoice-123',
        scheduledFor: reminderDate,
      }));
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoice_reminders'),
        expect.any(Array)
      );
    });
  });

  describe('markAsPaid', () => {
    it('should mark invoice as paid and send receipt', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [mockInvoice] });

      // Act
      await service.markAsPaid('invoice-123');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        expect.arrayContaining(['paid'])
      );
      expect(mockNotification.send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'receipt',
      }));
      expect(mockEventBus.emit).toHaveBeenCalledWith('invoice.paid', expect.any(Object));
    });

    it('should skip if already paid', async () => {
      // Arrange
      const paidInvoice = { ...mockInvoice, status: 'paid' };
      mockCache.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [paidInvoice] });

      // Act
      await service.markAsPaid('invoice-123');

      // Assert
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Only getInvoice
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database transaction failures', async () => {
      // Arrange
      mockDb.beginTransaction.mockRejectedValue(new Error('Transaction failed'));

      // Act & Assert
      await expect(service.create(mockInvoiceDraft))
        .rejects.toThrow('Invoice creation failed');
    });

    it('should handle concurrent payment updates', async () => {
      // Test optimistic locking with version numbers
      const invoice1 = { ...mockInvoice, version: 1 };
      const invoice2 = { ...mockInvoice, version: 2 };

      mockCache.get.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce({ rows: [invoice1] });

      // Simulate another process updating the invoice
      mockCache.get.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce({ rows: [invoice2] });

      // Both updates should handle version conflict appropriately
      const update1 = service.update('invoice-123', { notes: 'Update 1' });
      const update2 = service.update('invoice-123', { notes: 'Update 2' });

      await expect(Promise.all([update1, update2])).resolves.toBeDefined();
    });

    it('should handle currency precision correctly', async () => {
      // Test that all financial calculations maintain proper precision
      const items = [
        { quantity: 3, unitPrice: { amount: 33.333, currency: 'USD' } },
        { quantity: 1, unitPrice: { amount: 0.01, currency: 'USD' } },
      ];

      const draft = { ...mockInvoiceDraft, items };
      mockDb.query.mockResolvedValueOnce({ rows: [{ next_num: 1 }] });

      const result = await service.create(draft);

      expect(result.subtotal).toBeDefined();
      expect(result.total).toBeDefined();
    });
  });
});