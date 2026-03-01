/**
 * Payment Analytics Type Definitions
 * User Story: US-E5-028 (PaymentAnalyticsService)
 * Comprehensive analytics types for payment insights and reporting
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { Currency } from './currency';
import type { PaymentMethod, PaymentStatus } from './payment';

/**
 * Time period for analytics aggregation
 */
export enum AnalyticsPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  ALL_TIME = 'all_time',
}

/**
 * Analytics export format
 */
export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

/**
 * Time-series data point
 */
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Revenue analytics for a specific period
 */
export interface RevenueAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Revenue metrics
  totalRevenue: number; // Total revenue in satoshis
  netRevenue: number; // Revenue after refunds
  grossRevenue: number; // Revenue before any deductions
  refundedAmount: number; // Total refunded amount

  // Currency breakdown
  revenueByCurrency: Map<Currency, number>; // Revenue per currency in original units
  revenueInBaseCurrency: number; // All revenue converted to base currency (BTC)

  // Growth metrics
  growthRate: number; // Period-over-period growth rate (%)
  previousPeriodRevenue?: number; // Revenue from previous period

  // Transaction metrics
  transactionCount: number; // Total transactions
  averageTransactionValue: number; // Average transaction amount
  medianTransactionValue: number; // Median transaction amount

  // User metrics
  uniquePayingUsers: number; // Number of unique users who paid
  averageRevenuePerUser: number; // ARPU

  metadata?: Record<string, any>;
}

/**
 * Transaction volume metrics
 */
export interface TransactionVolumeMetrics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Volume metrics
  totalVolume: number; // Total transaction volume (satoshis)
  totalCount: number; // Total transaction count
  averageValue: number; // Average transaction value
  medianValue: number; // Median transaction value
  minValue: number; // Minimum transaction value
  maxValue: number; // Maximum transaction value

  // Distribution
  volumeByMethod: Map<PaymentMethod, number>; // Volume by payment method
  countByMethod: Map<PaymentMethod, number>; // Count by payment method
  volumeByStatus: Map<PaymentStatus, number>; // Volume by status
  countByStatus: Map<PaymentStatus, number>; // Count by status

  // Trends
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number; // Trend change percentage

  metadata?: Record<string, any>;
}

/**
 * Payment success/failure rate analytics
 */
export interface PaymentSuccessRateAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Success metrics
  totalAttempts: number; // Total payment attempts
  successfulPayments: number; // Successful payments
  failedPayments: number; // Failed payments
  successRate: number; // Success rate (%)
  failureRate: number; // Failure rate (%)

  // Success by method
  successRateByMethod: Map<PaymentMethod, number>;

  // Failure reasons
  failureReasonBreakdown: Map<string, number>; // Count by failure reason
  topFailureReasons: Array<{ reason: string; count: number; percentage: number }>;

  // Retry metrics
  averageRetries: number; // Average retry attempts
  retriedPayments: number; // Payments that were retried
  successAfterRetry: number; // Payments successful after retry
  retrySuccessRate: number; // Retry success rate (%)

  metadata?: Record<string, any>;
}

/**
 * Currency distribution analytics
 */
export interface CurrencyDistributionAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Currency breakdown
  transactionCountByCurrency: Map<Currency, number>;
  volumeByCurrency: Map<Currency, number>; // Volume in original currency
  volumeInBaseCurrency: Map<Currency, number>; // Volume converted to base currency

  // Distribution percentages
  percentageByTransaction: Map<Currency, number>; // % of transactions
  percentageByVolume: Map<Currency, number>; // % of volume

  // Top currencies
  topCurrencies: Array<{
    currency: Currency;
    transactionCount: number;
    volume: number;
    percentage: number;
  }>;

  // Dominance
  dominantCurrency: Currency; // Currency with highest volume
  dominancePercentage: number; // % of total volume

  metadata?: Record<string, any>;
}

/**
 * Payment method breakdown analytics
 */
export interface PaymentMethodAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Lightning Network metrics
  lightningTransactions: number;
  lightningVolume: number;
  lightningSuccessRate: number;
  averageLightningFee: number;

  // On-chain metrics
  onchainTransactions: number;
  onchainVolume: number;
  onchainSuccessRate: number;
  averageOnchainFee: number;

  // Method comparison
  methodBreakdown: Map<
    PaymentMethod,
    {
      transactionCount: number;
      volume: number;
      successRate: number;
      averageFee: number;
      averageProcessingTime: number;
    }
  >;

  // Preferred method
  preferredMethod: PaymentMethod;
  preferencePercentage: number;

  metadata?: Record<string, any>;
}

/**
 * Refund analytics
 */
