/**
 * Payment Analytics Integration Example
 *
 * This file demonstrates how to integrate the payment analytics system
 * into your Express application.
 */

import express from 'express';
import { PaymentAnalyticsService } from './services/PaymentAnalyticsService';
import { PaymentAlertingService } from './services/PaymentAlertingService';
import { createAnalyticsRouter } from './routes/analytics';
import { PaymentEvent } from './types/payment-analytics';

// ============================================================================
// STEP 1: Initialize Services
// ============================================================================

const analyticsService = new PaymentAnalyticsService();

const alertingService = new PaymentAlertingService(analyticsService, {
  enabled: true,
  thresholds: {
    min_success_rate: 0.95, // Alert when success rate drops below 95%
    max_failure_rate: 0.05, // Alert when failure rate exceeds 5%
    max_average_duration_ms: 30000, // Alert when avg duration > 30s
    min_payments_for_alert: 10, // Need at least 10 payments to alert
  },
  checkIntervalMs: 60000, // Check every minute
  resolutionDelayMs: 300000, // Auto-resolve after 5 minutes of healthy metrics
  channels: [
    {
      type: 'console',
      enabled: true,
      config: {},
    },
    // Add more channels as needed:
    // {
    //   type: 'slack',
    //   enabled: true,
    //   config: {
    //     webhookUrl: process.env.SLACK_WEBHOOK_URL,
    //   },
    // },
  ],
});

// ============================================================================
// STEP 2: Data Source - Connect to Your Payment Storage
// ============================================================================

/**
 * This function should fetch payment events from your database.
 * Replace this mock implementation with your actual data source.
 */
async function getPaymentEvents(): Promise<PaymentEvent[]> {
  // EXAMPLE: Fetch from PostgreSQL/Supabase
  // const { data, error } = await supabase
  //   .from('payment_events')
  //   .select('*')
  //   .order('timestamp', { ascending: false })
  //   .limit(10000);
  //
  // return data.map(row => ({
  //   id: row.id,
  //   timestamp: new Date(row.timestamp),
  //   amount_sats: row.amount_sats,
  //   payment_method: row.payment_method,
  //   status: row.status,
  //   payment_hash: row.payment_hash,
  //   creator_id: row.creator_id,
  //   user_id: row.user_id,
  //   duration_ms: row.duration_ms,
  //   retry_count: row.retry_count,
  //   error_code: row.error_code,
  //   error_message: row.error_message,
  // }));

  // Mock data for demonstration
  return [];
}

// ============================================================================
// STEP 3: Real-time Event Collection (on payment events)
// ============================================================================

/**
 * Call this function whenever a payment event occurs to update metrics in real-time.
 */
export function recordPaymentEvent(event: PaymentEvent): void {
  // In production, this would:
  // 1. Store event in database
  // 2. Publish to event stream (Redis, Kafka, etc.)
  // 3. Update in-memory cache for fast metrics

  console.log('[Analytics] Payment event recorded:', {
    id: event.id,
    status: event.status,
    amount_sats: event.amount_sats,
  });

  // Example: Store in database
  // await supabase.from('payment_events').insert({
  //   id: event.id,
  //   timestamp: event.timestamp,
  //   amount_sats: event.amount_sats,
  //   payment_method: event.payment_method,
  //   status: event.status,
  //   payment_hash: event.payment_hash,
  //   creator_id: event.creator_id,
  //   user_id: event.user_id,
  //   duration_ms: event.duration_ms,
  //   retry_count: event.retry_count,
  //   error_code: event.error_code,
  //   error_message: event.error_message,
  // });
}

// ============================================================================
// STEP 4: Create Express Application
// ============================================================================

const app = express();
app.use(express.json());

// Mount analytics routes
const analyticsRouter = createAnalyticsRouter(analyticsService, getPaymentEvents);
app.use(analyticsRouter);

// ============================================================================
// STEP 5: Start Alerting Monitoring
// ============================================================================

alertingService.startMonitoring(getPaymentEvents);

console.log('[Analytics] Payment analytics system initialized');
console.log('[Analytics] Alerting monitoring started');

// ============================================================================
// STEP 6: Graceful Shutdown
// ============================================================================

process.on('SIGTERM', () => {
  console.log('[Analytics] Shutting down...');
  alertingService.stopMonitoring();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Analytics] Shutting down...');
  alertingService.stopMonitoring();
  process.exit(0);
});

// ============================================================================
// STEP 7: Start Server
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Analytics] Server running on port ${PORT}`);
  console.log(`[Analytics] Endpoints available:`);
  console.log(`  - GET /api/analytics/payments/summary`);
  console.log(`  - GET /api/analytics/payments/timeseries`);
  console.log(`  - GET /api/analytics/payments/realtime`);
  console.log(`  - GET /api/analytics/creators/:creatorId`);
  console.log(`  - GET /metrics (Prometheus)`);
  console.log(`  - GET /api/analytics/health`);
});

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Recording a successful payment
 */
export function exampleSuccessfulPayment(): void {
  const paymentEvent: PaymentEvent = {
    id: 'payment-123',
    timestamp: new Date(),
    amount_sats: 10000, // 10k sats
    payment_method: 'lightning',
    status: 'completed',
    payment_hash: '0x1234567890abcdef...',
    creator_id: 'creator-456',
    user_id: 'user-789',
    duration_ms: 500, // 500ms processing time
    retry_count: 0,
  };

  recordPaymentEvent(paymentEvent);
}

/**
 * Example: Recording a failed payment
 */
export function exampleFailedPayment(): void {
  const paymentEvent: PaymentEvent = {
    id: 'payment-124',
    timestamp: new Date(),
    amount_sats: 5000,
    payment_method: 'webln',
    status: 'failed',
    payment_hash: '0xabcdef1234567890...',
    creator_id: 'creator-456',
    user_id: 'user-789',
    duration_ms: 2000,
    retry_count: 3,
    error_code: 'INSUFFICIENT_FUNDS',
    error_message: 'User does not have sufficient balance',
  };

  recordPaymentEvent(paymentEvent);
}

/**
 * Example: Manually checking for alerts
 */
export async function exampleManualAlertCheck(): Promise<void> {
  const alerts = await alertingService.checkForAlerts(getPaymentEvents);

  console.log(`[Analytics] Manual alert check complete`);
  console.log(`[Analytics] Alerts found: ${alerts.length}`);

  for (const alert of alerts) {
    console.log(`[Analytics] - ${alert.severity}: ${alert.message}`);
  }
}

/**
 * Example: Getting active alerts
 */
export function exampleGetActiveAlerts(): void {
  const activeAlerts = alertingService.getActiveAlerts();

  console.log(`[Analytics] Active alerts: ${activeAlerts.length}`);

  for (const alert of activeAlerts) {
    console.log(`[Analytics] - ${alert.type}: ${alert.message}`);
    console.log(`  Triggered at: ${alert.triggered_at.toISOString()}`);
    console.log(`  Current value: ${alert.current_value}`);
    console.log(`  Threshold: ${alert.threshold}`);
  }
}

export default app;
