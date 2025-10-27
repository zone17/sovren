/**
 * 🛡️ **COMPREHENSIVE SECURITY HEADERS SYSTEM**
 *
 * US-134: Security Headers Implementation
 *
 * Elite Security Features:
 * - Security Header Strategy Design (9.12.1)
 * - CSP (Content Security Policy) Implementation (9.12.2)
 * - HSTS Configuration (9.12.3)
 * - X-Frame-Options Protection (9.12.4)
 * - Security Header Monitoring (9.12.5)
 * - Header Compliance Testing (9.12.6)
 * - Header Configuration Management (9.12.7)
 * - Security Header Effectiveness Testing (9.12.8)
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { NextFunction, Request, Response } from 'express';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface SecurityHeadersConfig {
  contentSecurityPolicy: {
    directives: Record<string, string[]>;
    reportOnly?: boolean;
    reportUri?: string;
  };
  strictTransportSecurity: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  frameOptions: 'DENY' | 'SAMEORIGIN' | string;
  contentTypeOptions: boolean;
  xssProtection: {
    enabled: boolean;
    mode: 'block' | 'report';
    reportUri?: string;
  };
  referrerPolicy: string;
  permissionsPolicy: Record<string, string[]>;
  crossOriginPolicies: {
    embedderPolicy?: string;
    openerPolicy?: string;
    resourcePolicy?: string;
  };
  customHeaders: Record<string, string>;
}

export interface SecurityHeaderResult {
  headerName: string;
  headerValue: string;
  applied: boolean;
  reason?: string;
}

export interface ComplianceReport {
  totalHeaders: number;
  appliedHeaders: number;
  compliance: number;
  missing: string[];
  recommendations: string[];
  securityScore: number;
}

export interface SecurityMetrics {
  headersApplied: number;
  cspViolations: number;
  frameBlockAttempts: number;
  xssAttempts: number;
  complianceScore: number;
  lastUpdated: number;
}

// =====================================================
// 9.12.1 SECURITY HEADER STRATEGY DESIGN
// =====================================================

export class SecurityHeaderStrategy {
  private static instance: SecurityHeaderStrategy;
  private config: SecurityHeadersConfig;
  private metrics: SecurityMetrics;
  private reportingEnabled: boolean;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.metrics = this.initializeMetrics();
    this.reportingEnabled = process.env.NODE_ENV === 'production';
  }

  static getInstance(): SecurityHeaderStrategy {
    if (!SecurityHeaderStrategy.instance) {
      SecurityHeaderStrategy.instance = new SecurityHeaderStrategy();
    }
    return SecurityHeaderStrategy.instance;
  }

  private getDefaultConfig(): SecurityHeadersConfig {
    return {
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'", 'https://trusted-cdn.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'img-src': ["'self'", 'data:', 'https:'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'connect-src': ["'self'", 'https://api.sovren.dev', 'wss:', 'https:'],
          'media-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': [],
          'block-all-mixed-content': [],
        },
        reportOnly: false,
        reportUri: '/api/security/csp-report',
      },
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameOptions: 'DENY',
      contentTypeOptions: true,
      xssProtection: {
        enabled: true,
        mode: 'block',
        reportUri: '/api/security/xss-report',
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: ["'self'"],
        usb: [],
        midi: [],
        'sync-xhr': [],
        'clipboard-read': [],
        'clipboard-write': [],
        gyroscope: [],
        magnetometer: [],
        'picture-in-picture': [],
      },
      crossOriginPolicies: {
        embedderPolicy: 'require-corp',
        openerPolicy: 'same-origin',
        resourcePolicy: 'same-origin',
      },
      customHeaders: {},
    };
  }

  private initializeMetrics(): SecurityMetrics {
    return {
      headersApplied: 0,
      cspViolations: 0,
      frameBlockAttempts: 0,
      xssAttempts: 0,
      complianceScore: 0,
      lastUpdated: Date.now(),
    };
  }

  public updateConfig(newConfig: Partial<SecurityHeadersConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SecurityHeadersConfig {
    return { ...this.config };
  }

  public getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  public updateMetrics(key: keyof SecurityMetrics, value: number): void {
    this.metrics[key] = value;
    this.metrics.lastUpdated = Date.now();
  }

  public incrementMetric(key: keyof SecurityMetrics): void {
    if (typeof this.metrics[key] === 'number') {
      (this.metrics[key] as number)++;
    }
    this.metrics.lastUpdated = Date.now();
  }
}

// =====================================================
// 9.12.2 CSP (CONTENT SECURITY POLICY) IMPLEMENTATION
// =====================================================

export class ContentSecurityPolicyManager {
  private strategy: SecurityHeaderStrategy;
  private nonces: Map<string, { nonce: string; expires: number }>;

  constructor() {
    this.strategy = SecurityHeaderStrategy.getInstance();
    this.nonces = new Map();
  }

  generateNonce(req: Request): string {
    const nonce = Buffer.from(require('crypto').randomBytes(16)).toString('base64');
    const expires = Date.now() + 3600000; // 1 hour

    // Store nonce with request identifier
    const requestId = req.headers['x-request-id'] as string || 'default';
    this.nonces.set(requestId, { nonce, expires });

    // Cleanup expired nonces
    this.cleanupExpiredNonces();

    return nonce;
  }

  private cleanupExpiredNonces(): void {
    const now = Date.now();
    for (const [key, value] of this.nonces.entries()) {
      if (now > value.expires) {
        this.nonces.delete(key);
      }
    }
  }

  buildCSPHeader(req: Request, includeNonce = false): string {
    const config = this.strategy.getConfig();
    const cspConfig = config.contentSecurityPolicy;
    const directives: string[] = [];

    for (const [directive, sources] of Object.entries(cspConfig.directives)) {
      if (sources.length === 0) {
        directives.push(directive);
      } else {
        let sourceList = sources.join(' ');

        // Add nonce for script-src and style-src if requested
        if (includeNonce && (directive === 'script-src' || directive === 'style-src')) {
          const nonce = this.generateNonce(req);
          sourceList += ` 'nonce-${nonce}'`;
        }

        directives.push(`${directive} ${sourceList}`);
      }
    }

    const cspHeader = directives.join('; ');

    // Log CSP header for monitoring
    this.logCSPUsage(req, cspHeader);

    return cspHeader;
  }

  private logCSPUsage(req: Request, cspHeader: string): void {
    console.log('CSP Header Applied:', {
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      csp: cspHeader.substring(0, 200) + '...',
      timestamp: new Date().toISOString(),
    });
  }

  validateCSPCompliance(req: Request, res: Response): boolean {
    const config = this.strategy.getConfig();
    const requiredDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'connect-src',
      'font-src',
      'object-src',
      'frame-src',
    ];

    const cspDirectives = config.contentSecurityPolicy.directives;
    const missing = requiredDirectives.filter(directive => !cspDirectives[directive]);

    if (missing.length > 0) {
      console.warn('CSP Compliance Warning:', {
        missing,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    return true;
  }
}

// =====================================================
// 9.12.3 HSTS CONFIGURATION
// =====================================================

export class HSTSManager {
  private strategy: SecurityHeaderStrategy;

  constructor() {
    this.strategy = SecurityHeaderStrategy.getInstance();
  }

  buildHSTSHeader(): string {
    const config = this.strategy.getConfig();
    const hstsConfig = config.strictTransportSecurity;

    let hstsValue = `max-age=${hstsConfig.maxAge}`;

    if (hstsConfig.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }

    if (hstsConfig.preload) {
      hstsValue += '; preload';
    }

    return hstsValue;
  }

  validateHSTSCompliance(): boolean {
    const config = this.strategy.getConfig();
    const hstsConfig = config.strictTransportSecurity;

    // Check for minimum security requirements
    const minMaxAge = 31536000; // 1 year minimum recommended

    if (hstsConfig.maxAge < minMaxAge) {
      console.warn('HSTS Compliance Warning: max-age should be at least 1 year');
      return false;
    }

    if (!hstsConfig.includeSubDomains) {
      console.warn('HSTS Compliance Warning: includeSubDomains recommended for better security');
    }

    return true;
  }

  isHSTSRequired(req: Request): boolean {
    // HSTS only applies to HTTPS connections
    return req.secure || req.headers['x-forwarded-proto'] === 'https';
  }
}

// =====================================================
// 9.12.4 X-FRAME-OPTIONS PROTECTION
// =====================================================

export class FrameOptionsManager {
  private strategy: SecurityHeaderStrategy;
  private frameBlockAttempts: number = 0;

  constructor() {
    this.strategy = SecurityHeaderStrategy.getInstance();
  }

  buildFrameOptionsHeader(): string {
    const config = this.strategy.getConfig();
    return config.frameOptions;
  }

  logFrameBlockAttempt(req: Request): void {
    this.frameBlockAttempts++;
    this.strategy.incrementMetric('frameBlockAttempts');

    console.warn('Frame Embedding Attempt Blocked:', {
      url: req.originalUrl,
      referer: req.get('Referer'),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  }

  getFrameBlockAttempts(): number {
    return this.frameBlockAttempts;
  }
}

// =====================================================
// 9.12.5 SECURITY HEADER MONITORING
// =====================================================

export class SecurityHeaderMonitor {
  private events: Array<{
    timestamp: Date;
    type: string;
    details: any;
  }> = [];
  private maxEvents = 10000;

  logHeaderApplication(req: Request, headerName: string, headerValue: string): void {
    this.addEvent('header_applied', {
      headerName,
      headerValue: headerValue.substring(0, 100),
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  }

  logViolation(req: Request, violationType: string, details: any): void {
    this.addEvent('security_violation', {
      violationType,
      details,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  }

  logComplianceCheck(req: Request, compliance: ComplianceReport): void {
    this.addEvent('compliance_check', {
      compliance,
      url: req.originalUrl,
    });
  }

  private addEvent(type: string, details: any): void {
    this.events.push({
      timestamp: new Date(),
      type,
      details,
    });

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  getRecentEvents(limit = 100): typeof this.events {
    return this.events.slice(-limit);
  }

  generateSecurityReport(): {
    summary: {
      totalEvents: number;
      headerApplications: number;
      violations: number;
      complianceChecks: number;
    };
    violationsByType: Record<string, number>;
    topUrls: Array<{ url: string; count: number }>;
    recommendations: string[];
  } {
    const headerApplications = this.events.filter(e => e.type === 'header_applied').length;
    const violations = this.events.filter(e => e.type === 'security_violation').length;
    const complianceChecks = this.events.filter(e => e.type === 'compliance_check').length;

    const violationsByType: Record<string, number> = {};
    const urlCounts: Record<string, number> = {};

    this.events.forEach(event => {
      if (event.type === 'security_violation') {
        const violationType = event.details.violationType;
        violationsByType[violationType] = (violationsByType[violationType] || 0) + 1;
      }

      const url = event.details.url;
      if (url) {
        urlCounts[url] = (urlCounts[url] || 0) + 1;
      }
    });

    const topUrls = Object.entries(urlCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    const recommendations = this.generateRecommendations(violationsByType);

    return {
      summary: {
        totalEvents: this.events.length,
        headerApplications,
        violations,
        complianceChecks,
      },
      violationsByType,
      topUrls,
      recommendations,
    };
  }

  private generateRecommendations(violationsByType: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (violationsByType['csp_violation'] > 10) {
      recommendations.push('Consider reviewing and tightening Content Security Policy');
    }

    if (violationsByType['frame_block'] > 5) {
      recommendations.push('High number of frame embedding attempts detected - monitor for clickjacking');
    }

    if (violationsByType['xss_attempt'] > 0) {
      recommendations.push('XSS attempts detected - ensure all user input is properly sanitized');
    }

    return recommendations;
  }
}

// =====================================================
// 9.12.6 HEADER COMPLIANCE TESTING
// =====================================================

export class HeaderComplianceTester {
  private strategy: SecurityHeaderStrategy;
  private cspManager: ContentSecurityPolicyManager;
  private hstsManager: HSTSManager;
  private frameManager: FrameOptionsManager;

  constructor() {
    this.strategy = SecurityHeaderStrategy.getInstance();
    this.cspManager = new ContentSecurityPolicyManager();
    this.hstsManager = new HSTSManager();
    this.frameManager = new FrameOptionsManager();
  }

  async runComplianceTest(req: Request, res: Response): Promise<ComplianceReport> {
    const results: SecurityHeaderResult[] = [];
    const recommendations: string[] = [];

    // Test CSP compliance
    const cspCompliant = this.cspManager.validateCSPCompliance(req, res);
    results.push({
      headerName: 'Content-Security-Policy',
      headerValue: this.cspManager.buildCSPHeader(req),
      applied: cspCompliant,
      reason: cspCompliant ? undefined : 'Missing required directives',
    });

    // Test HSTS compliance
    const hstsCompliant = this.hstsManager.validateHSTSCompliance();
    const hstsRequired = this.hstsManager.isHSTSRequired(req);
    results.push({
      headerName: 'Strict-Transport-Security',
      headerValue: this.hstsManager.buildHSTSHeader(),
      applied: hstsCompliant && hstsRequired,
      reason: !hstsRequired ? 'HTTPS connection required' : !hstsCompliant ? 'Configuration issues' : undefined,
    });

    // Test other security headers
    const securityHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
      'Permissions-Policy',
    ];

    securityHeaders.forEach(headerName => {
      const headerValue = res.getHeader(headerName) as string;
      results.push({
        headerName,
        headerValue: headerValue || '',
        applied: !!headerValue,
        reason: headerValue ? undefined : 'Header not applied',
      });
    });

    const appliedHeaders = results.filter(r => r.applied).length;
    const totalHeaders = results.length;
    const compliance = (appliedHeaders / totalHeaders) * 100;

    const missing = results
      .filter(r => !r.applied)
      .map(r => r.headerName);

    if (compliance < 80) {
      recommendations.push('Critical: Security header compliance is below 80%');
    }

    if (missing.includes('Content-Security-Policy')) {
      recommendations.push('Implement Content Security Policy to prevent XSS attacks');
    }

    if (missing.includes('Strict-Transport-Security')) {
      recommendations.push('Enable HSTS to prevent man-in-the-middle attacks');
    }

    const securityScore = this.calculateSecurityScore(results);

    return {
      totalHeaders,
      appliedHeaders,
      compliance,
      missing,
      recommendations,
      securityScore,
    };
  }

  private calculateSecurityScore(results: SecurityHeaderResult[]): number {
    const weights = {
      'Content-Security-Policy': 30,
      'Strict-Transport-Security': 25,
      'X-Frame-Options': 20,
      'X-Content-Type-Options': 10,
      'X-XSS-Protection': 10,
      'Referrer-Policy': 3,
      'Permissions-Policy': 2,
    };

    let score = 0;
    let maxScore = 0;

    results.forEach(result => {
      const weight = weights[result.headerName as keyof typeof weights] || 1;
      maxScore += weight;
      if (result.applied) {
        score += weight;
      }
    });

    return Math.round((score / maxScore) * 100);
  }
}

// =====================================================
// 9.12.7 HEADER CONFIGURATION MANAGEMENT
// =====================================================

export class HeaderConfigurationManager {
  private strategy: SecurityHeaderStrategy;
  private configurations: Map<string, SecurityHeadersConfig>;

  constructor() {
    this.strategy = SecurityHeaderStrategy.getInstance();
    this.configurations = new Map();
    this.loadEnvironmentConfigurations();
  }

  private loadEnvironmentConfigurations(): void {
    // Development configuration
    const developmentConfig: Partial<SecurityHeadersConfig> = {
      contentSecurityPolicy: {
        directives: {
          ...this.strategy.getConfig().contentSecurityPolicy.directives,
          'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'"],
        },
        reportOnly: true,
      },
      strictTransportSecurity: {
        maxAge: 0,
        includeSubDomains: false,
        preload: false,
      },
    };

    // Production configuration
    const productionConfig: Partial<SecurityHeadersConfig> = {
      contentSecurityPolicy: {
        directives: {
          ...this.strategy.getConfig().contentSecurityPolicy.directives,
          'script-src': ["'self'"],
          'style-src': ["'self'"],
        },
        reportOnly: false,
      },
      strictTransportSecurity: {
        maxAge: 63072000, // 2 years
        includeSubDomains: true,
        preload: true,
      },
    };

    this.configurations.set('development', { ...this.strategy.getConfig(), ...developmentConfig });
    this.configurations.set('production', { ...this.strategy.getConfig(), ...productionConfig });
  }

  loadConfiguration(environment: string): void {
    const config = this.configurations.get(environment);
    if (config) {
      this.strategy.updateConfig(config);
      console.log(`Security headers configuration loaded for environment: ${environment}`);
    } else {
      console.warn(`No configuration found for environment: ${environment}`);
    }
  }

  saveConfiguration(environment: string, config: SecurityHeadersConfig): void {
    this.configurations.set(environment, config);
    console.log(`Security headers configuration saved for environment: ${environment}`);
  }

  validateConfiguration(config: SecurityHeadersConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate CSP directives
    if (!config.contentSecurityPolicy.directives['default-src']) {
      errors.push('CSP default-src directive is required');
    }

    // Validate HSTS configuration
    if (config.strictTransportSecurity.maxAge < 300) {
      errors.push('HSTS max-age should be at least 300 seconds');
    }

    // Validate frame options
    const validFrameOptions = ['DENY', 'SAMEORIGIN'];
    if (!validFrameOptions.includes(config.frameOptions) && !config.frameOptions.startsWith('ALLOW-FROM')) {
      errors.push('Invalid frame options value');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// =====================================================
// 9.12.8 SECURITY HEADER EFFECTIVENESS TESTING
// =====================================================

export class SecurityHeaderEffectivenessTester {
  private strategy: SecurityHeaderStrategy;
  private monitor: SecurityHeaderMonitor;

  constructor() {
    this.strategy = SecurityHeaderStrategy.getInstance();
    this.monitor = new SecurityHeaderMonitor();
  }

  async runEffectivenessTests(): Promise<{
    cspTest: { passed: boolean; details: any };
    hstsTest: { passed: boolean; details: any };
    frameOptionsTest: { passed: boolean; details: any };
    xssProtectionTest: { passed: boolean; details: any };
    overallScore: number;
  }> {
    console.log('Running security header effectiveness tests...');

    const cspTest = await this.testCSPEffectiveness();
    const hstsTest = await this.testHSTSEffectiveness();
    const frameOptionsTest = await this.testFrameOptionsEffectiveness();
    const xssProtectionTest = await this.testXSSProtectionEffectiveness();

    const passedTests = [cspTest, hstsTest, frameOptionsTest, xssProtectionTest].filter(
      test => test.passed
    ).length;

    const overallScore = (passedTests / 4) * 100;

    return {
      cspTest,
      hstsTest,
      frameOptionsTest,
      xssProtectionTest,
      overallScore,
    };
  }

  private async testCSPEffectiveness(): Promise<{ passed: boolean; details: any }> {
    const cspManager = new ContentSecurityPolicyManager();
    const mockReq = { originalUrl: '/test', headers: {} } as Request;

    try {
      const cspHeader = cspManager.buildCSPHeader(mockReq);
      const hasRequiredDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
      ].every(directive => cspHeader.includes(directive));

      return {
        passed: hasRequiredDirectives,
        details: {
          cspHeader,
          hasRequiredDirectives,
          directiveCount: cspHeader.split(';').length,
        },
      };
    } catch (error) {
      return {
        passed: false,
        details: { error: error.message },
      };
    }
  }

  private async testHSTSEffectiveness(): Promise<{ passed: boolean; details: any }> {
    const hstsManager = new HSTSManager();

    try {
      const hstsHeader = hstsManager.buildHSTSHeader();
      const isCompliant = hstsManager.validateHSTSCompliance();
      const hasMinAge = hstsHeader.includes('max-age=');
      const hasSubDomains = hstsHeader.includes('includeSubDomains');

      return {
        passed: isCompliant && hasMinAge,
        details: {
          hstsHeader,
          isCompliant,
          hasMinAge,
          hasSubDomains,
        },
      };
    } catch (error) {
      return {
        passed: false,
        details: { error: error.message },
      };
    }
  }

  private async testFrameOptionsEffectiveness(): Promise<{ passed: boolean; details: any }> {
    const frameManager = new FrameOptionsManager();

    try {
      const frameHeader = frameManager.buildFrameOptionsHeader();
      const validOptions = ['DENY', 'SAMEORIGIN'];
      const isValid = validOptions.includes(frameHeader) || frameHeader.startsWith('ALLOW-FROM');

      return {
        passed: isValid,
        details: {
          frameHeader,
          isValid,
          blockAttempts: frameManager.getFrameBlockAttempts(),
        },
      };
    } catch (error) {
      return {
        passed: false,
        details: { error: error.message },
      };
    }
  }

  private async testXSSProtectionEffectiveness(): Promise<{ passed: boolean; details: any }> {
    const config = this.strategy.getConfig();

    try {
      const xssConfig = config.xssProtection;
      const isEnabled = xssConfig.enabled;
      const hasBlockMode = xssConfig.mode === 'block';

      return {
        passed: isEnabled && hasBlockMode,
        details: {
          enabled: isEnabled,
          mode: xssConfig.mode,
          hasBlockMode,
        },
      };
    } catch (error) {
      return {
        passed: false,
        details: { error: error.message },
      };
    }
  }
}

// =====================================================
// MAIN SECURITY HEADERS MIDDLEWARE
// =====================================================

export function createSecurityHeadersMiddleware(options: Partial<SecurityHeadersConfig> = {}) {
  const strategy = SecurityHeaderStrategy.getInstance();
  const cspManager = new ContentSecurityPolicyManager();
  const hstsManager = new HSTSManager();
  const frameManager = new FrameOptionsManager();
  const monitor = new SecurityHeaderMonitor();
  const complianceTester = new HeaderComplianceTester();

  // Update configuration if provided
  if (Object.keys(options).length > 0) {
    strategy.updateConfig(options);
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = strategy.getConfig();

      // Apply Content Security Policy
      const cspHeader = cspManager.buildCSPHeader(req, true);
      const cspHeaderName = config.contentSecurityPolicy.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      res.setHeader(cspHeaderName, cspHeader);
      monitor.logHeaderApplication(req, cspHeaderName, cspHeader);

      // Apply HSTS (only for HTTPS)
      if (hstsManager.isHSTSRequired(req)) {
        const hstsHeader = hstsManager.buildHSTSHeader();
        res.setHeader('Strict-Transport-Security', hstsHeader);
        monitor.logHeaderApplication(req, 'Strict-Transport-Security', hstsHeader);
      }

      // Apply Frame Options
      const frameOptionsHeader = frameManager.buildFrameOptionsHeader();
      res.setHeader('X-Frame-Options', frameOptionsHeader);
      monitor.logHeaderApplication(req, 'X-Frame-Options', frameOptionsHeader);

      // Apply X-Content-Type-Options
      if (config.contentTypeOptions) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        monitor.logHeaderApplication(req, 'X-Content-Type-Options', 'nosniff');
      }

      // Apply XSS Protection
      if (config.xssProtection.enabled) {
        const xssValue = config.xssProtection.mode === 'report'
          ? `1; report=${config.xssProtection.reportUri}`
          : '1; mode=block';
        res.setHeader('X-XSS-Protection', xssValue);
        monitor.logHeaderApplication(req, 'X-XSS-Protection', xssValue);
      }

      // Apply Referrer Policy
      res.setHeader('Referrer-Policy', config.referrerPolicy);
      monitor.logHeaderApplication(req, 'Referrer-Policy', config.referrerPolicy);

      // Apply Permissions Policy
      const permissionsPolicy = Object.entries(config.permissionsPolicy)
        .map(([directive, allowlist]) => {
          if (allowlist.length === 0) {
            return `${directive}=()`;
          }
          return `${directive}=(${allowlist.join(' ')})`;
        })
        .join(', ');
      res.setHeader('Permissions-Policy', permissionsPolicy);
      monitor.logHeaderApplication(req, 'Permissions-Policy', permissionsPolicy);

      // Apply Cross-Origin Policies
      if (config.crossOriginPolicies.embedderPolicy) {
        res.setHeader('Cross-Origin-Embedder-Policy', config.crossOriginPolicies.embedderPolicy);
        monitor.logHeaderApplication(req, 'Cross-Origin-Embedder-Policy', config.crossOriginPolicies.embedderPolicy);
      }

      if (config.crossOriginPolicies.openerPolicy) {
        res.setHeader('Cross-Origin-Opener-Policy', config.crossOriginPolicies.openerPolicy);
        monitor.logHeaderApplication(req, 'Cross-Origin-Opener-Policy', config.crossOriginPolicies.openerPolicy);
      }

      if (config.crossOriginPolicies.resourcePolicy) {
        res.setHeader('Cross-Origin-Resource-Policy', config.crossOriginPolicies.resourcePolicy);
        monitor.logHeaderApplication(req, 'Cross-Origin-Resource-Policy', config.crossOriginPolicies.resourcePolicy);
      }

      // Apply custom headers
      Object.entries(config.customHeaders).forEach(([name, value]) => {
        res.setHeader(name, value);
        monitor.logHeaderApplication(req, name, value);
      });

      // Update metrics
      strategy.incrementMetric('headersApplied');

      // Run compliance check (in production, run periodically)
      if (Math.random() < 0.01) { // 1% sampling
        const complianceReport = await complianceTester.runComplianceTest(req, res);
        monitor.logComplianceCheck(req, complianceReport);
        strategy.updateMetrics('complianceScore', complianceReport.securityScore);
      }

      next();
    } catch (error) {
      console.error('Security headers middleware error:', error);

      // Apply minimal security headers on error
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      next();
    }
  };
}

// =====================================================
// CSP VIOLATION REPORTING ENDPOINT
// =====================================================

export function createCSPReportingEndpoint() {
  return (req: Request, res: Response): void => {
    try {
      const violation = req.body;
      const strategy = SecurityHeaderStrategy.getInstance();

      strategy.incrementMetric('cspViolations');

      console.warn('CSP Violation Reported:', {
        ...violation,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(204).send();
    } catch (error) {
      console.error('CSP reporting error:', error);
      res.status(400).json({ error: 'Invalid CSP report' });
    }
  };
}

// =====================================================
// SECURITY HEADERS TESTING UTILITIES
// =====================================================

export class SecurityHeadersTestingUtils {
  private strategy: SecurityHeaderStrategy;
  private effectivenessTester: SecurityHeaderEffectivenessTester;

  constructor() {
    this.strategy = SecurityHeaderStrategy.getInstance();
    this.effectivenessTester = new SecurityHeaderEffectivenessTester();
  }

  async runAllTests(): Promise<{
    effectivenessTests: any;
    complianceScore: number;
    securityMetrics: SecurityMetrics;
    recommendations: string[];
  }> {
    console.log('Running comprehensive security headers tests...');

    const effectivenessTests = await this.effectivenessTester.runEffectivenessTests();
    const securityMetrics = this.strategy.getMetrics();

    const recommendations = [];

    if (effectivenessTests.overallScore < 80) {
      recommendations.push('Critical: Security header effectiveness is below 80%');
    }

    if (!effectivenessTests.cspTest.passed) {
      recommendations.push('Fix Content Security Policy configuration');
    }

    if (!effectivenessTests.hstsTest.passed) {
      recommendations.push('Improve HSTS configuration');
    }

    if (!effectivenessTests.frameOptionsTest.passed) {
      recommendations.push('Configure proper frame options');
    }

    if (!effectivenessTests.xssProtectionTest.passed) {
      recommendations.push('Enable XSS protection headers');
    }

    return {
      effectivenessTests,
      complianceScore: effectivenessTests.overallScore,
      securityMetrics,
      recommendations,
    };
  }
}

// =====================================================
// EXPORTS
// =====================================================

export {
  ContentSecurityPolicyManager,
  HeaderComplianceTester,
  HeaderConfigurationManager,
  HSTSManager,
  FrameOptionsManager,
  SecurityHeaderMonitor,
  SecurityHeaderStrategy,
  SecurityHeaderEffectivenessTester,
};
