/**
 * 📊 **ANALYTICS DATA TRANSFORMATION UTILITIES**
 *
 * Elite Engineering Standards:
 * - Type-safe data transformations
 * - Comprehensive data aggregation
 * - Performance-optimized algorithms
 * - Error-resistant data processing
 */

import {
  AnalyticsChartData,
  AnalyticsExport,
  AnalyticsFilters,
  CreatorEarnings,
  CreatorPerformanceMetrics,
  LightningPaymentAnalytics,
} from '../types';

// 📈 **DATA AGGREGATION UTILITIES**

export interface AggregatedMetrics {
  totalEarnings: number;
  averagePayment: number;
  totalPayments: number;
  successRate: number;
  growthRate: number;
  periodComparison: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
}

export interface ProcessedChartData {
  labels: string[];
  datasets: {
    name: string;
    data: number[];
    color: string;
    trend: 'up' | 'down' | 'stable';
  }[];
}

export interface MetricsSummary {
  kpis: {
    totalRevenue: number;
    totalSubscribers: number;
    averageEngagement: number;
    conversionRate: number;
  };
  trends: {
    revenue: 'increasing' | 'decreasing' | 'stable';
    subscribers: 'increasing' | 'decreasing' | 'stable';
    engagement: 'increasing' | 'decreasing' | 'stable';
  };
  insights: string[];
}

// 🔢 **PAYMENT DATA AGGREGATION**
export const aggregatePaymentData = (
  payments: LightningPaymentAnalytics[],
  period: '24h' | '7d' | '30d' | '90d' | '1y' = '7d'
): AggregatedMetrics => {
  if (payments.length === 0) {
    return {
      totalEarnings: 0,
      averagePayment: 0,
      totalPayments: 0,
      successRate: 0,
      growthRate: 0,
      periodComparison: {
        current: 0,
        previous: 0,
        change: 0,
        changePercent: 0,
      },
    };
  }

  const now = new Date();
  const periodMs = getPeriodMilliseconds(period);
  const currentPeriodStart = new Date(now.getTime() - periodMs);
  const previousPeriodStart = new Date(now.getTime() - periodMs * 2);

  // Filter payments for current and previous periods
  const currentPeriodPayments = payments.filter((p) => new Date(p.paid_at) >= currentPeriodStart);
  const previousPeriodPayments = payments.filter(
    (p) => new Date(p.paid_at) >= previousPeriodStart && new Date(p.paid_at) < currentPeriodStart
  );

  const totalEarnings = currentPeriodPayments.reduce((sum, p) => sum + p.amount_sats, 0);
  const totalPayments = currentPeriodPayments.length;
  const averagePayment = totalPayments > 0 ? totalEarnings / totalPayments : 0;

  const previousEarnings = previousPeriodPayments.reduce((sum, p) => sum + p.amount_sats, 0);
  const change = totalEarnings - previousEarnings;
  const changePercent = previousEarnings > 0 ? (change / previousEarnings) * 100 : 0;

  // Calculate success rate (assuming all payments in array are successful)
  const successRate = 100; // Since we only get successful payments

  // Calculate growth rate
  const growthRate = changePercent;

  return {
    totalEarnings,
    averagePayment,
    totalPayments,
    successRate,
    growthRate,
    periodComparison: {
      current: totalEarnings,
      previous: previousEarnings,
      change,
      changePercent,
    },
  };
};

// 📊 **CHART DATA PROCESSING**
export const processChartData = (
  chartData: AnalyticsChartData,
  period: '24h' | '7d' | '30d' | '90d' | '1y' = '7d'
): ProcessedChartData => {
  const labels = chartData.earnings.map((point) => {
    const date = new Date(point.timestamp);
    return formatDateForPeriod(date, period);
  });

  // Calculate trends for each dataset
  const earningsTrend = calculateTrend(chartData.earnings.map((p) => p.value));
  const subscribersTrend = calculateTrend(chartData.subscribers.map((p) => p.value));
  const engagementTrend = calculateTrend(chartData.engagement.map((p) => p.value));
  const paymentsTrend = calculateTrend(chartData.payments.map((p) => p.value));

  return {
    labels,
    datasets: [
      {
        name: 'Earnings (sats)',
        data: chartData.earnings.map((p) => p.value),
        color: '#f59e0b',
        trend: earningsTrend,
      },
      {
        name: 'Subscribers',
        data: chartData.subscribers.map((p) => p.value),
        color: '#10b981',
        trend: subscribersTrend,
      },
      {
        name: 'Engagement %',
        data: chartData.engagement.map((p) => p.value),
        color: '#3b82f6',
        trend: engagementTrend,
      },
      {
        name: 'Payments',
        data: chartData.payments.map((p) => p.value),
        color: '#8b5cf6',
        trend: paymentsTrend,
      },
    ],
  };
};

