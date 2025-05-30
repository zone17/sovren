# Monitoring & Observability

## 🔍 Overview

This document outlines the comprehensive monitoring, logging, and observability strategy for Sovren.

## 📋 Table of Contents

1. [Observability Strategy](#observability-strategy)
2. [Application Performance Monitoring](#application-performance-monitoring)
3. [Logging Standards](#logging-standards)
4. [Metrics & KPIs](#metrics--kpis)
5. [Alerting & Notifications](#alerting--notifications)
6. [Error Tracking](#error-tracking)
7. [Infrastructure Monitoring](#infrastructure-monitoring)
8. [Business Intelligence](#business-intelligence)
9. [Incident Response](#incident-response)

---

## Observability Strategy

### Three Pillars of Observability

**1. Metrics (What)**

```typescript
// Key metrics collection
interface MetricsCollection {
  performance: {
    responseTime: 'P50, P90, P99 percentiles';
    throughput: 'Requests per second';
    errorRate: 'Percentage of failed requests';
    availability: 'Uptime percentage';
  };
  business: {
    userRegistrations: 'Daily active users';
    paymentVolume: 'Transaction count and value';
    contentCreation: 'Posts, uploads per day';
    engagement: 'Likes, comments, shares';
  };
  infrastructure: {
    cpuUsage: 'Server CPU utilization';
    memoryUsage: 'Memory consumption';
    diskSpace: 'Storage utilization';
    networkLatency: 'Network response times';
  };
}
```

**2. Logs (Why)**

```typescript
// Structured logging format
interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  service: string;
  version: string;
  traceId: string;
  spanId: string;
  userId?: string;
  sessionId?: string;
  message: string;
  metadata: Record<string, unknown>;
  stack?: string; // For errors
}

// Example log entry
const logEntry: LogEntry = {
  timestamp: '2024-12-15T10:30:00.000Z',
  level: 'INFO',
  service: 'user-service',
  version: '1.2.3',
  traceId: 'trace-123-456',
  spanId: 'span-789',
  userId: 'user-abc-123',
  sessionId: 'session-def-456',
  message: 'User authentication successful',
  metadata: {
    method: 'email',
    duration: 245,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  },
};
```

**3. Traces (How)**

```typescript
// Distributed tracing setup
interface TracingConfiguration {
  provider: 'OpenTelemetry';
  exporters: ['Jaeger', 'DataDog', 'NewRelic'];
  samplingRate: 0.1; // 10% of requests
  customSpans: [
    'database-queries',
    'external-api-calls',
    'cache-operations',
    'authentication-flow',
  ];
}
```

---

## Application Performance Monitoring

### Frontend Monitoring

**Real User Monitoring (RUM)**

```typescript
// Frontend performance tracking
interface FrontendMetrics {
  coreWebVitals: {
    firstContentfulPaint: number; // < 1.8s
    largestContentfulPaint: number; // < 2.5s
    firstInputDelay: number; // < 100ms
    cumulativeLayoutShift: number; // < 0.1
  };
  customMetrics: {
    timeToInteractive: number;
    totalBlockingTime: number;
    bundleSize: number;
    routeChangeTime: number;
  };
  userExperience: {
    pageViews: number;
    sessionDuration: number;
    bounceRate: number;
    conversionRate: number;
  };
}

// Performance tracking implementation
class PerformanceTracker {
  static trackPageLoad(): void {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;

      const metrics = {
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        ttfb: navigation.responseStart - navigation.requestStart,
        download: navigation.responseEnd - navigation.responseStart,
        domParse: navigation.domContentLoadedEventEnd - navigation.responseEnd,
        totalLoad: navigation.loadEventEnd - navigation.navigationStart,
      };

      this.sendMetrics('page_load', metrics);
    });
  }

  static trackUserInteraction(action: string, element: string): void {
    const startTime = performance.now();

    // Track interaction completion
    requestIdleCallback(() => {
      const duration = performance.now() - startTime;
      this.sendMetrics('user_interaction', {
        action,
        element,
        duration,
        timestamp: Date.now(),
      });
    });
  }
}
```

### Backend Monitoring

**API Performance Monitoring**

```typescript
// API monitoring middleware
interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  userId?: string;
  errorType?: string;
}

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to ms

    const metrics: APIMetrics = {
      endpoint: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime: duration,
      requestSize: JSON.stringify(req.body).length,
      responseSize: res.get('content-length') ? parseInt(res.get('content-length')!) : 0,
      userId: req.user?.id,
    };

    // Send to monitoring service
    metricsCollector.record('api_request', metrics);

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow API request detected', {
        ...metrics,
        traceId: req.headers['x-trace-id'],
      });
    }
  });

  next();
};
```

---

## Logging Standards

### Structured Logging Implementation

**Winston Logger Configuration**

```typescript
import winston from 'winston';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, traceId, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      service: service || 'sovren-api',
      traceId,
      message,
      metadata: meta,
    });
  })
);

// Logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'sovren-api',
    version: process.env.APP_VERSION || '1.0.0',
  },
  transports: [
    // Console output for development
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),

    // File output for production
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),

    // All logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
});

// Add DataDog transport for production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.Http({
      host: 'http-intake.logs.datadoghq.com',
      path: `/v1/input/${process.env.DATADOG_API_KEY}`,
      ssl: true,
    })
  );
}
```

### Log Correlation

**Request Tracing**

```typescript
// Request correlation middleware
export const requestTracing = (req: Request, res: Response, next: NextFunction): void => {
  // Generate or extract trace ID
  const traceId =
    (req.headers['x-trace-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    crypto.randomUUID();

  // Add to request context
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);

  // Create child logger with trace context
  req.logger = logger.child({
    traceId,
    userId: req.user?.id,
    sessionId: req.sessionID,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log request start
  req.logger.info('Request started', {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });

  next();
};

// Usage in controllers
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    req.logger.info('User login attempt', {
      email: req.body.email,
      loginMethod: 'email',
    });

    const user = await authService.authenticate(req.body);

    req.logger.info('User login successful', {
      userId: user.id,
      lastLogin: user.lastLogin,
    });

    res.json({ user, token: generateToken(user) });
  } catch (error) {
    req.logger.error('User login failed', {
      error: error.message,
      email: req.body.email,
    });

    res.status(401).json({ error: 'Authentication failed' });
  }
};
```

---

## Metrics & KPIs

### Business Metrics

**User Engagement KPIs**

```typescript
interface BusinessMetrics {
  userMetrics: {
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    userRetention: {
      day1: number; // % of users who return after 1 day
      day7: number; // % of users who return after 1 week
      day30: number; // % of users who return after 1 month
    };
    churnRate: number; // % of users who stop using the platform
  };

  contentMetrics: {
    postsPerDay: number;
    avgPostEngagement: number;
    contentCreatorGrowth: number;
    contentQualityScore: number;
  };

  revenueMetrics: {
    totalRevenue: number;
    revenuePerUser: number;
    paymentSuccessRate: number;
    averageTransactionValue: number;
  };

  performanceMetrics: {
    pageLoadTime: number;
    apiResponseTime: number;
    errorRate: number;
    uptime: number;
  };
}

// Metrics collection service
class MetricsCollector {
  private dataDogClient: StatsD;

  constructor() {
    this.dataDogClient = new StatsD({
      host: process.env.DATADOG_HOST,
      port: 8125,
      prefix: 'sovren.',
    });
  }

  recordUserAction(action: string, userId: string, metadata?: Record<string, unknown>): void {
    this.dataDogClient.increment('user.action', 1, {
      action,
      userId: userId.substring(0, 8), // Anonymized
      ...metadata,
    });
  }

  recordPayment(amount: number, currency: string, success: boolean): void {
    this.dataDogClient.increment('payment.attempt', 1, {
      currency,
      success: success.toString(),
    });

    if (success) {
      this.dataDogClient.histogram('payment.amount', amount, {
        currency,
      });
    }
  }

  recordPerformance(metric: string, value: number, tags?: Record<string, string>): void {
    this.dataDogClient.histogram(`performance.${metric}`, value, tags);
  }
}
```

### Technical Metrics

**System Health Metrics**

```typescript
// Health check endpoint with detailed metrics
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      externalAPIs: await checkExternalServices(),
      diskSpace: await checkDiskSpace(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      },
    },
    responseTime: Date.now() - startTime,
  };

  // Determine overall health status
  const allChecksHealthy = Object.values(health.checks).every((check) =>
    typeof check === 'object' ? check.status === 'healthy' : check
  );

  if (!allChecksHealthy) {
    health.status = 'degraded';
    res.status(503);
  }

  // Log health check
  req.logger.info('Health check performed', {
    status: health.status,
    responseTime: health.responseTime,
    checks: health.checks,
  });

  res.json(health);
};

// Database health check
async function checkDatabase(): Promise<{ status: string; responseTime: number }> {
  const startTime = Date.now();
  try {
    await supabase.from('users').select('count(*)').limit(1);
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
    };
  }
}
```

---

## Alerting & Notifications

### Alert Configuration

**Alert Thresholds**

```typescript
interface AlertConfiguration {
  performance: {
    responseTime: {
      warning: 1000; // ms
      critical: 3000; // ms
    };
    errorRate: {
      warning: 0.05; // 5%
      critical: 0.1; // 10%
    };
    throughput: {
      warning: 100; // requests/min drop
      critical: 500; // requests/min drop
    };
  };

  business: {
    userRegistrations: {
      warning: 0.5; // 50% drop from baseline
      critical: 0.8; // 80% drop from baseline
    };
    paymentFailures: {
      warning: 0.1; // 10% failure rate
      critical: 0.2; // 20% failure rate
    };
  };

  infrastructure: {
    cpuUsage: {
      warning: 70; // %
      critical: 90; // %
    };
    memoryUsage: {
      warning: 80; // %
      critical: 95; // %
    };
    diskSpace: {
      warning: 85; // %
      critical: 95; // %
    };
  };
}

// Alert manager
class AlertManager {
  private channels = [
    new SlackChannel(process.env.SLACK_WEBHOOK_URL),
    new EmailChannel(process.env.ALERT_EMAIL),
    new PagerDutyChannel(process.env.PAGERDUTY_KEY),
  ];

  async sendAlert(
    severity: 'warning' | 'critical',
    message: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const alert = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      source: 'sovren-monitoring',
      metadata,
      runbook: this.getRunbookUrl(metadata.alertType as string),
    };

    // Send to appropriate channels based on severity
    const channelsToNotify =
      severity === 'critical' ? this.channels : this.channels.filter((c) => c.type !== 'pagerduty');

    await Promise.all(channelsToNotify.map((channel) => channel.send(alert)));

    // Log alert
    logger.error('Alert triggered', alert);
  }

  private getRunbookUrl(alertType: string): string {
    const runbooks = {
      high_error_rate: 'https://docs.sovren.dev/runbooks/high-error-rate',
      slow_response: 'https://docs.sovren.dev/runbooks/slow-response',
      database_down: 'https://docs.sovren.dev/runbooks/database-down',
      payment_failures: 'https://docs.sovren.dev/runbooks/payment-failures',
    };

    return runbooks[alertType] || 'https://docs.sovren.dev/runbooks/general';
  }
}
```

### Alert Escalation

**Escalation Policy**

```typescript
interface EscalationPolicy {
  level1: {
    timeout: 5; // minutes
    notify: ['on-call-engineer'];
  };
  level2: {
    timeout: 15; // minutes
    notify: ['engineering-manager', 'senior-engineers'];
  };
  level3: {
    timeout: 30; // minutes
    notify: ['cto', 'engineering-director'];
  };
  level4: {
    timeout: 60; // minutes
    notify: ['ceo', 'all-executives'];
  };
}
```

---

## Error Tracking

### Error Monitoring Setup

**Sentry Integration**

```typescript
import * as Sentry from '@sentry/node';

// Sentry configuration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  tracesSampleRate: 0.1,

  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      if (error.message?.includes('User cancelled operation')) {
        return null; // Don't send to Sentry
      }
    }

    // Add additional context
    event.tags = {
      ...event.tags,
      component: 'backend',
      version: process.env.APP_VERSION,
    };

    return event;
  },
});

// Express error handler
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add request context to Sentry
  Sentry.configureScope((scope) => {
    scope.setTag('path', req.path);
    scope.setTag('method', req.method);
    scope.setUser({
      id: req.user?.id,
      email: req.user?.email,
    });
    scope.setContext('request', {
      headers: req.headers,
      body: req.body,
      query: req.query,
    });
  });

  // Send to Sentry
  Sentry.captureException(error);

  // Log error
  req.logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Send error response
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.traceId,
  });
};
```

### Frontend Error Tracking

**React Error Boundary with Sentry**

```typescript
import * as Sentry from '@sentry/react';

// Global error boundary
export const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} resetError={resetError} />
      )}
      beforeCapture={(scope, error, errorInfo) => {
        scope.setTag('component', 'react');
        scope.setContext('errorInfo', errorInfo);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
};

// Custom error fallback component
const ErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ error, resetError }) => {
  const handleReport = (): void => {
    // Send additional context to support
    fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      })
    });
  };

  return (
    <div className="error-boundary">
      <h2>Something went wrong</h2>
      <p>We've been notified of this error and are working to fix it.</p>
      <details>
        <summary>Error details</summary>
        <pre>{error.message}</pre>
      </details>
      <button onClick={resetError}>Try again</button>
      <button onClick={handleReport}>Report issue</button>
    </div>
  );
};
```

---

## Infrastructure Monitoring

### Vercel Monitoring

**Vercel Functions Monitoring**

```typescript
// Function monitoring
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const startTime = Date.now();

  try {
    // Function logic here
    const result = await processRequest(req);

    // Log successful execution
    console.log(
      JSON.stringify({
        level: 'INFO',
        message: 'Function executed successfully',
        duration: Date.now() - startTime,
        path: req.url,
        method: req.method,
        statusCode: 200,
      })
    );

    res.status(200).json(result);
  } catch (error) {
    // Log error
    console.error(
      JSON.stringify({
        level: 'ERROR',
        message: 'Function execution failed',
        duration: Date.now() - startTime,
        path: req.url,
        method: req.method,
        error: error.message,
        stack: error.stack,
      })
    );

    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Database Monitoring

**Supabase Monitoring**

```typescript
// Database performance monitoring
class DatabaseMonitor {
  static async monitorQueryPerformance<T>(query: () => Promise<T>, queryName: string): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await query();
      const duration = performance.now() - startTime;

      // Log slow queries
      if (duration > 1000) {
        logger.warn('Slow database query detected', {
          queryName,
          duration,
          threshold: 1000,
        });
      }

      // Record metrics
      metricsCollector.recordPerformance('db.query.duration', duration, {
        queryName,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      logger.error('Database query failed', {
        queryName,
        duration,
        error: error.message,
      });

      // Record error metrics
      metricsCollector.recordEvent('db.query.error', {
        queryName,
        errorType: error.message,
      });

      throw error;
    }
  }
}

// Usage example
export const getUserById = async (id: string): Promise<User | null> => {
  return DatabaseMonitor.monitorQueryPerformance(
    () => supabase.from('users').select('*').eq('id', id).single(),
    'getUserById'
  );
};
```

---

## Business Intelligence

### Analytics Dashboard

**Key Business Metrics**

```typescript
interface BusinessIntelligence {
  userGrowth: {
    newUsers: number;
    activeUsers: number;
    churnRate: number;
    lifetimeValue: number;
  };

  contentMetrics: {
    postsCreated: number;
    avgEngagement: number;
    topCategories: string[];
    viralContent: ContentItem[];
  };

  revenueAnalytics: {
    totalRevenue: number;
    revenueGrowth: number;
    topPayingUsers: User[];
    paymentMethodDistribution: Record<string, number>;
  };

  platformHealth: {
    uptime: number;
    performance: number;
    userSatisfaction: number;
    supportTickets: number;
  };
}

// Analytics service
export class AnalyticsService {
  async generateDailyReport(): Promise<BusinessIntelligence> {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    return {
      userGrowth: await this.getUserGrowthMetrics(yesterday, today),
      contentMetrics: await this.getContentMetrics(yesterday, today),
      revenueAnalytics: await this.getRevenueMetrics(yesterday, today),
      platformHealth: await this.getPlatformHealthMetrics(yesterday, today),
    };
  }

  async sendExecutiveDashboard(): Promise<void> {
    const report = await this.generateDailyReport();

    // Send to stakeholders
    await emailService.send({
      to: process.env.EXECUTIVE_EMAILS?.split(',') || [],
      subject: `Sovren Daily Business Report - ${new Date().toDateString()}`,
      template: 'executive-dashboard',
      data: report,
    });
  }
}
```

---

## Incident Response

### Incident Management Process

**Incident Response Workflow**

```typescript
interface Incident {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  title: string;
  description: string;
  affectedServices: string[];
  startTime: Date;
  endTime?: Date;
  assignee: string;
  timeline: IncidentEvent[];
}

class IncidentManager {
  async createIncident(data: Partial<Incident>): Promise<Incident> {
    const incident: Incident = {
      id: crypto.randomUUID(),
      severity: data.severity || 'P2',
      status: 'open',
      title: data.title || 'Incident',
      description: data.description || '',
      affectedServices: data.affectedServices || [],
      startTime: new Date(),
      assignee: await this.getOnCallEngineer(),
      timeline: [],
    };

    // Store incident
    await this.storeIncident(incident);

    // Send notifications
    await this.notifyStakeholders(incident);

    // Start monitoring
    await this.startIncidentMonitoring(incident);

    return incident;
  }

  async updateIncident(id: string, update: Partial<Incident>): Promise<void> {
    const incident = await this.getIncident(id);

    // Add timeline event
    incident.timeline.push({
      timestamp: new Date(),
      type: 'update',
      description: `Status updated to ${update.status}`,
      author: update.assignee || 'system',
    });

    // Update incident
    Object.assign(incident, update);

    // Store updated incident
    await this.storeIncident(incident);

    // Send status update
    await this.sendStatusUpdate(incident);
  }
}
```

### Post-Incident Analysis

**Incident Post-Mortem Template**

```typescript
interface PostMortem {
  incidentId: string;
  title: string;
  date: Date;
  duration: number; // minutes
  severity: string;

  summary: {
    whatHappened: string;
    impact: string;
    resolution: string;
  };

  timeline: {
    detection: Date;
    response: Date;
    mitigation: Date;
    resolution: Date;
  };

  rootCause: {
    primary: string;
    contributing: string[];
  };

  actionItems: {
    immediate: ActionItem[];
    shortTerm: ActionItem[];
    longTerm: ActionItem[];
  };

  lessons: {
    whatWentWell: string[];
    whatCouldImprove: string[];
  };
}

interface ActionItem {
  description: string;
  assignee: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'completed';
}
```

---

## 📊 Monitoring Tools Stack

### Current Implementation

**Tool Configuration:**

- **APM**: Vercel Analytics + DataDog
- **Logging**: Winston + DataDog Logs
- **Error Tracking**: Sentry
- **Uptime Monitoring**: Pingdom
- **Performance**: Lighthouse CI
- **Security**: Snyk + npm audit
- **Business Analytics**: Custom dashboard + Google Analytics

### Future Enhancements

**Planned Additions:**

- Grafana dashboards for custom metrics
- Prometheus for metrics collection
- ELK stack for log analysis
- Custom alerting with ML-based anomaly detection
- User session recording (FullStory/LogRocket)

---

**Last Updated:** December 2024
**Next Review:** March 2025
**Owner:** Platform Engineering Team
