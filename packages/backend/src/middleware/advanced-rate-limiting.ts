/**
 * ⚡ **ADVANCED RATE LIMITING SYSTEM**
 *
 * US-133: Rate Limiting Implementation
 *
 * Elite Security Features:
 * - Rate Limiting Architecture Design (9.11.1)
 * - Request Rate Limiting (9.11.2)
 * - Adaptive Rate Limiting (9.11.3)
 * - Rate Limiting by User/IP (9.11.4)
 * - Rate Limit Monitoring (9.11.5)
 * - Rate Limit Bypass Detection (9.11.6)
 * - Rate Limiting Configuration (9.11.7)
 * - Rate Limiting Effectiveness Testing (9.11.8)
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  onLimitReached?: (req: Request, res: Response, options: RateLimitConfig) => void;
  store?: RateLimitStore;
}

export interface AdaptiveRateLimitConfig extends RateLimitConfig {
  baseLimit: number;
  maxLimit: number;
  adaptationFactor: number;
  monitoringWindowMs: number;
  triggerThresholds: {
    errorRate: number;
    responseTime: number;
    concurrency: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
  totalRequests: number;
  currentWindowMs: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
  lastRequest: number;
  blocked: number;
  metadata: {
    userAgent: string;
    successRate: number;
    averageResponseTime: number;
    errorTypes: string[];
  };
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, entry: RateLimitEntry, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface RateLimitMonitoringData {
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  topViolators: Array<{ identifier: string; violations: number }>;
  bypassAttempts: number;
  adaptiveAdjustments: number;
  averageResponseTime: number;
  errorRate: number;
}

// =====================================================
// 9.11.1 RATE LIMITING ARCHITECTURE DESIGN
// =====================================================

export class RateLimitArchitecture {
  private static instance: RateLimitArchitecture;
  private stores: Map<string, RateLimitStore>;
  private monitors: Map<string, RateLimitMonitor>;
  private detectors: Map<string, BypassDetector>;

  private constructor() {
    this.stores = new Map();
    this.monitors = new Map();
    this.detectors = new Map();
  }

  static getInstance(): RateLimitArchitecture {
    if (!RateLimitArchitecture.instance) {
      RateLimitArchitecture.instance = new RateLimitArchitecture();
    }
    return RateLimitArchitecture.instance;
  }

  registerStore(name: string, store: RateLimitStore): void {
    this.stores.set(name, store);
  }

  getStore(name: string): RateLimitStore | undefined {
    return this.stores.get(name);
  }

  registerMonitor(name: string, monitor: RateLimitMonitor): void {
    this.monitors.set(name, monitor);
  }

  getMonitor(name: string): RateLimitMonitor | undefined {
    return this.monitors.get(name);
  }

  registerDetector(name: string, detector: BypassDetector): void {
    this.detectors.set(name, detector);
  }

  getDetector(name: string): BypassDetector | undefined {
    return this.detectors.get(name);
  }

  getSystemStats(): {
    activeStores: number;
    activeMonitors: number;
    activeDetectors: number;
    totalKeys: number;
  } {
    return {
      activeStores: this.stores.size,
      activeMonitors: this.monitors.size,
      activeDetectors: this.detectors.size,
      totalKeys: 0, // Would need to aggregate from all stores
    };
  }
}

// =====================================================
// IN-MEMORY RATE LIMIT STORE
// =====================================================

export class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitEntry>;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  async set(key: string, entry: RateLimitEntry, ttl: number): Promise<void> {
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  getSize(): number {
    return this.store.size;
  }
}

// =====================================================
// 9.11.2 REQUEST RATE LIMITING
// =====================================================

export class RequestRateLimiter {
  private config: RateLimitConfig;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.store = config.store || new MemoryRateLimitStore();
  }

  async checkLimit(req: Request): Promise<RateLimitResult> {
    const key = this.generateKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = await this.store.get(key);

    if (!entry || entry.resetTime <= now) {
      // Create new entry for new window
      entry = {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now,
        lastRequest: now,
        blocked: 0,
        metadata: {
          userAgent: req.get('User-Agent') || 'unknown',
          successRate: 1.0,
          averageResponseTime: 0,
          errorTypes: [],
        },
      };
    } else {
      // Update existing entry
      entry.count++;
      entry.lastRequest = now;
    }

    const allowed = entry.count <= this.config.maxRequests;

    if (!allowed) {
      entry.blocked++;
    }

    await this.store.set(key, entry, this.config.windowMs);

    return {
      allowed,
      remainingRequests: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000),
      totalRequests: entry.count,
      currentWindowMs: this.config.windowMs,
    };
  }

  private generateKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Default key generation: IP + User-Agent fingerprint
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const fingerprint = createHash('sha256')
      .update(`${ip}:${userAgent}`)
      .digest('hex')
      .substring(0, 16);

    return `rate_limit:${fingerprint}`;
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// =====================================================
// 9.11.3 ADAPTIVE RATE LIMITING
// =====================================================

export class AdaptiveRateLimiter extends RequestRateLimiter {
  private adaptiveConfig: AdaptiveRateLimitConfig;
  private systemMetrics: {
    errorRate: number;
    averageResponseTime: number;
    concurrency: number;
    lastUpdate: number;
  };
  private currentLimit: number;

  constructor(config: AdaptiveRateLimitConfig) {
    super(config);
    this.adaptiveConfig = config;
    this.currentLimit = config.baseLimit;
    this.systemMetrics = {
      errorRate: 0,
      averageResponseTime: 0,
      concurrency: 0,
      lastUpdate: Date.now(),
    };

    // Start adaptive monitoring
    this.startAdaptiveMonitoring();
  }

  async checkLimit(req: Request): Promise<RateLimitResult> {
    // Update config with current adaptive limit
    this.config.maxRequests = this.currentLimit;

    const result = await super.checkLimit(req);

    // Record request for adaptive analysis
    this.recordRequest(req, result);

    return result;
  }

  private recordRequest(req: Request, result: RateLimitResult): void {
    // Update system metrics for adaptive decisions
    const now = Date.now();

    // Simulate response time recording (in real implementation, this would be measured)
    const responseTime = Math.random() * 1000; // Mock response time
    this.updateAverageResponseTime(responseTime);

    // Update error rate based on request outcome
    const isError = !result.allowed || Math.random() < 0.05; // Mock error detection
    this.updateErrorRate(isError);

    // Update concurrency (simplified)
    this.systemMetrics.concurrency = Math.max(
      0,
      this.systemMetrics.concurrency + (result.allowed ? 1 : 0)
    );
    this.systemMetrics.lastUpdate = now;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const alpha = 0.1; // Smoothing factor
    this.systemMetrics.averageResponseTime =
      alpha * responseTime + (1 - alpha) * this.systemMetrics.averageResponseTime;
  }

  private updateErrorRate(isError: boolean): void {
    const alpha = 0.1; // Smoothing factor
    const errorValue = isError ? 1 : 0;
    this.systemMetrics.errorRate = alpha * errorValue + (1 - alpha) * this.systemMetrics.errorRate;
  }

  private startAdaptiveMonitoring(): void {
    setInterval(() => {
      this.adaptRateLimit();
    }, this.adaptiveConfig.monitoringWindowMs);
  }

  private adaptRateLimit(): void {
    const { errorRate, averageResponseTime, concurrency } = this.systemMetrics;
    const { triggerThresholds, adaptationFactor, baseLimit, maxLimit } = this.adaptiveConfig;

    let adjustmentFactor = 1.0;

    // Decrease limit if error rate is high
    if (errorRate > triggerThresholds.errorRate) {
      adjustmentFactor *= 1 - adaptationFactor;
    }

    // Decrease limit if response time is high
    if (averageResponseTime > triggerThresholds.responseTime) {
      adjustmentFactor *= 1 - adaptationFactor;
    }

    // Decrease limit if concurrency is high
    if (concurrency > triggerThresholds.concurrency) {
      adjustmentFactor *= 1 - adaptationFactor;
    }

    // If all metrics are good, gradually increase limit
    if (
      errorRate < triggerThresholds.errorRate * 0.5 &&
      averageResponseTime < triggerThresholds.responseTime * 0.8 &&
      concurrency < triggerThresholds.concurrency * 0.8
    ) {
      adjustmentFactor *= 1 + adaptationFactor * 0.1;
    }

    // Apply adaptation
    const newLimit = Math.round(this.currentLimit * adjustmentFactor);
    this.currentLimit = Math.max(1, Math.min(maxLimit, newLimit));

    console.log(
      `🔄 Adaptive Rate Limit: ${this.currentLimit} (was ${this.currentLimit / adjustmentFactor})`
    );
  }

  getCurrentLimit(): number {
    return this.currentLimit;
  }

  getSystemMetrics(): typeof this.systemMetrics {
    return { ...this.systemMetrics };
  }
}

// =====================================================
// 9.11.4 RATE LIMITING BY USER/IP
// =====================================================

export class UserIPRateLimiter {
  private ipLimiter: RequestRateLimiter;
  private userLimiter: RequestRateLimiter;
  private combinedLimiter: RequestRateLimiter;

  constructor(
    ipConfig: RateLimitConfig,
    userConfig: RateLimitConfig,
    combinedConfig: RateLimitConfig
  ) {
    this.ipLimiter = new RequestRateLimiter({
      ...ipConfig,
      keyGenerator: (req) => `ip:${this.getClientIP(req)}`,
    });

    this.userLimiter = new RequestRateLimiter({
      ...userConfig,
      keyGenerator: (req) => `user:${this.getUserId(req)}`,
    });

    this.combinedLimiter = new RequestRateLimiter({
      ...combinedConfig,
      keyGenerator: (req) => `combined:${this.getUserId(req)}:${this.getClientIP(req)}`,
    });
  }

  async checkLimits(req: Request): Promise<{
    allowed: boolean;
    ipResult: RateLimitResult;
    userResult: RateLimitResult;
    combinedResult: RateLimitResult;
    limitingFactor: 'ip' | 'user' | 'combined' | 'none';
  }> {
    const [ipResult, userResult, combinedResult] = await Promise.all([
      this.ipLimiter.checkLimit(req),
      this.userLimiter.checkLimit(req),
      this.combinedLimiter.checkLimit(req),
    ]);

    let limitingFactor: 'ip' | 'user' | 'combined' | 'none' = 'none';
    let allowed = true;

    if (!ipResult.allowed) {
      allowed = false;
      limitingFactor = 'ip';
    } else if (!userResult.allowed) {
      allowed = false;
      limitingFactor = 'user';
    } else if (!combinedResult.allowed) {
      allowed = false;
      limitingFactor = 'combined';
    }

    return {
      allowed,
      ipResult,
      userResult,
      combinedResult,
      limitingFactor,
    };
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private getUserId(req: Request): string {
    // Extract user ID from JWT token, session, or auth header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // In real implementation, decode JWT to get user ID
        return 'authenticated_user'; // Simplified
      } catch (error) {
        return 'anonymous';
      }
    }
    return 'anonymous';
  }
}

// =====================================================
// 9.11.5 RATE LIMIT MONITORING
// =====================================================

export class RateLimitMonitor {
  private events: Array<{
    timestamp: Date;
    type: 'allowed' | 'blocked' | 'bypass_attempt';
    identifier: string;
    endpoint: string;
    details: any;
  }> = [];

  private metrics: RateLimitMonitoringData = {
    totalRequests: 0,
    blockedRequests: 0,
    uniqueIPs: 0,
    topViolators: [],
    bypassAttempts: 0,
    adaptiveAdjustments: 0,
    averageResponseTime: 0,
    errorRate: 0,
  };

  private ipTracker: Set<string> = new Set();
  private violatorCounts: Map<string, number> = new Map();

  recordEvent(
    type: 'allowed' | 'blocked' | 'bypass_attempt',
    identifier: string,
    endpoint: string,
    details: any = {}
  ): void {
    this.events.push({
      timestamp: new Date(),
      type,
      identifier,
      endpoint,
      details,
    });

    // Keep only last 10000 events
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }

    this.updateMetrics(type, identifier, details);
  }

  private updateMetrics(
    type: 'allowed' | 'blocked' | 'bypass_attempt',
    identifier: string,
    details: any
  ): void {
    this.metrics.totalRequests++;

    if (type === 'blocked') {
      this.metrics.blockedRequests++;
      this.violatorCounts.set(identifier, (this.violatorCounts.get(identifier) || 0) + 1);
    }

    if (type === 'bypass_attempt') {
      this.metrics.bypassAttempts++;
    }

    // Track unique IPs
    if (details.ip) {
      this.ipTracker.add(details.ip);
      this.metrics.uniqueIPs = this.ipTracker.size;
    }

    // Update top violators
    this.updateTopViolators();

    // Update response time
    if (details.responseTime) {
      const alpha = 0.1;
      this.metrics.averageResponseTime =
        alpha * details.responseTime + (1 - alpha) * this.metrics.averageResponseTime;
    }

    // Update error rate
    if (details.isError !== undefined) {
      const alpha = 0.1;
      const errorValue = details.isError ? 1 : 0;
      this.metrics.errorRate = alpha * errorValue + (1 - alpha) * this.metrics.errorRate;
    }
  }

  private updateTopViolators(): void {
    this.metrics.topViolators = Array.from(this.violatorCounts.entries())
      .map(([identifier, violations]) => ({ identifier, violations }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);
  }

  getMetrics(): RateLimitMonitoringData {
    return { ...this.metrics };
  }

  getRecentEvents(limit = 100): typeof this.events {
    return this.events.slice(-limit);
  }

  generateReport(timeRange?: { start: Date; end: Date }): {
    summary: RateLimitMonitoringData;
    timeline: Array<{ hour: string; requests: number; blocked: number }>;
    endpoints: Array<{ endpoint: string; requests: number; blockRate: number }>;
    patterns: {
      burstDetected: boolean;
      suspiciousIPs: string[];
      anomalies: string[];
    };
  } {
    const filteredEvents = timeRange
      ? this.events.filter((e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
      : this.events;

    // Generate timeline
    const timeline = this.generateTimeline(filteredEvents);

    // Generate endpoint statistics
    const endpoints = this.generateEndpointStats(filteredEvents);

    // Detect patterns
    const patterns = this.detectPatterns(filteredEvents);

    return {
      summary: this.getMetrics(),
      timeline,
      endpoints,
      patterns,
    };
  }

  private generateTimeline(
    events: typeof this.events
  ): Array<{ hour: string; requests: number; blocked: number }> {
    const hourlyStats: Record<string, { requests: number; blocked: number }> = {};

    events.forEach((event) => {
      const hour = event.timestamp.getHours().toString().padStart(2, '0');
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { requests: 0, blocked: 0 };
      }
      hourlyStats[hour].requests++;
      if (event.type === 'blocked') {
        hourlyStats[hour].blocked++;
      }
    });

    return Object.entries(hourlyStats)
      .map(([hour, stats]) => ({ hour, ...stats }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  private generateEndpointStats(
    events: typeof this.events
  ): Array<{ endpoint: string; requests: number; blockRate: number }> {
    const endpointStats: Record<string, { requests: number; blocked: number }> = {};

    events.forEach((event) => {
      if (!endpointStats[event.endpoint]) {
        endpointStats[event.endpoint] = { requests: 0, blocked: 0 };
      }
      endpointStats[event.endpoint].requests++;
      if (event.type === 'blocked') {
        endpointStats[event.endpoint].blocked++;
      }
    });

    return Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.requests,
        blockRate: stats.requests > 0 ? stats.blocked / stats.requests : 0,
      }))
      .sort((a, b) => b.requests - a.requests);
  }

  private detectPatterns(events: typeof this.events): {
    burstDetected: boolean;
    suspiciousIPs: string[];
    anomalies: string[];
  } {
    const patterns = {
      burstDetected: false,
      suspiciousIPs: [] as string[],
      anomalies: [] as string[],
    };

    // Detect burst patterns (many requests in short time)
    const recentEvents = events.filter((e) => Date.now() - e.timestamp.getTime() < 60000); // Last minute
    if (recentEvents.length > 100) {
      patterns.burstDetected = true;
      patterns.anomalies.push('HIGH_REQUEST_BURST');
    }

    // Detect suspicious IPs (high block rate)
    const ipStats: Record<string, { requests: number; blocked: number }> = {};
    events.forEach((event) => {
      if (event.details.ip) {
        if (!ipStats[event.details.ip]) {
          ipStats[event.details.ip] = { requests: 0, blocked: 0 };
        }
        ipStats[event.details.ip].requests++;
        if (event.type === 'blocked') {
          ipStats[event.details.ip].blocked++;
        }
      }
    });

    patterns.suspiciousIPs = Object.entries(ipStats)
      .filter(([ip, stats]) => stats.requests > 10 && stats.blocked / stats.requests > 0.5)
      .map(([ip]) => ip)
      .slice(0, 10);

    return patterns;
  }
}

// =====================================================
// 9.11.6 RATE LIMIT BYPASS DETECTION
// =====================================================

export class BypassDetector {
  private suspiciousPatterns: Array<{
    name: string;
    detect: (req: Request) => boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;

  constructor() {
    this.suspiciousPatterns = [
      {
        name: 'HEADER_SPOOFING',
        detect: (req) => this.detectHeaderSpoofing(req),
        severity: 'high',
      },
      {
        name: 'IP_ROTATION',
        detect: (req) => this.detectIPRotation(req),
        severity: 'medium',
      },
      {
        name: 'USER_AGENT_ROTATION',
        detect: (req) => this.detectUserAgentRotation(req),
        severity: 'medium',
      },
      {
        name: 'DISTRIBUTED_ATTACK',
        detect: (req) => this.detectDistributedAttack(req),
        severity: 'critical',
      },
      {
        name: 'BOT_SIGNATURE',
        detect: (req) => this.detectBotSignature(req),
        severity: 'low',
      },
    ];
  }

  detectBypassAttempts(req: Request): {
    detected: boolean;
    patterns: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  } {
    const detectedPatterns: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let totalConfidence = 0;

    for (const pattern of this.suspiciousPatterns) {
      if (pattern.detect(req)) {
        detectedPatterns.push(pattern.name);

        // Update maximum severity
        const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
        if (severityLevels[pattern.severity] > severityLevels[maxSeverity]) {
          maxSeverity = pattern.severity;
        }

        totalConfidence += this.getPatternConfidence(pattern.name);
      }
    }

    const confidence = Math.min(totalConfidence / detectedPatterns.length || 0, 1.0);

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      severity: maxSeverity,
      confidence,
    };
  }

  private detectHeaderSpoofing(req: Request): boolean {
    // Check for suspicious header combinations
    const xForwardedFor = req.headers['x-forwarded-for'];
    const xRealIP = req.headers['x-real-ip'];
    const xClientIP = req.headers['x-client-ip'];

    // Multiple conflicting IP headers
    if (xForwardedFor && xRealIP && xClientIP) {
      const ips = [
        xForwardedFor.toString().split(',')[0].trim(),
        xRealIP.toString(),
        xClientIP.toString(),
      ];

      // If all IPs are different, it's suspicious
      return new Set(ips).size === ips.length;
    }

    return false;
  }

  private detectIPRotation(req: Request): boolean {
    // This would require storing previous IPs for comparison
    // Simplified implementation
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Check if IP changes frequently for the same user agent
    // (This would require a more sophisticated tracking system)
    return false; // Placeholder
  }

  private detectUserAgentRotation(req: Request): boolean {
    const userAgent = req.get('User-Agent') || '';

    // Check for suspicious user agent patterns
    const suspiciousPatterns = [
      /^Mozilla\/5\.0 \(compatible; [^)]+\)$/, // Generic bot pattern
      /curl|wget|python|java|go-http-client/i,
      /bot|crawler|spider|scraper/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  private detectDistributedAttack(req: Request): boolean {
    // This would require analyzing patterns across multiple requests
    // Simplified implementation checking for common distributed attack indicators
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';

    // Very generic headers that suggest automated requests
    return userAgent.length < 20 || !acceptLanguage || userAgent === 'Mozilla/5.0';
  }

  private detectBotSignature(req: Request): boolean {
    const userAgent = req.get('User-Agent') || '';
    const headers = req.headers;

    // Check for common bot signatures
    const botIndicators = [
      !headers.accept || headers.accept === '*/*',
      !headers['accept-language'],
      !headers['accept-encoding'],
      userAgent.includes('bot'),
      userAgent.includes('crawler'),
      userAgent.includes('spider'),
    ];

    return botIndicators.filter(Boolean).length >= 2;
  }

  private getPatternConfidence(patternName: string): number {
    const confidenceMap: Record<string, number> = {
      HEADER_SPOOFING: 0.9,
      IP_ROTATION: 0.7,
      USER_AGENT_ROTATION: 0.6,
      DISTRIBUTED_ATTACK: 0.8,
      BOT_SIGNATURE: 0.5,
    };

    return confidenceMap[patternName] || 0.5;
  }
}

