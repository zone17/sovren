/**
 * Sentry Node.js Integration
 *
 * Real @sentry/node SDK integration for production error tracking.
 * Captures unhandled exceptions, breadcrumbs, and performance data.
 *
 * Configuration:
 *   SENTRY_DSN - Sentry project DSN (required for Sentry to be active)
 *   SENTRY_ENVIRONMENT - Environment name (defaults to NODE_ENV)
 *   SENTRY_RELEASE - Release version (defaults to npm_package_version)
 *   SENTRY_TRACES_SAMPLE_RATE - Performance sampling rate (default: 0.1)
 *
 * @module lib/sentry
 */

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN || '';

export function initSentry(): void {
  if (!dsn) {
    console.log('[Sentry] No SENTRY_DSN configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version || '0.0.0',

    // Performance monitoring - 10% of transactions in production (FREE tier budget)
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Integrations
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],

    // Sanitize sensitive data before sending
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }

      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>;
        const sensitiveKeys = ['password', 'token', 'secret', 'private_key', 'nsec'];
        for (const key of Object.keys(data)) {
          if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
            data[key] = '[REDACTED]';
          }
        }
      }

      return event;
    },

    // Sanitize breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Redact URLs containing tokens
      if (breadcrumb.data?.url && typeof breadcrumb.data.url === 'string') {
        breadcrumb.data.url = breadcrumb.data.url.replace(
          /([?&])(token|key|secret|password)=[^&]+/gi,
          '$1$2=[REDACTED]'
        );
      }
      return breadcrumb;
    },
  });

  console.log('[Sentry] Initialized for environment:', process.env.NODE_ENV);
}

/**
 * Sentry Express error handler. Add AFTER all routes.
 */
export const sentryErrorHandler = Sentry.setupExpressErrorHandler
  ? (app: import('express').Express) => Sentry.setupExpressErrorHandler(app)
  : () => {}; // No-op if DSN not set

export { Sentry };
