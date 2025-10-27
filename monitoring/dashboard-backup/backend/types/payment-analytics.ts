/**
 * Payment Analytics Types
 *
 * Comprehensive type definitions for payment metrics, analytics,
 * and monitoring data structures.
 */

export interface PaymentEvent {
  id: string;
  timestamp: Date;
  amount_sats: number;
  payment_method: 'lightning' | 'webln';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  payment_hash: string;
  user_id?: string;
  creator_id: string;
  invoice_id?: string;
  error_code?: string;
  error_message?: string;
  duration_ms?: number;
  retry_count?: number;
}

export interface PaymentMetricsSummary {
  // Total metrics
  total_payments: number;
  total_volume_sats: number;
  total_volume_btc: number;

  // Success metrics
  successful_payments: number;
  failed_payments: number;
  success_rate: number;

  // Amount metrics
  average_payment_sats: number;
  median_payment_sats: number;
  min_payment_sats: number;
  max_payment_sats: number;

  // Performance metrics
  average_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;

  // Method distribution
  payment_methods: {
    lightning: number;
    webln: number;
  };

  // Time range
  time_range: {
    start: Date;
    end: Date;
  };
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  payment_count: number;
  total_volume_sats: number;
  success_count: number;
  failure_count: number;
  average_amount_sats: number;
  success_rate: number;
}

export interface PaymentTimeSeriesData {
  interval: 'hour' | 'day' | 'week' | 'month';
  data_points: TimeSeriesDataPoint[];
  summary: PaymentMetricsSummary;
}

export interface ErrorAnalytics {
  error_code: string;
  error_message: string;
  count: number;
  percentage: number;
  first_seen: Date;
  last_seen: Date;
  affected_payments: number;
}

export interface CreatorAnalytics {
  creator_id: string;
  total_received_sats: number;
  payment_count: number;
  unique_supporters: number;
  average_payment_sats: number;
  success_rate: number;
  top_supporter_id?: string;
  first_payment: Date;
  last_payment: Date;
}

export interface RealtimeMetrics {
  timestamp: Date;

  // Current rates (per minute)
  payments_per_minute: number;
  volume_per_minute_sats: number;

  // Current status
  active_payments: number;
  pending_verifications: number;

  // Rolling window metrics (last 5 minutes)
  recent_success_rate: number;
  recent_average_duration_ms: number;

  // Alerts
  is_degraded: boolean;
  degradation_reason?: string;
}

export interface AnalyticsQueryOptions {
  start_date?: Date;
  end_date?: Date;
  creator_id?: string;
  payment_method?: 'lightning' | 'webln';
  status?: PaymentEvent['status'];
  min_amount_sats?: number;
  max_amount_sats?: number;
  limit?: number;
  offset?: number;
}

export interface PrometheusMetrics {
  // Counters
  payment_total: number;
  payment_success_total: number;
  payment_failure_total: number;
  payment_volume_sats_total: number;

  // Gauges
  payment_success_rate: number;
  active_payments_count: number;

  // Histograms (buckets)
  payment_amount_sats_bucket: Record<string, number>;
  payment_duration_ms_bucket: Record<string, number>;

  // Summary
  timestamp: Date;
  scrape_duration_ms: number;
}

export interface AlertThresholds {
  min_success_rate: number; // Default: 0.95 (95%)
  max_failure_rate: number; // Default: 0.05 (5%)
  max_average_duration_ms: number; // Default: 30000 (30s)
  min_payments_for_alert: number; // Default: 10
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'success_rate' | 'failure_rate' | 'latency' | 'volume';
  message: string;
  threshold: number;
  current_value: number;
  triggered_at: Date;
  resolved_at?: Date;
  metadata: Record<string, any>;
}