// =====================================================
// MAIN RATE LIMITING MIDDLEWARE
// =====================================================

export function createAdvancedRateLimitMiddleware(options: {
  basic?: RateLimitConfig;
  adaptive?: AdaptiveRateLimitConfig;
  userIP?: {
    ip: RateLimitConfig;
    user: RateLimitConfig;
    combined: RateLimitConfig;
  };
  enableMonitoring?: boolean;
  enableBypassDetection?: boolean;
}) {
  const architecture = RateLimitArchitecture.getInstance();

  // Initialize components
  const monitor = options.enableMonitoring ? new RateLimitMonitor() : null;
  const bypassDetector = options.enableBypassDetection ? new BypassDetector() : null;

  let rateLimiter: RequestRateLimiter | AdaptiveRateLimiter | UserIPRateLimiter;

  if (options.adaptive) {
    rateLimiter = new AdaptiveRateLimiter(options.adaptive);
  } else if (options.userIP) {
    rateLimiter = new UserIPRateLimiter(
      options.userIP.ip,
      options.userIP.user,
      options.userIP.combined
    );
  } else if (options.basic) {
    rateLimiter = new RequestRateLimiter(options.basic);
  } else {
    throw new Error('No rate limiting configuration provided');
  }

  // Register components with architecture
  if (monitor) architecture.registerMonitor('default', monitor);
  if (bypassDetector) architecture.registerDetector('default', bypassDetector);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();

      // 1. Check for bypass attempts
      let bypassResult: any = null;
      if (bypassDetector) {
        bypassResult = bypassDetector.detectBypassAttempts(req);
        if (bypassResult.detected && bypassResult.severity === 'critical') {
          if (monitor) {
            monitor.recordEvent('bypass_attempt', req.ip || 'unknown', req.originalUrl, {
              patterns: bypassResult.patterns,
              severity: bypassResult.severity,
              confidence: bypassResult.confidence,
            });
          }

          res.status(429).json({
            success: false,
            error: 'Suspicious activity detected',
            code: 'BYPASS_ATTEMPT_DETECTED',
            retryAfter: 3600, // 1 hour penalty
          });
          return;
        }
      }

      // 2. Apply rate limiting
      let limitResult: any;
      if (rateLimiter instanceof UserIPRateLimiter) {
        limitResult = await rateLimiter.checkLimits(req);
      } else {
        limitResult = await rateLimiter.checkLimit(req);
        limitResult = { allowed: limitResult.allowed, ...limitResult };
      }

      // 3. Handle rate limit exceeded
      if (!limitResult.allowed) {
        if (monitor) {
          monitor.recordEvent('blocked', req.ip || 'unknown', req.originalUrl, {
            limitingFactor: limitResult.limitingFactor || 'general',
            remainingRequests: limitResult.remainingRequests || 0,
            retryAfter: limitResult.retryAfter,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': limitResult.totalRequests?.toString() || '0',
          'X-RateLimit-Remaining': limitResult.remainingRequests?.toString() || '0',
          'X-RateLimit-Reset': limitResult.resetTime?.toString() || '0',
          'Retry-After': limitResult.retryAfter?.toString() || '60',
        });

        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: limitResult.retryAfter,
          limitingFactor: limitResult.limitingFactor,
        });
        return;
      }

      // 4. Request allowed - record success
      if (monitor) {
        monitor.recordEvent('allowed', req.ip || 'unknown', req.originalUrl, {
          remainingRequests: limitResult.remainingRequests || 0,
          processingTime: Date.now() - startTime,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          bypassPatternsDetected: bypassResult?.patterns || [],
        });
      }

      // 5. Set informational headers
      res.set({
        'X-RateLimit-Limit': limitResult.totalRequests?.toString() || '0',
        'X-RateLimit-Remaining': limitResult.remainingRequests?.toString() || '0',
        'X-RateLimit-Reset': limitResult.resetTime?.toString() || '0',
      });

      next();
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // Fail open - allow request on error
      next();
    }
  };
}

