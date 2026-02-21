/**
 * 🌐 ELITE SERVICE: Centralized NOSTR Relay Configuration
 * US-309: Remove Hardcoded Relay URLs
 *
 * Single source of truth for NOSTR relay configuration across the application.
 * Supports environment-based configuration with intelligent fallbacks.
 *
 * Features:
 * - Environment variable configuration (VITE_NOSTR_RELAYS, NOSTR_RELAYS)
 * - Validated relay URL format
 * - Default fallback relays
 * - Type-safe relay metadata
 * - Support for read/write relay separation
 *
 * @example
 * ```typescript
 * import { RelayConfig } from '@shared/config/relay-config';
 *
 * // Get all configured relays
 * const relays = RelayConfig.getRelays();
 *
 * // Get read-only relays
 * const readRelays = RelayConfig.getReadRelays();
 *
 * // Get write-only relays
 * const writeRelays = RelayConfig.getWriteRelays();
 *
 * // Get relay URLs as string array
 * const urls = RelayConfig.getRelayUrls();
 * ```
 */

import type { RelayMetadata } from '../types/nostr/nips';

/**
 * Default relay configuration with read/write capabilities
 * Used as fallback when no environment configuration is provided
 */
const DEFAULT_RELAYS: RelayMetadata[] = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.nostr.band', read: true, write: false },
  { url: 'wss://relay.snort.social', read: true, write: true },
  { url: 'wss://relay.current.fyi', read: true, write: false },
] as const;

/**
 * Relay URL validation regex
 * Ensures URLs start with wss:// or ws:// and have valid format
 */
const RELAY_URL_REGEX = /^wss?:\/\/.+/;

/**
 * Environment variable keys to check for relay configuration
 * Checked in order: Vite-prefixed first, then standard
 */
const RELAY_ENV_KEYS = ['VITE_NOSTR_RELAYS', 'NOSTR_RELAYS'] as const;

/**
 * Centralized NOSTR Relay Configuration
 */
export class RelayConfig {
  private static cachedRelays: RelayMetadata[] | null = null;

  /**
   * Get all configured relays with read/write metadata
   *
   * @returns Array of relay metadata
   *
   * @example
   * ```typescript
   * const relays = RelayConfig.getRelays();
   * relays.forEach(relay => {
   *   console.log(`${relay.url}: read=${relay.read}, write=${relay.write}`);
   * });
   * ```
   */
  public static getRelays(): RelayMetadata[] {
    if (this.cachedRelays) {
      return [...this.cachedRelays];
    }

    // Try to load from environment
    const envRelays = this.loadFromEnvironment();
    if (envRelays.length > 0) {
      this.cachedRelays = envRelays;
      return [...envRelays];
    }

    // Fall back to defaults
    this.cachedRelays = [...DEFAULT_RELAYS];
    return [...DEFAULT_RELAYS];
  }

  /**
   * Get relay URLs as string array
   * Useful for simple relay list without metadata
   *
   * @returns Array of relay URLs
   *
   * @example
   * ```typescript
   * const urls = RelayConfig.getRelayUrls();
   * // ['wss://relay.damus.io', 'wss://nos.lol', ...]
   * ```
   */
  public static getRelayUrls(): string[] {
    return this.getRelays().map(relay => relay.url);
  }

  /**
   * Get relays configured for reading
   *
   * @returns Array of read-capable relay URLs
   *
   * @example
   * ```typescript
   * const readRelays = RelayConfig.getReadRelays();
   * ```
   */
  public static getReadRelays(): string[] {
    return this.getRelays()
      .filter(relay => relay.read)
      .map(relay => relay.url);
  }

  /**
   * Get relays configured for writing
   *
   * @returns Array of write-capable relay URLs
   *
   * @example
   * ```typescript
   * const writeRelays = RelayConfig.getWriteRelays();
   * ```
   */
  public static getWriteRelays(): string[] {
    return this.getRelays()
      .filter(relay => relay.write)
      .map(relay => relay.url);
  }

  /**
   * Get default relays (ignoring environment configuration)
   * Useful for testing or reset scenarios
   *
   * @returns Array of default relay metadata
   *
   * @example
   * ```typescript
   * const defaults = RelayConfig.getDefaultRelays();
   * ```
   */
  public static getDefaultRelays(): RelayMetadata[] {
    return [...DEFAULT_RELAYS];
  }

