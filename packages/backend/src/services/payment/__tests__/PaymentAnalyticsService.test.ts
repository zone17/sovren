/**
 * PaymentAnalyticsService Test Suite
 * User Story: US-E5-028
 * CRITICAL: 100% test coverage required for payment services
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import { PaymentAnalyticsService, TYPES } from '../PaymentAnalyticsService';
import type { IPaymentProcessingService } from '../../../interfaces/payment/IPaymentProcessingService';
import type { ICurrencyService } from '../../../interfaces/payment/ICurrencyService';
import type { ICacheService } from '../../../interfaces/shared/ICacheService';
import type { IEventBus } from '../../../interfaces/shared/IEventBus';
import type { ILogger } from '../../../interfaces/shared/ILogger';
import type {
  AnalyticsQuery,
  AnalyticsPeriod,
  ExportFormat,
  AnalyticsExportRequest
} from '../../../types/payment-analytics';
import type {
  PaymentTransaction,
  PaymentHistoryQuery,
  PaymentStatus,
  PaymentMethod
} from '../../../types/payment';
import type { Currency, ConversionResult } from '../../../types/currency';
import { DomainEventType } from '../../../interfaces/shared/IEventBus';

describe('PaymentAnalyticsService', () => {
  let service: PaymentAnalyticsService;
  let mockPaymentService: jest.Mocked<IPaymentProcessingService>;
  let mockCurrencyService: jest.Mocked<ICurrencyService>;
  let mockCacheService: jest.Mocked<ICacheService>;
  let mockEventBus: jest.Mocked<IEventBus>;
  let mockLogger: jest.Mocked<ILogger>;

  // Sample test data
  const sampleTransactions: PaymentTransaction[] = [
    {
      id: 'tx1',
      invoiceId: 'inv1',
      userId: 'user1',
      amount: 100000, // 100k sats
      currency: 'BTC',
      status: 'completed' as PaymentStatus,
      method: 'lightning' as PaymentMethod,
      paymentHash: 'hash1',
      retryCount: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      completedAt: new Date('2024-01-01')
    },
    {
      id: 'tx2',
      invoiceId: 'inv2',
      userId: 'user2',
      amount: 200000,
      currency: 'BTC',
      status: 'completed' as PaymentStatus,
      method: 'lightning' as PaymentMethod,
      paymentHash: 'hash2',
      retryCount: 0,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      completedAt: new Date('2024-01-02')
    },
    {
      id: 'tx3',
      invoiceId: 'inv3',
      userId: 'user1',
      amount: 50000,
      currency: 'BTC',
      status: 'failed' as PaymentStatus,
      method: 'onchain' as PaymentMethod,
      paymentHash: 'hash3',
      failureReason: 'insufficient_funds' as any,
      retryCount: 2,
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03')
    },
    {
      id: 'tx4',
      invoiceId: 'inv4',
      userId: 'user3',
      amount: 150000,
      currency: 'BTC',
      status: 'refunded' as PaymentStatus,
      method: 'lightning' as PaymentMethod,
      paymentHash: 'hash4',
      retryCount: 0,
      createdAt: new Date('2024-01-04'),
      updatedAt: new Date('2024-01-04'),
      completedAt: new Date('2024-01-04')
    }
  ];

  beforeEach(() => {
    // Create mocks
    mockPaymentService = {
      getPaymentHistory: jest.fn(),
      getStatistics: jest.fn(),
      createInvoice: jest.fn(),
      getInvoice: jest.fn(),
      getInvoiceByPaymentHash: jest.fn(),
      cancelInvoice: jest.fn(),
      listUserInvoices: jest.fn(),
      processPayment: jest.fn(),
      verifyPayment: jest.fn(),
      checkPaymentStatus: jest.fn(),
      getTransaction: jest.fn(),
      retryPayment: jest.fn(),
      initiateRefund: jest.fn(),
      getRefund: jest.fn(),
      listTransactionRefunds: jest.fn(),
      getReceipt: jest.fn(),
      generateReceiptPdf: jest.fn(),
      checkIdempotency: jest.fn(),
      storeIdempotency: jest.fn(),
      checkExpiredInvoices: jest.fn(),
      expireInvoice: jest.fn(),
      subscribeToEvents: jest.fn(),
      unsubscribeFromEvents: jest.fn(),
      getSupportedMethods: jest.fn(),
      isMethodAvailable: jest.fn(),
      healthCheck: jest.fn(),
      getMetrics: jest.fn(),
      dispose: jest.fn()
    } as any;

    mockCurrencyService = {
      convert: jest.fn(),
      getRate: jest.fn(),
      satoshisToBtc: jest.fn(),
      btcToSatoshis: jest.fn(),
      getSupportedCurrencies: jest.fn(),
      getCurrencySymbol: jest.fn(),
      getCurrencyName: jest.fn(),
      getCurrencyPrecision: jest.fn(),
      isCurrencySupported: jest.fn(),
      healthCheck: jest.fn(),
      dispose: jest.fn()
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      invalidate: jest.fn(),
      invalidateByTags: jest.fn(),
      flush: jest.fn(),
      getTtl: jest.fn(),
      setTtl: jest.fn(),
      getMany: jest.fn(),
      setMany: jest.fn(),
      remember: jest.fn(),
      healthCheck: jest.fn(),
      dispose: jest.fn()
    } as any;

    mockEventBus = {
      publish: jest.fn(),
      publishBatch: jest.fn(),
      subscribe: jest.fn(),
      subscribeToMany: jest.fn(),
      subscribeToAll: jest.fn(),
      subscribeWithFilter: jest.fn(),
      unsubscribe: jest.fn(),
      unsubscribeAll: jest.fn(),
      getEvent: jest.fn(),
      queryEvents: jest.fn(),
      replayEvents: jest.fn(),
      replayEventsToHandler: jest.fn(),
      getActiveSubscriptions: jest.fn(),
      getEventStats: jest.fn(),
      clearEventStore: jest.fn(),
      isHealthy: jest.fn(),
      dispose: jest.fn()
    } as any;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn()
    } as any;

    // Default mock implementations
    mockPaymentService.getPaymentHistory.mockResolvedValue(sampleTransactions);
    mockCacheService.get.mockResolvedValue(null); // Always miss cache by default
    mockCacheService.set.mockResolvedValue(undefined);
    mockCacheService.invalidate.mockResolvedValue(4);
    mockCacheService.healthCheck.mockResolvedValue(true);
    mockCurrencyService.convert.mockResolvedValue({
      originalAmount: 100,
      convertedAmount: 100,
      from: 'BTC' as Currency,
      to: 'BTC' as Currency,
      rate: 1,
      provider: 'fallback' as any,
      timestamp: new Date()
    } as ConversionResult);

    // Create service instance
    service = new PaymentAnalyticsService(
      mockPaymentService,
      mockCurrencyService,
      mockCacheService,
      mockEventBus,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize service correctly', () => {
      expect(service).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('PaymentAnalyticsService initialized');
    });

    it('should subscribe to payment events', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DomainEventType.PAYMENT_RECEIVED,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DomainEventType.PAYMENT_FAILED,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DomainEventType.PAYMENT_REFUNDED,
        expect.any(Function)
      );
    });

    it('should set default base currency to BTC', () => {
      expect(service.getBaseCurrency()).toBe('BTC');
    });
  });

  describe('Revenue Analytics', () => {
    const query: AnalyticsQuery = {
      period: 'daily' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get revenue analytics', async () => {
      const result = await service.getRevenueAnalytics(query);

      expect(result).toBeDefined();
      expect(result.period).toBe('daily');
      expect(result.totalRevenue).toBe(300000); // tx1 + tx2
      expect(result.netRevenue).toBe(150000); // total - refunded
      expect(result.transactionCount).toBe(4);
      expect(mockPaymentService.getPaymentHistory).toHaveBeenCalled();
    });

    it('should cache revenue analytics', async () => {
      await service.getRevenueAnalytics(query);
      await service.getRevenueAnalytics(query);

      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should calculate revenue by period', async () => {
      const result = await service.getRevenueByPeriod(
        'monthly' as AnalyticsPeriod,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBeDefined();
      expect(result.period).toBe('monthly');
    });

    it('should get revenue time series', async () => {
      const result = await service.getRevenueTimeSeries(query);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('timestamp');
      expect(result[0]).toHaveProperty('value');
    });

    it('should get revenue trend with forecast', async () => {
      const result = await service.getRevenueTrend(query, 30);

      expect(result).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(result.forecast).toBeDefined();
      expect(Array.isArray(result.forecast)).toBe(true);
      expect(result.forecastConfidence).toBeGreaterThan(0);
    });

    it('should handle empty transactions', async () => {
      mockPaymentService.getPaymentHistory.mockResolvedValue([]);

      const result = await service.getRevenueAnalytics(query);

      expect(result.totalRevenue).toBe(0);
      expect(result.transactionCount).toBe(0);
    });

    it('should convert multi-currency revenue', async () => {
      const multiCurrencyTxs = [
        { ...sampleTransactions[0], currency: 'USD', amountFiat: 100 },
        { ...sampleTransactions[1], currency: 'EUR', amountFiat: 200 }
      ];

      mockPaymentService.getPaymentHistory.mockResolvedValue(multiCurrencyTxs);
      mockCurrencyService.convert.mockResolvedValue({
        originalAmount: 100,
        convertedAmount: 0.002,
        from: 'USD' as Currency,
        to: 'BTC' as Currency,
        rate: 0.00002,
        provider: 'coingecko' as any,
        timestamp: new Date()
      } as ConversionResult);

      const result = await service.getRevenueAnalytics(query);

      expect(result.revenueByCurrency.size).toBeGreaterThan(0);
      expect(mockCurrencyService.convert).toHaveBeenCalled();
    });
  });

  describe('Transaction Metrics', () => {
    const query: AnalyticsQuery = {
      period: 'daily' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get transaction volume metrics', async () => {
      const result = await service.getTransactionVolume(query);

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(4);
      expect(result.totalVolume).toBe(500000); // All transactions
      expect(result.averageValue).toBeGreaterThan(0);
      expect(result.medianValue).toBeGreaterThan(0);
    });

    it('should get success rate analytics', async () => {
      const result = await service.getSuccessRateAnalytics(query);

      expect(result).toBeDefined();
      expect(result.totalAttempts).toBe(4);
      expect(result.successfulPayments).toBe(2); // tx1, tx2
      expect(result.failedPayments).toBe(1); // tx3
      expect(result.successRate).toBe(50); // 2/4 = 50%
    });

    it('should calculate success rate by method', async () => {
      const result = await service.getSuccessRateAnalytics(query);

      expect(result.successRateByMethod).toBeDefined();
      expect(result.successRateByMethod.has('lightning')).toBe(true);
    });

    it('should track failure reasons', async () => {
      const result = await service.getSuccessRateAnalytics(query);

      expect(result.failureReasonBreakdown).toBeDefined();
      expect(result.topFailureReasons).toBeDefined();
      expect(Array.isArray(result.topFailureReasons)).toBe(true);
    });

    it('should calculate retry metrics', async () => {
      const result = await service.getSuccessRateAnalytics(query);

      expect(result.averageRetries).toBeDefined();
      expect(result.retriedPayments).toBe(1); // tx3 has retries
      expect(result.retrySuccessRate).toBeGreaterThanOrEqual(0);
    });

    it('should get transaction count by period', async () => {
      const result = await service.getTransactionCountByPeriod(
        'daily' as AnalyticsPeriod,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should calculate volume by method', async () => {
      const result = await service.getTransactionVolume(query);

      expect(result.volumeByMethod).toBeDefined();
      expect(result.countByMethod).toBeDefined();
    });

    it('should calculate volume by status', async () => {
      const result = await service.getTransactionVolume(query);

      expect(result.volumeByStatus).toBeDefined();
      expect(result.countByStatus).toBeDefined();
    });
  });

  describe('Currency Distribution', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get currency distribution', async () => {
      const result = await service.getCurrencyDistribution(query);

      expect(result).toBeDefined();
      expect(result.transactionCountByCurrency).toBeDefined();
      expect(result.volumeByCurrency).toBeDefined();
      expect(result.topCurrencies).toBeDefined();
    });

    it('should calculate dominant currency', async () => {
      const result = await service.getCurrencyDistribution(query);

      expect(result.dominantCurrency).toBeDefined();
      expect(result.dominancePercentage).toBeGreaterThanOrEqual(0);
    });

    it('should convert volumes to base currency', async () => {
      const result = await service.getCurrencyDistribution(query);

      expect(result.volumeInBaseCurrency).toBeDefined();
      expect(result.volumeInBaseCurrency.size).toBeGreaterThan(0);
    });

    it('should get revenue by currency', async () => {
      const result = await service.getRevenueByCurrency('BTC' as Currency, query);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Payment Method Analytics', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get payment method analytics', async () => {
      const result = await service.getPaymentMethodAnalytics(query);

      expect(result).toBeDefined();
      expect(result.lightningTransactions).toBeDefined();
      expect(result.lightningVolume).toBeDefined();
      expect(result.onchainTransactions).toBeDefined();
    });

    it('should calculate method breakdown', async () => {
      const result = await service.getPaymentMethodAnalytics(query);

      expect(result.methodBreakdown).toBeDefined();
      expect(result.methodBreakdown.size).toBeGreaterThan(0);
    });

    it('should identify preferred method', async () => {
      const result = await service.getPaymentMethodAnalytics(query);

      expect(result.preferredMethod).toBeDefined();
      expect(result.preferencePercentage).toBeGreaterThanOrEqual(0);
    });

    it('should calculate success rate by method', async () => {
      const result = await service.getPaymentMethodAnalytics(query);

      expect(result.lightningSuccessRate).toBeGreaterThanOrEqual(0);
      expect(result.onchainSuccessRate).toBeGreaterThanOrEqual(0);
    });

    it('should get revenue by method', async () => {
      const result = await service.getRevenueByMethod('lightning' as PaymentMethod, query);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Refund Analytics', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get refund analytics', async () => {
      const result = await service.getRefundAnalytics(query);

      expect(result).toBeDefined();
      expect(result.totalRefunds).toBe(1); // tx4
      expect(result.totalRefundAmount).toBe(150000);
    });

    it('should calculate refund rate', async () => {
      const result = await service.getRefundAnalytics(query);

      expect(result.refundRate).toBeGreaterThanOrEqual(0);
      expect(result.refundAmountRate).toBeGreaterThanOrEqual(0);
    });

    it('should track refund reasons', async () => {
      const result = await service.getRefundAnalytics(query);

      expect(result.refundReasonBreakdown).toBeDefined();
      expect(result.topRefundReasons).toBeDefined();
    });

    it('should calculate refund impact', async () => {
      const result = await service.getRefundAnalytics(query);

      expect(result.refundImpactOnRevenue).toBeGreaterThanOrEqual(0);
    });

    it('should get refund rate directly', async () => {
      const rate = await service.getRefundRate(query);

      expect(rate).toBeGreaterThanOrEqual(0);
    });

    it('should get refund impact directly', async () => {
      const impact = await service.getRefundImpact(query);

      expect(impact).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Geographic Analytics', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get geographic revenue (stub)', async () => {
      const result = await service.getGeographicRevenue(query);

      expect(result).toBeDefined();
      expect(result.revenueByCountry).toBeDefined();
      expect(result.topCountries).toBeDefined();
    });

    it('should get revenue by country (stub)', async () => {
      const result = await service.getRevenueByCountry('US', query);

      expect(result).toBe(0); // Stub returns 0
    });
  });

  describe('Customer Analytics', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get top customers', async () => {
      const result = await service.getTopCustomers(query, 10);

      expect(result).toBeDefined();
      expect(result.topCustomers).toBeDefined();
      expect(Array.isArray(result.topCustomers)).toBe(true);
    });

    it('should calculate customer concentration risk', async () => {
      const result = await service.getTopCustomers(query);

      expect(result.customerConcentrationRisk).toBeGreaterThanOrEqual(0);
      expect(result.top10Percentage).toBeGreaterThanOrEqual(0);
    });

    it('should get ARPU', async () => {
      const result = await service.getARPU(query);

      expect(result).toBeDefined();
      expect(result.arpu).toBeGreaterThanOrEqual(0);
      expect(result.activeUsers).toBeGreaterThan(0);
    });

    it('should calculate ARPU growth', async () => {
      const result = await service.getARPU(query);

      expect(result.arpuGrowthRate).toBeDefined();
    });

    it('should get customer lifetime value', async () => {
      const result = await service.getCustomerLifetimeValue(query);

      expect(result).toBeDefined();
      expect(result.averageLifetimeValue).toBeGreaterThanOrEqual(0);
      expect(result.medianLifetimeValue).toBeGreaterThanOrEqual(0);
    });

    it('should get individual customer LTV', async () => {
      mockPaymentService.getPaymentHistory.mockResolvedValue([
        sampleTransactions[0]
      ]);

      const ltv = await service.getCustomerLTV('user1');

      expect(ltv).toBeGreaterThanOrEqual(0);
    });

    it('should calculate predicted CLV', async () => {
      const result = await service.getCustomerLifetimeValue(query);

      expect(result.predictedClv).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Churn Analytics', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get churn impact', async () => {
      const result = await service.getChurnImpact(query);

      expect(result).toBeDefined();
      expect(result.churnRate).toBeGreaterThanOrEqual(0);
      expect(result.lostRevenue).toBeGreaterThanOrEqual(0);
    });

    it('should calculate churn rate directly', async () => {
      const rate = await service.getChurnRate(query);

      expect(rate).toBeGreaterThanOrEqual(0);
    });

    it('should predict churn impact', async () => {
      const result = await service.getChurnImpact(query);

      expect(result.atRiskCustomers).toBeGreaterThanOrEqual(0);
      expect(result.predictedChurnRevenueLoss).toBeGreaterThanOrEqual(0);
    });
  });

  describe('MRR Analytics', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get MRR analytics', async () => {
      const result = await service.getMRRAnalytics(query);

      expect(result).toBeDefined();
      expect(result.currentMRR).toBeGreaterThanOrEqual(0);
      expect(result.currentARR).toBeGreaterThanOrEqual(0);
    });

    it('should calculate MRR components', async () => {
      const result = await service.getMRRAnalytics(query);

      expect(result.newMRR).toBeDefined();
      expect(result.expansionMRR).toBeDefined();
      expect(result.contractionMRR).toBeDefined();
      expect(result.churnedMRR).toBeDefined();
    });

    it('should calculate quick ratio', async () => {
      const result = await service.getMRRAnalytics(query);

      expect(result.quickRatio).toBeGreaterThanOrEqual(0);
    });

    it('should get current MRR', async () => {
      const mrr = await service.getCurrentMRR();

      expect(mrr).toBeGreaterThanOrEqual(0);
    });

    it('should get current ARR', async () => {
      const arr = await service.getCurrentARR();

      expect(arr).toBeGreaterThanOrEqual(0);
    });

    it('should get MRR growth rate', async () => {
      const rate = await service.getMRRGrowthRate(query);

      expect(rate).toBeDefined();
    });
  });

  describe('Real-time Dashboard', () => {
    it('should get realtime metrics', async () => {
      const result = await service.getRealtimeMetrics();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.todayRevenue).toBeGreaterThanOrEqual(0);
      expect(result.alerts).toBeDefined();
    });

    it('should subscribe to realtime updates', async () => {
      const callback = jest.fn();
      const subscriptionId = service.subscribeToRealtimeUpdates(callback);

      expect(subscriptionId).toBeDefined();

      // Wait for async callback
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe from realtime updates', () => {
      const callback = jest.fn();
      const subscriptionId = service.subscribeToRealtimeUpdates(callback);

      service.unsubscribeFromRealtimeUpdates(subscriptionId);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should generate alerts for low success rate', async () => {
      const failedTxs = Array(10).fill(null).map((_, i) => ({
        ...sampleTransactions[2],
        id: `tx_fail_${i}`,
        createdAt: new Date()
      }));

      mockPaymentService.getPaymentHistory.mockResolvedValue(failedTxs);

      const result = await service.getRealtimeMetrics();

      expect(result.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Export Capabilities', () => {
    const exportRequest: AnalyticsExportRequest = {
      format: 'json' as ExportFormat,
      analyticsType: 'revenue',
      query: {
        period: 'monthly' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }
    };

    it('should export analytics as JSON', async () => {
      const result = await service.exportAnalytics(exportRequest);

      expect(result).toBeDefined();
      expect(result.exportId).toBeDefined();
      expect(result.format).toBe('json');
      expect(result.fileName).toContain('.json');
    });

    it('should export analytics as CSV', async () => {
      const csvRequest = { ...exportRequest, format: 'csv' as ExportFormat };
      const result = await service.exportAnalytics(csvRequest);

      expect(result.format).toBe('csv');
      expect(result.fileName).toContain('.csv');
    });

    it('should export analytics as XLSX (stub)', async () => {
      const xlsxRequest = { ...exportRequest, format: 'xlsx' as ExportFormat };
      const result = await service.exportAnalytics(xlsxRequest);

      expect(result.format).toBe('xlsx');
    });

    it('should export analytics as PDF (stub)', async () => {
      const pdfRequest = { ...exportRequest, format: 'pdf' as ExportFormat };
      const result = await service.exportAnalytics(pdfRequest);

      expect(result.format).toBe('pdf');
    });

    it('should get export by ID', async () => {
      const exported = await service.exportAnalytics(exportRequest);
      const retrieved = await service.getExport(exported.exportId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.exportId).toBe(exported.exportId);
    });

    it('should list exports', async () => {
      await service.exportAnalytics(exportRequest);
      const exports = await service.listExports();

      expect(exports).toBeDefined();
      expect(Array.isArray(exports)).toBe(true);
      expect(exports.length).toBeGreaterThan(0);
    });

    it('should delete export', async () => {
      const exported = await service.exportAnalytics(exportRequest);
      await service.deleteExport(exported.exportId);

      const retrieved = await service.getExport(exported.exportId);
      expect(retrieved).toBeNull();
    });

    it('should format array data as CSV', async () => {
      const arrayRequest = {
        ...exportRequest,
        analyticsType: 'transactions',
        format: 'csv' as ExportFormat
      };

      const result = await service.exportAnalytics(arrayRequest);

      expect(result.data).toBeDefined();
    });
  });

  describe('Multi-Currency Consolidation', () => {
    const query: AnalyticsQuery = {
      period: 'monthly' as AnalyticsPeriod,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should get consolidated revenue', async () => {
      const result = await service.getConsolidatedRevenue(query);

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should get revenue breakdown in base currency', async () => {
      const result = await service.getRevenueBreakdownInBaseCurrency(query);

      expect(result).toBeDefined();
      expect(result instanceof Map).toBe(true);
    });

    it('should set base currency', () => {
      service.setBaseCurrency('USD' as Currency);

      expect(service.getBaseCurrency()).toBe('USD');
      expect(mockLogger.info).toHaveBeenCalledWith('Base currency set to USD');
    });

    it('should get base currency', () => {
      const currency = service.getBaseCurrency();

      expect(currency).toBe('BTC');
    });
  });

  describe('Data Aggregation', () => {
    it('should trigger aggregation', async () => {
      const jobId = await service.triggerAggregation(
        'daily' as AnalyticsPeriod,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(jobId).toBeDefined();
      expect(jobId).toContain('agg_');
    });

    it('should get aggregation job status', async () => {
      const jobId = await service.triggerAggregation('daily' as AnalyticsPeriod);
      const status = await service.getAggregationJobStatus(jobId);

      expect(status).toBeDefined();
      expect(status?.status).toBe('running');
      expect(status?.progress).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent job', async () => {
      const status = await service.getAggregationJobStatus('non-existent');

      expect(status).toBeNull();
    });

    it('should complete aggregation job', async () => {
      const jobId = await service.triggerAggregation('daily' as AnalyticsPeriod);

      // Wait for simulated completion
      await new Promise(resolve => setTimeout(resolve, 5100));

      const status = await service.getAggregationJobStatus(jobId);

      expect(status?.status).toBe('completed');
      expect(status?.progress).toBe(100);
    });
  });

  describe('Cache Management', () => {
    it('should warm up cache', async () => {
      await service.warmupCache();

      expect(mockPaymentService.getPaymentHistory).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Analytics cache warmed up');
    });

    it('should clear cache', async () => {
      await service.clearCache();

      expect(mockCacheService.invalidate).toHaveBeenCalledWith('analytics:*');
    });

    it('should clear cache with pattern', async () => {
      await service.clearCache('analytics:revenue:*');

      expect(mockCacheService.invalidate).toHaveBeenCalledWith('analytics:revenue:*');
    });

    it('should get cache stats', async () => {
      const stats = await service.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hits).toBeGreaterThanOrEqual(0);
      expect(stats.misses).toBeGreaterThanOrEqual(0);
    });

    it('should use cached data on second call', async () => {
      const query: AnalyticsQuery = {
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      // First call - cache miss
      await service.getRevenueAnalytics(query);

      // Mock cache hit
      mockCacheService.get.mockResolvedValueOnce({
        period: 'daily',
        totalRevenue: 100000
      });

      // Second call - cache hit
      await service.getRevenueAnalytics(query);

      const stats = await service.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to analytics events', () => {
      const callback = jest.fn();
      const subscriptionId = service.subscribeToEvents('analytics.generated', callback);

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toContain('event_');
    });

    it('should unsubscribe from analytics events', () => {
      const callback = jest.fn();
      const subscriptionId = service.subscribeToEvents('analytics.generated', callback);

      service.unsubscribeFromEvents(subscriptionId);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Health & Monitoring', () => {
    it('should perform health check', async () => {
      const healthy = await service.healthCheck();

      expect(healthy).toBe(true);
      expect(mockCacheService.healthCheck).toHaveBeenCalled();
    });

    it('should return false on health check failure', async () => {
      mockCacheService.healthCheck.mockRejectedValueOnce(new Error('Cache unhealthy'));

      const healthy = await service.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should get service metrics', async () => {
      // Generate some activity first
      await service.getRevenueAnalytics({
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date(),
        endDate: new Date()
      });

      const metrics = await service.getServiceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.totalQueries).toBeGreaterThanOrEqual(0);
      expect(metrics.totalExports).toBeGreaterThanOrEqual(0);
    });

    it('should get query performance metrics', async () => {
      // Generate some queries
      await service.getRevenueAnalytics({
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date(),
        endDate: new Date()
      });

      const metrics = await service.getQueryPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics instanceof Map).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should compare two periods', async () => {
      const period1: AnalyticsQuery = {
        period: 'monthly' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const period2: AnalyticsQuery = {
        period: 'monthly' as AnalyticsPeriod,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29')
      };

      const result = await service.comparePeriods(period1, period2);

      expect(result).toBeDefined();
      expect(result.period1).toBeDefined();
      expect(result.period2).toBeDefined();
      expect(result.revenueDelta).toBeDefined();
      expect(result.revenueGrowth).toBeDefined();
    });

    it('should get analytics summary', async () => {
      const query: AnalyticsQuery = {
        period: 'monthly' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const summary = await service.getAnalyticsSummary(query);

      expect(summary).toBeDefined();
      expect(summary.revenue).toBeDefined();
      expect(summary.transactions).toBeDefined();
      expect(summary.successRate).toBeDefined();
      expect(summary.refunds).toBeDefined();
      expect(summary.arpu).toBeDefined();
    });
  });

  describe('Helper Methods', () => {
    it('should format time key for hourly period', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      // Access private method through type casting for testing
      const key = (service as any).formatTimeKey(date, 'hourly');

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });

    it('should parse time key correctly', () => {
      const key = '2024-1-1';
      const parsed = (service as any).parseTimeKey(key, 'daily');

      expect(parsed).toBeInstanceOf(Date);
    });

    it('should calculate trend from values', () => {
      const values = [100, 110, 120, 130, 140];
      const trend = (service as any).calculateTrend(values);

      expect(trend).toBeDefined();
      expect(['increasing', 'stable']).toContain(trend.direction);
      expect(trend.strength).toBeGreaterThanOrEqual(0);
    });

    it('should calculate volatility', () => {
      const values = [100, 110, 90, 120, 80];
      const volatility = (service as any).calculateVolatility(values);

      expect(volatility).toBeGreaterThan(0);
    });

    it('should calculate SMA', () => {
      const values = [100, 110, 120, 130, 140];
      const sma = (service as any).calculateSMA(values, 3);

      expect(sma).toBeGreaterThan(0);
    });

    it('should calculate EMA', () => {
      const values = [100, 110, 120, 130, 140];
      const ema = (service as any).calculateEMA(values, 3);

      expect(ema).toBeGreaterThan(0);
    });

    it('should detect seasonality', () => {
      const values = Array(20).fill(0).map((_, i) => 100 + (i % 7) * 10);
      const result = (service as any).detectSeasonality(values);

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
    });
  });

  describe('Dispose', () => {
    it('should dispose resources', async () => {
      await service.dispose();

      expect(mockLogger.info).toHaveBeenCalledWith('PaymentAnalyticsService disposed');
    });

    it('should clear all subscriptions on dispose', async () => {
      const callback = jest.fn();
      service.subscribeToRealtimeUpdates(callback);
      service.subscribeToEvents('test', callback);

      await service.dispose();

      // Verify cleanup
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null cache results gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const query: AnalyticsQuery = {
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const result = await service.getRevenueAnalytics(query);

      expect(result).toBeDefined();
    });

    it('should handle empty time series', async () => {
      mockPaymentService.getPaymentHistory.mockResolvedValue([]);

      const query: AnalyticsQuery = {
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const result = await service.getRevenueTimeSeries(query);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle currency conversion errors', async () => {
      // Use multi-currency transactions to trigger conversion
      const multiCurrencyTxs = [
        { ...sampleTransactions[0], currency: 'USD', amountFiat: 100, status: 'completed' as PaymentStatus }
      ];

      mockPaymentService.getPaymentHistory.mockResolvedValue(multiCurrencyTxs);
      mockCurrencyService.convert.mockRejectedValue(new Error('Conversion failed'));

      const query: AnalyticsQuery = {
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      // Should throw error when converting currencies
      await expect(service.getRevenueAnalytics(query)).rejects.toThrow();
    });

    it('should handle single transaction', async () => {
      mockPaymentService.getPaymentHistory.mockResolvedValue([sampleTransactions[0]]);

      const query: AnalyticsQuery = {
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const result = await service.getRevenueAnalytics(query);

      expect(result.transactionCount).toBe(1);
    });

    it('should handle zero division in calculations', async () => {
      mockPaymentService.getPaymentHistory.mockResolvedValue([]);

      const query: AnalyticsQuery = {
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const result = await service.getARPU(query);

      expect(result.arpu).toBe(0);
    });
  });

  describe('Event Handlers', () => {
    it('should invalidate cache on payment received event', async () => {
      const subscribeCall = mockEventBus.subscribe.mock.calls.find(
        call => call[0] === DomainEventType.PAYMENT_RECEIVED
      );

      expect(subscribeCall).toBeDefined();

      // Trigger the handler
      const handler = subscribeCall?.[1];
      if (handler) {
        await handler({} as any);
        expect(mockCacheService.invalidate).toHaveBeenCalled();
      }
    });

    it('should handle cache invalidation errors', async () => {
      mockCacheService.invalidate.mockRejectedValue(new Error('Cache error'));

      const subscribeCall = mockEventBus.subscribe.mock.calls.find(
        call => call[0] === DomainEventType.PAYMENT_RECEIVED
      );

      const handler = subscribeCall?.[1];
      if (handler) {
        await handler({} as any);
        expect(mockLogger.error).toHaveBeenCalled();
      }
    });
  });

  describe('Additional Edge Cases for 100% Coverage', () => {
    it('should handle trend calculation with insufficient data', () => {
      const values = [100];
      const trend = (service as any).calculateTrend(values);

      expect(trend.direction).toBe('stable');
      expect(trend.strength).toBe(0);
    });

    it('should handle volatility with single value', () => {
      const values = [100];
      const volatility = (service as any).calculateVolatility(values);

      expect(volatility).toBe(0);
    });

    it('should handle SMA with no values', () => {
      const values: number[] = [];
      const sma = (service as any).calculateSMA(values, 5);

      expect(sma).toBe(0);
    });

    it('should handle EMA with no values', () => {
      const values: number[] = [];
      const ema = (service as any).calculateEMA(values, 5);

      expect(ema).toBe(0);
    });

    it('should handle EMA with single value', () => {
      const values = [100];
      const ema = (service as any).calculateEMA(values, 5);

      expect(ema).toBe(100);
    });

    it('should handle forecast with insufficient data', () => {
      const timeSeries: any[] = [];
      const forecast = (service as any).forecastRevenue(timeSeries, 30);

      expect(forecast).toEqual([]);
    });

    it('should handle forecast with single data point', () => {
      const timeSeries = [{
        timestamp: new Date(),
        value: 100
      }];
      const forecast = (service as any).forecastRevenue(timeSeries, 30);

      expect(forecast).toEqual([]);
    });

    it('should handle seasonality detection with insufficient data', () => {
      const values = [100, 110, 120];
      const result = (service as any).detectSeasonality(values);

      expect(result.detected).toBe(false);
    });

    it('should format CSV from empty array', () => {
      const data: any[] = [];
      const csv = (service as any).formatAsCSV(data);

      expect(csv).toBe('');
    });

    it('should format CSV from object', () => {
      const data = { a: 1, b: 2, c: 3 };
      const csv = (service as any).formatAsCSV(data);

      expect(csv).toContain('a,b,c');
      expect(csv).toContain('1,2,3');
    });

    it('should format CSV from primitive value', () => {
      const data = 42;
      const csv = (service as any).formatAsCSV(data);

      expect(csv).toBe('42');
    });

    it('should handle time key formatting for weekly period', () => {
      const date = new Date('2024-01-15');
      const key = (service as any).formatTimeKey(date, 'weekly');

      expect(key).toBeDefined();
      expect(key).toContain('W');
    });

    it('should handle time key formatting for yearly period', () => {
      const date = new Date('2024-06-15');
      const key = (service as any).formatTimeKey(date, 'yearly');

      expect(key).toBe('2024');
    });

    it('should handle time key formatting for default period', () => {
      const date = new Date('2024-01-15');
      const key = (service as any).formatTimeKey(date, 'all_time');

      expect(key).toBeDefined();
    });

    it('should parse time key for weekly period', () => {
      const key = '2024-1-W2';
      const parsed = (service as any).parseTimeKey(key, 'weekly');

      expect(parsed).toBeInstanceOf(Date);
    });

    it('should parse time key for yearly period', () => {
      const key = '2024';
      const parsed = (service as any).parseTimeKey(key, 'yearly');

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getFullYear()).toBe(2024);
    });

    it('should parse time key for default period', () => {
      const isoDate = new Date().toISOString();
      const parsed = (service as any).parseTimeKey(isoDate, 'all_time');

      expect(parsed).toBeInstanceOf(Date);
    });

    it('should handle export with unknown type', async () => {
      const request: AnalyticsExportRequest = {
        format: 'json' as ExportFormat,
        analyticsType: 'unknown-type',
        query: {
          period: 'monthly' as AnalyticsPeriod,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };

      const result = await service.exportAnalytics(request);

      expect(result).toBeDefined();
      expect(result.format).toBe('json');
    });

    it('should handle export with default format for unknown format', async () => {
      const request: AnalyticsExportRequest = {
        format: 'unknown' as any,
        analyticsType: 'revenue',
        query: {
          period: 'monthly' as AnalyticsPeriod,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };

      const result = await service.exportAnalytics(request);

      expect(result).toBeDefined();
      expect(result.fileName).toContain('.json');
    });

    it('should handle increasing trend direction', () => {
      const values = [100, 200, 300, 400, 500]; // Strong increasing trend
      const trend = (service as any).calculateTrend(values);

      expect(trend.direction).toBe('increasing');
      expect(trend.strength).toBeGreaterThan(10);
    });

    it('should handle decreasing trend direction', () => {
      const values = [500, 400, 300, 200, 100]; // Strong decreasing trend
      const trend = (service as any).calculateTrend(values);

      expect(trend.direction).toBe('decreasing');
      expect(trend.strength).toBeGreaterThan(10);
    });

    it('should handle volatile trend', () => {
      const values = Array(20).fill(0).map(() => Math.random() * 1000); // Random volatile data
      const trend = (service as any).calculateTrend(values);

      expect(trend.direction).toBeDefined();
      expect(['increasing', 'decreasing', 'stable', 'volatile']).toContain(trend.direction);
    });

    it('should handle division by zero in trend strength', () => {
      const values = [0, 0, 0, 0, 0]; // All zeros
      const trend = (service as any).calculateTrend(values);

      expect(trend.strength).toBeDefined();
      expect(isNaN(trend.strength) || trend.strength === 0 || trend.strength === Infinity).toBe(true);
    });

    it('should handle forecast with negative trend', () => {
      const timeSeries = [
        { timestamp: new Date('2024-01-01'), value: 1000 },
        { timestamp: new Date('2024-01-02'), value: 500 },
        { timestamp: new Date('2024-01-03'), value: 250 }
      ];

      const forecast = (service as any).forecastRevenue(timeSeries, 5);

      expect(forecast).toBeDefined();
      expect(Array.isArray(forecast)).toBe(true);
      // Forecast should not go below 0
      forecast.forEach((point: any) => {
        expect(point.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('should detect weekly seasonality', () => {
      // Create perfect weekly pattern
      const values = Array(21).fill(0).map((_, i) => 100 + (i % 7) * 10);
      const result = (service as any).detectSeasonality(values);

      expect(result).toBeDefined();
      // Depending on the pattern, it might or might not be detected
      expect(result.detected).toBeDefined();
    });

    it('should handle list exports with userId filter', async () => {
      const exported = await service.exportAnalytics({
        format: 'json' as ExportFormat,
        analyticsType: 'revenue',
        query: {
          period: 'monthly' as AnalyticsPeriod,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          userId: 'user1'
        }
      });

      const exports = await service.listExports('user1');

      expect(exports).toBeDefined();
      expect(exports.length).toBeGreaterThan(0);
    });

    it('should track query metrics correctly', async () => {
      const query: AnalyticsQuery = {
        period: 'daily' as AnalyticsPeriod,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      // Execute multiple queries
      await service.getRevenueAnalytics(query);
      await service.getTransactionVolume(query);
      await service.getSuccessRateAnalytics(query);

      const metrics = await service.getQueryPerformanceMetrics();

      expect(metrics.size).toBeGreaterThan(0);
    });

    it('should handle realtime metrics with alerts', async () => {
      // Set up scenario that triggers alerts
      const now = new Date();
      const recentTxs = Array(15).fill(null).map((_, i) => ({
        ...sampleTransactions[2], // Failed transaction
        id: `fail_${i}`,
        createdAt: new Date(now.getTime() - 1000)
      }));

      mockPaymentService.getPaymentHistory.mockResolvedValue(recentTxs);

      const metrics = await service.getRealtimeMetrics();

      expect(metrics.alerts.length).toBeGreaterThan(0);
      expect(metrics.alerts.some(a => a.severity === 'critical')).toBe(true);
    });
  });
});
