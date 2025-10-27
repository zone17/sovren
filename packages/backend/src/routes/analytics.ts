import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';

import { authenticateToken } from '../middleware/auth';
import { handleError } from '../middleware/error-handler';
import { AnalyticsIntegrationService } from '../services/analytics-integration-service';

const router = Router();
const analyticsService = AnalyticsIntegrationService.getInstance();

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// ==========================================
// US-143: Web Analytics Integration Routes
// ==========================================

/**
 * POST /api/analytics/initialize
 * Initialize analytics architecture
 */
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    await analyticsService.initializeAnalyticsArchitecture();
    res.json({ message: 'Analytics architecture initialized successfully' });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/analytics/events
 * Track analytics events
 */
router.post(
  '/events',
  authenticateToken,
  [
    body('event_name').notEmpty().withMessage('Event name is required'),
    body('event_category').notEmpty().withMessage('Event category is required'),
    body('event_action').notEmpty().withMessage('Event action is required'),
    body('event_label').optional().isString(),
    body('event_value').optional().isNumeric(),
    body('custom_properties').optional().isObject(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const sessionId = (req.headers['x-session-id'] as string) || 'anonymous';
      const userId = req.user?.id;

      const event = await analyticsService.trackEvent(sessionId, userId, req.body);
      res.status(201).json({ data: event });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/analytics/funnels
 * Create conversion funnels
 */
router.post(
  '/funnels',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Funnel name is required'),
    body('steps').isArray().withMessage('Steps must be an array'),
    body('steps.*.name').notEmpty().withMessage('Step name is required'),
    body('steps.*.event_name').notEmpty().withMessage('Step event name is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const funnel = await analyticsService.createConversionFunnel(req.body);
      res.status(201).json({ data: funnel });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/analytics/behavior
 * Track user behavior
 */
router.post(
  '/behavior',
  authenticateToken,
  [
    body('page_views').optional().isArray(),
    body('interactions').optional().isArray(),
    body('conversion_events').optional().isArray(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const sessionId = (req.headers['x-session-id'] as string) || 'anonymous';
      const userId = req.user?.id;

      const behavior = await analyticsService.trackUserBehavior(userId, sessionId, req.body);
      res.status(201).json({ data: behavior });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/analytics/dashboards/:userId
 * Get dashboard configuration
 */
router.get(
  '/dashboards/:userId',
  authenticateToken,
  [param('userId').isUUID().withMessage('Valid user ID is required')],
  validateRequest,
  async (req, res) => {
    try {
      const dashboard = await analyticsService.createAnalyticsDashboard(req.params.userId, {});
      res.json({ data: dashboard });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/analytics/export
 * Export analytics data
 */
router.post(
  '/export',
  authenticateToken,
  [
    body('data_type').isIn(['events', 'behavior', 'funnels']).withMessage('Invalid data type'),
    body('format').isIn(['csv', 'json', 'xlsx']).withMessage('Invalid format'),
    body('date_range.start_date').isISO8601().withMessage('Valid start date is required'),
    body('date_range.end_date').isISO8601().withMessage('Valid end date is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const exportUrl = await analyticsService.exportAnalyticsData(req.body);
      res.json({ data: { url: exportUrl } });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/analytics/validate
 * Validate tracking accuracy
 */
router.get('/validate', authenticateToken, async (req, res) => {
  try {
    const validation = await analyticsService.validateTrackingAccuracy();
    res.json({ data: validation });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * GET /api/analytics/metrics/events
 * Get total events count
 */
router.get(
  '/metrics/events',
  authenticateToken,
  [query('range').isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid time range')],
  validateRequest,
  async (req, res) => {
    try {
      // Mock implementation - would query actual metrics
      const total = Math.floor(Math.random() * 10000) + 1000;
      res.json({ data: { total } });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/analytics/metrics/users
 * Get active users count
 */
router.get(
  '/metrics/users',
  authenticateToken,
  [query('range').isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid time range')],
  validateRequest,
  async (req, res) => {
    try {
      // Mock implementation - would query actual metrics
      const active = Math.floor(Math.random() * 1000) + 100;
      res.json({ data: { active } });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/analytics/metrics/conversion
 * Get conversion rate
 */
router.get(
  '/metrics/conversion',
  authenticateToken,
  [query('range').isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid time range')],
  validateRequest,
  async (req, res) => {
    try {
      // Mock implementation - would calculate actual conversion rate
      const rate = Math.random() * 0.2 + 0.1; // 10-30% conversion rate
      res.json({ data: { rate } });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

// ==========================================
// US-144: Business Intelligence Routes
// ==========================================

/**
 * POST /api/bi/initialize
 * Initialize BI architecture
 */
router.post('/bi/initialize', authenticateToken, async (req, res) => {
  try {
    await analyticsService.initializeBIArchitecture();
    res.json({ message: 'BI architecture initialized successfully' });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/bi/warehouse-connections
 * Create data warehouse connection
 */
router.post(
  '/bi/warehouse-connections',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Connection name is required'),
    body('type')
      .isIn(['postgresql', 'mysql', 'bigquery', 'snowflake'])
      .withMessage('Invalid connection type'),
    body('host').notEmpty().withMessage('Host is required'),
    body('port').isNumeric().withMessage('Port must be numeric'),
    body('database').notEmpty().withMessage('Database name is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const connection = await analyticsService.createDataWarehouseConnection(req.body);
      res.status(201).json({ data: connection });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/bi/reports
 * Create automated report
 */
router.post(
  '/bi/reports',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Report name is required'),
    body('query').notEmpty().withMessage('Query is required'),
    body('schedule').notEmpty().withMessage('Schedule is required'),
    body('recipients').isArray().withMessage('Recipients must be an array'),
    body('format').isIn(['pdf', 'csv', 'xlsx']).withMessage('Invalid format'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const report = await analyticsService.createAutomatedReport(req.body);
      res.status(201).json({ data: report });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/bi/reports
 * Get automated reports
 */
router.get('/bi/reports', authenticateToken, async (req, res) => {
  try {
    // Mock implementation - would query actual reports
    const reports = [];
    res.json({ data: reports });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/bi/dashboards/:dashboardId/realtime
 * Enable real-time dashboard
 */
router.post(
  '/bi/dashboards/:dashboardId/realtime',
  authenticateToken,
  [param('dashboardId').isUUID().withMessage('Valid dashboard ID is required')],
  validateRequest,
  async (req, res) => {
    try {
      await analyticsService.enableRealTimeDashboard(req.params.dashboardId);
      res.json({ message: 'Real-time dashboard enabled successfully' });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/bi/predictive-models
 * Create predictive model
 */
router.post(
  '/bi/predictive-models',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Model name is required'),
    body('algorithm')
      .isIn(['linear_regression', 'random_forest', 'neural_network'])
      .withMessage('Invalid algorithm'),
    body('target_variable').notEmpty().withMessage('Target variable is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const model = await analyticsService.createPredictiveModel(req.body);
      res.status(201).json({ data: model });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/bi/predictive-models
 * Get predictive models
 */
router.get('/bi/predictive-models', authenticateToken, async (req, res) => {
  try {
    // Mock implementation - would query actual models
    const models = [];
    res.json({ data: models });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/bi/visualizations
 * Create data visualization
 */
router.post(
  '/bi/visualizations',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Visualization name is required'),
    body('type').isIn(['chart', 'table', 'map', 'gauge']).withMessage('Invalid visualization type'),
    body('data_source').notEmpty().withMessage('Data source is required'),
    body('query').notEmpty().withMessage('Query is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const visualization = await analyticsService.createDataVisualization(req.body);
      res.status(201).json({ data: visualization });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/bi/validate
 * Validate BI integration
 */
router.get('/bi/validate', authenticateToken, async (req, res) => {
  try {
    const validation = await analyticsService.validateBIIntegration();
    res.json({ data: validation });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==========================================
// US-145: Performance Monitoring Routes
// ==========================================

/**
 * POST /api/performance/initialize
 * Initialize performance monitoring
 */
router.post('/performance/initialize', authenticateToken, async (req, res) => {
  try {
    await analyticsService.initializePerformanceMonitoring();
    res.json({ message: 'Performance monitoring initialized successfully' });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/performance/alerts
 * Create performance alert
 */
router.post(
  '/performance/alerts',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Alert name is required'),
    body('metric_name').notEmpty().withMessage('Metric name is required'),
    body('condition')
      .isIn(['greater_than', 'less_than', 'equals'])
      .withMessage('Invalid condition'),
    body('threshold').isNumeric().withMessage('Threshold must be numeric'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const alert = await analyticsService.createPerformanceAlert(req.body);
      res.status(201).json({ data: alert });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/performance/baselines
 * Create performance baseline
 */
router.post(
  '/performance/baselines',
  authenticateToken,
  [
    body('service_name').notEmpty().withMessage('Service name is required'),
    body('metric_name').notEmpty().withMessage('Metric name is required'),
    body('calculation_period.start_date').isISO8601().withMessage('Valid start date is required'),
    body('calculation_period.end_date').isISO8601().withMessage('Valid end date is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { service_name, metric_name, calculation_period } = req.body;
      const baseline = await analyticsService.createPerformanceBaseline(
        service_name,
        metric_name,
        calculation_period
      );
      res.status(201).json({ data: baseline });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/performance/suggestions/:serviceName
 * Get optimization suggestions
 */
router.get(
  '/performance/suggestions/:serviceName',
  authenticateToken,
  [param('serviceName').notEmpty().withMessage('Service name is required')],
  validateRequest,
  async (req, res) => {
    try {
      const suggestions = await analyticsService.generateOptimizationSuggestions(
        req.params.serviceName
      );
      res.json({ data: suggestions });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/performance/trends/:serviceName
 * Analyze performance trends
 */
router.post(
  '/performance/trends/:serviceName',
  authenticateToken,
  [
    param('serviceName').notEmpty().withMessage('Service name is required'),
    body('timeRange.start_date').isISO8601().withMessage('Valid start date is required'),
    body('timeRange.end_date').isISO8601().withMessage('Valid end date is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const trends = await analyticsService.analyzePerformanceTrends(
        req.params.serviceName,
        req.body.timeRange
      );
      res.json({ data: trends });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/performance/metrics/response-time
 * Get average response time
 */
router.get(
  '/performance/metrics/response-time',
  authenticateToken,
  [query('range').isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid time range')],
  validateRequest,
  async (req, res) => {
    try {
      // Mock implementation - would query actual metrics
      const average = Math.floor(Math.random() * 500) + 100; // 100-600ms
      res.json({ data: { average } });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/performance/health
 * Get system health score
 */
router.get('/performance/health', authenticateToken, async (req, res) => {
  try {
    // Mock implementation - would calculate actual health score
    const score = Math.random() * 0.3 + 0.7; // 70-100% health
    res.json({ data: { score } });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * GET /api/performance/validate
 * Validate performance monitoring
 */
router.get('/performance/validate', authenticateToken, async (req, res) => {
  try {
    const validation = await analyticsService.validatePerformanceMonitoring();
    res.json({ data: validation });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ==========================================
// US-146: Error Tracking Routes
// ==========================================

/**
 * POST /api/errors/initialize
 * Initialize error tracking
 */
router.post('/errors/initialize', authenticateToken, async (req, res) => {
  try {
    await analyticsService.initializeErrorTracking();
    res.json({ message: 'Error tracking initialized successfully' });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /api/errors/report
 * Report error
 */
router.post(
  '/errors/report',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Error title is required'),
    body('message').notEmpty().withMessage('Error message is required'),
    body('error_type').notEmpty().withMessage('Error type is required'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const error = await analyticsService.reportError(req.body);
      res.status(201).json({ data: error });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/errors/categories
 * Create error category
 */
router.post(
  '/errors/categories',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').notEmpty().withMessage('Category description is required'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const category = await analyticsService.createErrorCategory(req.body);
      res.status(201).json({ data: category });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/errors/workflows
 * Create resolution workflow
 */
router.post(
  '/errors/workflows',
  authenticateToken,
  [
    body('errorId').isUUID().withMessage('Valid error ID is required'),
    body('steps').isArray().withMessage('Steps must be an array'),
    body('steps.*.step_name').notEmpty().withMessage('Step name is required'),
    body('steps.*.description').notEmpty().withMessage('Step description is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { errorId, steps } = req.body;
      const workflow = await analyticsService.createResolutionWorkflow(errorId, steps);
      res.status(201).json({ data: workflow });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * POST /api/errors/analytics
 * Get error analytics
 */
router.post(
  '/errors/analytics',
  authenticateToken,
  [
    body('timeRange.start_date').isISO8601().withMessage('Valid start date is required'),
    body('timeRange.end_date').isISO8601().withMessage('Valid end date is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const analytics = await analyticsService.generateErrorAnalytics(req.body.timeRange);
      res.json({ data: analytics });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/errors/metrics/rate
 * Get error rate
 */
router.get(
  '/errors/metrics/rate',
  authenticateToken,
  [query('range').isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid time range')],
  validateRequest,
  async (req, res) => {
    try {
      // Mock implementation - would calculate actual error rate
      const rate = Math.random() * 0.05; // 0-5% error rate
      res.json({ data: { rate } });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/errors/top
 * Get top errors
 */
router.get(
  '/errors/top',
  authenticateToken,
  [query('range').isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid time range')],
  validateRequest,
  async (req, res) => {
    try {
      // Mock implementation - would query actual top errors
      const errors = [];
      res.json({ data: errors });
    } catch (error) {
      handleError(error, req, res);
    }
  }
);

/**
 * GET /api/errors/validate
 * Validate error tracking
 */
router.get('/errors/validate', authenticateToken, async (req, res) => {
  try {
    const validation = await analyticsService.validateErrorTracking();
    res.json({ data: validation });
  } catch (error) {
    handleError(error, req, res);
  }
});

export default router;
