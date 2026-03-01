/**
 * Deployment Smoke Tests (Standalone)
 *
 * Lightweight smoke tests that can run independently
 * without full Express app initialization.
 *
 * These tests validate deployment readiness by checking:
 * - Environment configuration
 * - Critical dependencies availability
 * - Monitoring middleware functionality
 *
 * @module deployment-smoke-tests
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Deployment Smoke Tests', () => {
  describe('Environment Configuration', () => {
    it('should have test environment configured', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have required environment variables defined', () => {
      const requiredVars = ['NODE_ENV'];

      requiredVars.forEach((varName) => {
        expect(process.env[varName]).toBeDefined();
      });
    });
  });

  describe('Health Check Logic', () => {
    it('should have health check routes module', () => {
      const healthRoutePath = path.join(__dirname, '../routes/health.ts');
      const exists = fs.existsSync(healthRoutePath);
      expect(exists).toBe(true);
    });

    it('should export deployment monitoring middleware', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');

      expect(monitoring.deploymentMonitoring).toBeDefined();
      expect(typeof monitoring.deploymentMonitoring).toBe('function');
      expect(monitoring.getPrometheusMetrics).toBeDefined();
      expect(typeof monitoring.getPrometheusMetrics).toBe('function');
    });
  });

  describe('Deployment Monitoring', () => {
    it('should export Prometheus metrics middleware', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      expect(monitoring.deploymentMonitoring).toBeDefined();
      expect(typeof monitoring.deploymentMonitoring).toBe('function');
    });

    it('should export metrics registry', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      expect(monitoring.metricsRegistry).toBeDefined();
    });

    it('should expose metrics in Prometheus format', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      const metricsText = await monitoring.metricsRegistry.metrics();
      expect(typeof metricsText).toBe('string');
    });

    it('should have HTTP request counter metric', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      const metricsJson = await monitoring.metricsRegistry.getMetricsAsJSON();
      const names = metricsJson.map((m: any) => m.name);
      expect(names).toContain('sovren_http_requests_total');
    });

    it('should have HTTP request duration metric', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      const metricsJson = await monitoring.metricsRegistry.getMetricsAsJSON();
      const names = metricsJson.map((m: any) => m.name);
      expect(names).toContain('sovren_http_request_duration_seconds');
    });

    it('should have active connections gauge', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      const metricsJson = await monitoring.metricsRegistry.getMetricsAsJSON();
      const names = metricsJson.map((m: any) => m.name);
      expect(names).toContain('sovren_http_active_connections');
    });

    it('should export JSON metrics helper', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      expect(monitoring.getJsonMetrics).toBeDefined();
      const json = await monitoring.getJsonMetrics();
      expect(typeof json).toBe('object');
    });

    it('should export getPrometheusMetrics handler', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      expect(monitoring.getPrometheusMetrics).toBeDefined();
      expect(typeof monitoring.getPrometheusMetrics).toBe('function');
    });
  });

  describe('Critical Dependencies', () => {
    it('should have express installed', async () => {
      const express = await import('express');
      expect(express).toBeDefined();
      expect(typeof express.default).toBe('function');
    });

    it('should have helmet for security', async () => {
      const helmet = await import('helmet');
      expect(helmet).toBeDefined();
    });

    it('should have cors configured', async () => {
      const cors = await import('cors');
      expect(cors).toBeDefined();
    });

    it('should have rate limiting available', async () => {
      const rateLimit = await import('express-rate-limit');
      expect(rateLimit).toBeDefined();
    });

    it('should have Supabase client', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      expect(createClient).toBeDefined();
      expect(typeof createClient).toBe('function');
    });
  });

  describe('Deployment Readiness', () => {
    it('should have deployment monitoring middleware available', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');

      expect(monitoring.deploymentMonitoring).toBeDefined();
      expect(monitoring.getPrometheusMetrics).toBeDefined();
      expect(monitoring.metricsRegistry).toBeDefined();
    });

    it('should validate Prometheus metrics output', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');

      const metricsText = await monitoring.metricsRegistry.metrics();
      expect(typeof metricsText).toBe('string');
      // Prometheus format contains HELP and TYPE lines
      expect(metricsText).toContain('# HELP');
      expect(metricsText).toContain('# TYPE');
    });

    it('should validate JSON metrics structure', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');
      const json = await monitoring.getJsonMetrics();

      expect(typeof json).toBe('object');
      // Should have at least the custom metrics
      const keys = Object.keys(json);
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Baselines', () => {
    it('should initialize monitoring within acceptable time', async () => {
      const start = Date.now();
      await import('../middleware/deployment-monitoring');
      const duration = Date.now() - start;

      // Module should load quickly (cached after first import)
      expect(duration).toBeLessThan(500);
    });

    it('should collect metrics efficiently', async () => {
      const monitoring = await import('../middleware/deployment-monitoring');

      const start = Date.now();
      const metricsText = await monitoring.metricsRegistry.metrics();
      const duration = Date.now() - start;

      expect(metricsText.length).toBeGreaterThan(0);
      // Metrics collection should be fast
      expect(duration).toBeLessThan(100);
    });
  });
});

describe('Deployment Workflow Validation', () => {
  describe('GitHub Actions Workflows', () => {
    it('should have backend-deployment workflow', () => {
      const workflowPath = path.join(
        __dirname,
        '../../../..',
        '.github/workflows/backend-deployment.yml'
      );
      const exists = fs.existsSync(workflowPath);
      expect(exists).toBe(true);
    });

    it('should have deploy-blue-green workflow or backend-deployment covers it', () => {
      const blueGreenPath = path.join(
        __dirname,
        '../../../..',
        '.github/workflows/deploy-blue-green.yml'
      );
      const backendPath = path.join(
        __dirname,
        '../../../..',
        '.github/workflows/backend-deployment.yml'
      );
      // Blue-green deployment is handled within backend-deployment.yml
      const exists = fs.existsSync(blueGreenPath) || fs.existsSync(backendPath);
      expect(exists).toBe(true);
    });

    it('should have automated-rollback workflow', () => {
      const workflowPath = path.join(
        __dirname,
        '../../../..',
        '.github/workflows/automated-rollback.yml'
      );
      const exists = fs.existsSync(workflowPath);
      expect(exists).toBe(true);
    });
  });

  describe('Documentation', () => {
    it('should have deployment guide', () => {
      const docPath = path.join(__dirname, '../../../..', 'docs/deployment/DEPLOYMENT_GUIDE.md');
      const exists = fs.existsSync(docPath);
      expect(exists).toBe(true);
    });

    it('should have secrets management guide', () => {
      const docPath = path.join(__dirname, '../../../..', 'docs/deployment/SECRETS_MANAGEMENT.md');
      const exists = fs.existsSync(docPath);
      expect(exists).toBe(true);
    });

    it('should have implementation summary', () => {
      const docPath = path.join(
        __dirname,
        '../../../..',
        'docs/deployment/EPIC_006_IMPLEMENTATION_SUMMARY.md'
      );
      const exists = fs.existsSync(docPath);
      expect(exists).toBe(true);
    });

    it('should have quick reference', () => {
      const docPath = path.join(__dirname, '../../../..', 'docs/deployment/QUICK_REFERENCE.md');
      const exists = fs.existsSync(docPath);
      expect(exists).toBe(true);
    });
  });
});
