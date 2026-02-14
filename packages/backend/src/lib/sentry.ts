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
import { sanitizeObject } from './sensitive-fields';
import logger from './logger';

const dsn = process.env.SENTRY_DSN || '';

export function initSentry(): void {
  if (!dsn) {
    logger.info('No SENTRY_DSN configured, error tracking disabled');
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

    // Sanitize sensitive data before sending (clone to avoid mutating original)
    beforeSend(event) {
      const sanitizedEvent = { ...event };

      if (sanitizedEvent.request) {
        sanitizedEvent.request = { ...sanitizedEvent.request };
        if (sanitizedEvent.request.headers) {
          sanitizedEvent.request.headers = { ...sanitizedEvent.request.headers };
          delete sanitizedEvent.request.headers['authorization'];
          delete sanitizedEvent.request.headers['cookie'];
          delete sanitizedEvent.request.headers['x-api-key'];
        }

        if (sanitizedEvent.request.data && typeof sanitizedEvent.request.data === 'object') {
          sanitizedEvent.request.data = sanitizeObject(
            sanitizedEvent.request.data as Record<string, unknown>
          );
        }
      }

      return sanitizedEvent;
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

  logger.info('Sentry initialized', { environment: process.env.NODE_ENV });
}

export { Sentry };
