/**
 * 🧪 ELITE TESTS: Relay Configuration
 * US-309: Remove Hardcoded Relay URLs
 *
 * Comprehensive test suite for centralized relay configuration.
 * Validates environment-based configuration, fallbacks, and URL validation.
 *
 * Coverage Target: 95%+
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RelayConfig, getRelayUrls, getRelays, getReadRelays, getWriteRelays } from '../relay-config';
import type { RelayMetadata } from '@shared/types/nostr';

describe('RelayConfig', () => {
  // Store original env
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store and clear environment
    originalEnv = { ...process.env };
    delete process.env.NOSTR_RELAYS;
    delete process.env.VITE_NOSTR_RELAYS;

    // Clear cache before each test
    RelayConfig.clearCache();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    RelayConfig.clearCache();
  });

  describe('getRelays()', () => {
    it('should return default relays when no environment config', () => {
      delete process.env.NOSTR_RELAYS;
      delete process.env.VITE_NOSTR_RELAYS;

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(5);
      expect(relays[0]).toHaveProperty('url');
      expect(relays[0]).toHaveProperty('read');
      expect(relays[0]).toHaveProperty('write');
      expect(relays[0].url).toBe('wss://relay.damus.io');
    });

    it('should load relays from VITE_NOSTR_RELAYS environment variable', () => {
      const customRelays = 'wss://custom1.com,wss://custom2.com';
      process.env.VITE_NOSTR_RELAYS = customRelays;

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays[0].url).toBe('wss://custom1.com');
      expect(relays[1].url).toBe('wss://custom2.com');
      expect(relays[0].read).toBe(true);
      expect(relays[0].write).toBe(true);
    });

    it('should load relays from NOSTR_RELAYS environment variable', () => {
      const customRelays = 'wss://relay1.com,wss://relay2.com,wss://relay3.com';
      process.env.NOSTR_RELAYS = customRelays;

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(3);
      expect(relays[0].url).toBe('wss://relay1.com');
      expect(relays[1].url).toBe('wss://relay2.com');
      expect(relays[2].url).toBe('wss://relay3.com');
    });

    it('should cache relays after first load', () => {
      const relays1 = RelayConfig.getRelays();
      const relays2 = RelayConfig.getRelays();

      expect(relays1).toEqual(relays2);
      expect(relays1).not.toBe(relays2); // Should be a copy, not same reference
    });

    it('should return a copy of cached relays (immutability)', () => {
      const relays1 = RelayConfig.getRelays();
      const relays2 = RelayConfig.getRelays();

      relays1.push({ url: 'wss://modified.com', read: true, write: true });

      expect(relays1).toHaveLength(relays2.length + 1);
      expect(relays2).not.toContainEqual({ url: 'wss://modified.com', read: true, write: true });
    });

    it('should handle whitespace in environment relay URLs', () => {
      process.env.NOSTR_RELAYS = '  wss://relay1.com  ,  wss://relay2.com  ';

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays[0].url).toBe('wss://relay1.com');
      expect(relays[1].url).toBe('wss://relay2.com');
    });

    it('should handle trailing slashes in relay URLs', () => {
      process.env.NOSTR_RELAYS = 'wss://relay1.com/,wss://relay2.com/';

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays[0].url).toBe('wss://relay1.com');
      expect(relays[1].url).toBe('wss://relay2.com');
    });

    it('should filter out invalid relay URLs from environment', () => {
      process.env.NOSTR_RELAYS = 'wss://valid.com,invalid-url,https://wrong-protocol.com,wss://valid2.com';

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays[0].url).toBe('wss://valid.com');
      expect(relays[1].url).toBe('wss://valid2.com');
    });

    it('should handle empty environment variable', () => {
      process.env.NOSTR_RELAYS = '';

      const relays = RelayConfig.getRelays();

      // Should fall back to defaults
      expect(relays).toHaveLength(5);
      expect(relays[0].url).toBe('wss://relay.damus.io');
    });
  });

  describe('getRelayUrls()', () => {
    it('should return array of relay URLs', () => {
      const urls = RelayConfig.getRelayUrls();

      expect(urls).toBeInstanceOf(Array);
      expect(urls.every(url => typeof url === 'string')).toBe(true);
      expect(urls.every(url => url.startsWith('wss://'))).toBe(true);
    });

    it('should match URLs from getRelays()', () => {
      const relays = RelayConfig.getRelays();
      const urls = RelayConfig.getRelayUrls();

      expect(urls).toEqual(relays.map(r => r.url));
    });
  });

  describe('getReadRelays()', () => {
    it('should return only relays with read capability', () => {
      const customRelays: RelayMetadata[] = [
        { url: 'wss://read-write.com', read: true, write: true },
        { url: 'wss://read-only.com', read: true, write: false },
        { url: 'wss://write-only.com', read: false, write: true },
      ];

      RelayConfig.setRelays(customRelays);
      const readRelays = RelayConfig.getReadRelays();

      expect(readRelays).toHaveLength(2);
      expect(readRelays).toContain('wss://read-write.com');
      expect(readRelays).toContain('wss://read-only.com');
      expect(readRelays).not.toContain('wss://write-only.com');
    });

    it('should return empty array if no read relays', () => {
      const customRelays: RelayMetadata[] = [
        { url: 'wss://write-only.com', read: false, write: true },
      ];

      RelayConfig.setRelays(customRelays);
      const readRelays = RelayConfig.getReadRelays();

      expect(readRelays).toHaveLength(0);
    });
  });

  describe('getWriteRelays()', () => {
    it('should return only relays with write capability', () => {
      const customRelays: RelayMetadata[] = [
        { url: 'wss://read-write.com', read: true, write: true },
        { url: 'wss://read-only.com', read: true, write: false },
        { url: 'wss://write-only.com', read: false, write: true },
      ];

      RelayConfig.setRelays(customRelays);
      const writeRelays = RelayConfig.getWriteRelays();

      expect(writeRelays).toHaveLength(2);
      expect(writeRelays).toContain('wss://read-write.com');
      expect(writeRelays).toContain('wss://write-only.com');
      expect(writeRelays).not.toContain('wss://read-only.com');
    });

    it('should return empty array if no write relays', () => {
      const customRelays: RelayMetadata[] = [
        { url: 'wss://read-only.com', read: true, write: false },
      ];

      RelayConfig.setRelays(customRelays);
      const writeRelays = RelayConfig.getWriteRelays();

      expect(writeRelays).toHaveLength(0);
    });
  });

  describe('getDefaultRelays()', () => {
    it('should return default relays ignoring environment', () => {
      process.env.NOSTR_RELAYS = 'wss://custom.com';

      const defaults = RelayConfig.getDefaultRelays();

      expect(defaults).toHaveLength(5);
      expect(defaults[0].url).toBe('wss://relay.damus.io');
      // Check that defaults have read and write capabilities (some may be read-only or write-only)
      expect(defaults.every(r => r.read || r.write)).toBe(true);
      expect(defaults.filter(r => r.read).length).toBeGreaterThan(0);
      expect(defaults.filter(r => r.write).length).toBeGreaterThan(0);
    });

    it('should return immutable copy of defaults', () => {
      const defaults1 = RelayConfig.getDefaultRelays();
      const defaults2 = RelayConfig.getDefaultRelays();

      defaults1.push({ url: 'wss://modified.com', read: true, write: true });

      expect(defaults1).toHaveLength(defaults2.length + 1);
      expect(defaults2).not.toContainEqual({ url: 'wss://modified.com', read: true, write: true });
    });
  });

  describe('isValidRelayUrl()', () => {
    it('should validate wss:// URLs', () => {
      expect(RelayConfig.isValidRelayUrl('wss://relay.damus.io')).toBe(true);
      expect(RelayConfig.isValidRelayUrl('wss://nos.lol')).toBe(true);
      expect(RelayConfig.isValidRelayUrl('wss://relay.snort.social:7777')).toBe(true);
    });

    it('should validate ws:// URLs', () => {
      expect(RelayConfig.isValidRelayUrl('ws://localhost:7000')).toBe(true);
      expect(RelayConfig.isValidRelayUrl('ws://relay.local')).toBe(true);
    });

    it('should reject non-websocket protocols', () => {
      expect(RelayConfig.isValidRelayUrl('http://relay.com')).toBe(false);
      expect(RelayConfig.isValidRelayUrl('https://relay.com')).toBe(false);
      expect(RelayConfig.isValidRelayUrl('ftp://relay.com')).toBe(false);
    });

    it('should reject invalid URL formats', () => {
      expect(RelayConfig.isValidRelayUrl('not-a-url')).toBe(false);
      expect(RelayConfig.isValidRelayUrl('wss://')).toBe(false);
      expect(RelayConfig.isValidRelayUrl('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      // @ts-expect-error - Testing invalid input
      expect(RelayConfig.isValidRelayUrl(null)).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(RelayConfig.isValidRelayUrl(undefined)).toBe(false);
    });

    it('should reject non-string values', () => {
      // @ts-expect-error - Testing invalid input
      expect(RelayConfig.isValidRelayUrl(123)).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(RelayConfig.isValidRelayUrl({})).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(RelayConfig.isValidRelayUrl([])).toBe(false);
    });
  });

  describe('normalizeRelayUrl()', () => {
    it('should remove trailing slashes', () => {
      expect(RelayConfig.normalizeRelayUrl('wss://relay.com/')).toBe('wss://relay.com');
      expect(RelayConfig.normalizeRelayUrl('wss://relay.com///')).toBe('wss://relay.com');
    });

    it('should trim whitespace', () => {
      expect(RelayConfig.normalizeRelayUrl('  wss://relay.com  ')).toBe('wss://relay.com');
      expect(RelayConfig.normalizeRelayUrl('\t\nwss://relay.com\n\t')).toBe('wss://relay.com');
    });

    it('should return null for invalid URLs', () => {
      expect(RelayConfig.normalizeRelayUrl('invalid-url')).toBe(null);
      expect(RelayConfig.normalizeRelayUrl('http://wrong-protocol.com')).toBe(null);
      expect(RelayConfig.normalizeRelayUrl('')).toBe(null);
    });

    it('should handle complex valid URLs', () => {
      expect(RelayConfig.normalizeRelayUrl('wss://relay.example.com:7777/path')).toBe('wss://relay.example.com:7777/path');
    });

    it('should return null for null/undefined', () => {
      // @ts-expect-error - Testing invalid input
      expect(RelayConfig.normalizeRelayUrl(null)).toBe(null);
      // @ts-expect-error - Testing invalid input
      expect(RelayConfig.normalizeRelayUrl(undefined)).toBe(null);
    });
  });

  describe('clearCache()', () => {
    it('should clear cached relays', () => {
      process.env.NOSTR_RELAYS = 'wss://relay1.com';

      const relays1 = RelayConfig.getRelays();
      expect(relays1).toHaveLength(1);

      process.env.NOSTR_RELAYS = 'wss://relay2.com,wss://relay3.com';

      // Still cached, should return 1
      const relays2 = RelayConfig.getRelays();
      expect(relays2).toHaveLength(1);

      RelayConfig.clearCache();

      // Should reload from env
      const relays3 = RelayConfig.getRelays();
      expect(relays3).toHaveLength(2);
      expect(relays3[0].url).toBe('wss://relay2.com');
    });
  });

  describe('setRelays()', () => {
    it('should set custom relay configuration', () => {
      const customRelays: RelayMetadata[] = [
        { url: 'wss://custom1.com', read: true, write: true },
        { url: 'wss://custom2.com', read: true, write: false },
      ];

      RelayConfig.setRelays(customRelays);
      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays[0].url).toBe('wss://custom1.com');
      expect(relays[1].url).toBe('wss://custom2.com');
    });

    it('should filter out invalid relay URLs', () => {
      const mixedRelays: RelayMetadata[] = [
        { url: 'wss://valid.com', read: true, write: true },
        { url: 'invalid-url', read: true, write: true },
        { url: 'wss://valid2.com', read: true, write: false },
      ];

      RelayConfig.setRelays(mixedRelays);
      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays.map(r => r.url)).toEqual(['wss://valid.com', 'wss://valid2.com']);
    });

    it('should override cached relays', () => {
      // Ensure environment is clear for consistent defaults
      delete process.env.NOSTR_RELAYS;
      delete process.env.VITE_NOSTR_RELAYS;
      RelayConfig.clearCache();

      const relays1 = RelayConfig.getRelays(); // Load defaults
      expect(relays1.length).toBeGreaterThan(0);

      const customRelays: RelayMetadata[] = [
        { url: 'wss://custom.com', read: true, write: true },
      ];

      RelayConfig.setRelays(customRelays);
      const relays2 = RelayConfig.getRelays();

      expect(relays2).toHaveLength(1);
      expect(relays2[0].url).toBe('wss://custom.com');
    });
  });

  describe('convenience functions', () => {
    it('getRelayUrls() should match RelayConfig.getRelayUrls()', () => {
      const urls1 = getRelayUrls();
      const urls2 = RelayConfig.getRelayUrls();

      expect(urls1).toEqual(urls2);
    });

    it('getRelays() should match RelayConfig.getRelays()', () => {
      const relays1 = getRelays();
      const relays2 = RelayConfig.getRelays();

      expect(relays1).toEqual(relays2);
    });

    it('getReadRelays() should match RelayConfig.getReadRelays()', () => {
      const readRelays1 = getReadRelays();
      const readRelays2 = RelayConfig.getReadRelays();

      expect(readRelays1).toEqual(readRelays2);
    });

    it('getWriteRelays() should match RelayConfig.getWriteRelays()', () => {
      const writeRelays1 = getWriteRelays();
      const writeRelays2 = RelayConfig.getWriteRelays();

      expect(writeRelays1).toEqual(writeRelays2);
    });
  });

  describe('edge cases', () => {
    it('should handle environment with only commas', () => {
      process.env.NOSTR_RELAYS = ',,,';

      const relays = RelayConfig.getRelays();

      // Should fall back to defaults
      expect(relays).toHaveLength(5);
    });

    it('should handle mixed valid/invalid URLs', () => {
      process.env.NOSTR_RELAYS = 'wss://valid.com,,,invalid,wss://valid2.com,';

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays.map(r => r.url)).toEqual(['wss://valid.com', 'wss://valid2.com']);
    });

    it('should handle very long relay lists', () => {
      const longList = Array.from({ length: 100 }, (_, i) => `wss://relay${i}.com`).join(',');
      process.env.NOSTR_RELAYS = longList;

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(100);
    });

    it('should handle URLs with special characters', () => {
      process.env.NOSTR_RELAYS = 'wss://relay-with-dash.com,wss://relay_with_underscore.com';

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays[0].url).toBe('wss://relay-with-dash.com');
      expect(relays[1].url).toBe('wss://relay_with_underscore.com');
    });

    it('should preserve ws:// protocol (not only wss://)', () => {
      process.env.NOSTR_RELAYS = 'ws://localhost:7000,wss://production.com';

      const relays = RelayConfig.getRelays();

      expect(relays).toHaveLength(2);
      expect(relays[0].url).toBe('ws://localhost:7000');
      expect(relays[1].url).toBe('wss://production.com');
    });
  });
});