// 📈 **METRICS SUMMARY GENERATION**
export const generateMetricsSummary = (
  earnings: CreatorEarnings,
  performance: CreatorPerformanceMetrics
): MetricsSummary => {
  const kpis = {
    totalRevenue: earnings.lightning.total_sats,
    totalSubscribers: earnings.subscribers.total_count,
    averageEngagement: earnings.content.average_engagement,
    conversionRate: earnings.lightning.success_rate,
  };

  const trends = {
    revenue:
      earnings.lightning.payment_velocity > 1
        ? ('increasing' as const)
        : earnings.lightning.payment_velocity < 0.5
          ? ('decreasing' as const)
          : ('stable' as const),
    subscribers:
      earnings.subscribers.subscriber_growth > 0
        ? ('increasing' as const)
        : earnings.subscribers.subscriber_growth < 0
          ? ('decreasing' as const)
          : ('stable' as const),
    engagement:
      earnings.content.average_engagement > 50
        ? ('increasing' as const)
        : earnings.content.average_engagement < 30
          ? ('decreasing' as const)
          : ('stable' as const),
  };

  const insights = generateInsights(kpis, trends, performance);

  return { kpis, trends, insights };
};

// 💡 **INSIGHTS GENERATION**
const generateInsights = (
  kpis: MetricsSummary['kpis'],
  trends: MetricsSummary['trends'],
  performance: CreatorPerformanceMetrics
): string[] => {
  const insights: string[] = [];

  // Revenue insights
  if (trends.revenue === 'increasing') {
    insights.push(
      `🚀 Revenue is trending upward with ${kpis.totalRevenue.toLocaleString()} sats earned`
    );
  } else if (trends.revenue === 'decreasing') {
    insights.push(`⚠️ Revenue is declining - consider reviewing pricing or content strategy`);
  }

  // Subscriber insights
  if (trends.subscribers === 'increasing') {
    insights.push(
      `📈 Growing subscriber base with ${kpis.totalSubscribers.toLocaleString()} total subscribers`
    );
  } else if (trends.subscribers === 'decreasing') {
    insights.push(`📉 Subscriber churn detected - focus on retention strategies`);
  }

  // Engagement insights
  if (kpis.averageEngagement > 70) {
    insights.push(`🎯 Excellent engagement rate of ${kpis.averageEngagement.toFixed(1)}%`);
  } else if (kpis.averageEngagement < 30) {
    insights.push(
      `💡 Low engagement (${kpis.averageEngagement.toFixed(1)}%) - consider content optimization`
    );
  }

  // Performance-based insights
  if (performance.performance_score > 80) {
    insights.push(
      `⭐ Outstanding overall performance score of ${performance.performance_score}/100`
    );
  } else if (performance.performance_score < 60) {
    insights.push(`🔧 Performance needs improvement - check recommendations below`);
  }

  // Conversion insights
  if (kpis.conversionRate > 95) {
    insights.push(`💎 Excellent payment success rate of ${kpis.conversionRate.toFixed(1)}%`);
  } else if (kpis.conversionRate < 85) {
    insights.push(
      `⚡ Payment issues detected - ${(100 - kpis.conversionRate).toFixed(1)}% failure rate`
    );
  }

  return insights.slice(0, 5); // Limit to 5 insights
};

// 📅 **DATA FILTERING UTILITIES**
export const applyFilters = (
  payments: LightningPaymentAnalytics[],
  filters: AnalyticsFilters
): LightningPaymentAnalytics[] => {
  let filtered = [...payments];

  // Date range filter
  if (filters.dateRange) {
    const start = new Date(filters.dateRange.start);
    const end = new Date(filters.dateRange.end);
    filtered = filtered.filter((p) => {
      const paymentDate = new Date(p.paid_at);
      return paymentDate >= start && paymentDate <= end;
    });
  }

  // Payment range filter
  if (filters.paymentRange) {
    filtered = filtered.filter(
      (p) =>
        p.amount_sats >= filters.paymentRange.min_sats &&
        p.amount_sats <= filters.paymentRange.max_sats
    );
  }

  // Content types filter
  if (filters.contentTypes && filters.contentTypes.length > 0) {
    // This would need content_id lookup in a real implementation
    // For now, we'll use a simple heuristic based on payment amounts
    if (filters.contentTypes.includes('premium')) {
      filtered = filtered.filter((p) => p.amount_sats > 1000); // Premium content threshold
    }
  }

  return filtered;
};

