/**
 * 📊 **ANALYTICS HOOK**
 *
 * Elite React Hook providing:
 * - Event tracking and user behavior analytics
 * - Performance monitoring
 * - Custom event logging
 * - Privacy-compliant tracking
 */

import { useCallback } from 'react';

// =====================================================
// TYPES
// =====================================================

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp?: Date;
  sessionId?: string;
  category?: string;
  label?: string;
  value?: number;
}

export interface AnalyticsConfig {
  enableTracking: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  privacyMode: boolean;
  sessionTimeout: number;
  batchSize: number;
  flushInterval: number;
}

export interface UseAnalyticsReturn {
  track: (event: string, properties?: Record<string, any>) => Promise<void>;
  identify: (userId: string, traits?: Record<string, any>) => Promise<void>;
  page: (pageName: string, properties?: Record<string, any>) => Promise<void>;
  group: (groupId: string, traits?: Record<string, any>) => Promise<void>;
  alias: (newId: string, previousId?: string) => Promise<void>;
  reset: () => void;
  flush: () => Promise<void>;
  isTracking: boolean;
  sessionId: string;
}

// =====================================================
// DEFAULT CONFIG
// =====================================================

const DEFAULT_CONFIG: AnalyticsConfig = {
  enableTracking: true,
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  privacyMode: false,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  batchSize: 20,
  flushInterval: 10 * 1000, // 10 seconds
};

// =====================================================
// ANALYTICS SERVICE
// =====================================================

class AnalyticsService {
  private config: AnalyticsConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private sessionId: string;
  private userId?: string;
  private flushTimer?: NodeJS.Timeout;
  private lastActivity: number = Date.now();

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.setupAutoFlush();
    this.setupActivityTracking();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private setupAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  private setupActivityTracking(): void {
    const updateActivity = () => {
      const now = Date.now();

      // Check if session has expired
      if (now - this.lastActivity > this.config.sessionTimeout) {
        this.sessionId = this.generateSessionId();
      }

      this.lastActivity = now;
    };

    // Throttled version for high-frequency events (mousemove)
    let lastMousemoveUpdate = 0;
    const throttledUpdateActivity = () => {
      const now = Date.now();
      if (now - lastMousemoveUpdate >= 5000) {
        lastMousemoveUpdate = now;
        updateActivity();
      }
    };

    // Track user activity
    if (typeof window !== 'undefined') {
      window.addEventListener('click', updateActivity);
      window.addEventListener('scroll', updateActivity);
      window.addEventListener('keydown', updateActivity);
      window.addEventListener('mousemove', throttledUpdateActivity);
    }
  }

  async track(event: string, properties: Record<string, any> = {}): Promise<void> {
    if (!this.config.enableTracking) return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: this.sanitizeProperties(properties),
      userId: this.userId,
      timestamp: new Date(),
      sessionId: this.sessionId,
    };

    this.eventQueue.push(analyticsEvent);

    // Auto-flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async identify(userId: string, traits: Record<string, any> = {}): Promise<void> {
    if (!this.config.enableTracking) return;

    this.userId = userId;

    await this.track('user_identified', {
      userId,
      traits: this.sanitizeProperties(traits),
    });
  }

  async page(pageName: string, properties: Record<string, any> = {}): Promise<void> {
    if (!this.config.enableTracking) return;

    await this.track('page_viewed', {
      page: pageName,
      url: typeof window !== 'undefined' ? window.location.href : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      ...this.sanitizeProperties(properties),
    });
  }

  async group(groupId: string, traits: Record<string, any> = {}): Promise<void> {
    if (!this.config.enableTracking) return;

    await this.track('group_identified', {
      groupId,
      traits: this.sanitizeProperties(traits),
    });
  }

  async alias(newId: string, previousId?: string): Promise<void> {
    if (!this.config.enableTracking) return;

    await this.track('user_aliased', {
      newId,
      previousId: previousId || this.userId,
    });

    this.userId = newId;
  }

  reset(): void {
    this.userId = undefined;
    this.sessionId = this.generateSessionId();
    this.eventQueue = [];
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send events to analytics endpoint
      await this.sendEvents(events);
    } catch (error) {
      console.error('Failed to send analytics events:', error);

      // Re-queue events on failure (with limit to prevent infinite growth)
      if (this.eventQueue.length < this.config.batchSize * 2) {
        this.eventQueue.unshift(...events);
      }
    }
  }

  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    if (typeof window === 'undefined') return;

    const payload = {
      events,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer,
    };

    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Analytics request failed: ${response.status}`);
    }
  }

  private sanitizeProperties(properties: Record<string, any>): Record<string, any> {
    if (!this.config.privacyMode) {
      return properties;
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Remove potentially sensitive data in privacy mode
      if (!this.isSensitiveKey(key)) {
        sanitized[key] = this.sanitizeValue(value);
      }
    }

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = ['email', 'password', 'token', 'credit_card', 'ssn', 'phone', 'address'];

    return sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive));
  }

  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Mask potential email addresses, phone numbers, etc.
      return value
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
        .replace(/\b\d{3}-?\d{3}-?\d{4}\b/g, '[phone]');
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (!this.isSensitiveKey(k)) {
          sanitized[k] = this.sanitizeValue(v);
        }
      }
      return sanitized;
    }

    return value;
  }

  get isTracking(): boolean {
    return this.config.enableTracking;
  }

  get currentSessionId(): string {
    return this.sessionId;
  }
}

// =====================================================
// GLOBAL ANALYTICS INSTANCE
// =====================================================

let analyticsInstance: AnalyticsService | null = null;

const getAnalyticsInstance = (config?: Partial<AnalyticsConfig>): AnalyticsService => {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsService(config);
  }
  return analyticsInstance;
};

// =====================================================
// MAIN HOOK
// =====================================================

export const useAnalytics = (config?: Partial<AnalyticsConfig>): UseAnalyticsReturn => {
  const analytics = getAnalyticsInstance(config);

  const track = useCallback(
    async (event: string, properties?: Record<string, any>): Promise<void> => {
      return analytics.track(event, properties);
    },
    [analytics]
  );

  const identify = useCallback(
    async (userId: string, traits?: Record<string, any>): Promise<void> => {
      return analytics.identify(userId, traits);
    },
    [analytics]
  );

  const page = useCallback(
    async (pageName: string, properties?: Record<string, any>): Promise<void> => {
      return analytics.page(pageName, properties);
    },
    [analytics]
  );

  const group = useCallback(
    async (groupId: string, traits?: Record<string, any>): Promise<void> => {
      return analytics.group(groupId, traits);
    },
    [analytics]
  );

  const alias = useCallback(
    async (newId: string, previousId?: string): Promise<void> => {
      return analytics.alias(newId, previousId);
    },
    [analytics]
  );

  const reset = useCallback((): void => {
    analytics.reset();
  }, [analytics]);

  const flush = useCallback(async (): Promise<void> => {
    return analytics.flush();
  }, [analytics]);

  return {
    track,
    identify,
    page,
    group,
    alias,
    reset,
    flush,
    isTracking: analytics.isTracking,
    sessionId: analytics.currentSessionId,
  };
};

export default useAnalytics;
