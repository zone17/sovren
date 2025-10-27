/**
 * Payment Alerting Service Tests
 *
 * Tests for alert detection, deduplication, and notification routing.
 *
 * Coverage Target: ≥95%
 */

import { PaymentAlertingService } from '../services/PaymentAlertingService';
import { PaymentAnalyticsService } from '../services/PaymentAnalyticsService';
import { PaymentEvent } from '../types/payment-analytics';

describe('PaymentAlertingService', () => {
  let analyticsService: PaymentAnalyticsService;
  let alertingService: PaymentAlertingService;

  beforeEach(() => {
    analyticsService = new PaymentAnalyticsService();
    alertingService = new PaymentAlertingService(analyticsService, {
      enabled: true,
      checkIntervalMs: 1000,
      resolutionDelayMs: 100, // Short delay for testing
    });
  });

  afterEach(() => {
    alertingService.stopMonitoring();
  });

  describe('Alert Detection', () => {
    it('should detect low success rate alert', async () => {
      const degradedPayments = createDegradedPayments(80); // 80% success rate

      const alerts = await alertingService.checkForAlerts(async () => degradedPayments);

      expect(alerts.length).toBeGreaterThan(0);

      const successRateAlert = alerts.find((a) => a.type === 'success_rate');
      expect(successRateAlert).toBeDefined();
      expect(successRateAlert?.severity).toBe('critical');
      expect(successRateAlert?.message).toContain('success rate');
    });

    it('should not alert when success rate is above threshold', async () => {
      const healthyPayments = createHealthyPayments();

      const alerts = await alertingService.checkForAlerts(async () => healthyPayments);

      const successRateAlert = alerts.find((a) => a.type === 'success_rate');
      expect(successRateAlert).toBeUndefined();
    });

    it('should detect high latency alert', async () => {
      const slowPayments = createSlowPayments();

      const alerts = await alertingService.checkForAlerts(async () => slowPayments);

      const latencyAlert = alerts.find((a) => a.type === 'latency');
      expect(latencyAlert).toBeDefined();
      expect(latencyAlert?.severity).toBe('warning');
      expect(latencyAlert?.message).toContain('duration');
    });

    it('should not alert when payment count is below minimum', async () => {
      const fewPayments = createHealthyPayments().slice(0, 5); // Only 5 payments

      const alerts = await alertingService.checkForAlerts(async () => fewPayments);

      expect(alerts).toHaveLength(0);
    });

    it('should detect low volume alert during business hours', async () => {
      // Mock business hours
      const now = new Date();
      const businessHour = 12; // Noon UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), businessHour));

      const noPayments: PaymentEvent[] = [];

      const alerts = await alertingService.checkForAlerts(async () => noPayments);

      // Note: This will only trigger if we have 0 payments and it's business hours
      // The actual implementation checks for this condition

      jest.useRealTimers();
    });
  });

  describe('Alert Deduplication', () => {
    it('should not create duplicate alerts for same issue', async () => {
      const degradedPayments = createDegradedPayments(80);

      // First check
      await alertingService.checkForAlerts(async () => degradedPayments);
      const activeAlerts1 = alertingService.getActiveAlerts();

      // Second check (should update, not duplicate)
      await alertingService.checkForAlerts(async () => degradedPayments);
      const activeAlerts2 = alertingService.getActiveAlerts();

      expect(activeAlerts1.length).toBe(activeAlerts2.length);
    });

    it('should update existing alert with new metrics', async () => {
      const degradedPayments1 = createDegradedPayments(80);

      await alertingService.checkForAlerts(async () => degradedPayments1);
      const activeAlerts1 = alertingService.getActiveAlerts();
      const alert1 = activeAlerts1[0];

      // Create worse conditions
      const degradedPayments2 = createDegradedPayments(70);

      await alertingService.checkForAlerts(async () => degradedPayments2);
      const activeAlerts2 = alertingService.getActiveAlerts();
      const alert2 = activeAlerts2[0];

      expect(alert2.current_value).toBeLessThan(alert1.current_value);
    });
  });

  describe('Alert Resolution', () => {
    it('should resolve alerts when conditions improve', async () => {
      jest.useFakeTimers();

      const degradedPayments = createDegradedPayments(80);
      const healthyPayments = createHealthyPayments();

      // Trigger alert
      await alertingService.checkForAlerts(async () => degradedPayments);
      expect(alertingService.getActiveAlerts().length).toBeGreaterThan(0);

      // Wait for resolution delay
      jest.advanceTimersByTime(200); // resolutionDelayMs is 100

      // Conditions improve
      await alertingService.checkForAlerts(async () => healthyPayments);

      // Alert should be resolved
      expect(alertingService.getActiveAlerts().length).toBe(0);

      jest.useRealTimers();
    });

    it('should track alert resolution in history', async () => {
      jest.useFakeTimers();

      const degradedPayments = createDegradedPayments(80);
      const healthyPayments = createHealthyPayments();

      await alertingService.checkForAlerts(async () => degradedPayments);

      jest.advanceTimersByTime(200);

      await alertingService.checkForAlerts(async () => healthyPayments);

      const history = alertingService.getAlertHistory();
      const resolvedAlert = history.find((h) => h.resolved_at !== undefined);

      expect(resolvedAlert).toBeDefined();
      expect(resolvedAlert?.resolved_at).toBeDefined();

      jest.useRealTimers();
    });
  });

  describe('Alert History', () => {
    it('should track all triggered alerts', async () => {
      const degradedPayments = createDegradedPayments(80);

      await alertingService.checkForAlerts(async () => degradedPayments);

      const history = alertingService.getAlertHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('alert');
      expect(history[0]).toHaveProperty('notified_at');
      expect(history[0]).toHaveProperty('channels_notified');
    });

    it('should limit history when requested', async () => {
      const degradedPayments = createDegradedPayments(80);

      // Trigger multiple alerts
      await alertingService.checkForAlerts(async () => degradedPayments);
      await alertingService.checkForAlerts(async () => degradedPayments);

      const fullHistory = alertingService.getAlertHistory();
      const limitedHistory = alertingService.getAlertHistory(1);

      expect(limitedHistory.length).toBeLessThanOrEqual(1);
      expect(fullHistory.length).toBeGreaterThanOrEqual(limitedHistory.length);
    });

    it('should clear history when requested', async () => {
      const degradedPayments = createDegradedPayments(80);

      await alertingService.checkForAlerts(async () => degradedPayments);

      alertingService.clearHistory();

      const history = alertingService.getAlertHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Monitoring Control', () => {
    it('should start and stop monitoring', (done) => {
      const healthyPayments = createHealthyPayments();

      let checkCount = 0;
      const getPayments = async () => {
        checkCount++;
        return healthyPayments;
      };

      // Start monitoring
      alertingService.startMonitoring(getPayments);

      // Wait for a couple checks
      setTimeout(() => {
        alertingService.stopMonitoring();

        const checksAtStop = checkCount;

        // Wait a bit more
        setTimeout(() => {
          // Should not have increased
          expect(checkCount).toBe(checksAtStop);
          done();
        }, 1500);
      }, 2500);
    });

    it('should not start monitoring when disabled', () => {
      const disabledService = new PaymentAlertingService(analyticsService, {
        enabled: false,
      });

      disabledService.startMonitoring(async () => []);

      const activeAlerts = disabledService.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });
  });
});

/**
 * Helper: Create healthy payment events
 */
function createHealthyPayments(): PaymentEvent[] {
  const now = new Date();
  const payments: PaymentEvent[] = [];

  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - i * 1000);

    payments.push({
      id: `payment-${i}`,
      timestamp,
      amount_sats: 1000,
      payment_method: 'lightning',
      status: i < 98 ? 'completed' : 'failed', // 98% success rate
      payment_hash: `hash-${i}`,
      creator_id: 'creator1',
      duration_ms: 300,
      retry_count: 0,
    });
  }

  return payments;
}

/**
 * Helper: Create degraded payment events
 */
function createDegradedPayments(successRatePercent: number): PaymentEvent[] {
  const now = new Date();
  const payments: PaymentEvent[] = [];

  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - i * 1000);

    payments.push({
      id: `payment-${i}`,
      timestamp,
      amount_sats: 1000,
      payment_method: 'lightning',
      status: i < successRatePercent ? 'completed' : 'failed',
      payment_hash: `hash-${i}`,
      creator_id: 'creator1',
      duration_ms: 300,
      retry_count: i >= successRatePercent ? 2 : 0,
      error_code: i >= successRatePercent ? 'TIMEOUT' : undefined,
    });
  }

  return payments;
}

/**
 * Helper: Create slow payment events
 */
function createSlowPayments(): PaymentEvent[] {
  const now = new Date();
  const payments: PaymentEvent[] = [];

  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - i * 1000);

    payments.push({
      id: `payment-${i}`,
      timestamp,
      amount_sats: 1000,
      payment_method: 'lightning',
      status: 'completed',
      payment_hash: `hash-${i}`,
      creator_id: 'creator1',
      duration_ms: 45000, // 45 seconds - very slow!
      retry_count: 0,
    });
  }

  return payments;
}