// 📊 **DATA EXPORT UTILITIES**
export const prepareExportData = (
  earnings: CreatorEarnings | null,
  payments: LightningPaymentAnalytics[],
  chartData: AnalyticsChartData | null,
  exportConfig: AnalyticsExport
): Record<string, unknown> => {
  const exportData: Record<string, unknown> = {
    export_config: exportConfig,
    generated_at: new Date().toISOString(),
    period: `${exportConfig.date_range.start} to ${exportConfig.date_range.end}`,
  };

  if (exportConfig.data_types.includes('earnings') && earnings) {
    exportData.earnings = earnings;
  }

  if (exportConfig.data_types.includes('payments')) {
    exportData.payments = exportConfig.include_personal_data
      ? payments
      : payments.map((p) => ({
          id: p.id,
          amount_sats: p.amount_sats,
          description: p.description,
          paid_at: p.paid_at,
          fee_sats: p.fee_sats,
          settlement_time_ms: p.settlement_time_ms,
        }));
  }

  if (exportConfig.data_types.includes('content') && chartData) {
    exportData.charts = chartData;
  }

  return exportData;
};

// 🛠️ **UTILITY FUNCTIONS**

const getPeriodMilliseconds = (period: '24h' | '7d' | '30d' | '90d' | '1y'): number => {
  const day = 24 * 60 * 60 * 1000;
  switch (period) {
    case '24h':
      return day;
    case '7d':
      return 7 * day;
    case '30d':
      return 30 * day;
    case '90d':
      return 90 * day;
    case '1y':
      return 365 * day;
    default:
      return 7 * day;
  }
};

const formatDateForPeriod = (date: Date, period: '24h' | '7d' | '30d' | '90d' | '1y'): string => {
  switch (period) {
    case '24h':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '7d':
      return date.toLocaleDateString([], { weekday: 'short' });
    case '30d':
    case '90d':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    case '1y':
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    default:
      return date.toLocaleDateString();
  }
};

const calculateTrend = (values: number[]): 'up' | 'down' | 'stable' => {
  if (values.length < 2) return 'stable';

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  const change = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
};

// 🔄 **REAL-TIME DATA PROCESSING**
export const processRealTimeEvent = (
  event: { type: string; data: Record<string, unknown> },
  currentMetrics: AggregatedMetrics
): AggregatedMetrics => {
  const updatedMetrics = { ...currentMetrics };

  switch (event.type) {
    case 'payment_received':
      if (typeof event.data.amount_sats === 'number') {
        updatedMetrics.totalEarnings += event.data.amount_sats;
        updatedMetrics.totalPayments += 1;
        updatedMetrics.averagePayment = updatedMetrics.totalEarnings / updatedMetrics.totalPayments;
      }
      break;
    case 'new_subscriber':
      // Update subscriber-related metrics
      break;
    case 'content_viewed':
      // Update engagement metrics
      break;
    default:
      // Handle unknown event types gracefully
      break;
  }

  return updatedMetrics;
};

// 📱 **MOBILE-OPTIMIZED DATA FORMATTING**
export const formatForMobile = (
  data: AggregatedMetrics
): {
  displayValues: Record<string, string>;
  summaryText: string;
  quickStats: Array<{ label: string; value: string; trend: 'up' | 'down' | 'stable' }>;
} => {
  const displayValues = {
    totalEarnings: `${(data.totalEarnings / 1000).toFixed(1)}k sats`,
    averagePayment: `${data.averagePayment.toFixed(0)} sats`,
    successRate: `${data.successRate.toFixed(1)}%`,
    growthRate: `${data.growthRate > 0 ? '+' : ''}${data.growthRate.toFixed(1)}%`,
  };

  const summaryText =
    data.growthRate > 0
      ? `🚀 Up ${data.growthRate.toFixed(1)}% from last period`
      : data.growthRate < 0
        ? `📉 Down ${Math.abs(data.growthRate).toFixed(1)}% from last period`
        : `📊 Stable performance`;

  const quickStats = [
    {
      label: 'Total Earnings',
      value: displayValues.totalEarnings,
      trend:
        data.growthRate > 5
          ? ('up' as const)
          : data.growthRate < -5
            ? ('down' as const)
            : ('stable' as const),
    },
    {
      label: 'Avg Payment',
      value: displayValues.averagePayment,
      trend: 'stable' as const,
    },
    {
      label: 'Success Rate',
      value: displayValues.successRate,
      trend:
        data.successRate > 95
          ? ('up' as const)
          : data.successRate < 85
            ? ('down' as const)
            : ('stable' as const),
    },
  ];

  return { displayValues, summaryText, quickStats };
};
