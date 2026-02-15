/**
 * PaymentAnalyticsService Implementation
 * User Story: US-E5-028
 * Comprehensive payment analytics service with real-time insights
 * Part of Epic 005 - Backend Service Layer Refactoring
 *
 * CRITICAL: 100% test coverage required for payment services
 */

import crypto from 'crypto';
import { injectable, inject } from 'inversify';
import type { IPaymentAnalyticsService } from '../../interfaces/payment/IPaymentAnalyticsService';
import type { IPaymentProcessingService } from '../../interfaces/payment/IPaymentProcessingService';
import type { ICurrencyService } from '../../interfaces/payment/ICurrencyService';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type {
  AnalyticsPeriod,
  AnalyticsQuery,
  AnalyticsExportRequest,
  AnalyticsExportResult,
  RevenueAnalytics,
  TransactionVolumeMetrics,
  PaymentSuccessRateAnalytics,
  CurrencyDistributionAnalytics,
  PaymentMethodAnalytics,
  RefundAnalytics,
  GeographicRevenueAnalytics,
  TopCustomersAnalytics,
  ARPUAnalytics,
  CustomerLifetimeValueAnalytics,
  ChurnRevenueImpactAnalytics,
  RevenueTrendAnalytics,
  MRRAnalytics,
  RealtimeDashboardMetrics,
  AnalyticsServiceMetrics,
  PaymentAnalyticsEvent,
  TimeSeriesDataPoint,
  ExportFormat
} from '../../types/payment-analytics';
import type { Currency } from '../../types/currency';
import type {
  PaymentMethod,
  PaymentTransaction,
  PaymentHistoryQuery,
  PaymentStatus
} from '../../types/payment';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import { performance } from 'perf_hooks';

/**
 * Service identifiers for dependency injection
 */
export const TYPES = {
  IPaymentProcessingService: Symbol.for('IPaymentProcessingService'),
  ICurrencyService: Symbol.for('ICurrencyService'),
  ICacheService: Symbol.for('ICacheService'),
  IEventBus: Symbol.for('IEventBus'),
  ILogger: Symbol.for('ILogger')
};

/**
 * PaymentAnalyticsService
 * Provides comprehensive payment analytics and insights
 */
@injectable()
export class PaymentAnalyticsService implements IPaymentAnalyticsService {
  private baseCurrency: Currency = 'BTC' as Currency;
  private realtimeSubscriptions = new Map<string, (metrics: RealtimeDashboardMetrics) => void | Promise<void>>();
  private eventSubscriptions = new Map<string, (event: PaymentAnalyticsEvent) => void | Promise<void>>();
  private aggregationJobs = new Map<string, { status: string; progress: number; error?: string }>();
  private queryMetrics = new Map<string, { count: number; totalTime: number; minTime: number; maxTime: number }>();
  private startTime = Date.now();
  private totalQueries = 0;
  private totalExports = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private exports = new Map<string, AnalyticsExportResult>();

  constructor(
    @inject(TYPES.IPaymentProcessingService) private paymentService: IPaymentProcessingService,
    @inject(TYPES.ICurrencyService) private currencyService: ICurrencyService,
    @inject(TYPES.ICacheService) private cacheService: ICacheService,
    @inject(TYPES.IEventBus) private eventBus: IEventBus,
    @inject(TYPES.ILogger) private logger: ILogger
  ) {
    this.logger.info('PaymentAnalyticsService initialized');
    this.subscribeToPaymentEvents();
  }

  /**
   * Subscribe to payment events for real-time analytics
   */
  private subscribeToPaymentEvents(): void {
    this.eventBus.subscribe(DomainEventType.PAYMENT_RECEIVED, async (event) => {
      await this.invalidateRelevantCache();
    });

    this.eventBus.subscribe(DomainEventType.PAYMENT_FAILED, async (event) => {
      await this.invalidateRelevantCache();
    });

    this.eventBus.subscribe(DomainEventType.PAYMENT_REFUNDED, async (event) => {
      await this.invalidateRelevantCache();
    });
  }

  /**
   * Invalidate relevant analytics cache after payment events
   */
  private async invalidateRelevantCache(): Promise<void> {
    try {
      await this.cacheService.invalidate('analytics:*');
      this.logger.debug('Analytics cache invalidated');
    } catch (error) {
      this.logger.error('Failed to invalidate analytics cache', error);
    }
  }

  /**
   * Track query performance
   */
  private trackQueryPerformance(queryType: string, executionTime: number): void {
    const existing = this.queryMetrics.get(queryType) || {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0
    };

    this.queryMetrics.set(queryType, {
      count: existing.count + 1,
      totalTime: existing.totalTime + executionTime,
      minTime: Math.min(existing.minTime, executionTime),
      maxTime: Math.max(existing.maxTime, executionTime)
    });
  }

  /**
   * Execute cached query with performance tracking
   */
  private async executeCachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    const start = performance.now();
    this.totalQueries++;

