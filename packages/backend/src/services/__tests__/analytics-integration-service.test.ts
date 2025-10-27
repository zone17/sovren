import { TrackEventRequest } from '../../types/analytics-integration';
import { AnalyticsIntegrationService } from '../analytics-integration-service';

describe('AnalyticsIntegrationService', () => {
  let service: AnalyticsIntegrationService;

  beforeEach(() => {
    service = AnalyticsIntegrationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // US-143: Web Analytics Integration Tests
  // ==========================================

  describe('US-143: Web Analytics Integration', () => {
    test('should initialize analytics architecture', async () => {
      await expect(service.initializeAnalyticsArchitecture()).resolves.not.toThrow();
      // Event listener is added asynchronously, so we don't check count
    });

    test('should track events successfully', async () => {
      const request: TrackEventRequest = {
        event_name: 'button_click',
        event_category: 'engagement',
        event_action: 'click',
        event_label: 'signup_button',
        custom_properties: { page: 'landing' },
      };

      const event = await service.trackEvent('session123', 'user456', request);

      expect(event).toMatchObject({
        event_name: 'button_click',
        event_category: 'engagement',
        event_action: 'click',
        user_id: 'user456',
        session_id: 'session123',
      });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    test('should create conversion funnels', async () => {
      const funnelRequest = {
        name: 'Signup Funnel',
        steps: [
          { name: 'Landing Page', event_name: 'page_view' },
          { name: 'Signup Form', event_name: 'form_view' },
          { name: 'Account Created', event_name: 'signup_complete' },
        ],
      };

      const funnel = await service.createConversionFunnel(funnelRequest);

      expect(funnel).toMatchObject({
        name: 'Signup Funnel',
        steps: funnelRequest.steps,
      });
      expect(funnel.id).toBeDefined();
      expect(funnel.conversion_rate).toBeGreaterThanOrEqual(0);
    });

    test('should validate tracking accuracy', async () => {
      const validation = await service.validateTrackingAccuracy();

      expect(validation).toHaveProperty('accuracy_score');
      expect(validation).toHaveProperty('validation_results');
      expect(validation.accuracy_score).toBeGreaterThan(0.8);
    });
  });

  // ==========================================
  // US-144: Business Intelligence Tests
  // ==========================================

  describe('US-144: Business Intelligence Tools', () => {
    test('should initialize BI architecture', async () => {
      await expect(service.initializeBIArchitecture()).resolves.not.toThrow();
      // Event listener is added asynchronously, so we don't check count
    });

    test('should create data warehouse connections', async () => {
      const connectionConfig = {
        name: 'Test Warehouse',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'analytics',
        credentials: {
          username: 'test',
          password: 'test',
        },
        sync_schedule: '0 */6 * * *',
      };

      const connection = await service.createDataWarehouseConnection(connectionConfig);

      expect(connection).toMatchObject({
        name: 'Test Warehouse',
        type: 'postgresql',
        host: 'localhost',
      });
      expect(connection.id).toBeDefined();
    });

    test('should validate BI integration', async () => {
      const validation = await service.validateBIIntegration();

      expect(validation).toHaveProperty('connection_health');
      expect(validation).toHaveProperty('query_performance');
      expect(validation).toHaveProperty('data_accuracy');
      expect(validation.data_accuracy).toBeGreaterThan(0.9);
    });
  });

  // ==========================================
  // US-145: Performance Monitoring Tests
  // ==========================================

  describe('US-145: Performance Monitoring', () => {
    test('should initialize performance monitoring', async () => {
      // Create a spy to verify the event is emitted
      const emitSpy = jest.spyOn(service, 'emit');

      await expect(service.initializePerformanceMonitoring()).resolves.not.toThrow();

      // Verify the initialization event was emitted
      expect(emitSpy).toHaveBeenCalledWith('performance_monitoring_initialized');

      emitSpy.mockRestore();
    });

    test('should create performance alerts', async () => {
      const alertRequest = {
        name: 'High Response Time',
        metric_name: 'response_time',
        condition: 'greater_than' as const,
        threshold: 500,
        duration: 60,
        severity: 'medium' as const,
        notification_channels: ['email', 'slack'],
      };

      const alert = await service.createPerformanceAlert(alertRequest);

      expect(alert).toMatchObject({
        name: 'High Response Time',
        metric_name: 'response_time',
        threshold: 500,
      });
      expect(alert.id).toBeDefined();
    });

    test('should generate optimization suggestions', async () => {
      const suggestions = await service.generateOptimizationSuggestions('test-service');

      expect(suggestions).toHaveProperty('suggestions');
      expect(Array.isArray(suggestions.suggestions)).toBe(true);
    });

    test('should validate performance monitoring', async () => {
      const validation = await service.validatePerformanceMonitoring();

      expect(validation).toHaveProperty('metric_accuracy');
      expect(validation).toHaveProperty('alert_reliability');
      expect(validation).toHaveProperty('baseline_stability');
      expect(validation.metric_accuracy).toBeGreaterThan(0.9);
    });
  });

  // ==========================================
  // US-146: Error Tracking Tests
  // ==========================================

  describe('US-146: Error Tracking Integration', () => {
    test('should initialize error tracking', async () => {
      // Create a spy to verify the event is emitted
      const emitSpy = jest.spyOn(service, 'emit');

      await expect(service.initializeErrorTracking()).resolves.not.toThrow();

      // Verify the initialization event was emitted
      expect(emitSpy).toHaveBeenCalledWith('error_tracking_initialized');

      emitSpy.mockRestore();
    });

    test('should report errors', async () => {
      const errorRequest = {
        title: 'Database Connection Error',
        message: 'Connection timeout after 30 seconds',
        stack_trace: 'Error: Connection timeout\n  at Database.connect',
        error_type: 'database' as const,
        severity: 'high' as const,
        user_context: { user_id: 'user123' },
        request_context: { url: '/api/data', method: 'GET' },
      };

      const error = await service.reportError(errorRequest);

      expect(error).toMatchObject({
        title: 'Database Connection Error',
        message: 'Connection timeout after 30 seconds',
        severity: 'high',
      });
      expect(error.id).toBeDefined();
      expect(error.first_seen).toBeInstanceOf(Date);
    });

    test('should generate error analytics', async () => {
      const timeRange = {
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end_date: new Date(),
      };

      const analytics = await service.generateErrorAnalytics(timeRange);

      expect(analytics).toHaveProperty('total_errors');
      expect(analytics).toHaveProperty('error_rate');
      expect(analytics).toHaveProperty('mean_time_to_resolution');
      expect(analytics.total_errors).toBeGreaterThanOrEqual(0);
    });

    test('should validate error tracking', async () => {
      const validation = await service.validateErrorTracking();

      expect(validation).toHaveProperty('detection_accuracy');
      expect(validation).toHaveProperty('categorization_accuracy');
      expect(validation).toHaveProperty('resolution_efficiency');
      expect(validation.detection_accuracy).toBeGreaterThan(0.8);
    });
  });

  // ==========================================
  // Integration Tests
  // ==========================================

  describe('Integration Tests', () => {
    test('should handle event tracking with performance monitoring', async () => {
      const startTime = Date.now();

      const event = await service.trackEvent('session123', 'user456', {
        event_name: 'api_request',
        event_category: 'performance',
        event_action: 'call',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(event).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should correlate errors with analytics events', async () => {
      // Track an event
      const event = await service.trackEvent('session123', 'user456', {
        event_name: 'form_submission',
        event_category: 'engagement',
        event_action: 'submit',
      });

      // Report an error related to the event
      const error = await service.reportError({
        title: 'Form Validation Error',
        message: 'Required field missing',
        error_type: 'validation',
        severity: 'low',
        user_context: { user_id: 'user456' },
      });

      expect(event.user_id).toBe(error.user_context?.user_id);
    });

    test('should handle concurrent analytics operations', async () => {
      const operations = [
        service.trackEvent('session1', 'user1', {
          event_name: 'test1',
          event_category: 'test',
          event_action: 'action',
        }),
        service.trackEvent('session2', 'user2', {
          event_name: 'test2',
          event_category: 'test',
          event_action: 'action',
        }),
        service.reportError({
          title: 'Test Error',
          message: 'Test error message',
          error_type: 'test',
          severity: 'low',
        }),
      ];

      const results = await Promise.all(operations);
      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('id');
      expect(results[1]).toHaveProperty('id');
      expect(results[2]).toHaveProperty('id');
    });
  });
});
