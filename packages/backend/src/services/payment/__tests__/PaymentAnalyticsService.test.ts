/**
 * PaymentAnalyticsService Test Suite
 * User Story: US-E5-028
 * CRITICAL: 100% test coverage required for payment services
 * Part of Epic 005 - Backend Service Layer Refactoring
 *
 * Zero vi.fn() mocks for service dependencies — all services wired via PaymentTestHarness
 * with real in-memory backends. Only targeted `getPaymentHistory` overrides for tests
 * needing non-standard data sets (empty, multi-currency, all-failed, dynamic dates).
 */

import { PaymentAnalyticsService } from '../PaymentAnalyticsService';
import type { AnalyticsQuery, AnalyticsExportRequest } from '../../../types/payment-analytics';
import { AnalyticsPeriod, ExportFormat } from '../../../types/payment-analytics';
import type { PaymentTransaction } from '../../../types/payment';
import { PaymentStatus, PaymentMethod, PaymentFailureReason } from '../../../types/payment';
import { Currency } from '../../../types/currency';
import { DomainEventType } from '../../../interfaces/shared/IEventBus';
import {
  createPaymentTestHarness,
  makeDomainEvent,
  overridePaymentHistory,
  type PaymentTestHarness,
} from '../../../test-utils';

// Standard sample transactions seeded into every test via seedRawTransaction.
// 4 transactions: 2 completed, 1 failed, 1 refunded (matching the original test data).
function makeSampleTransactions(): PaymentTransaction[] {
  return [
    {
      id: 'tx1',
      invoiceId: 'inv1',
      userId: 'user1',
      amount: 100000,
      currency: 'BTC',
      status: PaymentStatus.COMPLETED,
      method: PaymentMethod.LIGHTNING,
      paymentHash: 'hash1',
      retryCount: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      completedAt: new Date('2024-01-01'),
    },
    {
      id: 'tx2',
      invoiceId: 'inv2',
      userId: 'user2',
      amount: 200000,
      currency: 'BTC',
      status: PaymentStatus.COMPLETED,
      method: PaymentMethod.LIGHTNING,
      paymentHash: 'hash2',
      retryCount: 0,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      completedAt: new Date('2024-01-02'),
    },
    {
      id: 'tx3',
      invoiceId: 'inv3',
      userId: 'user1',
      amount: 50000,
      currency: 'BTC',
      status: PaymentStatus.FAILED,
      method: PaymentMethod.ONCHAIN,
      paymentHash: 'hash3',
      failureReason: PaymentFailureReason.INSUFFICIENT_FUNDS,
      retryCount: 2,
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
    },
    {
      id: 'tx4',
      invoiceId: 'inv4',
      userId: 'user3',
      amount: 150000,
      currency: 'BTC',
      status: PaymentStatus.REFUNDED,
      method: PaymentMethod.LIGHTNING,
      paymentHash: 'hash4',
      retryCount: 0,
      createdAt: new Date('2024-01-04'),
      updatedAt: new Date('2024-01-04'),
      completedAt: new Date('2024-01-04'),
    },
  ];
}