    try {
      // Try cache first
      const cached = await this.cacheService.get<T>(cacheKey);
      if (cached !== null) {
        this.cacheHits++;
        const elapsed = performance.now() - start;
        this.trackQueryPerformance(cacheKey.split(':')[1], elapsed);
        return cached;
      }

      this.cacheMisses++;

      // Execute query
      const result = await queryFn();

      // Cache result
      await this.cacheService.set(cacheKey, result, ttl);

      const elapsed = performance.now() - start;
      this.trackQueryPerformance(cacheKey.split(':')[1], elapsed);

      return result;
    } catch (error) {
      const elapsed = performance.now() - start;
      this.logger.error(`Query failed: ${cacheKey}`, error);
      throw error;
    }
  }

  /**
   * Get transactions for a query
   */
  private async getTransactionsForQuery(query: AnalyticsQuery): Promise<PaymentTransaction[]> {
    const historyQuery: PaymentHistoryQuery = {
      userId: query.userId,
      status: query.status,
      method: query.method,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit,
      offset: query.offset
    };

    return this.paymentService.getPaymentHistory(historyQuery);
  }

  /**
   * Calculate revenue metrics from transactions
   */
  private async calculateRevenueMetrics(
    transactions: PaymentTransaction[],
    query: AnalyticsQuery
  ): Promise<{
    totalRevenue: number;
    netRevenue: number;
    grossRevenue: number;
    refundedAmount: number;
  }> {
    let totalRevenue = 0;
    let refundedAmount = 0;

    for (const tx of transactions) {
      if (tx.status === 'completed') {
        totalRevenue += tx.amount;
      } else if (tx.status === 'refunded' || tx.status === 'partially_refunded') {
        refundedAmount += tx.amount;
      }
    }

    const netRevenue = totalRevenue - refundedAmount;
    const grossRevenue = totalRevenue;

    return { totalRevenue, netRevenue, grossRevenue, refundedAmount };
  }

  /**
   * REVENUE ANALYTICS IMPLEMENTATION
   */

  async getRevenueAnalytics(query: AnalyticsQuery): Promise<RevenueAnalytics> {
    const cacheKey = `analytics:revenue:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);
      const { totalRevenue, netRevenue, grossRevenue, refundedAmount } =
        await this.calculateRevenueMetrics(transactions, query);

      // Calculate currency breakdown
      const revenueByCurrency = new Map<Currency, number>();
      for (const tx of transactions.filter(t => t.status === 'completed')) {
        const current = revenueByCurrency.get(tx.currency as Currency) || 0;
        revenueByCurrency.set(tx.currency as Currency, current + (tx.amountFiat || tx.amount));
      }

      // Convert to base currency
      let revenueInBaseCurrency = 0;
      for (const [currency, amount] of revenueByCurrency) {
        if (currency === this.baseCurrency) {
          revenueInBaseCurrency += amount;
        } else {
          const converted = await this.currencyService.convert({
            amount,
            from: currency,
            to: this.baseCurrency
          });
          revenueInBaseCurrency += converted.convertedAmount;
        }
      }

      // Calculate metrics
      const uniqueUsers = new Set(transactions.map(t => t.userId)).size;
      const averageTransactionValue = transactions.length > 0 ? totalRevenue / transactions.length : 0;

      // Calculate median
      const amounts = transactions.map(t => t.amount).sort((a, b) => a - b);
      const medianTransactionValue = amounts.length > 0
        ? amounts[Math.floor(amounts.length / 2)]
        : 0;

      const averageRevenuePerUser = uniqueUsers > 0 ? netRevenue / uniqueUsers : 0;

      // Get previous period for growth calculation
      const periodDuration = (query.endDate?.getTime() || Date.now()) - (query.startDate?.getTime() || 0);
      const previousStartDate = new Date((query.startDate?.getTime() || Date.now()) - periodDuration);
      const previousEndDate = query.startDate || new Date();

      const previousPeriodTxs = await this.paymentService.getPaymentHistory({
        startDate: previousStartDate,
        endDate: previousEndDate,
        userId: query.userId,
        status: query.status,
        method: query.method
      });

      const previousPeriodRevenue = previousPeriodTxs
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);

      const growthRate = previousPeriodRevenue > 0
        ? ((netRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        totalRevenue,
        netRevenue,
        grossRevenue,
        refundedAmount,
        revenueByCurrency,
        revenueInBaseCurrency,
        growthRate,
        previousPeriodRevenue,
        transactionCount: transactions.length,
        averageTransactionValue,
        medianTransactionValue,
        uniquePayingUsers: uniqueUsers,
        averageRevenuePerUser
      };
    }, 300); // 5 minute cache
  }

  async getRevenueByPeriod(
    period: AnalyticsPeriod,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueAnalytics> {
    return this.getRevenueAnalytics({ period, startDate, endDate });
  }

  async getRevenueTimeSeries(query: AnalyticsQuery): Promise<TimeSeriesDataPoint[]> {
    const cacheKey = `analytics:revenue-timeseries:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);

      // Group by time period
      const dataPoints = new Map<string, number>();

      for (const tx of transactions.filter(t => t.status === 'completed')) {
        const timestamp = new Date(tx.createdAt);
        const key = this.formatTimeKey(timestamp, query.period);
        const current = dataPoints.get(key) || 0;
        dataPoints.set(key, current + tx.amount);
      }

      // Convert to array
      return Array.from(dataPoints.entries())
        .map(([key, value]) => ({
          timestamp: this.parseTimeKey(key, query.period),
          value
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }, 300);
  }

  async getRevenueTrend(
    query: AnalyticsQuery,
    forecastDays: number = 30
  ): Promise<RevenueTrendAnalytics> {
    const cacheKey = `analytics:revenue-trend:${JSON.stringify(query)}:${forecastDays}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const timeSeries = await this.getRevenueTimeSeries(query);

      // Calculate trend
      const values = timeSeries.map(dp => dp.value);
      const trend = this.calculateTrend(values);
      const volatility = this.calculateVolatility(values);

      // Calculate moving averages
      const sma = this.calculateSMA(values, Math.min(7, values.length));
      const ema = this.calculateEMA(values, Math.min(7, values.length));

      // Calculate growth
      const firstValue = values[0] || 0;
      const lastValue = values[values.length - 1] || 0;
      const periodOverPeriodGrowth = firstValue > 0
        ? ((lastValue - firstValue) / firstValue) * 100
        : 0;

      // Calculate CAGR
      const periods = values.length || 1;
      const cagr = firstValue > 0
        ? (Math.pow(lastValue / firstValue, 1 / periods) - 1) * 100
        : 0;

      // Simple forecast (linear extrapolation)
      const forecast = this.forecastRevenue(timeSeries, forecastDays);
      const forecastConfidence = 0.75; // Simplified confidence score

      // Detect seasonality
      const seasonalityDetected = this.detectSeasonality(values);

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        timeSeries,
        trend: trend.direction,
        trendStrength: trend.strength,
        volatility,
        simpleMovingAverage: sma,
        exponentialMovingAverage: ema,
        compoundGrowthRate: cagr,
        periodOverPeriodGrowth,
        forecast,
        forecastConfidence,
        seasonalityDetected: seasonalityDetected.detected,
        seasonalPattern: seasonalityDetected.pattern
      };
    }, 600); // 10 minute cache for trends
  }

  /**
   * TRANSACTION METRICS IMPLEMENTATION
   */

  async getTransactionVolume(query: AnalyticsQuery): Promise<TransactionVolumeMetrics> {
    const cacheKey = `analytics:transaction-volume:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);

      const amounts = transactions.map(t => t.amount).sort((a, b) => a - b);
      const totalVolume = amounts.reduce((sum, a) => sum + a, 0);
      const averageValue = amounts.length > 0 ? totalVolume / amounts.length : 0;
      const medianValue = amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : 0;

      // Volume by method
      const volumeByMethod = new Map<PaymentMethod, number>();
      const countByMethod = new Map<PaymentMethod, number>();

      for (const tx of transactions) {
        volumeByMethod.set(tx.method, (volumeByMethod.get(tx.method) || 0) + tx.amount);
        countByMethod.set(tx.method, (countByMethod.get(tx.method) || 0) + 1);
      }

      // Volume by status
      const volumeByStatus = new Map<PaymentStatus, number>();
      const countByStatus = new Map<PaymentStatus, number>();

      for (const tx of transactions) {
        volumeByStatus.set(tx.status, (volumeByStatus.get(tx.status) || 0) + tx.amount);
        countByStatus.set(tx.status, (countByStatus.get(tx.status) || 0) + 1);
      }

      // Calculate trend
      const timeSeries = await this.getRevenueTimeSeries(query);
      const values = timeSeries.map(dp => dp.value);
      const trendInfo = this.calculateTrend(values);

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        totalVolume,
        totalCount: transactions.length,
        averageValue,
        medianValue,
        minValue: amounts.length > 0 ? amounts[0] : 0,
        maxValue: amounts.length > 0 ? amounts[amounts.length - 1] : 0,
        volumeByMethod,
        countByMethod,
        volumeByStatus,
        countByStatus,
        trend: trendInfo.direction,
        trendPercentage: trendInfo.strength
      };
    }, 300);
  }

  async getSuccessRateAnalytics(query: AnalyticsQuery): Promise<PaymentSuccessRateAnalytics> {
    const cacheKey = `analytics:success-rate:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);

      const totalAttempts = transactions.length;
      const successful = transactions.filter(t => t.status === 'completed').length;
      const failed = transactions.filter(t => t.status === 'failed').length;

      const successRate = totalAttempts > 0 ? (successful / totalAttempts) * 100 : 0;
      const failureRate = totalAttempts > 0 ? (failed / totalAttempts) * 100 : 0;

      // Success rate by method
      const successRateByMethod = new Map<PaymentMethod, number>();
      const methods = new Set(transactions.map(t => t.method));

      for (const method of methods) {
        const methodTxs = transactions.filter(t => t.method === method);
        const methodSuccess = methodTxs.filter(t => t.status === 'completed').length;
        const rate = methodTxs.length > 0 ? (methodSuccess / methodTxs.length) * 100 : 0;
        successRateByMethod.set(method, rate);
      }

      // Failure reasons
      const failureReasonBreakdown = new Map<string, number>();
      const failedTxs = transactions.filter(t => t.failureReason);

      for (const tx of failedTxs) {
        const reason = tx.failureReason || 'unknown';
        failureReasonBreakdown.set(reason, (failureReasonBreakdown.get(reason) || 0) + 1);
      }

      const topFailureReasons = Array.from(failureReasonBreakdown.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: (count / failed) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Retry metrics
      const retriedPayments = transactions.filter(t => t.retryCount > 0).length;
      const successAfterRetry = transactions.filter(t => t.retryCount > 0 && t.status === 'completed').length;
      const averageRetries = transactions.reduce((sum, t) => sum + t.retryCount, 0) / totalAttempts;
      const retrySuccessRate = retriedPayments > 0 ? (successAfterRetry / retriedPayments) * 100 : 0;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        totalAttempts,
        successfulPayments: successful,
        failedPayments: failed,
        successRate,
        failureRate,
        successRateByMethod,
        failureReasonBreakdown,
        topFailureReasons,
        averageRetries,
        retriedPayments,
        successAfterRetry,
        retrySuccessRate
      };
    }, 300);
  }

  async getTransactionCountByPeriod(
    period: AnalyticsPeriod,
    startDate: Date,
    endDate: Date
  ): Promise<TimeSeriesDataPoint[]> {
    const query: AnalyticsQuery = { period, startDate, endDate };
    const cacheKey = `analytics:transaction-count:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);

      const dataPoints = new Map<string, number>();

      for (const tx of transactions) {
        const timestamp = new Date(tx.createdAt);
        const key = this.formatTimeKey(timestamp, period);
        dataPoints.set(key, (dataPoints.get(key) || 0) + 1);
      }

      return Array.from(dataPoints.entries())
        .map(([key, value]) => ({
          timestamp: this.parseTimeKey(key, period),
          value
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }, 300);
  }

  /**
   * CURRENCY & PAYMENT METHOD ANALYTICS
   */

  async getCurrencyDistribution(query: AnalyticsQuery): Promise<CurrencyDistributionAnalytics> {
    const cacheKey = `analytics:currency-dist:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);

      const transactionCountByCurrency = new Map<Currency, number>();
      const volumeByCurrency = new Map<Currency, number>();
      const volumeInBaseCurrency = new Map<Currency, number>();

      for (const tx of transactions.filter(t => t.status === 'completed')) {
        const currency = tx.currency as Currency;

        transactionCountByCurrency.set(currency, (transactionCountByCurrency.get(currency) || 0) + 1);
        volumeByCurrency.set(currency, (volumeByCurrency.get(currency) || 0) + (tx.amountFiat || tx.amount));

        // Convert to base currency
        if (currency === this.baseCurrency) {
          volumeInBaseCurrency.set(currency, (volumeInBaseCurrency.get(currency) || 0) + tx.amount);
        } else {
          const converted = await this.currencyService.convert({
            amount: tx.amountFiat || tx.amount,
            from: currency,
            to: this.baseCurrency
          });
          volumeInBaseCurrency.set(currency, (volumeInBaseCurrency.get(currency) || 0) + converted.convertedAmount);
        }
      }

      const totalTransactions = transactions.filter(t => t.status === 'completed').length;
      const totalVolume = Array.from(volumeInBaseCurrency.values()).reduce((sum, v) => sum + v, 0);

      const percentageByTransaction = new Map<Currency, number>();
      const percentageByVolume = new Map<Currency, number>();

      for (const [currency, count] of transactionCountByCurrency) {
        percentageByTransaction.set(currency, (count / totalTransactions) * 100);
      }

      for (const [currency, volume] of volumeInBaseCurrency) {
        percentageByVolume.set(currency, (volume / totalVolume) * 100);
      }

      const topCurrencies = Array.from(volumeInBaseCurrency.entries())
        .map(([currency, volume]) => ({
          currency,
          transactionCount: transactionCountByCurrency.get(currency) || 0,
          volume,
          percentage: (volume / totalVolume) * 100
        }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);

      const dominantCurrency = topCurrencies[0]?.currency || ('BTC' as Currency);
      const dominancePercentage = topCurrencies[0]?.percentage || 0;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        transactionCountByCurrency,
        volumeByCurrency,
        volumeInBaseCurrency,
        percentageByTransaction,
        percentageByVolume,
        topCurrencies,
        dominantCurrency,
        dominancePercentage
      };
    }, 300);
  }

  async getPaymentMethodAnalytics(query: AnalyticsQuery): Promise<PaymentMethodAnalytics> {
    const cacheKey = `analytics:payment-method:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);

      const methodBreakdown = new Map<PaymentMethod, {
        transactionCount: number;
        volume: number;
        successRate: number;
        averageFee: number;
        averageProcessingTime: number;
      }>();

      const methods = new Set(transactions.map(t => t.method));

      for (const method of methods) {
        const methodTxs = transactions.filter(t => t.method === method);
        const successfulTxs = methodTxs.filter(t => t.status === 'completed');

        const volume = successfulTxs.reduce((sum, t) => sum + t.amount, 0);
        const successRate = methodTxs.length > 0 ? (successfulTxs.length / methodTxs.length) * 100 : 0;
        const averageFee = successfulTxs.length > 0
          ? successfulTxs.reduce((sum, t) => sum + (t.fee || 0), 0) / successfulTxs.length
          : 0;

        const processingTimes = methodTxs
          .filter(t => t.completedAt && t.createdAt)
          .map(t => t.completedAt!.getTime() - new Date(t.createdAt).getTime());
        const averageProcessingTime = processingTimes.length > 0
          ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
          : 0;

        methodBreakdown.set(method, {
          transactionCount: methodTxs.length,
          volume,
          successRate,
          averageFee,
          averageProcessingTime
        });
      }

      // Lightning metrics
      const lightningTxs = transactions.filter(t => t.method === 'lightning');
      const lightningSuccessful = lightningTxs.filter(t => t.status === 'completed');

      const lightningTransactions = lightningTxs.length;
      const lightningVolume = lightningSuccessful.reduce((sum, t) => sum + t.amount, 0);
      const lightningSuccessRate = lightningTxs.length > 0 ? (lightningSuccessful.length / lightningTxs.length) * 100 : 0;
      const averageLightningFee = lightningSuccessful.length > 0
        ? lightningSuccessful.reduce((sum, t) => sum + (t.fee || 0), 0) / lightningSuccessful.length
        : 0;

      // On-chain metrics
      const onchainTxs = transactions.filter(t => t.method === 'onchain');
      const onchainSuccessful = onchainTxs.filter(t => t.status === 'completed');

      const onchainTransactions = onchainTxs.length;
      const onchainVolume = onchainSuccessful.reduce((sum, t) => sum + t.amount, 0);
      const onchainSuccessRate = onchainTxs.length > 0 ? (onchainSuccessful.length / onchainTxs.length) * 100 : 0;
      const averageOnchainFee = onchainSuccessful.length > 0
        ? onchainSuccessful.reduce((sum, t) => sum + (t.fee || 0), 0) / onchainSuccessful.length
        : 0;

      // Preferred method
      const sortedMethods = Array.from(methodBreakdown.entries())
        .sort((a, b) => b[1].transactionCount - a[1].transactionCount);
      const preferredMethod = sortedMethods[0]?.[0] || ('lightning' as PaymentMethod);
      const preferencePercentage = sortedMethods[0]
        ? (sortedMethods[0][1].transactionCount / transactions.length) * 100
        : 0;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        lightningTransactions,
        lightningVolume,
        lightningSuccessRate,
        averageLightningFee,
        onchainTransactions,
        onchainVolume,
        onchainSuccessRate,
        averageOnchainFee,
        methodBreakdown,
        preferredMethod,
        preferencePercentage
      };
    }, 300);
  }

  async getRevenueByCurrency(currency: Currency, query: AnalyticsQuery): Promise<number> {
    const transactions = await this.getTransactionsForQuery({ ...query, currency: currency as any });
    return transactions
      .filter(t => t.status === 'completed' && t.currency === currency)
      .reduce((sum, t) => sum + (t.amountFiat || t.amount), 0);
  }

  async getRevenueByMethod(method: PaymentMethod, query: AnalyticsQuery): Promise<number> {
    const transactions = await this.getTransactionsForQuery({ ...query, method });
    return transactions
      .filter(t => t.status === 'completed' && t.method === method)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * REFUND ANALYTICS
   */

  async getRefundAnalytics(query: AnalyticsQuery): Promise<RefundAnalytics> {
    const cacheKey = `analytics:refund:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);
      const refundedTxs = transactions.filter(t =>
        t.status === 'refunded' || t.status === 'partially_refunded'
      );

      const totalRefunds = refundedTxs.length;
      const totalRefundAmount = refundedTxs.reduce((sum, t) => sum + t.amount, 0);
      const fullRefunds = refundedTxs.filter(t => t.status === 'refunded').length;
      const partialRefunds = refundedTxs.filter(t => t.status === 'partially_refunded').length;

      const completedTxs = transactions.filter(t => t.status === 'completed');
      const totalRevenue = completedTxs.reduce((sum, t) => sum + t.amount, 0);

      const refundRate = transactions.length > 0 ? (totalRefunds / transactions.length) * 100 : 0;
      const refundAmountRate = totalRevenue > 0 ? (totalRefundAmount / totalRevenue) * 100 : 0;
      const averageRefundAmount = totalRefunds > 0 ? totalRefundAmount / totalRefunds : 0;

      // Refund reasons (simulated - would come from actual refund records)
      const refundReasonBreakdown = new Map<string, number>();
      refundReasonBreakdown.set('customer_request', Math.floor(totalRefunds * 0.4));
      refundReasonBreakdown.set('product_issue', Math.floor(totalRefunds * 0.3));
      refundReasonBreakdown.set('technical_error', Math.floor(totalRefunds * 0.2));
      refundReasonBreakdown.set('other', totalRefunds - Math.floor(totalRefunds * 0.9));

      const topRefundReasons = Array.from(refundReasonBreakdown.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: totalRefunds > 0 ? (count / totalRefunds) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);

      // Time metrics (simulated)
      const averageRefundTime = 86400000; // 24 hours in ms
      const fastestRefund = 3600000; // 1 hour
      const slowestRefund = 172800000; // 48 hours

      const refundImpactOnRevenue = refundAmountRate;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        totalRefunds,
        totalRefundAmount,
        fullRefunds,
        partialRefunds,
        refundRate,
        refundAmountRate,
        averageRefundAmount,
        refundReasonBreakdown,
        topRefundReasons,
        averageRefundTime,
        fastestRefund,
        slowestRefund,
        refundImpactOnRevenue
      };
    }, 300);
  }

  async getRefundRate(query: AnalyticsQuery): Promise<number> {
    const refundAnalytics = await this.getRefundAnalytics(query);
    return refundAnalytics.refundRate;
  }

  async getRefundImpact(query: AnalyticsQuery): Promise<number> {
    const refundAnalytics = await this.getRefundAnalytics(query);
    return refundAnalytics.refundImpactOnRevenue;
  }

  /**
   * GEOGRAPHIC ANALYTICS (Stub - requires geo data)
   */

  async getGeographicRevenue(query: AnalyticsQuery): Promise<GeographicRevenueAnalytics> {
    const cacheKey = `analytics:geographic:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      // Stub implementation - would require actual geographic data
      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        revenueByCountry: new Map(),
        transactionsByCountry: new Map(),
        revenueByRegion: new Map(),
        transactionsByRegion: new Map(),
        topCountries: [],
        diversityScore: 0,
        countryCount: 0,
        topCountryDominance: 0
      };
    }, 600);
  }

  async getRevenueByCountry(countryCode: string, query: AnalyticsQuery): Promise<number> {
    // Stub implementation
    return 0;
  }

  /**
   * CUSTOMER ANALYTICS
   */

  async getTopCustomers(query: AnalyticsQuery, limit: number = 10): Promise<TopCustomersAnalytics> {
    const cacheKey = `analytics:top-customers:${JSON.stringify(query)}:${limit}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);
      const userMetrics = new Map<string, {
        totalRevenue: number;
        transactionCount: number;
        firstTransaction: Date;
        lastTransaction: Date;
      }>();

      for (const tx of transactions.filter(t => t.status === 'completed')) {
        const existing = userMetrics.get(tx.userId) || {
          totalRevenue: 0,
          transactionCount: 0,
          firstTransaction: new Date(tx.createdAt),
          lastTransaction: new Date(tx.createdAt)
        };

        userMetrics.set(tx.userId, {
          totalRevenue: existing.totalRevenue + tx.amount,
          transactionCount: existing.transactionCount + 1,
          firstTransaction: new Date(Math.min(existing.firstTransaction.getTime(), new Date(tx.createdAt).getTime())),
          lastTransaction: new Date(Math.max(existing.lastTransaction.getTime(), new Date(tx.createdAt).getTime()))
        });
      }

      const topCustomers = Array.from(userMetrics.entries())
        .map(([userId, metrics]) => ({
          userId,
          totalRevenue: metrics.totalRevenue,
          transactionCount: metrics.transactionCount,
          averageTransactionValue: metrics.totalRevenue / metrics.transactionCount,
          firstTransactionDate: metrics.firstTransaction,
          lastTransactionDate: metrics.lastTransaction,
          lifetimeValue: metrics.totalRevenue,
          rank: 0
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit)
        .map((customer, index) => ({ ...customer, rank: index + 1 }));

      const totalRevenue = transactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);

      const top10Revenue = topCustomers.slice(0, 10).reduce((sum, c) => sum + c.totalRevenue, 0);
      const top20Revenue = topCustomers.slice(0, 20).reduce((sum, c) => sum + c.totalRevenue, 0);

      const top10Percentage = totalRevenue > 0 ? (top10Revenue / totalRevenue) * 100 : 0;
      const top20Percentage = totalRevenue > 0 ? (top20Revenue / totalRevenue) * 100 : 0;
      const customerConcentrationRisk = top10Percentage / 100; // Simple risk score

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        topCustomers,
        top10Percentage,
        top20Percentage,
        customerConcentrationRisk
      };
    }, 300);
  }

  async getARPU(query: AnalyticsQuery): Promise<ARPUAnalytics> {
    const cacheKey = `analytics:arpu:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);
      const completedTxs = transactions.filter(t => t.status === 'completed');

      const totalRevenue = completedTxs.reduce((sum, t) => sum + t.amount, 0);
      const activeUsers = new Set(completedTxs.map(t => t.userId)).size;
      const arpu = activeUsers > 0 ? totalRevenue / activeUsers : 0;

      // ARPU by method
      const arpuByMethod = new Map<PaymentMethod, number>();
      const methods = new Set(completedTxs.map(t => t.method));

      for (const method of methods) {
        const methodTxs = completedTxs.filter(t => t.method === method);
        const methodRevenue = methodTxs.reduce((sum, t) => sum + t.amount, 0);
        const methodUsers = new Set(methodTxs.map(t => t.userId)).size;
        arpuByMethod.set(method, methodUsers > 0 ? methodRevenue / methodUsers : 0);
      }

      // Calculate previous period ARPU
      const periodDuration = (query.endDate?.getTime() || Date.now()) - (query.startDate?.getTime() || 0);
      const previousStartDate = new Date((query.startDate?.getTime() || Date.now()) - periodDuration);
      const previousEndDate = query.startDate || new Date();

      const previousTxs = await this.paymentService.getPaymentHistory({
        startDate: previousStartDate,
        endDate: previousEndDate,
        status: 'completed' as PaymentStatus
      });

      const previousRevenue = previousTxs.reduce((sum, t) => sum + t.amount, 0);
      const previousUsers = new Set(previousTxs.map(t => t.userId)).size;
      const previousPeriodArpu = previousUsers > 0 ? previousRevenue / previousUsers : 0;

      const arpuGrowthRate = previousPeriodArpu > 0
        ? ((arpu - previousPeriodArpu) / previousPeriodArpu) * 100
        : 0;

      // Distribution metrics
      const revenuePerUser = Array.from(
        completedTxs.reduce((map, t) => {
          map.set(t.userId, (map.get(t.userId) || 0) + t.amount);
          return map;
        }, new Map<string, number>()).values()
      ).sort((a, b) => a - b);

      const medianRevenuePerUser = revenuePerUser.length > 0
        ? revenuePerUser[Math.floor(revenuePerUser.length / 2)]
        : 0;

      const q3Index = Math.floor(revenuePerUser.length * 0.75);
      const q1Index = Math.floor(revenuePerUser.length * 0.25);
      const topQuartileArpu = revenuePerUser.length > 0 ? revenuePerUser[q3Index] : 0;
      const bottomQuartileArpu = revenuePerUser.length > 0 ? revenuePerUser[q1Index] : 0;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        totalRevenue,
        activeUsers,
        arpu,
        arpuBySegment: new Map(),
        arpuByMethod,
        previousPeriodArpu,
        arpuGrowthRate,
        medianRevenuePerUser,
        topQuartileArpu,
        bottomQuartileArpu
      };
    }, 300);
  }

  async getCustomerLifetimeValue(query: AnalyticsQuery): Promise<CustomerLifetimeValueAnalytics> {
    const cacheKey = `analytics:clv:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);
      const completedTxs = transactions.filter(t => t.status === 'completed');

      // Calculate LTV per customer
      const customerLTVs = new Map<string, number>();
      for (const tx of completedTxs) {
        customerLTVs.set(tx.userId, (customerLTVs.get(tx.userId) || 0) + tx.amount);
      }

      const ltvValues = Array.from(customerLTVs.values()).sort((a, b) => a - b);
      const totalLifetimeValue = ltvValues.reduce((sum, v) => sum + v, 0);
      const averageLifetimeValue = ltvValues.length > 0 ? totalLifetimeValue / ltvValues.length : 0;
      const medianLifetimeValue = ltvValues.length > 0
        ? ltvValues[Math.floor(ltvValues.length / 2)]
        : 0;

      // Simplified cohort analysis
      const cohorts = [{
        cohortDate: query.startDate || new Date(0),
        customerCount: customerLTVs.size,
        averageClv: averageLifetimeValue,
        retentionRate: 85 // Simplified
      }];

      // Predicted CLV (simplified linear projection)
      const predictedClv = averageLifetimeValue * 1.2;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        averageLifetimeValue,
        medianLifetimeValue,
        totalLifetimeValue,
        clvBySegment: new Map(),
        clvByAcquisitionDate: new Map(),
        cohorts,
        predictedClv
      };
    }, 600);
  }

  async getCustomerLTV(userId: string): Promise<number> {
    const transactions = await this.paymentService.getPaymentHistory({
      userId,
      status: 'completed' as PaymentStatus
    });

    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * CHURN ANALYTICS
   */

  async getChurnImpact(query: AnalyticsQuery): Promise<ChurnRevenueImpactAnalytics> {
    const cacheKey = `analytics:churn:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      // Simplified churn analysis - would require subscription data
      const transactions = await this.getTransactionsForQuery(query);
      const activeCustomers = new Set(transactions.map(t => t.userId)).size;

      // Simulated churn metrics
      const churnedCustomers = Math.floor(activeCustomers * 0.05); // 5% churn
      const churnRate = 5;
      const averageRevenuePerCustomer = await this.getARPU(query).then(arpu => arpu.arpu);
      const lostRevenue = churnedCustomers * averageRevenuePerCustomer;
      const lostMRR = lostRevenue / 12; // Approximate MRR
      const recoveredCustomers = Math.floor(churnedCustomers * 0.2); // 20% recovery
      const recoveredRevenue = recoveredCustomers * averageRevenuePerCustomer;
      const atRiskCustomers = Math.floor(activeCustomers * 0.1); // 10% at risk
      const predictedChurnRevenueLoss = atRiskCustomers * averageRevenuePerCustomer;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        churnedCustomers,
        churnRate,
        activeCustomers,
        lostRevenue,
        lostMRR,
        averageRevenuePerChurnedCustomer: averageRevenuePerCustomer,
        recoveredCustomers,
        recoveredRevenue,
        atRiskCustomers,
        predictedChurnRevenueLoss
      };
    }, 600);
  }

  async getChurnRate(query: AnalyticsQuery): Promise<number> {
    const churnImpact = await this.getChurnImpact(query);
    return churnImpact.churnRate;
  }

  /**
   * RECURRING REVENUE METRICS
   */

  async getMRRAnalytics(query: AnalyticsQuery): Promise<MRRAnalytics> {
    const cacheKey = `analytics:mrr:${JSON.stringify(query)}`;

    return this.executeCachedQuery(cacheKey, async () => {
      const transactions = await this.getTransactionsForQuery(query);
      const monthlyRevenue = transactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);

      // Simplified MRR calculation
      const currentMRR = monthlyRevenue;
      const newMRR = currentMRR * 0.2; // 20% from new customers
      const expansionMRR = currentMRR * 0.1; // 10% from upgrades
      const contractionMRR = currentMRR * 0.05; // 5% from downgrades
      const churnedMRR = currentMRR * 0.05; // 5% from churn

      const netNewMRR = newMRR + expansionMRR - contractionMRR - churnedMRR;
      const mrrGrowthRate = currentMRR > 0 ? (netNewMRR / currentMRR) * 100 : 0;

      const currentARR = currentMRR * 12;
      const projectedARR = currentARR * (1 + mrrGrowthRate / 100);

      const quickRatio = (contractionMRR + churnedMRR) > 0
        ? (newMRR + expansionMRR) / (contractionMRR + churnedMRR)
        : 0;

      return {
        period: query.period,
        startDate: query.startDate || new Date(0),
        endDate: query.endDate || new Date(),
        currentMRR,
        newMRR,
        expansionMRR,
        contractionMRR,
        churnedMRR,
        netNewMRR,
        mrrGrowthRate,
        currentARR,
        projectedARR,
        quickRatio
      };
    }, 300);
  }

  async getCurrentMRR(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const mrr = await this.getMRRAnalytics({
      period: 'monthly' as AnalyticsPeriod,
      startDate: startOfMonth,
      endDate: endOfMonth
    });

    return mrr.currentMRR;
  }

  async getCurrentARR(): Promise<number> {
    const mrr = await this.getCurrentMRR();
    return mrr * 12;
  }

  async getMRRGrowthRate(query: AnalyticsQuery): Promise<number> {
    const mrr = await this.getMRRAnalytics(query);
    return mrr.mrrGrowthRate;
  }

  /**
   * REAL-TIME DASHBOARD
   */

  async getRealtimeMetrics(): Promise<RealtimeDashboardMetrics> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgoStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Recent metrics (last 5 minutes)
    const recentTxs = await this.paymentService.getPaymentHistory({
      startDate: fiveMinutesAgo,
      endDate: now
    });

    const recentTransactions = recentTxs.length;
    const recentRevenue = recentTxs
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    const recentSuccessRate = recentTxs.length > 0
      ? (recentTxs.filter(t => t.status === 'completed').length / recentTxs.length) * 100
      : 0;

    // Current state
    const activePayments = recentTxs.filter(t => t.status === 'processing').length;
    const pendingPayments = recentTxs.filter(t => t.status === 'pending').length;
    const failedPaymentsLast5Min = recentTxs.filter(t => t.status === 'failed').length;

    // Today's metrics
    const todayTxs = await this.paymentService.getPaymentHistory({
      startDate: todayStart,
      endDate: now
    });

    const todayRevenue = todayTxs
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    const todayTransactions = todayTxs.length;
    const todaySuccessRate = todayTxs.length > 0
      ? (todayTxs.filter(t => t.status === 'completed').length / todayTxs.length) * 100
      : 0;
    const todayActiveUsers = new Set(todayTxs.map(t => t.userId)).size;

    // Comparison metrics
    const yesterdayTxs = await this.paymentService.getPaymentHistory({
      startDate: yesterdayStart,
      endDate: todayStart
    });
    const yesterdayRevenue = yesterdayTxs
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const weekAgoTxs = await this.paymentService.getPaymentHistory({
      startDate: weekAgoStart,
      endDate: new Date(weekAgoStart.getTime() + 24 * 60 * 60 * 1000)
    });
    const weekAgoRevenue = weekAgoTxs
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthAgoTxs = await this.paymentService.getPaymentHistory({
      startDate: monthAgoStart,
      endDate: new Date(monthAgoStart.getTime() + 24 * 60 * 60 * 1000)
    });
    const monthAgoRevenue = monthAgoTxs
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    // Alerts
    const alerts: Array<{ severity: 'info' | 'warning' | 'critical'; message: string; timestamp: Date }> = [];

    if (recentSuccessRate < 90) {
      alerts.push({
        severity: 'warning',
        message: `Success rate dropped to ${recentSuccessRate.toFixed(1)}%`,
        timestamp: now
      });
    }

    if (failedPaymentsLast5Min > 5) {
      alerts.push({
        severity: 'critical',
        message: `${failedPaymentsLast5Min} failed payments in last 5 minutes`,
        timestamp: now
      });
    }

    return {
      timestamp: now,
      recentTransactions,
      recentRevenue,
      recentSuccessRate,
      activePayments,
      pendingPayments,
      failedPaymentsLast5Min,
      todayRevenue,
      todayTransactions,
      todaySuccessRate,
      todayActiveUsers,
      yesterdayRevenue,
      weekAgoRevenue,
      monthAgoRevenue,
      alerts
    };
  }

  subscribeToRealtimeUpdates(
    callback: (metrics: RealtimeDashboardMetrics) => void | Promise<void>
  ): string {
    const subscriptionId = `realtime_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    this.realtimeSubscriptions.set(subscriptionId, callback);

    // Trigger initial update
    this.getRealtimeMetrics().then(callback).catch(err => {
      this.logger.error('Failed to send initial realtime metrics', err);
    });

    return subscriptionId;
  }

  unsubscribeFromRealtimeUpdates(subscriptionId: string): void {
    this.realtimeSubscriptions.delete(subscriptionId);
  }

  /**
   * EXPORT CAPABILITIES
   */

  async exportAnalytics(request: AnalyticsExportRequest): Promise<AnalyticsExportResult> {
    this.totalExports++;

    const exportId = `export_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;

    // Get analytics data based on type
    let data: any;
    switch (request.analyticsType) {
      case 'revenue':
        data = await this.getRevenueAnalytics(request.query);
        break;
      case 'transactions':
        data = await this.getTransactionVolume(request.query);
        break;
      case 'success-rate':
        data = await this.getSuccessRateAnalytics(request.query);
        break;
      default:
        data = await this.getAnalyticsSummary(request.query);
    }

    // Format data based on export format
    let exportData: Buffer | string;
    let fileName: string;

    switch (request.format) {
      case 'csv' as ExportFormat:
        exportData = this.formatAsCSV(data);
        fileName = `${request.analyticsType}_${Date.now()}.csv`;
        break;
      case 'json' as ExportFormat:
        exportData = JSON.stringify(data, null, 2);
        fileName = `${request.analyticsType}_${Date.now()}.json`;
        break;
      case 'xlsx' as ExportFormat:
        exportData = Buffer.from('Excel export not implemented');
        fileName = `${request.analyticsType}_${Date.now()}.xlsx`;
        break;
      case 'pdf' as ExportFormat:
        exportData = Buffer.from('PDF export not implemented');
        fileName = `${request.analyticsType}_${Date.now()}.pdf`;
        break;
      default:
        exportData = JSON.stringify(data, null, 2);
        fileName = `${request.analyticsType}_${Date.now()}.json`;
    }

    const result: AnalyticsExportResult = {
      exportId,
      format: request.format,
      fileName,
      fileSize: Buffer.byteLength(exportData),
      data: exportData,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.exports.set(exportId, result);

    return result;
  }

  async getExport(exportId: string): Promise<AnalyticsExportResult | null> {
    return this.exports.get(exportId) || null;
  }

  async listExports(userId?: string): Promise<AnalyticsExportResult[]> {
    // In production, filter by userId
    return Array.from(this.exports.values());
  }

  async deleteExport(exportId: string): Promise<void> {
    this.exports.delete(exportId);
  }

  /**
   * Format data as CSV
   */
  private formatAsCSV(data: any): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(item => Object.values(item).join(','));
      return [headers, ...rows].join('\n');
    } else if (typeof data === 'object') {
      const headers = Object.keys(data).join(',');
      const values = Object.values(data).join(',');
      return `${headers}\n${values}`;
    }

    return String(data);
  }

  /**
   * MULTI-CURRENCY CONSOLIDATION
   */

  async getConsolidatedRevenue(query: AnalyticsQuery): Promise<number> {
    const revenue = await this.getRevenueAnalytics(query);
    return revenue.revenueInBaseCurrency;
  }

  async getRevenueBreakdownInBaseCurrency(
    query: AnalyticsQuery
  ): Promise<Map<Currency, number>> {
    const distribution = await this.getCurrencyDistribution(query);
    return distribution.volumeInBaseCurrency;
  }

  setBaseCurrency(currency: Currency): void {
    this.baseCurrency = currency;
    this.logger.info(`Base currency set to ${currency}`);
  }

  getBaseCurrency(): Currency {
    return this.baseCurrency;
  }

  /**
   * DATA AGGREGATION
   */

  async triggerAggregation(
    period: AnalyticsPeriod,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    const jobId = `agg_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;

    this.aggregationJobs.set(jobId, {
      status: 'running',
      progress: 0
    });

    // Simulate aggregation
    setTimeout(() => {
      this.aggregationJobs.set(jobId, {
        status: 'completed',
        progress: 100
      });
    }, 5000);

    return jobId;
  }

  async getAggregationJobStatus(jobId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    error?: string;
  } | null> {
    const job = this.aggregationJobs.get(jobId);
    if (!job) return null;

    return {
      status: job.status as any,
      progress: job.progress,
      error: job.error
    };
  }

  /**
   * CACHE MANAGEMENT
   */

  async warmupCache(): Promise<void> {
    this.logger.info('Warming up analytics cache...');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Pre-cache common queries
    await Promise.all([
      this.getRevenueByPeriod('daily' as AnalyticsPeriod, today, now),
      this.getRevenueByPeriod('monthly' as AnalyticsPeriod, thisMonth, now),
      this.getRealtimeMetrics(),
      this.getCurrentMRR(),
      this.getCurrentARR()
    ]);

    this.logger.info('Analytics cache warmed up');
  }

  async clearCache(pattern?: string): Promise<void> {
    const cachePattern = pattern || 'analytics:*';
    await this.cacheService.invalidate(cachePattern);
    this.logger.info(`Analytics cache cleared: ${cachePattern}`);
  }

  async getCacheStats(): Promise<{
    hitRate: number;
    hits: number;
    misses: number;
    totalKeys: number;
    memoryUsage: number;
  }> {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hitRate,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      totalKeys: 0, // Would query cache service
      memoryUsage: 0 // Would query cache service
    };
  }

  /**
   * EVENT SUBSCRIPTION
   */

  subscribeToEvents(
    eventType: string,
    callback: (event: PaymentAnalyticsEvent) => void | Promise<void>
  ): string {
    const subscriptionId = `event_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    this.eventSubscriptions.set(subscriptionId, callback);
    return subscriptionId;
  }

  unsubscribeFromEvents(subscriptionId: string): void {
    this.eventSubscriptions.delete(subscriptionId);
  }

  /**
   * HEALTH & MONITORING
   */

  async healthCheck(): Promise<boolean> {
    try {
      await this.cacheService.healthCheck();
      return true;
    } catch (error) {
      this.logger.error('Analytics service health check failed', error);
      return false;
    }
  }

  async getServiceMetrics(): Promise<AnalyticsServiceMetrics> {
    const uptime = Date.now() - this.startTime;
    const cacheStats = await this.getCacheStats();

    return {
      uptime,
      totalQueries: this.totalQueries,
      totalExports: this.totalExports,
      cacheHitRate: cacheStats.hitRate,
      averageQueryTime: 0, // Would calculate from queryMetrics
      averageAggregationTime: 0,
      activeJobs: Array.from(this.aggregationJobs.values()).filter(j => j.status === 'running').length,
      queuedJobs: Array.from(this.aggregationJobs.values()).filter(j => j.status === 'pending').length,
      lastAggregation: new Date()
    };
  }

  async getQueryPerformanceMetrics(): Promise<Map<string, {
    count: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  }>> {
    const result = new Map();

    for (const [queryType, metrics] of this.queryMetrics) {
      result.set(queryType, {
        count: metrics.count,
        averageTime: metrics.totalTime / metrics.count,
        minTime: metrics.minTime,
        maxTime: metrics.maxTime
      });
    }

    return result;
  }

  /**
   * UTILITY METHODS
   */

  async comparePeriods(
    period1Query: AnalyticsQuery,
    period2Query: AnalyticsQuery
  ): Promise<{
    period1: RevenueAnalytics;
    period2: RevenueAnalytics;
    revenueDelta: number;
    revenueGrowth: number;
    transactionDelta: number;
    transactionGrowth: number;
  }> {
    const [period1, period2] = await Promise.all([
      this.getRevenueAnalytics(period1Query),
      this.getRevenueAnalytics(period2Query)
    ]);

    const revenueDelta = period2.netRevenue - period1.netRevenue;
    const revenueGrowth = period1.netRevenue > 0
      ? (revenueDelta / period1.netRevenue) * 100
      : 0;

    const transactionDelta = period2.transactionCount - period1.transactionCount;
    const transactionGrowth = period1.transactionCount > 0
      ? (transactionDelta / period1.transactionCount) * 100
      : 0;

    return {
      period1,
      period2,
      revenueDelta,
      revenueGrowth,
      transactionDelta,
      transactionGrowth
    };
  }

  async getAnalyticsSummary(query: AnalyticsQuery): Promise<{
    revenue: RevenueAnalytics;
    transactions: TransactionVolumeMetrics;
    successRate: PaymentSuccessRateAnalytics;
    refunds: RefundAnalytics;
    arpu: ARPUAnalytics;
  }> {
    const [revenue, transactions, successRate, refunds, arpu] = await Promise.all([
      this.getRevenueAnalytics(query),
      this.getTransactionVolume(query),
      this.getSuccessRateAnalytics(query),
      this.getRefundAnalytics(query),
      this.getARPU(query)
    ]);

    return { revenue, transactions, successRate, refunds, arpu };
  }

  /**
   * HELPER METHODS
   */

  private formatTimeKey(date: Date, period: AnalyticsPeriod): string {
    switch (period) {
      case 'hourly' as AnalyticsPeriod:
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
      case 'daily' as AnalyticsPeriod:
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      case 'weekly' as AnalyticsPeriod:
        const weekNum = Math.floor(date.getDate() / 7);
        return `${date.getFullYear()}-${date.getMonth() + 1}-W${weekNum}`;
      case 'monthly' as AnalyticsPeriod:
        return `${date.getFullYear()}-${date.getMonth() + 1}`;
      case 'yearly' as AnalyticsPeriod:
        return `${date.getFullYear()}`;
      default:
        return date.toISOString();
    }
  }

  private parseTimeKey(key: string, period: AnalyticsPeriod): Date {
    const parts = key.split('-');

    switch (period) {
      case 'hourly' as AnalyticsPeriod:
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), parseInt(parts[3]));
      case 'daily' as AnalyticsPeriod:
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      case 'monthly' as AnalyticsPeriod:
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      case 'yearly' as AnalyticsPeriod:
        return new Date(parseInt(parts[0]), 0, 1);
      default:
        return new Date(key);
    }
  }

  private calculateTrend(values: number[]): { direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'; strength: number } {
    if (values.length < 2) return { direction: 'stable', strength: 0 };

    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;

    const strength = Math.abs(slope / avgValue) * 100;

    let direction: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable';
    if (strength > 10) {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }
    if (strength > 50) {
      direction = 'volatile';
    }

    return { direction, strength };
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return mean > 0 ? (stdDev / mean) * 100 : 0;
  }

  private calculateSMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const relevantValues = values.slice(-period);
    return relevantValues.reduce((sum, v) => sum + v, 0) / relevantValues.length;
  }

  private calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];

    const k = 2 / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }

    return ema;
  }

  private forecastRevenue(timeSeries: TimeSeriesDataPoint[], days: number): TimeSeriesDataPoint[] {
    if (timeSeries.length < 2) return [];

    const values = timeSeries.map(dp => dp.value);
    const trend = this.calculateTrend(values);
    const lastValue = values[values.length - 1];
    const lastDate = timeSeries[timeSeries.length - 1].timestamp;

    // Simple linear extrapolation
    const forecast: TimeSeriesDataPoint[] = [];
    const dailyChange = trend.strength * (trend.direction === 'increasing' ? 1 : -1) / 100 * lastValue;

    for (let i = 1; i <= days; i++) {
      forecast.push({
        timestamp: new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000),
        value: Math.max(0, lastValue + dailyChange * i)
      });
    }

    return forecast;
  }

  private detectSeasonality(values: number[]): { detected: boolean; pattern?: string } {
    if (values.length < 14) return { detected: false };

    // Simple weekly pattern detection
    const weeklyAvg1 = values.slice(0, 7).reduce((sum, v) => sum + v, 0) / 7;
    const weeklyAvg2 = values.slice(7, 14).reduce((sum, v) => sum + v, 0) / 7;

    const similarity = 1 - Math.abs(weeklyAvg1 - weeklyAvg2) / Math.max(weeklyAvg1, weeklyAvg2);

    if (similarity > 0.8) {
      return { detected: true, pattern: 'weekly' };
    }

    return { detected: false };
  }

  async dispose(): Promise<void> {
    this.realtimeSubscriptions.clear();
    this.eventSubscriptions.clear();
    this.aggregationJobs.clear();
    this.queryMetrics.clear();
    this.exports.clear();
    this.logger.info('PaymentAnalyticsService disposed');
  }
}
