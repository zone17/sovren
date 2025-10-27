/**
 * Prometheus Exporter Tests
 *
 * Test suite for Prometheus metrics generation and formatting.
 * Validates metrics comply with Prometheus exposition format.
 *
 * @module __tests__/prometheus-exporter
 * @story PAY-013
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrometheusExporter } from '../services/PrometheusExporter';
import { PrometheusMetrics } from '../types/payment-analytics';
import { SystemHealthStatus } from '../services/HealthCheckService';

describe('PrometheusExporter', () => {
  let mockPaymentMetrics: PrometheusMetrics;
  let mockHealthStatus: SystemHealthStatus;

  beforeEach(() => {
    mockPaymentMetrics = {
      payment_total: 1000,
      payment_success_total: 950,
      payment_failure_total: 50,
      payment_volume_sats_total: 5000000,
      payment_success_rate: 0.95,
      active_payments_count: 5,
      payment_amount_sats_bucket: {
        '100': 100,
        '500': 300,
        '1000': 500,
        '5000': 800,
        '10000': 950,
        '+Inf': 1000,
      },
      payment_duration_ms_bucket: {
        '100': 200,
        '500': 600,
        '1000': 850,
        '5000': 950,
        '10000': 980,
        '+Inf': 1000,
      },
      timestamp: new Date('2024-01-15T10:00:00Z'),
      scrape_duration_ms: 25,
    };

    mockHealthStatus = {
      overall_status: 'healthy',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      uptime_seconds: 3600,
      components: {
        lightning_node: {
          status: 'healthy',
          component: 'lightning_node',
          timestamp: new Date(),
          latency_ms: 50,
          message: 'Lightning node connected',
        },
        database: {
          status: 'healthy',
          component: 'database',
          timestamp: new Date(),
          latency_ms: 30,
          message: 'Database responding normally',
        },
        payment_processor: {
          status: 'healthy',
          component: 'payment_processor',
          timestamp: new Date(),
          latency_ms: 40,
          message: 'Payment processor operating normally',
        },
        webhook_endpoint: {
          status: 'healthy',
          component: 'webhook_endpoint',
          timestamp: new Date(),
          latency_ms: 100,
          message: 'Webhook endpoint responsive',
        },
        circuit_breaker: {
          status: 'healthy',
          component: 'circuit_breaker',
          timestamp: new Date(),
          latency_ms: 5,
          message: 'Circuit breaker closed',
        },
      },
      metrics: {
        total_checks: 5,
        healthy_checks: 5,
        degraded_checks: 0,
        unhealthy_checks: 0,
      },
    };
  });

  describe('Metrics Export', () => {
    it('should export metrics in Prometheus text format', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
      expect(typeof output).toBe('string');
    });

    it('should include payment counter metrics', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('payment_total{status="completed",method="lightning"} 950');
      expect(output).toContain('payment_total{status="failed",method="lightning"} 50');
    });

    it('should include payment volume metrics', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('payment_volume_sats_total{method="lightning"} 5000000');
    });

    it('should include payment success rate gauge', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('payment_success_rate 0.9500');
    });

    it('should include active payments count', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('active_payments_count 5');
    });

    it('should include histogram buckets for payment amounts', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('payment_amount_sats_bucket{method="lightning",le="100"} 100');
      expect(output).toContain('payment_amount_sats_bucket{method="lightning",le="1000"} 500');
      expect(output).toContain('payment_amount_sats_bucket{method="lightning",le="+Inf"} 1000');
    });

    it('should include histogram buckets for payment duration in seconds', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      // Duration should be converted from ms to seconds
      expect(output).toContain('payment_duration_seconds_bucket');
      expect(output).toContain('le="0.100"'); // 100ms -> 0.1s
      expect(output).toContain('le="1.000"'); // 1000ms -> 1s
    });

    it('should include health check status metrics', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('health_check_status{component="lightning_node"} 1');
      expect(output).toContain('health_check_status{component="database"} 1');
      expect(output).toContain('health_check_status{component="payment_processor"} 1');
    });

    it('should include health check latency metrics', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('health_check_latency_seconds{component="lightning_node"} 0.0500');
      expect(output).toContain('health_check_latency_seconds{component="database"} 0.0300');
    });

    it('should include system uptime metric', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('system_uptime_seconds 3600');
    });

    it('should include scrape duration metric', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('scrape_duration_seconds 0.0250');
    });
  });

  describe('Health Status Conversion', () => {
    it('should convert healthy status to 1.0', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('health_check_status{component="lightning_node"} 1');
    });

    it('should convert degraded status to 0.5', () => {
      mockHealthStatus.components.database.status = 'degraded';

      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('health_check_status{component="database"} 0.5');
    });

    it('should convert unhealthy status to 0.0', () => {
      mockHealthStatus.components.lightning_node.status = 'unhealthy';

      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('health_check_status{component="lightning_node"} 0');
    });
  });

  describe('Additional Metrics', () => {
    it('should include additional metrics when provided', () => {
      const additionalMetrics = {
        custom_metric: 42,
        another_metric: 100,
      };

      const output = PrometheusExporter.exportMetrics(
        mockPaymentMetrics,
        mockHealthStatus,
        additionalMetrics
      );

      expect(output).toContain('custom_metric 42');
      expect(output).toContain('another_metric 100');
    });

    it('should ignore non-numeric additional metrics', () => {
      const additionalMetrics = {
        valid_metric: 42,
        invalid_metric: 'not a number' as any,
      };

      const output = PrometheusExporter.exportMetrics(
        mockPaymentMetrics,
        mockHealthStatus,
        additionalMetrics
      );

      expect(output).toContain('valid_metric 42');
      expect(output).not.toContain('invalid_metric');
    });
  });

  describe('OpenMetrics Format', () => {
    it('should export in OpenMetrics format', () => {
      const output = PrometheusExporter.exportOpenMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('# OpenMetrics format');
      expect(output).toContain('# EOF');
    });

    it('should include timestamps in OpenMetrics format', () => {
      const output = PrometheusExporter.exportOpenMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain(mockPaymentMetrics.timestamp.getTime().toString());
    });
  });

  describe('Metric Definitions', () => {
    it('should provide metric definitions', () => {
      const definitions = PrometheusExporter.getMetricDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBeGreaterThan(0);
    });

    it('should include metric name, help, and type in definitions', () => {
      const definitions = PrometheusExporter.getMetricDefinitions();

      definitions.forEach((def) => {
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('help');
        expect(def).toHaveProperty('type');
        expect(['counter', 'gauge', 'histogram', 'summary']).toContain(def.type);
      });
    });

    it('should include payment metrics in definitions', () => {
      const definitions = PrometheusExporter.getMetricDefinitions();

      const paymentTotal = definitions.find((d) => d.name === 'payment_total');
      expect(paymentTotal).toBeDefined();
      expect(paymentTotal?.type).toBe('counter');
    });

    it('should include health check metrics in definitions', () => {
      const definitions = PrometheusExporter.getMetricDefinitions();

      const healthCheck = definitions.find((d) => d.name === 'health_check_status');
      expect(healthCheck).toBeDefined();
      expect(healthCheck?.type).toBe('gauge');
    });
  });

  describe('Metric Naming Validation', () => {
    it('should validate correct metric names', () => {
      expect(PrometheusExporter.validateMetricName('payment_total')).toBe(true);
      expect(PrometheusExporter.validateMetricName('http_requests_total')).toBe(true);
      expect(PrometheusExporter.validateMetricName('node_cpu_seconds_total')).toBe(true);
    });

    it('should reject invalid metric names', () => {
      expect(PrometheusExporter.validateMetricName('123invalid')).toBe(false);
      expect(PrometheusExporter.validateMetricName('invalid-name')).toBe(false);
      expect(PrometheusExporter.validateMetricName('invalid.name')).toBe(false);
    });

    it('should allow colons and underscores in metric names', () => {
      expect(PrometheusExporter.validateMetricName('my:metric_name')).toBe(true);
      expect(PrometheusExporter.validateMetricName('_leading_underscore')).toBe(true);
    });
  });

  describe('Label Naming Validation', () => {
    it('should validate correct label names', () => {
      expect(PrometheusExporter.validateLabelName('method')).toBe(true);
      expect(PrometheusExporter.validateLabelName('status_code')).toBe(true);
      expect(PrometheusExporter.validateLabelName('_private_label')).toBe(true);
    });

    it('should reject invalid label names', () => {
      expect(PrometheusExporter.validateLabelName('123invalid')).toBe(false);
      expect(PrometheusExporter.validateLabelName('invalid-label')).toBe(false);
      expect(PrometheusExporter.validateLabelName('__reserved')).toBe(false); // Double underscore reserved
    });
  });

  describe('Format Compliance', () => {
    it('should produce valid Prometheus text format', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      // Check for required format elements
      expect(output).toMatch(/# HELP \w+ .+/);
      expect(output).toMatch(/# TYPE \w+ (counter|gauge|histogram|summary)/);
      expect(output).toMatch(/\w+(\{.+\})? \d+(\.\d+)?/);
    });

    it('should end lines with newline', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      const lines = output.split('\n');
      expect(lines.length).toBeGreaterThan(10); // Should have many lines
    });

    it('should not have trailing whitespace', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      const lines = output.split('\n');
      lines.forEach((line) => {
        if (line.length > 0) {
          expect(line).toBe(line.trimEnd());
        }
      });
    });

    it('should use correct histogram format with sum and count', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      expect(output).toContain('_bucket{');
      expect(output).toContain('_sum');
      expect(output).toContain('_count');
    });

    it('should sort histogram buckets correctly', () => {
      const output = PrometheusExporter.exportMetrics(mockPaymentMetrics, mockHealthStatus);

      const bucketLines = output
        .split('\n')
        .filter((line) => line.includes('payment_amount_sats_bucket'));

      // Extract bucket values
      const buckets = bucketLines.map((line) => {
        const match = line.match(/le="([^"]+)"/);
        return match ? match[1] : '';
      });

      // Verify +Inf is last
      expect(buckets[buckets.length - 1]).toBe('+Inf');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values correctly', () => {
      const zeroMetrics = {
        ...mockPaymentMetrics,
        payment_total: 0,
        payment_success_total: 0,
        payment_failure_total: 0,
        payment_success_rate: 0,
      };

      const output = PrometheusExporter.exportMetrics(zeroMetrics, mockHealthStatus);

      expect(output).toContain('payment_success_rate 0.0000');
      expect(output).toContain('active_payments_count 5');
    });

    it('should handle very large numbers', () => {
      const largeMetrics = {
        ...mockPaymentMetrics,
        payment_volume_sats_total: 999999999999,
      };

      const output = PrometheusExporter.exportMetrics(largeMetrics, mockHealthStatus);

      expect(output).toContain('payment_volume_sats_total{method="lightning"} 999999999999');
    });

    it('should handle decimal precision correctly', () => {
      const preciseMetrics = {
        ...mockPaymentMetrics,
        payment_success_rate: 0.9876543210,
      };

      const output = PrometheusExporter.exportMetrics(preciseMetrics, mockHealthStatus);

      expect(output).toContain('payment_success_rate 0.9877'); // 4 decimal places
    });

    it('should handle empty histogram buckets', () => {
      const emptyHistogram = {
        ...mockPaymentMetrics,
        payment_amount_sats_bucket: { '+Inf': 0 },
      };

      const output = PrometheusExporter.exportMetrics(emptyHistogram, mockHealthStatus);

      expect(output).toContain('le="+Inf"');
    });
  });
});
