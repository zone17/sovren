/**
 * 🛡️ **COMPREHENSIVE INPUT VALIDATION FRAMEWORK**
 *
 * US-131: Protection Against Injection Attacks Implementation
 *
 * Elite Security Features:
 * - SQL Injection Prevention (9.9.2)
 * - XSS Protection Mechanisms (9.9.3)
 * - CSRF Protection (9.9.4)
 * - Command Injection Prevention (9.9.5)
 * - Input Sanitization Pipelines (9.9.6)
 * - Validation Error Handling (9.9.7)
 * - Injection Attack Testing (9.9.8)
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import crypto from 'crypto';
import DOMPurify from 'dompurify';
import { NextFunction, Request, Response } from 'express';
import { JSDOM } from 'jsdom';
import validator from 'validator';
import { z } from 'zod';

// Initialize DOMPurify with JSDOM for server-side usage
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// =====================================================
// TYPE EXTENSIONS
// =====================================================

declare global {
  namespace Express {
    interface Request {
      validationMeta?: {
        sanitized: boolean;
        attacksDetected: string[];
        processingTime: number;
      };
      session?: {
        id: string;
        [key: string]: any;
      };
    }
  }
}

// =====================================================
// 9.9.1 INPUT VALIDATION FRAMEWORK DESIGN
// =====================================================

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  sanitized?: boolean;
  attacksDetected?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationOptions {
  sanitize?: boolean;
  allowHtml?: boolean;
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: string[];
  preventInjection?: boolean;
  logAttacks?: boolean;
}

// =====================================================
// 9.9.2 SQL INJECTION PREVENTION
// =====================================================

class SQLInjectionDetector {
  private static readonly SQL_PATTERNS = [
    // Union-based injection
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)|--/gi,
    // Boolean-based blind injection
    /(\b(and|or)\b\s+\d+\s*=\s*\d+)|(\b(true|false)\b)/gi,
    // Time-based blind injection
    /(sleep|waitfor|delay|benchmark)\s*\(/gi,
    // Error-based injection
    /(convert|cast|char|ascii|substring|length|count)\s*\(/gi,
    // Comment-based injection
    /(\/\*|\*\/|#|--)/g,
    // Stacked queries
    /;\s*(select|insert|update|delete|drop|create|alter)/gi,
    // Information gathering
    /(information_schema|sys\.|mysql\.|pg_)/gi,
  ];

  static detectSQLInjection(input: string): { detected: boolean; patterns: string[] } {
    const detectedPatterns: string[] = [];

    for (const pattern of this.SQL_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
      }
    }

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
    };
  }

  static sanitizeSQL(input: string): string {
    // Remove SQL keywords and dangerous characters
    return input
      .replace(/['";\\]/g, '') // Remove quotes and escape characters
      .replace(/--.*$/gm, '') // Remove SQL comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '')
      .trim();
  }
}

// =====================================================
// 9.9.3 XSS PROTECTION MECHANISMS
// =====================================================

class XSSProtector {
  private static readonly XSS_PATTERNS = [
    // Script injection
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    // Event handlers
    /on\w+\s*=\s*["'][^"']*["']/gi,
    // JavaScript URLs
    /javascript\s*:/gi,
    // Data URLs with JavaScript
    /data\s*:\s*text\/html/gi,
    // Expression injection (IE)
    /expression\s*\(/gi,
    // Meta refresh attacks
    /<meta[\s\S]*?http-equiv[\s\S]*?refresh/gi,
    // Object/embed attacks
    /<(object|embed|applet|iframe)[\s\S]*?>/gi,
  ];

  static detectXSS(input: string): { detected: boolean; patterns: string[] } {
    const detectedPatterns: string[] = [];

    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
      }
    }

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
    };
  }

  static sanitizeHTML(input: string, options: ValidationOptions = {}): string {
    const config = {
      ALLOWED_TAGS: options.allowedTags || ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: options.allowedAttributes || [],
      KEEP_CONTENT: true,
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      SANITIZE_DOM: true,
    };

    return purify.sanitize(input, config);
  }

  static encodeOutput(input: string): string {
    return validator.escape(input);
  }
}

// =====================================================
// 9.9.4 CSRF PROTECTION
// =====================================================

class CSRFProtector {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly tokenStore = new Map<string, { token: string; expires: number }>();

  static generateToken(sessionId: string): string {
    const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

    this.tokenStore.set(sessionId, { token, expires });
    return token;
  }

  static validateToken(sessionId: string, providedToken: string): boolean {
    const storedData = this.tokenStore.get(sessionId);

    if (!storedData) {
      return false;
    }

    if (Date.now() > storedData.expires) {
      this.tokenStore.delete(sessionId);
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(storedData.token, 'hex'),
      Buffer.from(providedToken, 'hex')
    );
  }

  static cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokenStore.entries()) {
      if (now > data.expires) {
        this.tokenStore.delete(sessionId);
      }
    }
  }
}

// =====================================================
// 9.9.5 COMMAND INJECTION PREVENTION
// =====================================================

class CommandInjectionDetector {
  private static readonly COMMAND_PATTERNS = [
    // Shell command injection
    /[;&|`$(){}[\]]/g,
    // Path traversal
    /\.\.[\/\\]/g,
    // Command substitution
    /\$\([^)]*\)/g,
    // Backtick execution
    /`[^`]*`/g,
    // Shell operators
    /(\|\||&&|>>|<<)/g,
    // Environment variables
    /\$\{[^}]*\}/g,
    // Common commands
    /\b(cat|ls|pwd|whoami|id|ps|netstat|ifconfig|ping|curl|wget|nc|ncat|telnet|ssh|ftp|scp|rsync)\b/gi,
  ];

  static detectCommandInjection(input: string): { detected: boolean; patterns: string[] } {
    const detectedPatterns: string[] = [];

    for (const pattern of this.COMMAND_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
      }
    }

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
    };
  }

  static sanitizeCommand(input: string): string {
    // Remove dangerous characters and commands
    return input
      .replace(/[;&|`$(){}[\]]/g, '')
      .replace(/\.\.[\/\\]/g, '')
      .replace(/\$\([^)]*\)/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/(\|\||&&|>>|<<)/g, '')
      .replace(/\$\{[^}]*\}/g, '')
      .trim();
  }
}

// =====================================================
// 9.9.6 INPUT SANITIZATION PIPELINES
// =====================================================

class InputSanitizer {
  static sanitizeInput(
    input: any,
    options: ValidationOptions = {}
  ): { sanitized: any; attacksDetected: string[] } {
    const attacksDetected: string[] = [];

    if (typeof input === 'string') {
      return this.sanitizeString(input, options);
    }

    if (Array.isArray(input)) {
      return this.sanitizeArray(input, options);
    }

    if (input && typeof input === 'object') {
      return this.sanitizeObject(input, options);
    }

    return { sanitized: input, attacksDetected };
  }

  private static sanitizeString(
    input: string,
    options: ValidationOptions
  ): { sanitized: string; attacksDetected: string[] } {
    const attacksDetected: string[] = [];
    let sanitized = input;

    // Check for SQL injection
    const sqlCheck = SQLInjectionDetector.detectSQLInjection(input);
    if (sqlCheck.detected) {
      attacksDetected.push('SQL_INJECTION');
      sanitized = SQLInjectionDetector.sanitizeSQL(sanitized);
    }

    // Check for XSS
    const xssCheck = XSSProtector.detectXSS(input);
    if (xssCheck.detected) {
      attacksDetected.push('XSS_ATTEMPT');
      sanitized = options.allowHtml
        ? XSSProtector.sanitizeHTML(sanitized, options)
        : XSSProtector.encodeOutput(sanitized);
    }

    // Check for command injection
    const cmdCheck = CommandInjectionDetector.detectCommandInjection(input);
    if (cmdCheck.detected) {
      attacksDetected.push('COMMAND_INJECTION');
      sanitized = CommandInjectionDetector.sanitizeCommand(sanitized);
    }

    // Length validation
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
      attacksDetected.push('LENGTH_EXCEEDED');
    }

    // General sanitization
    sanitized = sanitized
      .trim()
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

    return { sanitized, attacksDetected };
  }

  private static sanitizeArray(
    input: any[],
    options: ValidationOptions
  ): { sanitized: any[]; attacksDetected: string[] } {
    const attacksDetected: string[] = [];
    const sanitized: any[] = [];

    for (const item of input.slice(0, 1000)) {
      // Limit array size
      const result = this.sanitizeInput(item, options);
      sanitized.push(result.sanitized);
      attacksDetected.push(...result.attacksDetected);
    }

    return { sanitized, attacksDetected };
  }

  private static sanitizeObject(
    input: Record<string, any>,
    options: ValidationOptions
  ): { sanitized: Record<string, any>; attacksDetected: string[] } {
    const attacksDetected: string[] = [];
    const sanitized: Record<string, any> = {};

    const entries = Object.entries(input).slice(0, 100); // Limit object size

    for (const [key, value] of entries) {
      // Sanitize key
      const keyResult = this.sanitizeString(key, { ...options, maxLength: 100 });
      attacksDetected.push(...keyResult.attacksDetected);

      // Sanitize value
      const valueResult = this.sanitizeInput(value, options);
      attacksDetected.push(...valueResult.attacksDetected);

      sanitized[keyResult.sanitized] = valueResult.sanitized;
    }

    return { sanitized, attacksDetected };
  }
}

// =====================================================
// 9.9.7 VALIDATION ERROR HANDLING
// =====================================================

class ValidationErrorHandler {
  static formatValidationErrors(errors: ValidationError[]): {
    summary: string;
    details: ValidationError[];
    severity: string;
  } {
    const severityLevels: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

    const highestSeverity = errors.reduce((max, error) => {
      return severityLevels[error.severity] > severityLevels[max] ? error.severity : max;
    }, 'low');

    const summary = this.generateErrorSummary(errors);

    return {
      summary,
      details: errors,
      severity: highestSeverity,
    };
  }

  private static generateErrorSummary(errors: ValidationError[]): string {
    const errorCounts = errors.reduce(
      (counts, error) => {
        counts[error.severity] = (counts[error.severity] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    const parts: string[] = [];
    if (errorCounts.critical) parts.push(`${errorCounts.critical} critical`);
    if (errorCounts.high) parts.push(`${errorCounts.high} high`);
    if (errorCounts.medium) parts.push(`${errorCounts.medium} medium`);
    if (errorCounts.low) parts.push(`${errorCounts.low} low`);

    return `Validation failed: ${parts.join(', ')} severity issues detected`;
  }

  static logSecurityEvent(req: Request, attackType: string, details: any): void {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_VALIDATION',
      attackType,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      details,
    };

    console.warn('🚨 Security Event Detected:', securityEvent);

    // In production, send to security monitoring system
    // await securityMonitoring.logEvent(securityEvent);
  }
}

// =====================================================
// MAIN VALIDATION MIDDLEWARE
// =====================================================

export function createInputValidationMiddleware(
  schema: z.ZodSchema,
  options: ValidationOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const validationErrors: ValidationError[] = [];
      const attacksDetected: string[] = [];

      // 1. Sanitize input data
      const sanitizationResult = InputSanitizer.sanitizeInput(req.body, options);
      req.body = sanitizationResult.sanitized;
      attacksDetected.push(...sanitizationResult.attacksDetected);

      // 2. Validate with Zod schema
      const zodResult = schema.safeParse(req.body);
      if (!zodResult.success) {
        zodResult.error.errors.forEach((error) => {
          validationErrors.push({
            field: error.path.join('.'),
            message: error.message,
            code: error.code,
            severity: 'medium',
          });
        });
      }

      // 3. CSRF token validation for state-changing operations
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const sessionId = req.session?.id || (req.headers['x-session-id'] as string);
        const csrfToken = req.headers['x-csrf-token'] as string;

        if (sessionId && csrfToken) {
          if (!CSRFProtector.validateToken(sessionId, csrfToken)) {
            validationErrors.push({
              field: 'csrf',
              message: 'Invalid or expired CSRF token',
              code: 'CSRF_VALIDATION_FAILED',
              severity: 'critical',
            });
            attacksDetected.push('CSRF_ATTACK');
          }
        }
      }

      // 4. Log security events
      if (attacksDetected.length > 0) {
        ValidationErrorHandler.logSecurityEvent(req, 'INJECTION_ATTEMPT', {
          attacks: attacksDetected,
          sanitizedData: req.body,
          originalUrl: req.originalUrl,
        });
      }

      // 5. Handle validation errors
      if (validationErrors.length > 0) {
        const errorResponse = ValidationErrorHandler.formatValidationErrors(validationErrors);

        res.status(400).json({
          success: false,
          error: 'Input validation failed',
          code: 'VALIDATION_ERROR',
          ...errorResponse,
          attacksDetected: attacksDetected.length > 0 ? attacksDetected : undefined,
          processingTime: Date.now() - startTime,
        });
        return;
      }

      // 6. Success - attach validation metadata
      req.validationMeta = {
        sanitized: sanitizationResult.attacksDetected.length > 0,
        attacksDetected,
        processingTime: Date.now() - startTime,
      };

      next();
    } catch (error) {
      console.error('Input validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation service error',
        code: 'VALIDATION_SERVICE_ERROR',
      });
      return;
    }
  };
}

// =====================================================
// 9.9.8 INJECTION ATTACK TESTING UTILITIES
// =====================================================

export const InjectionTestSuite = {
  sqlInjectionTests: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' UNION SELECT * FROM users --",
    "admin'--",
    "' OR 1=1#",
  ],

  xssTests: [
    "<script>alert('XSS')</script>",
    "javascript:alert('XSS')",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "data:text/html,<script>alert('XSS')</script>",
  ],

  commandInjectionTests: [
    '; cat /etc/passwd',
    '| whoami',
    '$(cat /etc/hosts)',
    '`id`',
    '&& ls -la',
  ],

  async runTests(): Promise<{
    sqlTests: Array<{ input: string; detected: boolean }>;
    xssTests: Array<{ input: string; detected: boolean }>;
    commandTests: Array<{ input: string; detected: boolean }>;
  }> {
    return {
      sqlTests: this.sqlInjectionTests.map((input) => ({
        input,
        detected: SQLInjectionDetector.detectSQLInjection(input).detected,
      })),
      xssTests: this.xssTests.map((input) => ({
        input,
        detected: XSSProtector.detectXSS(input).detected,
      })),
      commandTests: this.commandInjectionTests.map((input) => ({
        input,
        detected: CommandInjectionDetector.detectCommandInjection(input).detected,
      })),
    };
  },
};

// =====================================================
// EXPORTS
// =====================================================

export {
  CommandInjectionDetector,
  CSRFProtector,
  InputSanitizer,
  SQLInjectionDetector,
  ValidationErrorHandler,
  XSSProtector,
};