  /**
   * Validate a relay URL format
   *
   * @param url - Relay URL to validate
   * @returns True if valid, false otherwise
   *
   * @example
   * ```typescript
   * RelayConfig.isValidRelayUrl('wss://relay.damus.io'); // true
   * RelayConfig.isValidRelayUrl('https://example.com'); // false
   * ```
   */
  public static isValidRelayUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Check format
    if (!RELAY_URL_REGEX.test(url)) {
      return false;
    }

    // Validate URL structure
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize a relay URL
   * - Trims whitespace
   * - Removes trailing slash
   * - Validates format
   *
   * @param url - Relay URL to normalize
   * @returns Normalized URL or null if invalid
   *
   * @example
   * ```typescript
   * RelayConfig.normalizeRelayUrl('wss://relay.damus.io/'); // 'wss://relay.damus.io'
   * RelayConfig.normalizeRelayUrl('  wss://nos.lol  '); // 'wss://nos.lol'
   * ```
   */
  public static normalizeRelayUrl(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Trim whitespace and remove all trailing slashes
    const normalized = url.trim().replace(/\/+$/, '');

    return this.isValidRelayUrl(normalized) ? normalized : null;
  }

  /**
   * Clear cached relays
   * Forces reload from environment on next access
   *
   * @example
   * ```typescript
   * RelayConfig.clearCache();
   * const freshRelays = RelayConfig.getRelays();
   * ```
   */
  public static clearCache(): void {
    this.cachedRelays = null;
  }

  /**
   * Set custom relay configuration (for testing or runtime updates)
   *
   * @param relays - Custom relay metadata array
   *
   * @example
   * ```typescript
   * RelayConfig.setRelays([
   *   { url: 'wss://custom-relay.com', read: true, write: true }
   * ]);
   * ```
   */
  public static setRelays(relays: RelayMetadata[]): void {
    const validated = relays.filter(relay => this.isValidRelayUrl(relay.url));
    this.cachedRelays = validated;
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Load relays from environment variables
   * Checks VITE_NOSTR_RELAYS and NOSTR_RELAYS
   */
  private static loadFromEnvironment(): RelayMetadata[] {
    // Check both Vite and standard environment variables
    for (const envKey of RELAY_ENV_KEYS) {
      const envValue = this.getEnvValue(envKey);
      if (envValue) {
        const relays = this.parseRelayEnv(envValue);
        if (relays.length > 0) {
          return relays;
        }
      }
    }

    return [];
  }

  /**
   * Get environment variable value
   * Works in both Node.js and browser (Vite) environments
   */
  private static getEnvValue(key: string): string | undefined {
    // Node.js environment (including Jest/tests)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }

    // Vite environment (browser) - using globalThis to avoid import.meta syntax errors in Jest
    // In Vite, import.meta.env is available, but we can't use it directly in CommonJS/Jest
    if (typeof globalThis !== 'undefined' && (globalThis as any).__VITE_ENV__) {
      return (globalThis as any).__VITE_ENV__[key];
    }

    return undefined;
  }

  /**
   * Parse relay environment variable
   * Format: comma-separated list of URLs
   * Example: "wss://relay1.com,wss://relay2.com,wss://relay3.com"
   */
  private static parseRelayEnv(envValue: string): RelayMetadata[] {
    if (!envValue || typeof envValue !== 'string') {
      return [];
    }

    // Split by comma and normalize
    const urls = envValue
      .split(',')
      .map(url => this.normalizeRelayUrl(url))
      .filter((url): url is string => url !== null);

    // Convert to relay metadata (default to read+write)
    return urls.map(url => ({
      url,
      read: true,
      write: true,
    }));
  }
}

/**
 * Export default relays constant for backward compatibility
 * @deprecated Use RelayConfig.getDefaultRelays() instead
 */
export const DEFAULT_RELAYS_LEGACY = DEFAULT_RELAYS;

/**
 * Convenience function to get relay URLs
 * @deprecated Use RelayConfig.getRelayUrls() instead
 */
export function getRelayUrls(): string[] {
  return RelayConfig.getRelayUrls();
}

/**
 * Convenience function to get relay metadata
 */
export function getRelays(): RelayMetadata[] {
  return RelayConfig.getRelays();
}

/**
 * Convenience function to get read relays
 */
export function getReadRelays(): string[] {
  return RelayConfig.getReadRelays();
}

/**
 * Convenience function to get write relays
 */
export function getWriteRelays(): string[] {
  return RelayConfig.getWriteRelays();
}
