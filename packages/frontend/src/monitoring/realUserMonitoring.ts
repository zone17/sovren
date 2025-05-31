import { addBreadcrumb, captureMessage } from './simpleMonitoring';

// User session data interface
interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  interactions: number;
  errors: number;
  userAgent: string;
  viewport: { width: number; height: number };
  connection?: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  device: 'mobile' | 'tablet' | 'desktop';
}

// User interaction types
interface UserInteraction {
  type: 'click' | 'scroll' | 'form_submit' | 'keyboard' | 'navigation';
  element?: string;
  timestamp: number;
  pageUrl: string;
  position?: { x: number; y: number };
  value?: string;
}

// Page performance metrics
interface PageMetrics {
  url: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  timeToInteractive?: number;
}

class RealUserMonitoring {
  private session: UserSession;
  private interactions: UserInteraction[] = [];
  private pageMetrics: PageMetrics[] = [];
  private isTracking = false;
  private inactivityTimer: number | null = null;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.session = this.initializeSession();
    this.init();
  }

  private initializeSession(): UserSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      pageViews: 0,
      interactions: 0,
      errors: 0,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      connection: this.getConnectionType(),
      device: this.getDeviceType(),
    };
  }

  private getConnectionType(): 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  public init(): void {
    if (this.isTracking) return;

    this.isTracking = true;
    this.setupEventListeners();
    this.trackPageView();
    this.resetInactivityTimer();

    addBreadcrumb('RUM monitoring initialized', 'navigation', 'info');
    console.log('🔍 Real User Monitoring initialized');
  }

  private setupEventListeners(): void {
    // Page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // User interactions
    document.addEventListener('click', this.trackClick.bind(this), true);
    document.addEventListener('scroll', this.trackScroll.bind(this), { passive: true });
    document.addEventListener('keydown', this.trackKeyboard.bind(this));

    // Form submissions
    document.addEventListener('submit', this.trackFormSubmit.bind(this), true);

    // Window events
    window.addEventListener('resize', this.trackResize.bind(this));
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Error tracking
    window.addEventListener('error', this.trackError.bind(this));
    window.addEventListener('unhandledrejection', this.trackUnhandledRejection.bind(this));

    // Performance observer for navigation timing
    if ('PerformanceObserver' in window) {
      this.observeNavigationTiming();
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.pauseTracking();
    } else {
      this.resumeTracking();
    }
  }

  private pauseTracking(): void {
    addBreadcrumb('User left page/tab', 'navigation', 'info');
    this.sendSessionData();
  }

  private resumeTracking(): void {
    this.updateLastActivity();
    addBreadcrumb('User returned to page/tab', 'navigation', 'info');
  }

  private trackClick(event: Event): void {
    const target = event.target as HTMLElement;
    const interaction: UserInteraction = {
      type: 'click',
      element: this.getElementSelector(target),
      timestamp: Date.now(),
      pageUrl: window.location.href,
      position: {
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY,
      },
    };

    this.recordInteraction(interaction);
  }

  private trackScroll(): void {
    // Throttle scroll events
    if (this.interactions.filter((i) => i.type === 'scroll').length % 10 === 0) {
      const interaction: UserInteraction = {
        type: 'scroll',
        timestamp: Date.now(),
        pageUrl: window.location.href,
        position: {
          x: window.scrollX,
          y: window.scrollY,
        },
      };

      this.recordInteraction(interaction);
    }
  }

  private trackKeyboard(event: KeyboardEvent): void {
    const interaction: UserInteraction = {
      type: 'keyboard',
      element: this.getElementSelector(event.target as HTMLElement),
      timestamp: Date.now(),
      pageUrl: window.location.href,
      value: event.key,
    };

    this.recordInteraction(interaction);
  }

  private trackFormSubmit(event: Event): void {
    const form = event.target as HTMLFormElement;
    const interaction: UserInteraction = {
      type: 'form_submit',
      element: this.getElementSelector(form),
      timestamp: Date.now(),
      pageUrl: window.location.href,
    };

    this.recordInteraction(interaction);
  }

  private trackResize(): void {
    this.session.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.session.device = this.getDeviceType();
    this.updateLastActivity();
  }

  private trackError(event: ErrorEvent): void {
    this.session.errors++;

    addBreadcrumb(`JavaScript error: ${event.message}`, 'error', 'error');
  }

  private trackUnhandledRejection(event: PromiseRejectionEvent): void {
    this.session.errors++;

    addBreadcrumb(`Unhandled promise rejection: ${event.reason}`, 'error', 'error');
  }

  private observeNavigationTiming(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          this.recordPageMetrics(entry as PerformanceNavigationTiming);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.warn('Navigation timing observer not supported');
    }
  }

  private recordPageMetrics(timing: PerformanceNavigationTiming): void {
    const metrics: PageMetrics = {
      url: window.location.href,
      loadTime: timing.loadEventEnd - timing.fetchStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.fetchStart,
      firstPaint: this.getFirstPaint(),
      firstContentfulPaint: this.getFirstContentfulPaint(),
    };

    this.pageMetrics.push(metrics);

    addBreadcrumb(`Page metrics recorded: ${metrics.loadTime}ms load time`, 'performance', 'info');
  }

  private getFirstPaint(): number | undefined {
    const entries = performance.getEntriesByType('paint');
    const fpEntry = entries.find((entry) => entry.name === 'first-paint');
    return fpEntry?.startTime;
  }

  private getFirstContentfulPaint(): number | undefined {
    const entries = performance.getEntriesByType('paint');
    const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
    return fcpEntry?.startTime;
  }

  private getElementSelector(element: HTMLElement): string {
    if (!element) return 'unknown';

    // Try ID first
    if (element.id) return `#${element.id}`;

    // Try data attributes
    if (element.dataset.testid) return `[data-testid="${element.dataset.testid}"]`;
    if (element.dataset.cy) return `[data-cy="${element.dataset.cy}"]`;

    // Fallback to tag + class
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';

    return `${tagName}${className}`.slice(0, 50); // Limit length
  }

  private recordInteraction(interaction: UserInteraction): void {
    this.interactions.push(interaction);
    this.session.interactions++;
    this.updateLastActivity();

    // Keep only last 100 interactions to manage memory
    if (this.interactions.length > 100) {
      this.interactions = this.interactions.slice(-100);
    }
  }

  private updateLastActivity(): void {
    this.session.lastActivity = Date.now();
    this.resetInactivityTimer();
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      window.clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = window.setTimeout(() => {
      this.handleInactivity();
    }, this.INACTIVITY_TIMEOUT);
  }

  private handleInactivity(): void {
    addBreadcrumb('User inactive for 30 minutes', 'navigation', 'info');
    this.sendSessionData();
  }

  private handleBeforeUnload(): void {
    this.sendSessionData();
  }

  public trackPageView(url?: string): void {
    this.session.pageViews++;
    this.updateLastActivity();

    const pageUrl = url || window.location.href;

    addBreadcrumb(`Page view: ${pageUrl}`, 'navigation', 'info');

    // Record navigation interaction
    const interaction: UserInteraction = {
      type: 'navigation',
      timestamp: Date.now(),
      pageUrl,
    };

    this.recordInteraction(interaction);
  }

  public setUser(userId: string): void {
    this.session.userId = userId;
    addBreadcrumb(`User identified: ${userId}`, 'user', 'info');
  }

  public trackCustomEvent(eventName: string, properties?: Record<string, any>): void {
    addBreadcrumb(
      `Custom event: ${eventName}${properties ? ` - ${JSON.stringify(properties)}` : ''}`,
      'custom',
      'info'
    );
  }

  public getSessionSummary() {
    const sessionDuration = Date.now() - this.session.startTime;

    return {
      ...this.session,
      sessionDuration,
      interactionRate: this.session.interactions / (sessionDuration / 60000), // interactions per minute
      errorRate: this.session.errors / this.session.pageViews,
      avgPageLoadTime:
        this.pageMetrics.length > 0
          ? this.pageMetrics.reduce((sum, m) => sum + m.loadTime, 0) / this.pageMetrics.length
          : 0,
      recentInteractions: this.interactions.slice(-10),
      performanceMetrics: this.pageMetrics.slice(-5),
    };
  }

  private sendSessionData(): void {
    const sessionSummary = this.getSessionSummary();

    // Send to monitoring service (Sentry, analytics, etc.)
    captureMessage('User session summary', 'info');

    // Log for development
    if (process.env.NODE_ENV === 'development') {
      console.group('📊 RUM Session Summary');
      console.log('Session:', sessionSummary);
      console.groupEnd();
    }
  }

  public destroy(): void {
    this.isTracking = false;
    this.sendSessionData();

    if (this.inactivityTimer) {
      window.clearTimeout(this.inactivityTimer);
    }

    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    document.removeEventListener('click', this.trackClick.bind(this));
    document.removeEventListener('scroll', this.trackScroll.bind(this));
    document.removeEventListener('keydown', this.trackKeyboard.bind(this));
    document.removeEventListener('submit', this.trackFormSubmit.bind(this));
    window.removeEventListener('resize', this.trackResize.bind(this));
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    window.removeEventListener('error', this.trackError.bind(this));
    window.removeEventListener('unhandledrejection', this.trackUnhandledRejection.bind(this));
  }
}

// Singleton instance
export const realUserMonitoring = new RealUserMonitoring();

// Utility functions for common RUM tasks
export const trackPageView = (url?: string) => realUserMonitoring.trackPageView(url);
export const setRumUser = (userId: string) => realUserMonitoring.setUser(userId);
export const trackCustomEvent = (eventName: string, properties?: Record<string, any>) =>
  realUserMonitoring.trackCustomEvent(eventName, properties);
export const getRumSessionSummary = () => realUserMonitoring.getSessionSummary();

export default realUserMonitoring;