// =====================================================
// 9.11.8 RATE LIMITING EFFECTIVENESS TESTING
// =====================================================

export const RateLimitTestSuite = {
  async testBasicRateLimit(
    limiter: RequestRateLimiter,
    maxRequests: number
  ): Promise<{
    passed: boolean;
    results: Array<{ request: number; allowed: boolean; remaining: number }>;
  }> {
    const mockReq = {
      ip: '127.0.0.1',
      get: (header: string) => (header === 'User-Agent' ? 'test-agent' : undefined),
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
    } as any;

    const results: Array<{ request: number; allowed: boolean; remaining: number }> = [];
    let passed = true;

    for (let i = 1; i <= maxRequests + 2; i++) {
      const result = await limiter.checkLimit(mockReq);
      results.push({
        request: i,
        allowed: result.allowed,
        remaining: result.remainingRequests,
      });

      // Check if blocking starts at the right point
      if (i <= maxRequests && !result.allowed) {
        passed = false;
      }
      if (i > maxRequests && result.allowed) {
        passed = false;
      }
    }

    return { passed, results };
  },

  async testBypassDetection(detector: BypassDetector): Promise<{
    passed: boolean;
    results: Array<{ test: string; detected: boolean; patterns: string[] }>;
  }> {
    const testCases = [
      {
        name: 'normal_request',
        req: {
          ip: '127.0.0.1',
          get: (h: string) =>
            h === 'User-Agent'
              ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              : undefined,
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'en-US,en;q=0.9',
          },
        },
        shouldDetect: false,
      },
      {
        name: 'bot_request',
        req: {
          ip: '127.0.0.1',
          get: (h: string) => (h === 'User-Agent' ? 'python-requests/2.25.1' : undefined),
          headers: { accept: '*/*' },
        },
        shouldDetect: true,
      },
      {
        name: 'header_spoofing',
        req: {
          ip: '127.0.0.1',
          get: (h: string) => (h === 'User-Agent' ? 'Mozilla/5.0' : undefined),
          headers: {
            'x-forwarded-for': '192.168.1.1',
            'x-real-ip': '10.0.0.1',
            'x-client-ip': '172.16.0.1',
          },
        },
        shouldDetect: true,
      },
    ];

    const results: Array<{ test: string; detected: boolean; patterns: string[] }> = [];
    let passed = true;

    for (const testCase of testCases) {
      const result = detector.detectBypassAttempts(testCase.req as any);
      results.push({
        test: testCase.name,
        detected: result.detected,
        patterns: result.patterns,
      });

      if (result.detected !== testCase.shouldDetect) {
        passed = false;
      }
    }

    return { passed, results };
  },

  async testAdaptiveRateLimit(limiter: AdaptiveRateLimiter): Promise<{
    passed: boolean;
    initialLimit: number;
    finalLimit: number;
    adaptations: number;
  }> {
    const initialLimit = limiter.getCurrentLimit();

    // Simulate high error rate to trigger adaptation
    const mockReq = {
      ip: '127.0.0.1',
      get: (header: string) => (header === 'User-Agent' ? 'test-agent' : undefined),
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
    } as any;

    // Make requests that should trigger adaptation
    for (let i = 0; i < 10; i++) {
      await limiter.checkLimit(mockReq);
    }

    // Wait for adaptation cycle
    await new Promise((resolve) => setTimeout(resolve, 100));

    const finalLimit = limiter.getCurrentLimit();
    const adaptations = initialLimit !== finalLimit ? 1 : 0;

    return {
      passed: adaptations > 0, // Adaptation should occur
      initialLimit,
      finalLimit,
      adaptations,
    };
  },

  async runAllTests(): Promise<{
    basicRateLimit: { passed: boolean; results: any[] };
    bypassDetection: { passed: boolean; results: any[] };
    adaptiveRateLimit: {
      passed: boolean;
      initialLimit: number;
      finalLimit: number;
      adaptations: number;
    };
  }> {
    // Create test instances
    const basicLimiter = new RequestRateLimiter({
      windowMs: 60000,
      maxRequests: 5,
    });

    const adaptiveLimiter = new AdaptiveRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      baseLimit: 10,
      maxLimit: 100,
      adaptationFactor: 0.2,
      monitoringWindowMs: 10000,
      triggerThresholds: {
        errorRate: 0.1,
        responseTime: 1000,
        concurrency: 50,
      },
    });

    const bypassDetector = new BypassDetector();

    // Run all tests
    const [basicResult, bypassResult, adaptiveResult] = await Promise.all([
      this.testBasicRateLimit(basicLimiter, 5),
      this.testBypassDetection(bypassDetector),
      this.testAdaptiveRateLimit(adaptiveLimiter),
    ]);

    return {
      basicRateLimit: basicResult,
      bypassDetection: bypassResult,
      adaptiveRateLimit: adaptiveResult,
    };
  },
};

// =====================================================
// EXPORTS
// =====================================================

export {
  AdaptiveRateLimiter,
  BypassDetector,
  MemoryRateLimitStore,
  RateLimitArchitecture,
  RateLimitMonitor,
  RequestRateLimiter,
  UserIPRateLimiter,
};
