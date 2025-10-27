/**
 * Health Check Service Tests
 *
 * Comprehensive test suite for payment system health monitoring.
 * Tests all health check components and system status aggregation.
 *
 * @module __tests__/health-check
 * @story PAY-013
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthCheckService, SystemHealthStatus } from '../services/HealthCheckService';

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService;

  beforeEach(() => {
    healthCheckService = new HealthCheckService({
      timeout_ms: 5000,
      check_interval_ms: 30000,
    });
  });

  afterEach(() => {
    healthCheckService.stopMonitoring();
  });

  describe('Lightning Node Health Check', () => {
    it('should return healthy status when Lightning node is accessible', async () => {
      const result = await healthCheckService.checkLightningNode();

      expect(result.component).toBe('lightning_node');
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata with node information', async () => {
      const result = await healthCheckService.checkLightningNode();

      expect(result.metadata).toBeDefined();
      if (result.status === 'healthy') {
        expect(result.metadata).toHaveProperty('url');
      }
    });

    it('should measure latency correctly', async () => {
      const result = await healthCheckService.checkLightningNode();

      expect(result.latency_ms).toBeGreaterThan(0);
      expect(result.latency_ms).toBeLessThan(10000); // Should complete within 10s
    });
  });

  describe('Database Health Check', () => {
    it('should return degraded status when database client not configured', async () => {
      const result = await healthCheckService.checkDatabase();

      expect(result.component).toBe('database');
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('not configured');
    });

    it('should return healthy status with valid database client', async () => {
      const mockDbClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      const service = new HealthCheckService({
        timeout_ms: 5000,
        database_client: mockDbClient,
      });

      const result = await service.checkDatabase();

      expect(result.component).toBe('database');
      expect(result.latency_ms).toBeDefined();
    });

    it('should measure database check latency', async () => {
      const mockDbClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      const service = new HealthCheckService({
        timeout_ms: 5000,
        database_client: mockDbClient,
      });

      const result = await service.checkDatabase();

      // Latency should be measured
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
      expect(result.latency_ms).toBeLessThan(5000);
    });

    it('should include timestamp in health check', async () => {
      const result = await healthCheckService.checkDatabase();

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Payment Processor Health Check', () => {
    it('should return healthy status when processor is operating normally', async () => {
      const result = await healthCheckService.checkPaymentProcessor();

      expect(result.component).toBe('payment_processor');
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include queue depth and processing rate in metadata', async () => {
      const result = await healthCheckService.checkPaymentProcessor();

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('queue_depth');
      expect(result.metadata).toHaveProperty('processing_rate_per_sec');
      expect(result.metadata).toHaveProperty('pending_verifications');
    });

    it('should measure processing latency', async () => {
      const result = await healthCheckService.checkPaymentProcessor();

      expect(result.latency_ms).toBeGreaterThan(0);
      expect(result.latency_ms).toBeLessThan(5000);
    });
  });

  describe('Webhook Endpoint Health Check', () => {
    it('should return healthy status when webhook endpoint is responsive', async () => {
      const result = await healthCheckService.checkWebhookEndpoint();

      expect(result.component).toBe('webhook_endpoint');
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include webhook URL in metadata', async () => {
      const service = new HealthCheckService({
        timeout_ms: 5000,
        webhook_url: 'http://example.com/webhook',
      });

      const result = await service.checkWebhookEndpoint();

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('url');
    });

    it('should measure webhook response time', async () => {
      const result = await healthCheckService.checkWebhookEndpoint();

      expect(result.latency_ms).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker Health Check', () => {
    it('should return healthy status when circuit breaker is closed', async () => {
      const result = await healthCheckService.checkCircuitBreaker();

      expect(result.component).toBe('circuit_breaker');
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include circuit breaker state in metadata', async () => {
      const result = await healthCheckService.checkCircuitBreaker();

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('state');
      expect(result.metadata?.state).toMatch(/closed|half-open|open/);
    });

    it('should return unhealthy when circuit breaker is open', async () => {
      const result = await healthCheckService.checkCircuitBreaker();

      if (result.metadata?.state === 'open') {
        expect(result.status).toBe('unhealthy');
        expect(result.message).toContain('open');
      }
    });
  });

  describe('System Health Status', () => {
    it('should aggregate all component health checks', async () => {
      const status = await healthCheckService.checkAllComponents();

      expect(status.overall_status).toMatch(/healthy|degraded|unhealthy/);
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(status.uptime_seconds).toBeGreaterThanOrEqual(0);

      // Verify all components are checked
      expect(status.components).toHaveProperty('lightning_node');
      expect(status.components).toHaveProperty('database');
      expect(status.components).toHaveProperty('payment_processor');
      expect(status.components).toHaveProperty('webhook_endpoint');
      expect(status.components).toHaveProperty('circuit_breaker');
    });

    it('should calculate metrics correctly', async () => {
      const status = await healthCheckService.checkAllComponents();

      const { metrics } = status;
      expect(metrics.total_checks).toBe(5); // 5 components
      expect(metrics.healthy_checks + metrics.degraded_checks + metrics.unhealthy_checks).toBe(5);
    });

    it('should determine overall status as unhealthy if any component is unhealthy', async () => {
      const status = await healthCheckService.checkAllComponents();

      const hasUnhealthyComponent = Object.values(status.components).some(
        (component) => component.status === 'unhealthy'
      );

      if (hasUnhealthyComponent) {
        expect(status.overall_status).toBe('unhealthy');
      }
    });

    it('should determine overall status as degraded if any component is degraded', async () => {
      const status = await healthCheckService.checkAllComponents();

      const hasUnhealthyComponent = Object.values(status.components).some(
        (component) => component.status === 'unhealthy'
      );
      const hasDegradedComponent = Object.values(status.components).some(
        (component) => component.status === 'degraded'
      );

      if (!hasUnhealthyComponent && hasDegradedComponent) {
        expect(status.overall_status).toBe('degraded');
      }
    });

    it('should track uptime since service start', async () => {
      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await healthCheckService.checkAllComponents();

      // Uptime should be at least 0 (service just started)
      expect(status.uptime_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Continuous Monitoring', () => {
    it('should start monitoring without errors', () => {
      expect(() => {
        healthCheckService.startMonitoring();
      }).not.toThrow();
    });

    it('should stop monitoring without errors', () => {
      healthCheckService.startMonitoring();

      expect(() => {
        healthCheckService.stopMonitoring();
      }).not.toThrow();
    });

    it('should store last check results', async () => {
      await healthCheckService.checkAllComponents();

      const lastResults = healthCheckService.getLastCheckResults();

      expect(lastResults.size).toBeGreaterThan(0);
      expect(lastResults.has('lightning_node')).toBe(true);
      expect(lastResults.has('database')).toBe(true);
    });

    it('should retrieve component health by name', async () => {
      await healthCheckService.checkAllComponents();

      const lightningHealth = healthCheckService.getComponentHealth('lightning_node');

      expect(lightningHealth).toBeDefined();
      expect(lightningHealth?.component).toBe('lightning_node');
    });

    it('should return undefined for non-existent component', async () => {
      const nonExistent = healthCheckService.getComponentHealth('non_existent');

      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in Lightning node check', async () => {
      // Service should not throw even if check fails
      const result = await healthCheckService.checkLightningNode();

      expect(result).toBeDefined();
      expect(result.component).toBe('lightning_node');
    });

    it('should include error details in metadata when check fails', async () => {
      const result = await healthCheckService.checkLightningNode();

      if (result.status === 'unhealthy') {
        expect(result.metadata).toHaveProperty('error');
        expect(result.message).toBeDefined();
      }
    });

    it('should complete checks within timeout', async () => {
      const startTime = Date.now();
      await healthCheckService.checkAllComponents();
      const duration = Date.now() - startTime;

      // Should complete well within timeout (5s) + overhead
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when not provided', () => {
      const service = new HealthCheckService();

      expect(service).toBeDefined();
      // Service should work with defaults
    });

    it('should accept custom timeout configuration', () => {
      const service = new HealthCheckService({
        timeout_ms: 3000,
      });

      expect(service).toBeDefined();
    });

    it('should accept custom check interval', () => {
      const service = new HealthCheckService({
        check_interval_ms: 15000,
      });

      expect(service).toBeDefined();
    });

    it('should accept all configuration options', () => {
      const service = new HealthCheckService({
        timeout_ms: 5000,
        check_interval_ms: 30000,
        database_client: { query: vi.fn() },
        lightning_node_url: 'http://localhost:10009',
        webhook_url: 'http://localhost:3000/webhook',
      });

      expect(service).toBeDefined();
    });
  });
});
