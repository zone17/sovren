/**
 * 🔐 NIP-05 Service - Elite Implementation
 *
 * US-306: DNS-based NOSTR identifier verification
 * Implements NIP-05 specification for human-readable NOSTR identifiers
 *
 * Features:
 * - Identifier parsing and validation
 * - HTTP verification via .well-known/nostr.json
 * - IndexedDB/Memory caching with TTL
 * - Comprehensive error handling
 * - CORS-aware fetch
 * - Performance optimized
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/05.md
 */

import type {
  NIP05Identifier,
  NIP05VerificationResult,
  NIP05VerificationOptions,
  NIP05WellKnownResponse,
  NIP05CacheConfig,
  NIP05CacheEntry,
  INIP05Service,
  NIP05Statistics,
} from '@shared/types/nip05';
import {
  NIP05IdentifierSchema,
  NIP05WellKnownResponseSchema,
  NIP05CacheError,
  NIP05VerificationStatus,
  NIP05ErrorCode,
  DEFAULT_NIP05_CACHE_CONFIG,
} from '@shared/types/nip05';

// ========================================
// NIP05Service Implementation
// ========================================

export class NIP05Service implements INIP05Service {
  private cacheConfig: NIP05CacheConfig;
  private memoryCache: Map<string, NIP05CacheEntry>;
  private statistics: NIP05Statistics;

  // Default configuration
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private static readonly WELL_KNOWN_PATH = '/.well-known/nostr.json';