export interface RefundAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Refund metrics
  totalRefunds: number; // Total refund count
  totalRefundAmount: number; // Total refunded amount
  fullRefunds: number; // Full refund count
  partialRefunds: number; // Partial refund count

  // Rates
  refundRate: number; // Refunds / total transactions (%)
  refundAmountRate: number; // Refunded amount / total revenue (%)
  averageRefundAmount: number; // Average refund amount

  // Refund reasons
  refundReasonBreakdown: Map<string, number>;
  topRefundReasons: Array<{ reason: string; count: number; percentage: number }>;

  // Time metrics
  averageRefundTime: number; // Average time to refund (ms)
  fastestRefund: number; // Fastest refund time (ms)
  slowestRefund: number; // Slowest refund time (ms)

  // Impact
  refundImpactOnRevenue: number; // Revenue loss due to refunds (%)

  metadata?: Record<string, any>;
}

/**
 * Geographic revenue distribution
 */
export interface GeographicRevenueAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Geographic breakdown
  revenueByCountry: Map<string, number>; // ISO country code -> revenue
  transactionsByCountry: Map<string, number>; // ISO country code -> count

  // Regional aggregation
  revenueByRegion: Map<string, number>; // Region -> revenue
  transactionsByRegion: Map<string, number>; // Region -> count

  // Top locations
  topCountries: Array<{
    countryCode: string;
    countryName: string;
    revenue: number;
    transactionCount: number;
    percentage: number;
  }>;

  // Geographic diversity
  diversityScore: number; // Geographic diversity index (0-1)
  countryCount: number; // Number of countries
  topCountryDominance: number; // Top country revenue percentage

  metadata?: Record<string, any>;
}

/**
 * Top customers by revenue
 */
export interface TopCustomersAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Top customers
  topCustomers: Array<{
    userId: string;
    totalRevenue: number;
    transactionCount: number;
    averageTransactionValue: number;
    firstTransactionDate: Date;
    lastTransactionDate: Date;
    lifetimeValue: number;
    rank: number;
  }>;

  // Concentration metrics
  top10Percentage: number; // Revenue from top 10 customers (%)
  top20Percentage: number; // Revenue from top 20 customers (%)
  customerConcentrationRisk: number; // Risk score (0-1, higher = more concentrated)

  metadata?: Record<string, any>;
}

/**
 * Average Revenue Per User (ARPU)
 */
export interface ARPUAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // ARPU metrics
  totalRevenue: number;
  activeUsers: number;
  arpu: number; // Average revenue per user

  // ARPU breakdown
  arpuBySegment: Map<string, number>; // ARPU by user segment
  arpuByMethod: Map<PaymentMethod, number>; // ARPU by payment method

  // Trends
  previousPeriodArpu?: number;
  arpuGrowthRate: number; // Period-over-period growth (%)

  // Distribution
  medianRevenuePerUser: number;
  topQuartileArpu: number; // ARPU of top 25% users
  bottomQuartileArpu: number; // ARPU of bottom 25% users

  metadata?: Record<string, any>;
}

/**
 * Customer Lifetime Value (CLV/LTV)
 */
export interface CustomerLifetimeValueAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // CLV metrics
  averageLifetimeValue: number; // Average CLV across all customers
  medianLifetimeValue: number; // Median CLV
  totalLifetimeValue: number; // Total CLV of all customers

  // CLV breakdown
  clvBySegment: Map<string, number>; // CLV by user segment
  clvByAcquisitionDate: Map<string, number>; // CLV by cohort

  // Cohort analysis
  cohorts: Array<{
    cohortDate: Date;
    customerCount: number;
    averageClv: number;
    retentionRate: number;
  }>;

  // Predictive metrics
  predictedClv: number; // Predicted future CLV
  clvToAcquisitionCostRatio?: number; // CLV / CAC ratio

  metadata?: Record<string, any>;
}

/**
 * Churn impact on revenue
 */
export interface ChurnRevenueImpactAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Churn metrics
  churnedCustomers: number; // Number of churned customers
  churnRate: number; // Churn rate (%)
  activeCustomers: number; // Active customer count

  // Revenue impact
  lostRevenue: number; // Revenue lost due to churn
  lostMRR: number; // Lost monthly recurring revenue
  averageRevenuePerChurnedCustomer: number;

  // Recovery metrics
  recoveredCustomers: number; // Churned customers who returned
  recoveredRevenue: number; // Revenue from recovered customers

  // Churn prediction
  atRiskCustomers: number; // Customers at risk of churning
  predictedChurnRevenueLoss: number; // Predicted revenue loss from at-risk customers

  metadata?: Record<string, any>;
}

/**
 * Revenue trend analysis with forecasting
 */
export interface RevenueTrendAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // Historical data
  timeSeries: TimeSeriesDataPoint[]; // Time-series revenue data

  // Trend analysis
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  trendStrength: number; // Trend strength (0-1)
  volatility: number; // Revenue volatility index

  // Moving averages
  simpleMovingAverage: number; // SMA
  exponentialMovingAverage: number; // EMA

  // Growth metrics
  compoundGrowthRate: number; // CAGR (%)
  periodOverPeriodGrowth: number; // Recent period growth (%)

  // Forecasting
  forecast: TimeSeriesDataPoint[]; // Forecasted future revenue
  forecastConfidence: number; // Forecast confidence (0-1)

  // Seasonality
  seasonalityDetected: boolean;
  seasonalPattern?: string; // e.g., "weekly", "monthly"

  metadata?: Record<string, any>;
}

