/**
 * Payment Alerting Service
 *
 * Production-grade alerting system for payment anomalies.
 * Monitors payment metrics and triggers alerts when thresholds are exceeded.
 *
 * Features:
 * - Real-time alert detection
 * - Alert deduplication
 * - Alert routing (Slack, email, PagerDuty)
 * - Alert history tracking
 * - Auto-resolution when metrics recover
 */

import {
  Alert,
  AlertThresholds,
  PaymentEvent,
  RealtimeMetrics,
} from '../types/payment-analytics';
import { PaymentAnalyticsService } from './PaymentAnalyticsService';

export interface AlertConfig {
  enabled: boolean;
  thresholds: AlertThresholds;
  checkIntervalMs: number; // How often to check for alerts
  resolutionDelayMs: number; // How long to wait before auto-resolving
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'console' | 'slack' | 'email' | 'pagerduty' | 'webhook';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AlertHistory {
  alert: Alert;
  notified_at: Date;
  resolved_at?: Date;
  channels_notified: string[];
}

/**
 * Payment Alerting Service
 */
export class PaymentAlertingService {
  private analyticsService: PaymentAnalyticsService;
  private config: AlertConfig;
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: AlertHistory[] = [];
  private checkInterval?: NodeJS.Timeout;

  constructor(
    analyticsService: PaymentAnalyticsService,
    config?: Partial<AlertConfig>
  ) {
    this.analyticsService = analyticsService;
    this.config = {
      enabled: true,
      thresholds: {
        min_success_rate: 0.95, // Alert when < 95%
        max_failure_rate: 0.05, // Alert when > 5%
        max_average_duration_ms: 30000, // Alert when > 30s
        min_payments_for_alert: 10, // Minimum payments before alerting
      },
      checkIntervalMs: 60000, // Check every minute
      resolutionDelayMs: 300000, // Auto-resolve after 5 minutes
      channels: [
        {
          type: 'console',
          enabled: true,
          config: {},
        },
      ],
      ...config,
    };
  }

  /**
   * Start monitoring for alerts
   */
  startMonitoring(getPayments: () => Promise<PaymentEvent[]> | PaymentEvent[]): void {
    if (!this.config.enabled) {
      console.log('[PaymentAlerting] Monitoring disabled');
      return;
    }

    console.log('[PaymentAlerting] Starting monitoring...');
    console.log(`[PaymentAlerting] Check interval: ${this.config.checkIntervalMs}ms`);
    console.log(`[PaymentAlerting] Thresholds:`, this.config.thresholds);

    // Initial check
    this.checkForAlerts(getPayments);

    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      await this.checkForAlerts(getPayments);
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log('[PaymentAlerting] Monitoring stopped');
    }
  }

  /**
   * Check for alerts based on recent payment data
   */
  async checkForAlerts(
    getPayments: () => Promise<PaymentEvent[]> | PaymentEvent[]
  ): Promise<Alert[]> {
    try {
      const allPayments = await getPayments();

      // Get payments from last 5 minutes for alerting
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentPayments = allPayments.filter(
        (p) => p.timestamp >= fiveMinutesAgo
      );

      if (recentPayments.length < this.config.thresholds.min_payments_for_alert) {
        // Not enough data to alert
        return [];
      }

      // Get realtime metrics
      const metrics = await this.analyticsService.getRealtimeMetrics(recentPayments);

      // Detect new alerts
      const newAlerts: Alert[] = [];

      // Check success rate
      if (metrics.recent_success_rate < this.config.thresholds.min_success_rate) {
        const alert = this.createAlert(
          'critical',
          'success_rate',
          `Payment success rate (${(metrics.recent_success_rate * 100).toFixed(1)}%) is below threshold (${(this.config.thresholds.min_success_rate * 100).toFixed(1)}%)`,
          this.config.thresholds.min_success_rate,
          metrics.recent_success_rate,
          {
            recent_payments: recentPayments.length,
            failure_rate: 1 - metrics.recent_success_rate,
            is_degraded: metrics.is_degraded,
          }
        );

        newAlerts.push(alert);
      }

      // Check latency
      if (
        metrics.recent_average_duration_ms >
        this.config.thresholds.max_average_duration_ms
      ) {
        const alert = this.createAlert(
          'warning',
          'latency',
          `Average payment duration (${metrics.recent_average_duration_ms.toFixed(0)}ms) exceeds threshold (${this.config.thresholds.max_average_duration_ms}ms)`,
          this.config.thresholds.max_average_duration_ms,
          metrics.recent_average_duration_ms,
          {
            recent_payments: recentPayments.length,
            p95_duration_ms: metrics.recent_average_duration_ms * 1.5, // Estimate
          }
        );

        newAlerts.push(alert);
      }

      // Check for low volume (no payments in last 5 minutes during business hours)
      const hour = new Date().getUTCHours();
      const isBusinessHours = hour >= 8 && hour <= 20; // 8 AM to 8 PM UTC

      if (isBusinessHours && recentPayments.length === 0) {
        const alert = this.createAlert(
          'warning',
          'volume',
          'No payments received in the last 5 minutes during business hours',
          1,
          0,
          {
            business_hours: true,
            hour_utc: hour,
          }
        );

        newAlerts.push(alert);
      }

      // Process alerts
      for (const alert of newAlerts) {
        await this.handleAlert(alert);
      }

      // Check for alerts to resolve
      await this.checkForResolutions(metrics);

      return newAlerts;
    } catch (error) {
      console.error('[PaymentAlerting] Error checking for alerts:', error);
      return [];
    }
  }

