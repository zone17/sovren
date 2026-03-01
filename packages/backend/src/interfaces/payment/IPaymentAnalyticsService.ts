/**
 * PaymentAnalyticsService Interface
 * User Story: US-E5-028
 * Comprehensive payment analytics and insights interface
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
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
} from '../../types/payment-analytics';
import { AnalyticsPeriod } from '../../types/payment-analytics';
import { Currency } from '../../types/currency';
import { PaymentMethod } from '../../types/payment';

/**
 * Payment Analytics Service Interface
 * Provides comprehensive analytics and insights for payment operations
 */
export interface IPaymentAnalyticsService {
  /**
   * REVENUE ANALYTICS
   */

  /**
   * Get revenue analytics for a period
   * @param query - Analytics query parameters
   * @returns Revenue analytics
   */
  getRevenueAnalytics(query: AnalyticsQuery): Promise<RevenueAnalytics>;

  /**
   * Get revenue by period (daily, weekly, monthly, yearly)
   * @param period - Time period
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Revenue analytics
   */
  getRevenueByPeriod(
    period: AnalyticsPeriod,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueAnalytics>;

  /**
   * Get revenue time series data
   * @param query - Analytics query
   * @returns Array of time-series data points
   */
  getRevenueTimeSeries(query: AnalyticsQuery): Promise<TimeSeriesDataPoint[]>;

  /**
   * Get revenue trend and forecast
   * @param query - Analytics query
   * @param forecastDays - Number of days to forecast (optional)
   * @returns Revenue trend analytics with forecast
   */
  getRevenueTrend(query: AnalyticsQuery, forecastDays?: number): Promise<RevenueTrendAnalytics>;

  /**
   * TRANSACTION METRICS
   */

  /**
   * Get transaction volume metrics
   * @param query - Analytics query
   * @returns Transaction volume metrics
   */
  getTransactionVolume(query: AnalyticsQuery): Promise<TransactionVolumeMetrics>;

  /**
   * Get payment success/failure rates
   * @param query - Analytics query
   * @returns Success rate analytics
   */
  getSuccessRateAnalytics(query: AnalyticsQuery): Promise<PaymentSuccessRateAnalytics>;

  /**
   * Get transaction count by period
   * @param period - Time period
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Transaction count time series
   */
  getTransactionCountByPeriod(
    period: AnalyticsPeriod,
    startDate: Date,
    endDate: Date
  ): Promise<TimeSeriesDataPoint[]>;

  /**
   * CURRENCY & PAYMENT METHOD ANALYTICS
   */

  /**
   * Get currency distribution analytics
   * @param query - Analytics query
   * @returns Currency distribution analytics
   */
  getCurrencyDistribution(query: AnalyticsQuery): Promise<CurrencyDistributionAnalytics>;

  /**
   * Get payment method breakdown
   * @param query - Analytics query
   * @returns Payment method analytics
   */
  getPaymentMethodAnalytics(query: AnalyticsQuery): Promise<PaymentMethodAnalytics>;

  /**
   * Get revenue by currency
   * @param currency - Currency to analyze
   * @param query - Analytics query
   * @returns Revenue in specified currency
   */
  getRevenueByCurrency(currency: Currency, query: AnalyticsQuery): Promise<number>;

  /**
   * Get revenue by payment method
   * @param method - Payment method
   * @param query - Analytics query
   * @returns Revenue for specified method
   */
  getRevenueByMethod(method: PaymentMethod, query: AnalyticsQuery): Promise<number>;

  /**
   * REFUND ANALYTICS
   */

  /**
   * Get refund analytics
   * @param query - Analytics query
   * @returns Refund analytics
   */
  getRefundAnalytics(query: AnalyticsQuery): Promise<RefundAnalytics>;

  /**
   * Get refund rate
   * @param query - Analytics query
   * @returns Refund rate percentage
   */
  getRefundRate(query: AnalyticsQuery): Promise<number>;

  /**
   * Get refund impact on revenue
   * @param query - Analytics query
   * @returns Revenue impact percentage
   */
  getRefundImpact(query: AnalyticsQuery): Promise<number>;

  /**
   * GEOGRAPHIC ANALYTICS
   */

  /**
   * Get geographic revenue distribution
   * @param query - Analytics query
   * @returns Geographic revenue analytics
   */
  getGeographicRevenue(query: AnalyticsQuery): Promise<GeographicRevenueAnalytics>;

  /**
   * Get revenue by country
   * @param countryCode - ISO country code
   * @param query - Analytics query
   * @returns Revenue for specified country
   */
  getRevenueByCountry(countryCode: string, query: AnalyticsQuery): Promise<number>;

  /**
   * CUSTOMER ANALYTICS
   */

  /**
   * Get top customers by revenue
   * @param query - Analytics query
   * @param limit - Number of customers to return
   * @returns Top customers analytics
   */
  getTopCustomers(query: AnalyticsQuery, limit?: number): Promise<TopCustomersAnalytics>;

  /**
   * Get Average Revenue Per User (ARPU)
   * @param query - Analytics query
   * @returns ARPU analytics
   */
  getARPU(query: AnalyticsQuery): Promise<ARPUAnalytics>;

  /**
   * Get Customer Lifetime Value (CLV/LTV)
   * @param query - Analytics query
   * @returns CLV analytics
   */
  getCustomerLifetimeValue(query: AnalyticsQuery): Promise<CustomerLifetimeValueAnalytics>;

  /**
   * Get individual customer LTV
   * @param userId - User ID
   * @returns Customer lifetime value
   */
  getCustomerLTV(userId: string): Promise<number>;

  /**
   * CHURN ANALYTICS
   */

  /**
   * Get churn impact on revenue
   * @param query - Analytics query
   * @returns Churn revenue impact analytics
   */
  getChurnImpact(query: AnalyticsQuery): Promise<ChurnRevenueImpactAnalytics>;

  /**
   * Get churn rate
   * @param query - Analytics query
   * @returns Churn rate percentage
   */
  getChurnRate(query: AnalyticsQuery): Promise<number>;

  /**
   * RECURRING REVENUE METRICS
   */

  /**
   * Get Monthly Recurring Revenue (MRR) analytics
   * @param query - Analytics query
   * @returns MRR analytics
   */
  getMRRAnalytics(query: AnalyticsQuery): Promise<MRRAnalytics>;

  /**
   * Get current MRR
   * @returns Current monthly recurring revenue
   */
  getCurrentMRR(): Promise<number>;

  /**
   * Get Annual Recurring Revenue (ARR)
   * @returns Current annual recurring revenue
   */
  getCurrentARR(): Promise<number>;

  /**
   * Get MRR growth rate
   * @param query - Analytics query
   * @returns MRR growth rate percentage
   */
  getMRRGrowthRate(query: AnalyticsQuery): Promise<number>;

  /**
   * REAL-TIME DASHBOARD
   */

  /**
   * Get real-time dashboard metrics
   * @returns Real-time metrics for dashboard
   */
  getRealtimeMetrics(): Promise<RealtimeDashboardMetrics>;

  /**
   * Subscribe to real-time updates
   * @param callback - Update callback function
   * @returns Subscription ID
   */
  subscribeToRealtimeUpdates(
    callback: (metrics: RealtimeDashboardMetrics) => void | Promise<void>
  ): string;

  /**
   * Unsubscribe from real-time updates
   * @param subscriptionId - Subscription ID
   */
  unsubscribeFromRealtimeUpdates(subscriptionId: string): void;

  /**
   * EXPORT CAPABILITIES
   */

  /**
   * Export analytics to file
   * @param request - Export request
   * @returns Export result with file data
   */
  exportAnalytics(request: AnalyticsExportRequest): Promise<AnalyticsExportResult>;

  /**
   * Get export by ID
   * @param exportId - Export ID
   * @returns Export result or null
   */
  getExport(exportId: string): Promise<AnalyticsExportResult | null>;

  /**
   * List available exports
   * @param userId - User ID (optional)
   * @returns List of export results
   */
  listExports(userId?: string): Promise<AnalyticsExportResult[]>;

  /**
   * Delete export
   * @param exportId - Export ID
   */
  deleteExport(exportId: string): Promise<void>;

  /**
   * MULTI-CURRENCY CONSOLIDATION
   */

  /**
   * Get consolidated revenue (all currencies converted to base)
   * @param query - Analytics query
   * @returns Consolidated revenue in base currency
   */
  getConsolidatedRevenue(query: AnalyticsQuery): Promise<number>;

  /**
   * Get revenue breakdown by currency (in base currency)
   * @param query - Analytics query
   * @returns Map of currency to revenue in base currency
   */
  getRevenueBreakdownInBaseCurrency(query: AnalyticsQuery): Promise<Map<Currency, number>>;

  /**
   * Set base currency for consolidation
   * @param currency - Base currency
   */
  setBaseCurrency(currency: Currency): void;

  /**
   * Get current base currency
   * @returns Base currency
   */
  getBaseCurrency(): Currency;

  /**
   * DATA AGGREGATION
   */

  /**
   * Trigger manual data aggregation
   * @param period - Period to aggregate
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   * @returns Aggregation job ID
   */
  triggerAggregation(period: AnalyticsPeriod, startDate?: Date, endDate?: Date): Promise<string>;

  /**
   * Get aggregation job status
   * @param jobId - Job ID
   * @returns Job status or null
   */
  getAggregationJobStatus(jobId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    error?: string;
  } | null>;

  /**
   * CACHE MANAGEMENT
   */

  /**
   * Warm up analytics cache with common queries
   */
  warmupCache(): Promise<void>;

  /**
   * Clear analytics cache
   * @param pattern - Cache key pattern (optional)
   */
  clearCache(pattern?: string): Promise<void>;

  /**
   * Get cache statistics
   * @returns Cache hit rate and metrics
   */
  getCacheStats(): Promise<{
    hitRate: number;
    hits: number;
    misses: number;
    totalKeys: number;
    memoryUsage: number;
  }>;

  /**
   * EVENT SUBSCRIPTION
   */

  /**
   * Subscribe to analytics events
   * @param eventType - Event type to subscribe to
   * @param callback - Event handler
   * @returns Subscription ID
   */
  subscribeToEvents(
    eventType: string,
    callback: (event: PaymentAnalyticsEvent) => void | Promise<void>
  ): string;

  /**
   * Unsubscribe from analytics events
   * @param subscriptionId - Subscription ID
   */
  unsubscribeFromEvents(subscriptionId: string): void;

  /**
   * HEALTH & MONITORING
   */

  /**
   * Health check for analytics service
   * @returns Whether service is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get service metrics
   * @returns Analytics service metrics
   */
  getServiceMetrics(): Promise<AnalyticsServiceMetrics>;

  /**
   * Get query performance metrics
   * @returns Performance metrics by query type
   */
  getQueryPerformanceMetrics(): Promise<
    Map<
      string,
      {
        count: number;
        averageTime: number;
        minTime: number;
        maxTime: number;
      }
    >
  >;

  /**
   * UTILITY METHODS
   */

  /**
   * Compare two periods
   * @param period1Query - First period query
   * @param period2Query - Second period query
   * @returns Comparison result with deltas
   */
  comparePeriods(
    period1Query: AnalyticsQuery,
    period2Query: AnalyticsQuery
  ): Promise<{
    period1: RevenueAnalytics;
    period2: RevenueAnalytics;
    revenueDelta: number;
    revenueGrowth: number;
    transactionDelta: number;
    transactionGrowth: number;
  }>;

  /**
   * Get analytics summary
   * @param query - Analytics query
   * @returns Comprehensive analytics summary
   */
  getAnalyticsSummary(query: AnalyticsQuery): Promise<{
    revenue: RevenueAnalytics;
    transactions: TransactionVolumeMetrics;
    successRate: PaymentSuccessRateAnalytics;
    refunds: RefundAnalytics;
    arpu: ARPUAnalytics;
  }>;

  /**
   * Dispose resources
   */
  dispose(): Promise<void>;
}
