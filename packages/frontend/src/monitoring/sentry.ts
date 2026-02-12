/**
 * Sentry React SDK Integration
 *
 * Real @sentry/react SDK for production error tracking and performance monitoring.
 *
 * Configuration (via environment variables / import.meta.env):
 *   VITE_SENTRY_DSN           - Sentry project DSN (required)
 *   VITE_SENTRY_ENVIRONMENT   - Environment name (defaults to MODE)
 *   VITE_SENTRY_RELEASE       - Release version
 *   VITE_SENTRY_TRACES_SAMPLE_RATE - Performance sampling (default: 0.1)
 *
 * @module monitoring/sentry
 */

import * as Sentry from '@sentry/react';

export interface SentryConfig {
  dsn: string;
  environment: 'development' | 'staging' | 'production';
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

export interface UserContext {
  id: string;
  email?: string;
  username?: string;
  plan?: string;
  segment?: string;
}

/**
 * Initialize Sentry with real SDK.
 * Should be called once at application startup, before React renders.
 */
export function initSentry(config?: Partial<SentryConfig>): void {
  const dsn = config?.dsn || import.meta.env.VITE_SENTRY_DSN || '';

  if (!dsn) {
    console.log('[Sentry] No DSN configured, error tracking disabled');
    return;
  }

  const environment =
    config?.environment ||
    (import.meta.env.VITE_SENTRY_ENVIRONMENT as SentryConfig['environment']) ||
    (import.meta.env.MODE as SentryConfig['environment']) ||
    'development';

  Sentry.init({
    dsn,
    environment,
    release: config?.release || import.meta.env.VITE_SENTRY_RELEASE || undefined,

    // Error sampling - capture all errors
    sampleRate: config?.sampleRate ?? 1.0,

    // Performance monitoring - 10% on FREE tier to stay within budget
    tracesSampleRate:
      config?.tracesSampleRate ??
      parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Session replay sampling (FREE tier: keep low)
    replaysSessionSampleRate: config?.replaysSessionSampleRate ?? 0,
    replaysOnErrorSampleRate: config?.replaysOnErrorSampleRate ?? 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Sanitize sensitive data before sending to Sentry
    beforeSend(event) {
      // Redact sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },

    // Sanitize breadcrumb URLs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data?.url && typeof breadcrumb.data.url === 'string') {
        breadcrumb.data.url = breadcrumb.data.url.replace(
          /([?&])(token|key|secret|password|nsec)=[^&]+/gi,
          '$1$2=[REDACTED]'
        );
      }
      return breadcrumb;
    },
  });

  console.log('[Sentry] Initialized for environment:', environment);
}

/**
 * Set user context for session tracking.
 */
export function setUser(user: UserContext): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    segment: user.segment,
  });
}

/**
 * Clear user context (logout).
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture an error with optional context.
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'error'
): string {
  return Sentry.captureException(error, {
    level,
    extra: context,
  });
}

/**
 * Capture a message with optional context.
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  extra?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra,
  });
}

/**
 * Add a breadcrumb for debugging context.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Measure function performance using Sentry spans.
 */
export function measurePerformance<T>(name: string, fn: () => T): T {
  return Sentry.startSpan({ name, op: 'function' }, () => fn());
}

/**
 * Measure async function performance using Sentry spans.
 */
export async function measureAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan({ name, op: 'function' }, () => fn());
}

/**
 * Force flush all pending events (useful before page unload).
 */
export async function flush(timeout = 5000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Check if Sentry is initialized and active.
 */
export function isReady(): boolean {
  return !!Sentry.getClient();
}

// Re-export Sentry for advanced usage (ErrorBoundary, etc.)
export { Sentry };

// Default export for backwards compatibility
export default {
  initSentry,
  setUser,
  clearUser,
  captureError,
  captureMessage,
  addBreadcrumb,
  measurePerformance,
  measureAsyncPerformance,
  flush,
  isReady,
};
