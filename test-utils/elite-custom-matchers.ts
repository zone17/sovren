/**
 * 🧪 **ELITE CUSTOM MATCHERS - COMPREHENSIVE TESTING UTILITIES**
 *
 * @description Custom Jest matchers for elite testing standards
 * @version 2.0.0 - Production-Ready Test Matchers
 * @author Elite Engineering Team
 * @lastModified 2024-12-28
 *
 * **FEATURES:**
 * - Testing Library DOM matchers
 * - Custom AI/ML validation matchers
 * - Performance testing matchers
 * - Accessibility testing matchers
 * - Security testing matchers
 * - Lightning Network testing matchers
 * - NOSTR protocol testing matchers
 *
 * **USAGE:**
 * These matchers are automatically imported in all test files
 * through the Jest setupFilesAfterEnv configuration
 */

import { expect } from '@jest/globals';
import '@testing-library/jest-dom';

// 🔍 **TESTING LIBRARY DOM MATCHERS**
// Imported from @testing-library/jest-dom for DOM testing
// Available matchers:
// - toBeInTheDocument()
// - toHaveTextContent()
// - toHaveClass()
// - toHaveAttribute()
// - toBeVisible()
// - toBeDisabled()
// - toBeChecked()
// - toHaveValue()
// - toBeRequired()
// - toBeValid()
// - toBeInvalid()
// - toHaveFocus()
// - toHaveAccessibleName()
// - toHaveAccessibleDescription()

// 🎯 **CUSTOM MATCHERS FOR ELITE TESTING**

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeBetween(min: number, max: number): R;
      toBeWithinRange(min: number, max: number): R;
      toMatchNostrPubkey(): R;
      toMatchLightningInvoice(): R;
      toHaveAccessibleRole(role: string): R;
      toMeetPerformanceBudget(budget: number): R;
      toPassSecurityValidation(): R;
      toHaveCorrectDataStructure(schema: any): R;
      toBeValidJSON(): R;
      toHaveValidTimestamp(): R;
      toMatchEmailFormat(): R;
      toHaveValidUrl(): R;
      toBeValidNIP05(): R;
      toPassAIValidation(threshold: number): R;
      toHaveCorrectCacheHeaders(): R;
      toPassRateLimitValidation(): R;
      toHaveSecureHeaders(): R;
      toBeOptimizedImage(): R;
      toHaveCorrectMetadata(): R;
      toPassContentSecurityPolicy(): R;
      toHaveValidSignature(): R;
      toPassCryptographicValidation(): R;
      toHaveCorrectEncoding(): R;
      toPassInputSanitization(): R;
      toBeSQLInjectionSafe(): R;
      toPassXSSValidation(): R;
      toHaveCorrectErrorHandling(): R;
      toPassLoadBalancingValidation(): R;
      toHaveCorrectDatabaseConnection(): R;
      toPassWebVitalsThreshold(metric: string, threshold: number): R;
    }
  }
}

// 🎯 **NUMERIC RANGE MATCHERS**
expect.extend({
  toBeBetween(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to be between ${min} and ${max}`
          : `Expected ${received} to be between ${min} and ${max}`,
      pass,
    };
  },

  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to be within range ${min}-${max}`
          : `Expected ${received} to be within range ${min}-${max}`,
      pass,
    };
  },
});

// 🔗 **NOSTR PROTOCOL MATCHERS**
expect.extend({
  toMatchNostrPubkey(received: string) {
    // NOSTR pubkeys are 64-character hex strings
    const hexPattern = /^[0-9a-fA-F]{64}$/;
    const pass = typeof received === 'string' && hexPattern.test(received);
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to be a valid NOSTR pubkey`
          : `Expected ${received} to be a valid NOSTR pubkey (64-character hex string)`,
      pass,
    };
  },

  toBeValidNIP05(received: string) {
    // NIP-05 format: localpart@domain.tld
    const nip05Pattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const pass = typeof received === 'string' && nip05Pattern.test(received);
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to be a valid NIP-05 identifier`
          : `Expected ${received} to be a valid NIP-05 identifier (localpart@domain.tld)`,
      pass,
    };
  },
});

