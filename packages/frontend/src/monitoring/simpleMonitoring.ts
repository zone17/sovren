/**
 * 🔍 **ELITE SIMPLE MONITORING SYSTEM - ZERO VIOLATIONS**
 *
 * **Purpose**: Lightweight error tracking and breadcrumb system for production
 * **Architecture**: Type-safe monitoring without external dependencies
 * **Standards**: Elite engineering with ZERO type violations
 *
 * @author Elite Engineering Team
 * @version 3.0.0 - Zero Violations Standard
 * @lastModified 2024-12-28
 */

export type LogLevel = 'info' | 'warn' | 'warning' | 'error' | 'debug';

// 🛡️ **ELITE TYPE SAFETY - COMPREHENSIVE INTERFACES**

interface MonitoringData {
  [key: string]: string | number | boolean | null | undefined;
}

interface ErrorContext {
  filename?: string;
  lineno?: number;
  colno?: number;
  type?: string;
  [key: string]: unknown;
}

interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: string;
  context?: ErrorContext;
  level: LogLevel;
  id: string;
}

interface MessageInfo {
  message: string;
  level: LogLevel;
  timestamp: string;
  extra?: MonitoringData;
  id: string;
}

interface Breadcrumb {
  message: string;
  category: string;
  level: LogLevel;
  timestamp: number;
  data?: MonitoringData;
}

interface UserContext {
  id: string;
  email?: string;
  username?: string;
  segment?: string;
  subscription?: string;
  permissions?: string[];
}

interface PerformanceMetrics extends MonitoringData {
  duration: number;
  status: 'success' | 'error';
  error?: string;
}

interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

// 🎯 **ELITE MONITORING ENGINE**
class SimpleMonitoring {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 50;
  private user: UserContext | null = null;
  private errors: ErrorInfo[] = [];
  private messages: MessageInfo[] = [];

  // Initialize monitoring with proper typing
  init(): void {
    if (process.env.NODE_ENV === 'development') {
      // Development console output (allowed in monitoring context)
      console.log('🔍 Simple Monitoring initialized (Development Mode)');
    }

    // Add global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled errors with proper typing
    window.addEventListener('error', (event: ErrorEvent): void => {
      this.captureError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Handle unhandled promise rejections with proper typing
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent): void => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.captureError(error, {
        type: 'unhandledrejection',
      });
    });
  }

  // Add breadcrumb for tracking user actions
  addBreadcrumb(
    message: string,
    category = 'custom',
    level: LogLevel = 'info',
    data?: MonitoringData
  ): void {
    const breadcrumb: Breadcrumb = {
      message,
      category,
      level,
      timestamp: Date.now(),
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only the last N breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }

    // Development console output (monitoring context)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🍞 [${category}] ${message}`, data || '');
    }
  }

  // Set user context with proper typing
  setUser(user: UserContext): void {
    this.user = user;
    this.addBreadcrumb(`User identified: ${user.id}`, 'auth', 'info', {
      segment: user.segment || '',
      subscription: user.subscription || '',
      permissions_count: user.permissions?.length || 0,
    });
  }

  // Clear user context
  clearUser(): void {
    this.user = null;
    this.addBreadcrumb('User logged out', 'auth', 'info');
  }

  // Capture error with context and proper typing
  captureError(error: Error, context?: ErrorContext, level: LogLevel = 'error'): void {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context,
      level,
      id: this.generateId(),
    };

    this.errors.push(errorInfo);

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    // Development console output (monitoring context)
    if (process.env.NODE_ENV === 'development') {
      console.error('Captured Error:', errorInfo);
    }
  }

  // Capture message with proper typing
  captureMessage(message: string, level: LogLevel = 'info', extra?: MonitoringData): void {
    const messageInfo: MessageInfo = {
      message,
      level,
      timestamp: new Date().toISOString(),
      extra,
      id: this.generateId(),
    };

    this.messages.push(messageInfo);

    // Keep only last 100 messages
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }

    // Development console output (monitoring context)
    if (process.env.NODE_ENV === 'development') {
      console.log('Captured Message:', messageInfo);
    }
  }

  // Performance measurement with proper typing
  async measurePerformance<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();

    this.addBreadcrumb(`Performance measurement started: ${name}`, 'performance', 'info');

    try {
      const result = await operation();
      const duration = performance.now() - start;

      const metrics: PerformanceMetrics = { duration, status: 'success' };
      this.addBreadcrumb(
        `Performance: ${name} completed in ${duration.toFixed(2)}ms`,
        'performance',
        'info',
        metrics
      );

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const metrics: PerformanceMetrics = { duration, status: 'error', error: errorMessage };
      this.addBreadcrumb(
        `Performance: ${name} failed after ${duration.toFixed(2)}ms`,
        'performance',
        'error',
        metrics
      );

      throw error;
    }
  }

  // Get current breadcrumbs (for debugging)
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  // Track analytics event with proper typing
  trackEvent(eventName: string, properties?: AnalyticsProperties): void {
    this.addBreadcrumb(`Analytics: ${eventName}`, 'analytics', 'info', properties);
  }

  // Helper for debugging - print current state (monitoring context)
  debug(): void {
    console.group('🔍 Simple Monitoring Debug Info');
    console.log('User:', this.user);
    console.log('Breadcrumbs:', this.breadcrumbs);
    console.log('URL:', window.location.href);
    console.groupEnd();
  }

  private generateId(): string {
    // Generate a unique ID for tracking errors and messages
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// 🌟 **ELITE SINGLETON INSTANCE**
const simpleMonitoring = new SimpleMonitoring();

// 🚀 **ELITE EXPORT FUNCTIONS WITH PROPER TYPING**
export const initMonitoring = (): void => simpleMonitoring.init();

export const addBreadcrumb = (
  message: string,
  category?: string,
  level?: LogLevel,
  data?: MonitoringData
): void => simpleMonitoring.addBreadcrumb(message, category, level, data);

export const setUser = (user: UserContext): void => simpleMonitoring.setUser(user);

export const clearUser = (): void => simpleMonitoring.clearUser();

export const captureError = (error: Error, context?: ErrorContext, level?: LogLevel): void =>
  simpleMonitoring.captureError(error, context, level);

export const captureMessage = (message: string, level?: LogLevel, context?: MonitoringData): void =>
  simpleMonitoring.captureMessage(message, level, context);

export const measurePerformance = <T>(name: string, operation: () => Promise<T>): Promise<T> =>
  simpleMonitoring.measurePerformance(name, operation);

export const trackEvent = (eventName: string, properties?: AnalyticsProperties): void =>
  simpleMonitoring.trackEvent(eventName, properties);

export default simpleMonitoring;