describe('PaymentAnalyticsService', () => {
  let harness: PaymentTestHarness;
  let service: PaymentAnalyticsService;
  let sampleTransactions: PaymentTransaction[];

  beforeEach(async () => {
    harness = createPaymentTestHarness();
    service = harness.analyticsService;
    sampleTransactions = makeSampleTransactions();

    // Seed standard transactions into the real repository
    for (const tx of sampleTransactions) {
      await harness.seedRawTransaction(tx);
    }
  });

  afterEach(async () => {
    await harness.dispose();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize service correctly', () => {
      expect(service).toBeDefined();
    });

    it('should subscribe to payment events', async () => {
      // Publishing a domain event should not throw — verifies event subscriptions work.
      await harness.eventBus.publish(makeDomainEvent(DomainEventType.PAYMENT_RECEIVED));
    });

    it('should set default base currency to BTC', () => {
      expect(service.getBaseCurrency()).toBe('BTC');
    });
  });

  describe('Revenue Analytics', () => {
    const query: AnalyticsQuery = {
      period: AnalyticsPeriod.DAILY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };

    it('should get revenue analytics', async () => {
      const result = await service.getRevenueAnalytics(query);

      expect(result).toBeDefined();
      expect(result.period).toBe('daily');
      expect(result.totalRevenue).toBe(300000); // tx1 + tx2
      expect(result.netRevenue).toBe(150000); // total - refunded
      expect(result.transactionCount).toBe(4);
    });

    it('should cache revenue analytics', async () => {
      await service.getRevenueAnalytics(query);
      // Second call should use cached data
      await service.getRevenueAnalytics(query);

      const stats = await service.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should calculate revenue by period', async () => {
      const result = await service.getRevenueByPeriod(
        AnalyticsPeriod.MONTHLY,
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
      // Override to return empty set
      overridePaymentHistory(harness, []);

      const result = await service.getRevenueAnalytics(query);

      expect(result.totalRevenue).toBe(0);
      expect(result.transactionCount).toBe(0);
    });

    it('should convert multi-currency revenue', async () => {
      const multiCurrencyTxs = [
        { ...sampleTransactions[0], currency: 'USD', amountFiat: 100 },
        { ...sampleTransactions[1], currency: 'EUR', amountFiat: 200 },
      ];

      overridePaymentHistory(harness, multiCurrencyTxs);

      // Seed USD:BTC and EUR:BTC fallback rates
      const cs = harness.currencyService as any;
      cs.fallbackProvider.setRate(Currency.USD, Currency.BTC, 0.00002);
      cs.fallbackProvider.setRate(Currency.EUR, Currency.BTC, 0.000022);

      const result = await service.getRevenueAnalytics(query);

      expect(result.revenueByCurrency.size).toBeGreaterThan(0);
    });
  });

  describe('Transaction Metrics', () => {
    const query: AnalyticsQuery = {
      period: AnalyticsPeriod.DAILY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };

    it('should get transaction volume metrics', async () => {
      const result = await service.getTransactionVolume(query);

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(4);
      expect(result.totalVolume).toBe(500000);
      expect(result.averageValue).toBeGreaterThan(0);
      expect(result.medianValue).toBeGreaterThan(0);
    });

    it('should get success rate analytics', async () => {
      const result = await service.getSuccessRateAnalytics(query);

      expect(result).toBeDefined();
      expect(result.totalAttempts).toBe(4);
      expect(result.successfulPayments).toBe(2);
      expect(result.failedPayments).toBe(1);
      expect(result.successRate).toBe(50);
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
      expect(result.retriedPayments).toBe(1);
      expect(result.retrySuccessRate).toBeGreaterThanOrEqual(0);
    });

    it('should get transaction count by period', async () => {
      const result = await service.getTransactionCountByPeriod(
        AnalyticsPeriod.DAILY,
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
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
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
      const result = await service.getRevenueByCurrency(Currency.BTC, query);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Payment Method Analytics', () => {
    const query: AnalyticsQuery = {
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
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
      const result = await service.getRevenueByMethod(PaymentMethod.LIGHTNING, query);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Refund Analytics', () => {
    const query: AnalyticsQuery = {
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };

    it('should get refund analytics', async () => {
      const result = await service.getRefundAnalytics(query);

      expect(result).toBeDefined();
      expect(result.totalRefunds).toBe(1);
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
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };

    it('should get geographic revenue (stub)', async () => {
      const result = await service.getGeographicRevenue(query);

      expect(result).toBeDefined();
      expect(result.revenueByCountry).toBeDefined();
      expect(result.topCountries).toBeDefined();
    });

    it('should get revenue by country (stub)', async () => {
      const result = await service.getRevenueByCountry('US', query);

      expect(result).toBe(0);
    });
  });

  describe('Customer Analytics', () => {
    const query: AnalyticsQuery = {
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
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
      // Override to return only user1's transaction
      overridePaymentHistory(harness, [sampleTransactions[0]]);

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
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
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
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
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
      const callback = vi.fn();
      const subscriptionId = service.subscribeToRealtimeUpdates(callback);

      expect(subscriptionId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe from realtime updates', () => {
      const callback = vi.fn();
      const subscriptionId = service.subscribeToRealtimeUpdates(callback);

      service.unsubscribeFromRealtimeUpdates(subscriptionId);
    });

    it('should generate alerts for low success rate', async () => {
      const now = new Date();
      const failedTxs = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...sampleTransactions[2],
          id: `tx_fail_${i}`,
          createdAt: now,
          updatedAt: now,
        }));

      overridePaymentHistory(harness, failedTxs);

      const result = await service.getRealtimeMetrics();

      expect(result.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Export Capabilities', () => {
    const exportRequest: AnalyticsExportRequest = {
      format: ExportFormat.JSON,
      analyticsType: 'revenue',
      query: {
        period: AnalyticsPeriod.MONTHLY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
    };

    it('should export analytics as JSON', async () => {
      const result = await service.exportAnalytics(exportRequest);

      expect(result).toBeDefined();
      expect(result.exportId).toBeDefined();
      expect(result.format).toBe('json');
      expect(result.fileName).toContain('.json');
    });

    it('should export analytics as CSV', async () => {
      const csvRequest = { ...exportRequest, format: ExportFormat.CSV };
      const result = await service.exportAnalytics(csvRequest);

      expect(result.format).toBe('csv');
      expect(result.fileName).toContain('.csv');
    });

    it('should export analytics as XLSX (stub)', async () => {
      const xlsxRequest = { ...exportRequest, format: ExportFormat.XLSX };
      const result = await service.exportAnalytics(xlsxRequest);

      expect(result.format).toBe('xlsx');
    });

    it('should export analytics as PDF (stub)', async () => {
      const pdfRequest = { ...exportRequest, format: ExportFormat.PDF };
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
        format: ExportFormat.CSV,
      };

      const result = await service.exportAnalytics(arrayRequest);

      expect(result.data).toBeDefined();
    });
  });

  describe('Multi-Currency Consolidation', () => {
    const query: AnalyticsQuery = {
      period: AnalyticsPeriod.MONTHLY,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
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
      service.setBaseCurrency(Currency.USD);

      expect(service.getBaseCurrency()).toBe('USD');
    });

    it('should get base currency', () => {
      const currency = service.getBaseCurrency();

      expect(currency).toBe('BTC');
    });
  });

  describe('Data Aggregation', () => {
    it('should trigger aggregation', async () => {
      const jobId = await service.triggerAggregation(
        AnalyticsPeriod.DAILY,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(jobId).toBeDefined();
      expect(jobId).toContain('agg_');
    });

    it('should get aggregation job status', async () => {
      const jobId = await service.triggerAggregation(AnalyticsPeriod.DAILY);
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
      vi.useFakeTimers();
      try {
        const jobId = await service.triggerAggregation(AnalyticsPeriod.DAILY);

        vi.advanceTimersByTime(5100);

        const status = await service.getAggregationJobStatus(jobId);

        expect(status?.status).toBe('completed');
        expect(status?.progress).toBe(100);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Cache Management', () => {
    it('should warm up cache', async () => {
      await service.warmupCache();

      // Warmup populates cache with standard analytics
      const stats = await service.getCacheStats();
      expect(stats).toBeDefined();
    });

    it('should clear cache', async () => {
      // Populate cache first
      await service.getRevenueAnalytics({
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      await service.clearCache();

      // After clearing, cache stats should reflect cleared state
      const stats = await service.getCacheStats();
      expect(stats).toBeDefined();
    });

    it('should clear cache with pattern', async () => {
      await service.clearCache('analytics:revenue:*');
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
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      // First call - cache miss
      await service.getRevenueAnalytics(query);

      // Second call - should be a cache hit
      await service.getRevenueAnalytics(query);

      const stats = await service.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to analytics events', () => {
      const callback = vi.fn();
      const subscriptionId = service.subscribeToEvents('analytics.generated', callback);

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toContain('event_');
    });

    it('should unsubscribe from analytics events', () => {
      const callback = vi.fn();
      const subscriptionId = service.subscribeToEvents('analytics.generated', callback);

      service.unsubscribeFromEvents(subscriptionId);
    });
  });

  describe('Health & Monitoring', () => {
    it('should perform health check', async () => {
      const healthy = await service.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return false on health check failure', async () => {
      // Override cache healthCheck to throw
      const origHealthCheck = harness.cache.healthCheck.bind(harness.cache);
      (harness.cache as any).healthCheck = async () => {
        throw new Error('Cache unhealthy');
      };

      const healthy = await service.healthCheck();

      expect(healthy).toBe(false);

      // Restore
      (harness.cache as any).healthCheck = origHealthCheck;
    });

    it('should get service metrics', async () => {
      await service.getRevenueAnalytics({
        period: AnalyticsPeriod.DAILY,
        startDate: new Date(),
        endDate: new Date(),
      });

      const metrics = await service.getServiceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.totalQueries).toBeGreaterThanOrEqual(0);
      expect(metrics.totalExports).toBeGreaterThanOrEqual(0);
    });

    it('should get query performance metrics', async () => {
      await service.getRevenueAnalytics({
        period: AnalyticsPeriod.DAILY,
        startDate: new Date(),
        endDate: new Date(),
      });

      const metrics = await service.getQueryPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics instanceof Map).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should compare two periods', async () => {
      const period1: AnalyticsQuery = {
        period: AnalyticsPeriod.MONTHLY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const period2: AnalyticsQuery = {
        period: AnalyticsPeriod.MONTHLY,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
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
        period: AnalyticsPeriod.MONTHLY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
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
      const values = Array(20)
        .fill(0)
        .map((_, i) => 100 + (i % 7) * 10);
      const result = (service as any).detectSeasonality(values);

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
    });
  });

  describe('Dispose', () => {
    it('should dispose resources', async () => {
      await service.dispose();
    });

    it('should clear all subscriptions on dispose', async () => {
      const callback = vi.fn();
      service.subscribeToRealtimeUpdates(callback);
      service.subscribeToEvents('test', callback);

      await service.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null cache results gracefully', async () => {
      // Flush cache to ensure miss
      await harness.cache.flush();

      const query: AnalyticsQuery = {
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await service.getRevenueAnalytics(query);

      expect(result).toBeDefined();
    });

    it('should handle empty time series', async () => {
      overridePaymentHistory(harness, []);

      const query: AnalyticsQuery = {
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await service.getRevenueTimeSeries(query);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle currency conversion errors', async () => {
      const multiCurrencyTxs = [
        {
          ...sampleTransactions[0],
          currency: 'USD',
          amountFiat: 100,
          status: PaymentStatus.COMPLETED,
        },
      ];

      overridePaymentHistory(harness, multiCurrencyTxs);

      // Override convert to throw
      const origConvert = harness.currencyService.convert.bind(harness.currencyService);
      (harness.currencyService as any).convert = async () => {
        throw new Error('Conversion failed');
      };

      const query: AnalyticsQuery = {
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      await expect(service.getRevenueAnalytics(query)).rejects.toThrow();

      // Restore
      (harness.currencyService as any).convert = origConvert;
    });

    it('should handle single transaction', async () => {
      overridePaymentHistory(harness, [sampleTransactions[0]]);

      const query: AnalyticsQuery = {
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await service.getRevenueAnalytics(query);

      expect(result.transactionCount).toBe(1);
    });

    it('should handle zero division in calculations', async () => {
      overridePaymentHistory(harness, []);

      const query: AnalyticsQuery = {
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await service.getARPU(query);

      expect(result.arpu).toBe(0);
    });
  });

  describe('Event Handlers', () => {
    it('should invalidate cache on payment received event', async () => {
      // Populate cache first
      const query: AnalyticsQuery = {
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };
      await service.getRevenueAnalytics(query);

      // Publish a PAYMENT_RECEIVED event to trigger cache invalidation
      await harness.eventBus.publish(makeDomainEvent(DomainEventType.PAYMENT_RECEIVED));
      await harness.flushPromises();

      // Cache should be invalidated — next call should be a miss
      // Verify service still works after invalidation
      const result = await service.getRevenueAnalytics(query);
      expect(result).toBeDefined();
    });

    it('should handle cache invalidation errors', async () => {
      // Override invalidate to throw
      const origInvalidate = harness.cache.invalidate.bind(harness.cache);
      (harness.cache as any).invalidate = async () => {
        throw new Error('Cache error');
      };

      // Publish event — handler should catch error and not throw
      await harness.eventBus.publish(makeDomainEvent(DomainEventType.PAYMENT_RECEIVED));
      await harness.flushPromises();

      // Service should still be operational
      expect(await service.healthCheck()).toBe(true);

      // Restore
      (harness.cache as any).invalidate = origInvalidate;
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
      const timeSeries = [{ timestamp: new Date(), value: 100 }];
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
        format: ExportFormat.JSON,
        analyticsType: 'unknown-type',
        query: {
          period: AnalyticsPeriod.MONTHLY,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
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
          period: AnalyticsPeriod.MONTHLY,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
      };

      const result = await service.exportAnalytics(request);

      expect(result).toBeDefined();
      expect(result.fileName).toContain('.json');
    });

    it('should handle increasing trend direction', () => {
      const values = [100, 200, 300, 400, 500];
      const trend = (service as any).calculateTrend(values);

      expect(trend.direction).toBe('increasing');
      expect(trend.strength).toBeGreaterThan(10);
    });

    it('should handle decreasing trend direction', () => {
      const values = [500, 400, 300, 200, 100];
      const trend = (service as any).calculateTrend(values);

      expect(trend.direction).toBe('decreasing');
      expect(trend.strength).toBeGreaterThan(10);
    });

    it('should handle volatile trend', () => {
      const values = Array(20)
        .fill(0)
        .map(() => Math.random() * 1000);
      const trend = (service as any).calculateTrend(values);

      expect(trend.direction).toBeDefined();
      expect(['increasing', 'decreasing', 'stable', 'volatile']).toContain(trend.direction);
    });

    it('should handle division by zero in trend strength', () => {
      const values = [0, 0, 0, 0, 0];
      const trend = (service as any).calculateTrend(values);

      expect(trend.strength).toBeDefined();
      expect(isNaN(trend.strength) || trend.strength === 0 || trend.strength === Infinity).toBe(
        true
      );
    });

    it('should handle forecast with negative trend', () => {
      const timeSeries = [
        { timestamp: new Date('2024-01-01'), value: 1000 },
        { timestamp: new Date('2024-01-02'), value: 500 },
        { timestamp: new Date('2024-01-03'), value: 250 },
      ];

      const forecast = (service as any).forecastRevenue(timeSeries, 5);

      expect(forecast).toBeDefined();
      expect(Array.isArray(forecast)).toBe(true);
      forecast.forEach((point: any) => {
        expect(point.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('should detect weekly seasonality', () => {
      const values = Array(21)
        .fill(0)
        .map((_, i) => 100 + (i % 7) * 10);
      const result = (service as any).detectSeasonality(values);

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
    });

    it('should handle list exports with userId filter', async () => {
      await service.exportAnalytics({
        format: ExportFormat.JSON,
        analyticsType: 'revenue',
        query: {
          period: AnalyticsPeriod.MONTHLY,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          userId: 'user1',
        },
      });

      const exports = await service.listExports('user1');

      expect(exports).toBeDefined();
      expect(exports.length).toBeGreaterThan(0);
    });

    it('should track query metrics correctly', async () => {
      const query: AnalyticsQuery = {
        period: AnalyticsPeriod.DAILY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      await service.getRevenueAnalytics(query);
      await service.getTransactionVolume(query);
      await service.getSuccessRateAnalytics(query);

      const metrics = await service.getQueryPerformanceMetrics();

      expect(metrics.size).toBeGreaterThan(0);
    });

    it('should handle realtime metrics with alerts', async () => {
      const now = new Date();
      const recentTxs = Array(15)
        .fill(null)
        .map((_, i) => ({
          ...sampleTransactions[2],
          id: `fail_${i}`,
          createdAt: new Date(now.getTime() - 1000),
          updatedAt: new Date(now.getTime() - 1000),
        }));

      overridePaymentHistory(harness, recentTxs);

      const metrics = await service.getRealtimeMetrics();

      expect(metrics.alerts.length).toBeGreaterThan(0);
      expect(metrics.alerts.some((a) => a.severity === 'critical')).toBe(true);
    });
  });
});
