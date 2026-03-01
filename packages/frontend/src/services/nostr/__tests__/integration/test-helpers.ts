/**
 * 🧪 Integration Test Helpers
 * US-316: NOSTR Integration Test Suite
 *
 * Utilities for integration testing:
 * - Mock relay simulation
 * - Test data factories
 * - Performance measurement utilities
 * - Assertion helpers
 */

import type { NostrEvent, UnsignedNostrEvent, Filter } from '@sovren/shared/types/nostr';
import type { NostrEnhancedKeyPair } from '@sovren/shared/types/nostr';

/**
 * Mock Relay Server for testing
 */
export class MockRelayServer {
  private events: Map<string, NostrEvent> = new Map();
  private subscriptions: Map<string, { filters: Filter[]; callback: (event: NostrEvent) => void }> =
    new Map();
  private connected = true;
  private latency: number;

  constructor(latency: number = 100) {
    this.latency = latency;
  }

  /**
   * Simulate relay connection
   */
  connect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.connected = true;
        resolve();
      }, this.latency);
    });
  }

  /**
   * Simulate relay disconnection
   */
  disconnect(): void {
    this.connected = false;
  }

  /**
   * Check if relay is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Publish event to relay
   */
  async publishEvent(event: NostrEvent): Promise<{ success: boolean; latency: number }> {
    if (!this.connected) {
      throw new Error('Relay not connected');
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        this.events.set(event.id, event);

        // Notify subscriptions
        this.subscriptions.forEach((sub) => {
          if (this.matchesFilter(event, sub.filters)) {
            sub.callback(event);
          }
        });

        resolve({ success: true, latency: this.latency });
      }, this.latency);
    });
  }

  /**
   * Query events with filter
   */
  async queryEvents(filter: Filter): Promise<NostrEvent[]> {
    if (!this.connected) {
      throw new Error('Relay not connected');
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const results = Array.from(this.events.values()).filter((event) =>
          this.matchesFilter(event, [filter])
        );

        // Apply limit
        const limited = filter.limit ? results.slice(0, filter.limit) : results;

        resolve(limited);
      }, this.latency);
    });
  }

  /**
   * Create subscription
   */
  subscribe(filters: Filter[], callback: (event: NostrEvent) => void): string {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.subscriptions.set(subId, { filters, callback });
    return subId;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(subId: string): void {
    this.subscriptions.delete(subId);
  }

  /**
   * Check if event matches filters
   */
  private matchesFilter(event: NostrEvent, filters: Filter[]): boolean {
    return filters.some((filter) => {
      // Check kinds
      if (filter.kinds && !filter.kinds.includes(event.kind)) {
        return false;
      }

      // Check authors
      if (filter.authors && !filter.authors.includes(event.pubkey)) {
        return false;
      }

      // Check ids
      if (filter.ids && !filter.ids.includes(event.id)) {
        return false;
      }

      // Check since/until
      if (filter.since && event.created_at < filter.since) {
        return false;
      }

      if (filter.until && event.created_at > filter.until) {
        return false;
      }

      // Check tags
      if (filter['#e']) {
        const eTags = event.tags.filter(([tag]) => tag === 'e').map(([, value]) => value);
        if (!filter['#e'].some((id) => eTags.includes(id))) {
          return false;
        }
      }

      if (filter['#p']) {
        const pTags = event.tags.filter(([tag]) => tag === 'p').map(([, value]) => value);
        if (!filter['#p'].some((pubkey) => pTags.includes(pubkey))) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get relay statistics
   */
  getStats() {
    return {
      events: this.events.size,
      subscriptions: this.subscriptions.size,
      connected: this.connected,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.events.clear();
    this.subscriptions.clear();
  }
}

/**
 * Test data factory for creating NOSTR events
 */
export class TestDataFactory {
  /**
   * Create unsigned text note
   */
  static createTextNote(content: string, tags: string[][] = []): UnsignedNostrEvent {
    return {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    };
  }

  /**
   * Create profile metadata event
   */
  static createProfileMetadata(metadata: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
  }): UnsignedNostrEvent {
    return {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(metadata),
    };
  }

  /**
   * Create encrypted DM event template
   */
  static createDMTemplate(recipientPubkey: string, encryptedContent: string): UnsignedNostrEvent {
    return {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: encryptedContent,
    };
  }

  /**
   * Create reaction event
   */
  static createReaction(
    eventId: string,
    eventAuthor: string,
    emoji: string = '+'
  ): UnsignedNostrEvent {
    return {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', eventId],
        ['p', eventAuthor],
      ],
      content: emoji,
    };
  }

  /**
   * Create repost event
   */
  static createRepost(eventId: string, eventAuthor: string): UnsignedNostrEvent {
    return {
      kind: 6,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', eventId],
        ['p', eventAuthor],
      ],
      content: '',
    };
  }

  /**
   * Create deletion event
   */
  static createDeletion(eventIds: string[], reason?: string): UnsignedNostrEvent {
    const tags: string[][] = eventIds.map((id) => ['e', id]);

    return {
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: reason || '',
    };
  }

  /**
   * Create contact list event
   */
  static createContactList(
    contacts: Array<{ pubkey: string; relay?: string; petname?: string }>
  ): UnsignedNostrEvent {
    const tags = contacts.map(({ pubkey, relay, petname }) => {
      const tag = ['p', pubkey];
      if (relay) tag.push(relay);
      if (petname) tag.push(petname);
      return tag;
    });

    return {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: '',
    };
  }

  /**
   * Create relay list metadata event (NIP-65)
   */
  static createRelayListMetadata(
    relays: Array<{ url: string; read?: boolean; write?: boolean }>
  ): UnsignedNostrEvent {
    const tags = relays.map(({ url, read, write }) => {
      const tag = ['r', url];
      if (read && !write) tag.push('read');
      if (write && !read) tag.push('write');
      // If both or neither, don't add a marker (means both)
      return tag;
    });

    return {
      kind: 10002,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: '',
    };
  }

  /**
   * Create test key pair data
   */
  static createTestKeyPair(): Partial<NostrEnhancedKeyPair> {
    return {
      privateKey: 'a'.repeat(64),
      publicKey: 'b'.repeat(64),
      npub: 'npub1' + 'c'.repeat(58),
      nsec: 'nsec1' + 'd'.repeat(58),
      keyId: `test-key-${Date.now()}`,
      created: Date.now(),
      entropySource: 'web_crypto_api',
      entropyBits: 256,
      storageType: 'indexed_db',
      encrypted: true,
      securityLevel: 'enhanced',
      hardwareWalletSupported: false,
      hardwareWalletConnected: false,
      multiFactorEnabled: false,
      signatureCount: 0,
      compromised: false,
      backedUp: false,
      backupVerified: false,
      tags: ['test'],
    };
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceMeasurement {
  private measurements: Map<string, number[]> = new Map();

  /**
   * Measure async function execution time
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return { result, duration };
  }

  /**
   * Measure sync function execution time
   */
  measureSync<T>(name: string, fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return { result, duration };
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((sum, val) => sum + val, 0) / count,
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Print measurement report
   */
  printReport(): void {
    console.log('\n=== Performance Measurement Report ===\n');

    this.measurements.forEach((_, name) => {
      const stats = this.getStats(name);
      if (stats) {
        console.log(`${name}:`);
        console.log(`  Count: ${stats.count}`);
        console.log(`  Min: ${stats.min.toFixed(2)}ms`);
        console.log(`  Max: ${stats.max.toFixed(2)}ms`);
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
        console.log(`  Median: ${stats.median.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
        console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
        console.log('');
      }
    });
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }
}

/**
 * Assertion helpers for NOSTR events
 */
export class NostrAssertions {
  /**
   * Assert event is valid NOSTR event
   */
  static assertValidEvent(event: any): asserts event is NostrEvent {
    if (!event) throw new Error('Event is null or undefined');
    if (!event.id) throw new Error('Event missing id');
    if (!event.pubkey) throw new Error('Event missing pubkey');
    if (!event.sig) throw new Error('Event missing signature');
    if (typeof event.kind !== 'number') throw new Error('Event missing or invalid kind');
    if (typeof event.created_at !== 'number')
      throw new Error('Event missing or invalid created_at');
    if (!Array.isArray(event.tags)) throw new Error('Event tags must be an array');
    if (typeof event.content !== 'string') throw new Error('Event content must be a string');
  }

  /**
   * Assert event matches kind
   */
  static assertEventKind(event: NostrEvent, kind: number): void {
    if (event.kind !== kind) {
      throw new Error(`Expected event kind ${kind}, got ${event.kind}`);
    }
  }

  /**
   * Assert event has tag
   */
  static assertEventHasTag(event: NostrEvent, tagName: string, tagValue?: string): void {
    const hasTag = event.tags.some(([name, value]) => {
      if (name !== tagName) return false;
      if (tagValue && value !== tagValue) return false;
      return true;
    });

    if (!hasTag) {
      const msg = tagValue
        ? `Event missing tag [${tagName}, ${tagValue}]`
        : `Event missing tag ${tagName}`;
      throw new Error(msg);
    }
  }

  /**
   * Assert event is signed by pubkey
   */
  static assertEventSignedBy(event: NostrEvent, pubkey: string): void {
    if (event.pubkey !== pubkey) {
      throw new Error(`Event not signed by ${pubkey}, signed by ${event.pubkey}`);
    }
  }

  /**
   * Assert event is within time range
   */
  static assertEventTimeRange(
    event: NostrEvent,
    minTimestamp?: number,
    maxTimestamp?: number
  ): void {
    if (minTimestamp && event.created_at < minTimestamp) {
      throw new Error(`Event timestamp ${event.created_at} is before ${minTimestamp}`);
    }

    if (maxTimestamp && event.created_at > maxTimestamp) {
      throw new Error(`Event timestamp ${event.created_at} is after ${maxTimestamp}`);
    }
  }
}

/**
 * Wait utility
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await wait(delay);
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Create timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number, errorMsg?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg || `Timeout after ${ms}ms`)), ms)
    ),
  ]);
}