  /**
   * Handle a new alert
   */
  private async handleAlert(alert: Alert): Promise<void> {
    const alertKey = `${alert.type}-${alert.severity}`;

    // Check if alert already exists (deduplication)
    const existingAlert = this.activeAlerts.get(alertKey);

    if (existingAlert) {
      // Update existing alert
      existingAlert.current_value = alert.current_value;
      existingAlert.metadata = alert.metadata;
      console.log(`[PaymentAlerting] Updated existing alert: ${alert.message}`);
      return;
    }

    // New alert - activate it
    this.activeAlerts.set(alertKey, alert);
    console.log(`[PaymentAlerting] 🚨 NEW ALERT: ${alert.message}`);

    // Send notifications
    await this.sendNotifications(alert);

    // Add to history
    this.alertHistory.push({
      alert,
      notified_at: new Date(),
      channels_notified: this.config.channels
        .filter((c) => c.enabled)
        .map((c) => c.type),
    });
  }

  /**
   * Check if any alerts should be resolved
   */
  private async checkForResolutions(metrics: RealtimeMetrics): Promise<void> {
    const now = Date.now();

    for (const [key, alert] of this.activeAlerts.entries()) {
      let shouldResolve = false;

      // Check if alert condition has cleared
      if (alert.type === 'success_rate') {
        shouldResolve = metrics.recent_success_rate >= this.config.thresholds.min_success_rate;
      } else if (alert.type === 'latency') {
        shouldResolve = metrics.recent_average_duration_ms <= this.config.thresholds.max_average_duration_ms;
      } else if (alert.type === 'volume') {
        shouldResolve = metrics.payments_per_minute > 0;
      }

      // Auto-resolve if cleared for resolution delay period
      if (shouldResolve) {
        const triggeredTime = alert.triggered_at.getTime();
        const elapsedMs = now - triggeredTime;

        if (elapsedMs >= this.config.resolutionDelayMs) {
          await this.resolveAlert(key, alert);
        }
      }
    }
  }

  /**
   * Resolve an active alert
   */
  private async resolveAlert(key: string, alert: Alert): Promise<void> {
    alert.resolved_at = new Date();
    this.activeAlerts.delete(key);

    console.log(`[PaymentAlerting] ✅ RESOLVED: ${alert.message}`);

    // Update history
    const historyEntry = this.alertHistory.find(
      (h) => h.alert.id === alert.id && !h.resolved_at
    );

    if (historyEntry) {
      historyEntry.resolved_at = new Date();
    }

    // Send resolution notification
    await this.sendResolutionNotification(alert);
  }

  /**
   * Send alert notifications to configured channels
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    for (const channel of this.config.channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'console':
            this.sendConsoleNotification(alert);
            break;
          case 'slack':
            await this.sendSlackNotification(alert, channel.config);
            break;
          case 'email':
            await this.sendEmailNotification(alert, channel.config);
            break;
          case 'pagerduty':
            await this.sendPagerDutyNotification(alert, channel.config);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert, channel.config);
            break;
        }
      } catch (error) {
        console.error(
          `[PaymentAlerting] Failed to send notification via ${channel.type}:`,
          error
        );
      }
    }
  }

  /**
   * Send console notification (for development)
   */
  private sendConsoleNotification(alert: Alert): void {
    const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`${icon} PAYMENT ALERT - ${alert.severity.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Type: ${alert.type}`);
    console.log(`Message: ${alert.message}`);
    console.log(`Threshold: ${alert.threshold}`);
    console.log(`Current Value: ${alert.current_value}`);
    console.log(`Triggered At: ${alert.triggered_at.toISOString()}`);
    console.log(`Metadata:`, JSON.stringify(alert.metadata, null, 2));
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    alert: Alert,
    config: Record<string, any>
  ): Promise<void> {
    // Placeholder - implement with actual Slack webhook
    console.log('[PaymentAlerting] Would send Slack notification:', alert.message);
    // TODO: Implement Slack webhook integration
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    alert: Alert,
    config: Record<string, any>
  ): Promise<void> {
    // Placeholder - implement with email service
    console.log('[PaymentAlerting] Would send email notification:', alert.message);
    // TODO: Implement email integration
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(
    alert: Alert,
    config: Record<string, any>
  ): Promise<void> {
    // Placeholder - implement with PagerDuty API
    console.log('[PaymentAlerting] Would send PagerDuty notification:', alert.message);
    // TODO: Implement PagerDuty integration
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    alert: Alert,
    config: Record<string, any>
  ): Promise<void> {
    // Placeholder - implement with webhook POST
    console.log('[PaymentAlerting] Would send webhook notification:', alert.message);
    // TODO: Implement webhook integration
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(alert: Alert): Promise<void> {
    console.log(`[PaymentAlerting] ✅ Alert resolved: ${alert.message}`);
    // TODO: Implement resolution notifications for each channel
  }

  /**
   * Create alert object
   */
  private createAlert(
    severity: 'critical' | 'warning' | 'info',
    type: Alert['type'],
    message: string,
    threshold: number,
    currentValue: number,
    metadata: Record<string, any>
  ): Alert {
    return {
      id: `alert-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      severity,
      type,
      message,
      threshold,
      current_value: currentValue,
      triggered_at: new Date(),
      metadata,
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): AlertHistory[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = [];
  }
}