/**
 * Monthly Recurring Revenue (MRR) metrics
 */
export interface MRRAnalytics {
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;

  // MRR metrics
  currentMRR: number; // Current MRR
  newMRR: number; // MRR from new customers
  expansionMRR: number; // MRR from upgrades
  contractionMRR: number; // MRR lost from downgrades
  churnedMRR: number; // MRR lost from churn

  // Net metrics
  netNewMRR: number; // Net MRR change
  mrrGrowthRate: number; // MRR growth rate (%)

  // ARR (Annual Recurring Revenue)
  currentARR: number; // Current ARR (MRR * 12)
  projectedARR: number; // Projected ARR

  // Quick ratio
  quickRatio: number; // (New + Expansion) / (Contraction + Churn)

  metadata?: Record<string, any>;
}

/**
 * Real-time payment dashboard metrics
 */
export interface RealtimeDashboardMetrics {
  timestamp: Date;

  // Real-time metrics (last 5 minutes)
  recentTransactions: number;
  recentRevenue: number;
  recentSuccessRate: number;

  // Current state
  activePayments: number; // Payments in progress
  pendingPayments: number; // Pending payments
  failedPaymentsLast5Min: number;

  // Today's metrics
  todayRevenue: number;
  todayTransactions: number;
  todaySuccessRate: number;
  todayActiveUsers: number;

  // Comparisons
  yesterdayRevenue: number;
  weekAgoRevenue: number;
  monthAgoRevenue: number;

  // Alerts
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: Date;
  }>;

  metadata?: Record<string, any>;
}

/**
 * Analytics query parameters
 */
export interface AnalyticsQuery {
  period: AnalyticsPeriod;
  startDate?: Date; // Start of date range
  endDate?: Date; // End of date range
  userId?: string; // Filter by user
  currency?: Currency; // Filter by currency
  method?: PaymentMethod; // Filter by method
  status?: PaymentStatus; // Filter by status
  includeRefunds?: boolean; // Include refunded transactions
  groupBy?: string[]; // Group by fields
  limit?: number; // Result limit
  offset?: number; // Result offset
}

/**
 * Analytics export request
 */
export interface AnalyticsExportRequest {
  format: ExportFormat;
  analyticsType: string; // Type of analytics to export
  query: AnalyticsQuery;
  includeCharts?: boolean; // Include visualizations (PDF only)
  metadata?: Record<string, any>;
}

/**
 * Analytics export result
 */
export interface AnalyticsExportResult {
  exportId: string;
  format: ExportFormat;
  fileName: string;
  fileSize: number; // Size in bytes
  data: Buffer | string; // Export data
  generatedAt: Date;
  expiresAt: Date;
  downloadUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Analytics aggregation job
 */
export interface AnalyticsAggregationJob {
  id: string;
  period: AnalyticsPeriod;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: number; // Progress percentage (0-100)
  metadata?: Record<string, any>;
}

/**
 * Analytics cache entry
 */
export interface AnalyticsCacheEntry<T> {
  key: string;
  data: T;
  generatedAt: Date;
  expiresAt: Date;
  ttl: number; // TTL in seconds
  hitCount: number; // Number of times cache was hit
}

/**
 * Analytics service configuration
 */
export interface PaymentAnalyticsConfig {
  enableRealtime: boolean; // Enable real-time metrics
  realtimeInterval: number; // Real-time update interval (ms)
  aggregationSchedule: Record<AnalyticsPeriod, string>; // Cron schedules
  cacheTTL: Record<string, number>; // Cache TTL by metric type (seconds)
  exportRetention: number; // Export file retention (seconds)
  maxExportSize: number; // Maximum export size (bytes)
  enableForecasting: boolean; // Enable revenue forecasting
  forecastHorizon: number; // Forecast horizon (days)
  baseCurrency: Currency; // Base currency for consolidation
}

/**
 * Analytics service metrics
 */
export interface AnalyticsServiceMetrics {
  uptime: number; // Service uptime (ms)
  totalQueries: number; // Total analytics queries
  totalExports: number; // Total exports generated
  cacheHitRate: number; // Cache hit rate (%)
  averageQueryTime: number; // Average query time (ms)
  averageAggregationTime: number; // Average aggregation time (ms)
  activeJobs: number; // Active aggregation jobs
  queuedJobs: number; // Queued aggregation jobs
  lastAggregation: Date; // Last aggregation timestamp
}

/**
 * Payment analytics event
 */
export interface PaymentAnalyticsEvent {
  type: 'analytics.generated' | 'analytics.exported' | 'threshold.reached' | 'anomaly.detected';
  analyticsType: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}
