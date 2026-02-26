import logger from '../lib/logger';

/**
 * Analytics Service - Lightweight event tracking stub
 *
 * Logs analytics events via structured logger. Replace with a real
 * analytics provider (Mixpanel, Amplitude, PostHog) when needed.
 */
export class AnalyticsService {
  async track(event: string, properties: Record<string, unknown> = {}): Promise<void> {
    logger.info('Analytics event', { event, ...properties });
  }
}