// ⚡ **LIGHTNING NETWORK MATCHERS**
expect.extend({
  toMatchLightningInvoice(received: string) {
    // Lightning invoices start with lnbc, lntb, or lnbcrt
    const invoicePattern = /^ln(bc|tb|bcrt)[0-9]+[a-zA-Z0-9]+$/;
    const pass = typeof received === 'string' && invoicePattern.test(received);
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to be a valid Lightning invoice`
          : `Expected ${received} to be a valid Lightning invoice (BOLT11 format)`,
      pass,
    };
  },
});

// ♿ **ACCESSIBILITY MATCHERS**
expect.extend({
  toHaveAccessibleRole(received: Element, expectedRole: string) {
    const actualRole = received.getAttribute('role') || received.tagName.toLowerCase();
    const pass = actualRole === expectedRole;
    return {
      message: () =>
        pass
          ? `Expected element NOT to have role ${expectedRole}`
          : `Expected element to have role ${expectedRole}, but got ${actualRole}`,
      pass,
    };
  },
});

// ⚡ **PERFORMANCE MATCHERS**
expect.extend({
  toMeetPerformanceBudget(received: number, budget: number) {
    const pass = received <= budget;
    return {
      message: () =>
        pass
          ? `Expected ${received}ms NOT to meet performance budget of ${budget}ms`
          : `Expected ${received}ms to meet performance budget of ${budget}ms`,
      pass,
    };
  },

  toPassWebVitalsThreshold(received: number, metric: string, threshold: number) {
    const pass = received <= threshold;
    return {
      message: () =>
        pass
          ? `Expected ${metric} ${received} NOT to pass threshold ${threshold}`
          : `Expected ${metric} ${received} to pass threshold ${threshold}`,
      pass,
    };
  },
});

// 🔒 **SECURITY MATCHERS**
expect.extend({
  toPassSecurityValidation(received: any) {
    // Basic security validation checks
    const isObject = typeof received === 'object' && received !== null;
    const hasNoScriptTags = !JSON.stringify(received).includes('<script');
    const hasNoSQLInjection = !JSON.stringify(received).includes('DROP TABLE');
    const pass = isObject && hasNoScriptTags && hasNoSQLInjection;
    return {
      message: () =>
        pass
          ? `Expected data NOT to pass security validation`
          : `Expected data to pass security validation (no script tags, no SQL injection)`,
      pass,
    };
  },

  toHaveSecureHeaders(received: any) {
    const requiredHeaders = [
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security',
    ];
    const headers = received.headers || {};
    const pass = requiredHeaders.every((header) => headers[header]);
    return {
      message: () =>
        pass
          ? `Expected NOT to have all required security headers`
          : `Expected to have all required security headers: ${requiredHeaders.join(', ')}`,
      pass,
    };
  },

  toBeSQLInjectionSafe(received: string) {
    const sqlInjectionPatterns = [
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
      /INSERT\s+INTO/i,
      /UPDATE\s+SET/i,
      /UNION\s+SELECT/i,
      /--/,
      /;/,
      /'/,
      /"/,
    ];
    const pass = !sqlInjectionPatterns.some((pattern) => pattern.test(received));
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to be SQL injection safe`
          : `Expected ${received} to be SQL injection safe`,
      pass,
    };
  },

  toPassXSSValidation(received: string) {
    const xssPatterns = [
      /<script/i,
      /<\/script>/i,
      /javascript:/i,
      /on\w+=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];
    const pass = !xssPatterns.some((pattern) => pattern.test(received));
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to pass XSS validation`
          : `Expected ${received} to pass XSS validation`,
      pass,
    };
  },

  toPassInputSanitization(received: string) {
    // Check for common malicious patterns
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /data:text\/html/i,
      /vbscript:/i,
    ];
    const pass = !maliciousPatterns.some((pattern) => pattern.test(received));
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to pass input sanitization`
          : `Expected ${received} to pass input sanitization`,
      pass,
    };
  },
});

