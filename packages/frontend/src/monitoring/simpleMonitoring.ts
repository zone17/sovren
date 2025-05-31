// Elite Simple Monitoring System - No External Dependencies
// Lightweight error tracking and breadcrumb system for development and production

export type LogLevel = 'info' | 'warn' | 'warning' | 'error' | 'debug';

interface Breadcrumb {
  message: string;
  category: string;
  level: LogLevel;
  timestamp: number;
  data?: Record<string, any>;
}

interface UserContext {
  id: string;
  email?: string;
  username?: string;
  segment?: string;
  subscription?: string;
  permissions?: string[];
}

class SimpleMonitoring {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 50;
  private user: UserContext | null = null;
  private errors: Record<string, any>[] = [];
  private messages: Record<string, any>[] = [];

  // Initialize monitoring
  init(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Simple Monitoring initialized (Development Mode)');
    }

    // Add global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(new Error(event.reason), {
        type: 'unhandledrejection',
      });
    });
  }

  // Add breadcrumb for tracking user actions
  addBreadcrumb(
    message: string,
    category = 'custom',
    level: LogLevel = 'info',
    data?: Record<string, any>
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

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🍞 [${category}] ${message}`, data || '');
    }
  }

  // Set user context
  setUser(user: UserContext): void {
    this.user = user;
    this.addBreadcrumb(`User identified: ${user.id}`, 'auth', 'info', {
      segment: user.segment,
      subscription: user.subscription,
      permissions_count: user.permissions?.length || 0,
    });
  }

  // Clear user context
  clearUser(): void {
    this.user = null;
    this.addBreadcrumb('User logged out', 'auth', 'info');
  }

  // Capture error with context
  captureError(error: Error, context?: Record<string, any>, _level: LogLevel = 'error'): void {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context,
      level: _level,
      id: this.generateId(),
    };

    this.errors.push(errorInfo);

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      console.error('Captured Error:', errorInfo);
    }
  }

  // Capture message
  captureMessage(message: string, level: LogLevel = 'info', extra?: Record<string, any>): void {
    // Use the message info to track messages
    const messageInfo = {
      message,
      level,
      timestamp: new Date().toISOString(),
      extra,
      id: this.generateId(),
    };

    // Store the message info instead of ignoring it
    this.messages = this.messages || [];
    this.messages.push(messageInfo);

    // Keep only last 100 messages
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Captured Message:', messageInfo);
    }
  }

  // Performance measurement
  async measurePerformance<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();

    this.addBreadcrumb(`Performance measurement started: ${name}`, 'performance', 'info');

    try {
      const result = await operation();
      const duration = performance.now() - start;

      this.addBreadcrumb(
        `Performance: ${name} completed in ${duration.toFixed(2)}ms`,
        'performance',
        'info',
        { duration, status: 'success' }
      );

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.addBreadcrumb(
        `Performance: ${name} failed after ${duration.toFixed(2)}ms`,
        'performance',
        'error',
        { duration, status: 'error', error: (error as Error).message }
      );

      throw error;
    }
  }

  // Get current breadcrumbs (for debugging)
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  // Track analytics event
  trackEvent(eventName: string, properties?: Record<string, any>): void {
    this.addBreadcrumb(`Analytics: ${eventName}`, 'analytics', 'info', properties);
  }

  // Helper for debugging - print current state
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

// Create singleton instance
const simpleMonitoring = new SimpleMonitoring();

// Export convenience functions
export const initMonitoring = () => simpleMonitoring.init();
export const addBreadcrumb = (
  message: string,
  category?: string,
  level?: LogLevel,
  data?: Record<string, any>
) => simpleMonitoring.addBreadcrumb(message, category, level, data);
export const setUser = (user: UserContext) => simpleMonitoring.setUser(user);
export const clearUser = () => simpleMonitoring.clearUser();
export const captureError = (error: Error, context?: Record<string, any>, level?: LogLevel) =>
  simpleMonitoring.captureError(error, context, level);
export const captureMessage = (message: string, level?: LogLevel, context?: Record<string, any>) =>
  simpleMonitoring.captureMessage(message, level, context);
export const measurePerformance = <T>(name: string, operation: () => Promise<T>) =>
  simpleMonitoring.measurePerformance(name, operation);
export const trackEvent = (eventName: string, properties?: Record<string, any>) =>
  simpleMonitoring.trackEvent(eventName, properties);

export default simpleMonitoring;