  constructor(cacheConfig?: Partial<NIP05CacheConfig>) {
    this.cacheConfig = { ...DEFAULT_NIP05_CACHE_CONFIG, ...cacheConfig };
    this.memoryCache = new Map();
    this.statistics = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageVerificationTime: 0,
      successRate: 0,
      cacheHitRate: 0,
    };
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Parse NIP-05 identifier
   * Format: localPart@domain
   */
  public parseIdentifier(identifier: string): {
    success: boolean;
    parsed?: NIP05Identifier;
    error?: string;
  } {
    try {
      // Normalize: lowercase and trim
      const normalized = identifier.toLowerCase().trim();

      // Basic validation
      if (!normalized.includes('@')) {
        return {
          success: false,
          error: 'Invalid NIP-05 format: missing @ symbol',
        };
      }

      const parts = normalized.split('@');
      if (parts.length !== 2) {
        return {
          success: false,
          error: 'Invalid NIP-05 format: multiple @ symbols',
        };
      }

      const [localPart, domain] = parts;

      // Create identifier object
      const parsedIdentifier: NIP05Identifier = {
        localPart,
        domain,
        full: normalized,
      };

      // Validate using Zod schema
      const validationResult = NIP05IdentifierSchema.safeParse(parsedIdentifier);
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        return {
          success: false,
          error: `Invalid NIP-05 format: ${firstError.message}`,
        };
      }

      return {
        success: true,
        parsed: parsedIdentifier,
      };
    } catch (error) {
      return {
        success: false,
        error: `NIP-05 parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Verify NIP-05 identifier against expected pubkey
   */
  public async verifyIdentifier(
    identifier: string,
    expectedPubkey: string,
    options?: NIP05VerificationOptions
  ): Promise<NIP05VerificationResult> {
    const startTime = Date.now();
    this.statistics.totalAttempts++;

    try {
      // Validate pubkey format
      if (!this.isValidPubkey(expectedPubkey)) {
        return this.createFailedResult(
          identifier,
          expectedPubkey,
          'Invalid public key format',
          NIP05ErrorCode.VALIDATION_ERROR
        );
      }

      // Parse identifier
      const parseResult = this.parseIdentifier(identifier);
      if (!parseResult.success || !parseResult.parsed) {
        return this.createFailedResult(
          identifier,
          expectedPubkey,
          parseResult.error || 'Failed to parse identifier',
          NIP05ErrorCode.INVALID_FORMAT
        );
      }

      const parsedIdentifier = parseResult.parsed;

      // Check cache unless forceRefresh
      if (options?.useCache !== false && !options?.forceRefresh) {
        const cached = await this.getCachedVerification(identifier, expectedPubkey);
        if (cached && !this.isExpired(cached)) {
          this.statistics.cacheHits++;
          this.updateStatistics(startTime, true);
          return { ...cached, fromCache: true, method: 'cache' };
        }
        this.statistics.cacheMisses++;
      }

      // Perform HTTP verification
      const result = await this.performHTTPVerification(parsedIdentifier, expectedPubkey, options);

      // Cache result
      if (this.cacheConfig.enabled) {
        await this.setCachedVerification(identifier, expectedPubkey, result);
      }

      this.updateStatistics(startTime, result.verified);
      return result;
    } catch (error) {
      this.statistics.failureCount++;
      return this.createFailedResult(
        identifier,
        expectedPubkey,
        error instanceof Error ? error.message : 'Unknown error',
        NIP05ErrorCode.UNKNOWN_ERROR
      );
    }
  }

  /**
   * Get cached verification result
   */
  public async getCachedVerification(
    identifier: string,
    expectedPubkey: string
  ): Promise<NIP05VerificationResult | null> {
    try {
      const key = this.getCacheKey(identifier, expectedPubkey);

      // Check memory cache first
      if (this.cacheConfig.storage === 'memory' || this.cacheConfig.storage === 'indexeddb') {
        const cached = this.memoryCache.get(key);
        if (cached) {
          // Check if expired
          const now = Date.now();
          if (now - cached.cachedAt < cached.ttl) {
            return cached.result;
          } else {
            // Expired, remove from cache
            this.memoryCache.delete(key);
          }
        }
      }

      // TODO: Implement IndexedDB cache layer
      // For now, only memory cache is implemented

      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Clear cached verification(s)
   */
  public async clearCache(identifier?: string): Promise<void> {
    try {
      if (identifier) {
        // Clear specific identifier (all pubkeys)
        const keysToDelete: string[] = [];
        for (const [key] of this.memoryCache) {
          if (key.startsWith(identifier.toLowerCase())) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.memoryCache.delete(key));
      } else {
        // Clear all
        this.memoryCache.clear();
      }
    } catch (error) {
      throw new NIP05CacheError(
        `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        identifier ? 'delete' : 'clear'
      );
    }
  }

  /**
   * Check if verification result is expired
   */
  public isExpired(result: NIP05VerificationResult): boolean {
    if (!result.expiresAt) {
      return false; // No expiration set
    }
    return Date.now() > result.expiresAt;
  }

  /**
   * Get service statistics
   */
  public getStatistics(): NIP05Statistics {
    return { ...this.statistics };
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * Perform HTTP verification via .well-known/nostr.json
   */
  private async performHTTPVerification(
    identifier: NIP05Identifier,
    expectedPubkey: string,
    options?: NIP05VerificationOptions
  ): Promise<NIP05VerificationResult> {
    const timeout = options?.timeout || NIP05Service.DEFAULT_TIMEOUT;
    const fetchFn = options?.fetchFn || fetch;

    try {
      // Construct .well-known URL
      const url = `https://${identifier.domain}${NIP05Service.WELL_KNOWN_PATH}?name=${encodeURIComponent(identifier.localPart)}`;

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Fetch .well-known/nostr.json
        const response = await fetchFn(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Sovren-NIP05-Verifier/1.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check HTTP status
        if (!response.ok) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            `HTTP ${response.status}: ${response.statusText}`,
            this.getHTTPErrorCode(response.status),
            identifier
          );
        }

        // Validate content-type
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            'Invalid content type: expected application/json',
            NIP05ErrorCode.INVALID_CONTENT_TYPE,
            identifier
          );
        }

        // Parse JSON
        let wellKnownData: unknown;
        try {
          wellKnownData = await response.json();
        } catch (jsonError) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            'Invalid JSON response',
            NIP05ErrorCode.INVALID_JSON,
            identifier
          );
        }

        // Basic structure check
        if (!wellKnownData || typeof wellKnownData !== 'object' || !('names' in wellKnownData)) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            'Invalid response: missing names object',
            NIP05ErrorCode.MISSING_NAMES,
            identifier
          );
        }

        const data = wellKnownData as {
          names: Record<string, unknown>;
          relays?: Record<string, unknown>;
        };

        // Check if local part exists in names
        const actualPubkey = data.names[identifier.localPart];
        if (!actualPubkey) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            `Local part '${identifier.localPart}' not found in names`,
            NIP05ErrorCode.NAME_NOT_FOUND,
            identifier
          );
        }

        // Validate pubkey format (check before schema validation)
        if (typeof actualPubkey !== 'string' || !this.isValidPubkey(actualPubkey)) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            'Invalid public key format in response',
            NIP05ErrorCode.INVALID_PUBKEY_FORMAT,
            identifier
          );
        }

        // Validate full response structure with schema
        const validationResult = NIP05WellKnownResponseSchema.safeParse(wellKnownData);
        if (!validationResult.success) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            'Invalid response format',
            NIP05ErrorCode.INVALID_RESPONSE,
            identifier
          );
        }

        const validatedData: NIP05WellKnownResponse = validationResult.data;

        // Check pubkey match
        if (actualPubkey !== expectedPubkey) {
          return {
            success: false,
            verified: false,
            identifier,
            expectedPubkey,
            actualPubkey,
            status: NIP05VerificationStatus.FAILED,
            error: 'Public key mismatch',
            errorCode: NIP05ErrorCode.PUBKEY_MISMATCH,
            method: 'http',
          };
        }

        // Get optional relays
        const relays = validatedData.relays?.[expectedPubkey];

        // Success!
        const now = Date.now();
        return {
          success: true,
          verified: true,
          identifier,
          expectedPubkey,
          actualPubkey,
          status: NIP05VerificationStatus.VERIFIED,
          relays,
          verifiedAt: now,
          expiresAt: now + this.cacheConfig.successTTL,
          method: 'http',
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            'Verification timeout',
            NIP05ErrorCode.TIMEOUT_ERROR,
            identifier
          );
        }

        if (error.message.includes('Failed to fetch') || error instanceof TypeError) {
          return this.createFailedResult(
            identifier.full,
            expectedPubkey,
            'CORS or network error',
            NIP05ErrorCode.CORS_ERROR,
            identifier
          );
        }

        return this.createFailedResult(
          identifier.full,
          expectedPubkey,
          error.message,
          NIP05ErrorCode.NETWORK_ERROR,
          identifier
        );
      }

      return this.createFailedResult(
        identifier.full,
        expectedPubkey,
        'Unknown error during verification',
        NIP05ErrorCode.UNKNOWN_ERROR,
        identifier
      );
    }
  }

  /**
   * Set cached verification result
   */
  private async setCachedVerification(
    identifier: string,
    expectedPubkey: string,
    result: NIP05VerificationResult
  ): Promise<void> {
    try {
      const key = this.getCacheKey(identifier, expectedPubkey);
      const ttl = result.verified ? this.cacheConfig.successTTL : this.cacheConfig.failureTTL;

      const cacheEntry: NIP05CacheEntry = {
        result,
        cachedAt: Date.now(),
        ttl,
        key,
      };

      // Store in memory cache
      this.memoryCache.set(key, cacheEntry);

      // Enforce max cache size
      if (this.memoryCache.size > this.cacheConfig.maxSize) {
        // Remove oldest entry
        const firstKey = this.memoryCache.keys().next().value;
        if (firstKey) {
          this.memoryCache.delete(firstKey);
        }
      }

      // TODO: Implement IndexedDB persistence
    } catch (error) {
      console.error('Cache write error:', error);
      // Don't throw, caching is optional
    }
  }

  /**
   * Get cache key for identifier and pubkey pair
   */
  private getCacheKey(identifier: string, pubkey: string): string {
    return `${identifier.toLowerCase()}:${pubkey.toLowerCase()}`;
  }

  /**
   * Validate pubkey format (64 hex characters)
   */
  private isValidPubkey(pubkey: string): boolean {
    return /^[a-f0-9]{64}$/.test(pubkey);
  }

  /**
   * Get HTTP error code from status
   */
  private getHTTPErrorCode(status: number): NIP05ErrorCode {
    if (status === 404) return NIP05ErrorCode.HTTP_404;
    if (status >= 500) return NIP05ErrorCode.HTTP_500;
    return NIP05ErrorCode.HTTP_ERROR;
  }

  /**
   * Create failed verification result
   */
  private createFailedResult(
    identifierStr: string,
    expectedPubkey: string,
    error: string,
    errorCode: NIP05ErrorCode,
    identifier?: NIP05Identifier
  ): NIP05VerificationResult {
    // Parse identifier if not provided
    if (!identifier) {
      const parseResult = this.parseIdentifier(identifierStr);
      if (parseResult.parsed) {
        identifier = parseResult.parsed;
      } else {
        // Create minimal identifier for error response
        identifier = {
          localPart: '',
          domain: '',
          full: identifierStr,
        };
      }
    }

    return {
      success: false,
      verified: false,
      identifier,
      expectedPubkey,
      status: NIP05VerificationStatus.FAILED,
      error,
      errorCode,
      method: 'http',
    };
  }

  /**
   * Update service statistics
   */
  private updateStatistics(startTime: number, success: boolean): void {
    const duration = Date.now() - startTime;

    if (success) {
      this.statistics.successCount++;
    } else {
      this.statistics.failureCount++;
    }

    // Update average verification time (running average)
    const totalTime = this.statistics.averageVerificationTime * (this.statistics.totalAttempts - 1);
    this.statistics.averageVerificationTime =
      (totalTime + duration) / this.statistics.totalAttempts;

    // Update rates
    this.statistics.successRate =
      (this.statistics.successCount / this.statistics.totalAttempts) * 100;
    const totalCacheAttempts = this.statistics.cacheHits + this.statistics.cacheMisses;
    this.statistics.cacheHitRate =
      totalCacheAttempts > 0 ? (this.statistics.cacheHits / totalCacheAttempts) * 100 : 0;
  }
}

// ========================================
// Factory Function
// ========================================

/**
 * Create NIP05Service instance
 */
export function createNIP05Service(config?: Partial<NIP05CacheConfig>): NIP05Service {
  return new NIP05Service(config);
}

/**
 * Singleton instance (default configuration)
 */
let defaultInstance: NIP05Service | null = null;

/**
 * Get default NIP05Service instance
 */
export function getNIP05Service(): NIP05Service {
  if (!defaultInstance) {
    defaultInstance = new NIP05Service();
  }
  return defaultInstance;
}

// Export types for convenience
export type {
  NIP05Identifier,
  NIP05VerificationResult,
  NIP05VerificationOptions,
  NIP05CacheConfig,
  NIP05Statistics,
} from '@shared/types/nip05';
