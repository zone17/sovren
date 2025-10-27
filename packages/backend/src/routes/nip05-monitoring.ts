/**
 * 🔍 **NIP-05 MONITORING ROUTES**
 *
 * **Purpose**: API endpoints for accessing NIP-05 monitoring data
 * **Features**: Metrics, health checks, alerts, performance reports
 * **Security**: Admin-only access with API key validation
 *
 * @author Elite Engineering Team
 * @version 1.0.0
 * @lastModified 2024-12-29
 */

import { Request, Response, Router } from 'express';
import { authenticate } from '../middleware/auth';
import { nip05MonitoringService } from '../services/nip05-monitoring-service';

const router = Router();

/**
 * 📊 Get Current Metrics
 * GET /api/nip05/monitoring/metrics
 */
router.get('/metrics', authenticate, async (req: Request, res: Response) => {
  try {
    const metrics = nip05MonitoringService.getCurrentMetrics();

    res.json({
      success: true,
      data: {
        metrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
    });
  }
});

/**
 * 🏥 Get Health Status
 * GET /api/nip05/monitoring/health
 */
router.get('/health', authenticate, async (req: Request, res: Response) => {
  try {
    const healthStatus = nip05MonitoringService.getHealthStatus();

    // Determine overall system health
    const services = Object.values(healthStatus);
    const overallStatus = services.every((s) => s.status === 'healthy')
      ? 'healthy'
      : services.some((s) => s.status === 'unhealthy')
        ? 'unhealthy'
        : 'degraded';

    res.json({
      success: true,
      data: {
        overall_status: overallStatus,
        services: healthStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get health status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status',
    });
  }
});

/**
 * 🚨 Get Active Alerts
 * GET /api/nip05/monitoring/alerts
 */
router.get('/alerts', authenticate, async (req: Request, res: Response) => {
  try {
    const alerts = nip05MonitoringService.getActiveAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
    });
  }
});

/**
 * ✅ Resolve Alert
 * POST /api/nip05/monitoring/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', authenticate, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const resolved = nip05MonitoringService.resolveAlert(alertId);

    if (resolved) {
      res.json({
        success: true,
        data: {
          alert_id: alertId,
          resolved_at: new Date().toISOString(),
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved',
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to resolve alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
    });
  }
});

/**
 * 📈 Get Performance History
 * GET /api/nip05/monitoring/performance
 */
router.get('/performance', authenticate, async (req: Request, res: Response) => {
  try {
    const { timeframe } = req.query;
    const validTimeframes = ['hour', 'day', 'week'];
    const selectedTimeframe = validTimeframes.includes(timeframe as string)
      ? (timeframe as 'hour' | 'day' | 'week')
      : undefined;

    const performanceHistory = nip05MonitoringService.getPerformanceHistory(selectedTimeframe);

    res.json({
      success: true,
      data: {
        performance_history: performanceHistory,
        timeframe: selectedTimeframe || 'all',
        count: performanceHistory.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get performance history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance history',
    });
  }
});

/**
 * 📊 Generate Performance Report
 * GET /api/nip05/monitoring/report
 */
router.get('/report', authenticate, async (req: Request, res: Response) => {
  try {
    const report = nip05MonitoringService.generatePerformanceReport();

    res.json({
      success: true,
      data: {
        report,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to generate report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report',
    });
  }
});

/**
 * ⚙️ Update Alert Thresholds
 * PUT /api/nip05/monitoring/thresholds
 */
router.put('/thresholds', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      error_rate_threshold,
      response_time_threshold,
      success_rate_threshold,
      consecutive_failures_threshold,
    } = req.body;

    // Validate thresholds
    const thresholds: any = {};

    if (error_rate_threshold !== undefined) {
      if (
        typeof error_rate_threshold !== 'number' ||
        error_rate_threshold < 0 ||
        error_rate_threshold > 1
      ) {
        return res.status(400).json({
          success: false,
          error: 'error_rate_threshold must be a number between 0 and 1',
        });
      }
      thresholds.error_rate_threshold = error_rate_threshold;
    }

    if (response_time_threshold !== undefined) {
      if (typeof response_time_threshold !== 'number' || response_time_threshold < 0) {
        return res.status(400).json({
          success: false,
          error: 'response_time_threshold must be a positive number',
        });
      }
      thresholds.response_time_threshold = response_time_threshold;
    }

    if (success_rate_threshold !== undefined) {
      if (
        typeof success_rate_threshold !== 'number' ||
        success_rate_threshold < 0 ||
        success_rate_threshold > 1
      ) {
        return res.status(400).json({
          success: false,
          error: 'success_rate_threshold must be a number between 0 and 1',
        });
      }
      thresholds.success_rate_threshold = success_rate_threshold;
    }

    if (consecutive_failures_threshold !== undefined) {
      if (
        typeof consecutive_failures_threshold !== 'number' ||
        consecutive_failures_threshold < 1
      ) {
        return res.status(400).json({
          success: false,
          error: 'consecutive_failures_threshold must be a positive integer',
        });
      }
      thresholds.consecutive_failures_threshold = consecutive_failures_threshold;
    }

    nip05MonitoringService.updateThresholds(thresholds);

    res.json({
      success: true,
      data: {
        updated_thresholds: thresholds,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert thresholds',
    });
  }
});

/**
 * 🔄 Trigger Manual Health Check
 * POST /api/nip05/monitoring/health/check
 */
router.post('/health/check', authenticate, async (req: Request, res: Response) => {
  try {
    const { service } = req.body;
    const validServices = ['nip05_verification', 'dns_resolution', 'http_endpoints'];

    if (service && !validServices.includes(service)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service name. Valid services: ' + validServices.join(', '),
      });
    }

    if (service) {
      // Check specific service
      const result = await nip05MonitoringService.performHealthCheck(service);
      res.json({
        success: true,
        data: {
          health_check: result,
        },
      });
    } else {
      // Check all services
      const results = await Promise.all(
        validServices.map((svc) => nip05MonitoringService.performHealthCheck(svc))
      );

      res.json({
        success: true,
        data: {
          health_checks: results,
        },
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to perform health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform health check',
    });
  }
});

/**
 * 🧹 Reset Metrics
 * POST /api/nip05/monitoring/reset
 */
router.post('/reset', authenticate, async (req: Request, res: Response) => {
  try {
    // Only allow admin users to reset metrics
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required to reset metrics',
      });
    }

    nip05MonitoringService.resetMetrics();

    res.json({
      success: true,
      data: {
        message: 'Metrics reset successfully',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to reset metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics',
    });
  }
});

/**
 * 📊 Export Metrics (CSV format)
 * GET /api/nip05/monitoring/export
 */
router.get('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.query;
    const report = nip05MonitoringService.generatePerformanceReport();

    if (format === 'csv') {
      // Generate CSV format
      const performanceHistory = nip05MonitoringService.getPerformanceHistory();
      const csvHeader = 'timestamp,method,domain,success,response_time\n';
      const csvData = performanceHistory
        .map(
          (entry) =>
            `${entry.timestamp},${entry.method},${entry.domain},${entry.success},${entry.response_time}`
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=nip05-metrics.csv');
      res.send(csvHeader + csvData);
    } else {
      // Default JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=nip05-metrics.json');
      res.json({
        success: true,
        data: {
          ...report,
          performance_history: nip05MonitoringService.getPerformanceHistory(),
          exported_at: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to export metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics',
    });
  }
});

export default router;
