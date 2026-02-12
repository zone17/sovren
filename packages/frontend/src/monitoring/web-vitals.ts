/**
 * Web Vitals Reporting
 *
 * Measures Core Web Vitals and reports them to Sentry performance monitoring.
 *
 * Metrics reported:
 *   LCP  - Largest Contentful Paint (target < 2.5s)
 *   FID  - First Input Delay (target < 100ms)
 *   CLS  - Cumulative Layout Shift (target < 0.1)
 *   TTFB - Time to First Byte
 *   INP  - Interaction to Next Paint
 *
 * Uses the web-vitals library (already in frontend dependencies).
 *
 * @module monitoring/web-vitals
 */

import type { Metric } from 'web-vitals';
import { captureMessage, addBreadcrumb } from './sentry';

type WebVitalName = 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP';

const thresholds: Record<WebVitalName, { good: number; needsImprovement: number }> = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  TTFB: { good: 800, needsImprovement: 1800 },
  INP: { good: 200, needsImprovement: 500 },
};

function getRating(name: WebVitalName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = thresholds[name];
  if (!t) return 'good';
  if (value <= t.good) return 'good';
  if (value <= t.needsImprovement) return 'needs-improvement';
  return 'poor';
}

function handleVital(metric: Metric): void {
  const name = metric.name as WebVitalName;
  const rating = getRating(name, metric.value);

  // Add breadcrumb for every web vital measurement
  addBreadcrumb(
    `Web Vital: ${name} = ${metric.value.toFixed(name === 'CLS' ? 3 : 0)}`,
    'web-vital',
    rating === 'poor' ? 'warning' : 'info',
    {
      name,
      value: metric.value,
      rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
    }
  );

  // Only report poor vitals as Sentry messages to stay within FREE tier event budget
  if (rating === 'poor') {
    captureMessage(
      `Poor Web Vital: ${name} = ${metric.value.toFixed(name === 'CLS' ? 3 : 0)}`,
      'warning',
      {
        webVital: name,
        value: metric.value,
        rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
        url: window.location.pathname,
      }
    );
  }
}

/**
 * Start collecting Web Vitals metrics.
 * Dynamically imports web-vitals to avoid blocking the critical path.
 */
export function reportWebVitals(): void {
  import('web-vitals')
    .then(({ onLCP, onFID, onCLS, onTTFB, onINP }) => {
      onLCP(handleVital);
      onFID(handleVital);
      onCLS(handleVital);
      onTTFB(handleVital);
      onINP(handleVital);
    })
    .catch((err) => {
      console.warn('[WebVitals] Failed to load web-vitals library:', err);
    });
}