// 📊 **DATA STRUCTURE MATCHERS**
expect.extend({
  toHaveCorrectDataStructure(received: any, schema: any) {
    const validateSchema = (data: any, schemaObj: any): boolean => {
      if (typeof schemaObj === 'string') {
        return typeof data === schemaObj;
      }
      if (Array.isArray(schemaObj)) {
        return Array.isArray(data) && data.every((item) => validateSchema(item, schemaObj[0]));
      }
      if (typeof schemaObj === 'object') {
        return (
          typeof data === 'object' &&
          Object.keys(schemaObj).every((key) => validateSchema(data[key], schemaObj[key]))
        );
      }
      return false;
    };

    const pass = validateSchema(received, schema);
    return {
      message: () =>
        pass ? `Expected data NOT to match schema` : `Expected data to match schema structure`,
      pass,
    };
  },

  toBeValidJSON(received: string) {
    try {
      JSON.parse(received);
      return {
        message: () => `Expected ${received} NOT to be valid JSON`,
        pass: true,
      };
    } catch {
      return {
        message: () => `Expected ${received} to be valid JSON`,
        pass: false,
      };
    }
  },

  toHaveValidTimestamp(received: string) {
    const timestamp = new Date(received).getTime();
    const pass = !isNaN(timestamp) && timestamp > 0;
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to be a valid timestamp`
          : `Expected ${received} to be a valid timestamp`,
      pass,
    };
  },
});

// 🌐 **FORMAT VALIDATION MATCHERS**
expect.extend({
  toMatchEmailFormat(received: string) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailPattern.test(received);
    return {
      message: () =>
        pass
          ? `Expected ${received} NOT to match email format`
          : `Expected ${received} to match email format`,
      pass,
    };
  },

  toHaveValidUrl(received: string) {
    try {
      new URL(received);
      return {
        message: () => `Expected ${received} NOT to be a valid URL`,
        pass: true,
      };
    } catch {
      return {
        message: () => `Expected ${received} to be a valid URL`,
        pass: false,
      };
    }
  },
});

// 🤖 **AI/ML MATCHERS**
expect.extend({
  toPassAIValidation(received: number, threshold: number) {
    // AI validation score should be above threshold
    const pass = received >= threshold;
    return {
      message: () =>
        pass
          ? `Expected AI validation score ${received} NOT to pass threshold ${threshold}`
          : `Expected AI validation score ${received} to pass threshold ${threshold}`,
      pass,
    };
  },
});

// 🎯 **HTTP/NETWORK MATCHERS**
expect.extend({
  toHaveCorrectCacheHeaders(received: any) {
    const headers = received.headers || {};
    const hasCacheControl = 'cache-control' in headers;
    const hasEtag = 'etag' in headers;
    const pass = hasCacheControl || hasEtag;
    return {
      message: () =>
        pass
          ? `Expected NOT to have correct cache headers`
          : `Expected to have correct cache headers (cache-control or etag)`,
      pass,
    };
  },

  toPassRateLimitValidation(received: any) {
    const headers = received.headers || {};
    const hasRateLimit = 'x-ratelimit-limit' in headers;
    const hasRateRemaining = 'x-ratelimit-remaining' in headers;
    const pass = hasRateLimit && hasRateRemaining;
    return {
      message: () =>
        pass
          ? `Expected NOT to have rate limit headers`
          : `Expected to have rate limit headers (x-ratelimit-limit, x-ratelimit-remaining)`,
      pass,
    };
  },
});

// 🖼️ **MEDIA MATCHERS**
expect.extend({
  toBeOptimizedImage(received: any) {
    const hasCorrectFormat = ['webp', 'avif', 'jpeg', 'png'].includes(received.format);
    const hasDimensions = received.width && received.height;
    const hasReasonableSize = received.size < 1024 * 1024; // 1MB
    const pass = hasCorrectFormat && hasDimensions && hasReasonableSize;
    return {
      message: () =>
        pass
          ? `Expected image NOT to be optimized`
          : `Expected image to be optimized (correct format, dimensions, size < 1MB)`,
      pass,
    };
  },
});

// 🔐 **CRYPTOGRAPHIC MATCHERS**
expect.extend({
  toHaveValidSignature(received: any) {
    const hasSignature = received.signature && typeof received.signature === 'string';
    const hasPublicKey = received.publicKey && typeof received.publicKey === 'string';
    const hasMessage = received.message && typeof received.message === 'string';
    const pass = hasSignature && hasPublicKey && hasMessage;
    return {
      message: () =>
        pass
          ? `Expected NOT to have valid signature structure`
          : `Expected to have valid signature structure (signature, publicKey, message)`,
      pass,
    };
  },

  toPassCryptographicValidation(received: any) {
    // Basic cryptographic validation
    const isValidLength = received.length >= 32; // Minimum 32 bytes
    const isHex = /^[0-9a-fA-F]+$/.test(received);
    const pass = isValidLength && isHex;
    return {
      message: () =>
        pass
          ? `Expected NOT to pass cryptographic validation`
          : `Expected to pass cryptographic validation (min 32 bytes, hex format)`,
      pass,
    };
  },
});

// 🌍 **ENCODING MATCHERS**
expect.extend({
  toHaveCorrectEncoding(received: string) {
    // Check for valid UTF-8 encoding
    try {
      const encoded = encodeURIComponent(received);
      const decoded = decodeURIComponent(encoded);
      const pass = decoded === received;
      return {
        message: () =>
          pass
            ? `Expected ${received} NOT to have correct encoding`
            : `Expected ${received} to have correct encoding`,
        pass,
      };
    } catch {
      return {
        message: () => `Expected ${received} to have correct encoding`,
        pass: false,
      };
    }
  },
});

// 📝 **METADATA MATCHERS**
expect.extend({
  toHaveCorrectMetadata(received: any) {
    const requiredFields = ['title', 'description', 'author', 'created_at'];
    const pass = requiredFields.every((field) => received[field]);
    return {
      message: () =>
        pass
          ? `Expected NOT to have correct metadata`
          : `Expected to have correct metadata (${requiredFields.join(', ')})`,
      pass,
    };
  },
});

// 🔧 **ERROR HANDLING MATCHERS**
expect.extend({
  toHaveCorrectErrorHandling(received: any) {
    const hasErrorType = received.error && typeof received.error === 'string';
    const hasMessage = received.message && typeof received.message === 'string';
    const hasStatusCode = received.statusCode && typeof received.statusCode === 'number';
    const pass = hasErrorType && hasMessage && hasStatusCode;
    return {
      message: () =>
        pass
          ? `Expected NOT to have correct error handling`
          : `Expected to have correct error handling (error, message, statusCode)`,
      pass,
    };
  },
});

// 🔄 **SYSTEM MATCHERS**
expect.extend({
  toPassLoadBalancingValidation(received: any) {
    const hasHealthCheck = received.healthCheck && typeof received.healthCheck === 'boolean';
    const hasLoadAverage = received.loadAverage && typeof received.loadAverage === 'number';
    const pass = hasHealthCheck && hasLoadAverage;
    return {
      message: () =>
        pass
          ? `Expected NOT to pass load balancing validation`
          : `Expected to pass load balancing validation (healthCheck, loadAverage)`,
      pass,
    };
  },

  toHaveCorrectDatabaseConnection(received: any) {
    const hasConnection = received.connected === true;
    const hasLatency = received.latency && received.latency < 1000; // < 1 second
    const pass = hasConnection && hasLatency;
    return {
      message: () =>
        pass
          ? `Expected NOT to have correct database connection`
          : `Expected to have correct database connection (connected: true, latency < 1000ms)`,
      pass,
    };
  },
});

// 🔐 **CONTENT SECURITY POLICY MATCHERS**
expect.extend({
  toPassContentSecurityPolicy(received: string) {
    const csp = received.toLowerCase();
    const hasDefaultSrc = csp.includes("default-src 'self'");
    const hasScriptSrc = csp.includes('script-src');
    const hasStyleSrc = csp.includes('style-src');
    const pass = hasDefaultSrc && hasScriptSrc && hasStyleSrc;
    return {
      message: () =>
        pass
          ? `Expected NOT to pass Content Security Policy validation`
          : `Expected to pass Content Security Policy validation (default-src, script-src, style-src)`,
      pass,
    };
  },
});

// 🎯 **SETUP COMPLETE**
console.log('🧪 Elite custom matchers loaded successfully!');
console.log(
  '📊 Available matchers: 25+ custom matchers including security, performance, and NOSTR validation'
);
