/**
 * 🌐 Relay Fixtures for Integration Testing
 * US-318: Comprehensive Integration Tests
 *
 * Provides relay connection fixtures and utilities
 */

import { SimplePool } from 'nostr-tools';
import type { NostrEvent, NostrFilter } from '@shared/types/nostr/index';

/**
 * Relay fixture for testing
 */
export class RelayFixture {
  private pool: SimplePool;
  private relayUrl: string;
  private connected: boolean = false;

  constructor(relayUrl: string) {
    this.relayUrl = relayUrl;
    this.pool = new SimplePool();
  }

  /**
   * Connect to relay with timeout
   */
  async connect(timeoutMs: number = 5000): Promise<void> {
    try {
      await Promise.race([
        this.pool.ensureRelay(this.relayUrl),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
        ),
      ]);

      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to ${this.relayUrl}: ${error}`);
    }
  }

  /**
   * Disconnect from relay
   */
  disconnect(): void {
    this.pool.close([this.relayUrl]);
    this.connected = false;
  }

  /**
   * Publish event to relay
   */
  async publishEvent(
    event: NostrEvent,
    timeoutMs: number = 3000
  ): Promise<{ success: boolean; latency: number; error?: Error }> {
    const startTime = performance.now();

    try {
      await Promise.race([
        this.pool.publish([this.relayUrl], event),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Publish timeout')), timeoutMs)
        ),
      ]);

      const latency = performance.now() - startTime;

      return { success: true, latency };
    } catch (error) {
      const latency = performance.now() - startTime;
      return { success: false, latency, error: error as Error };
    }
  }

  /**
   * Subscribe to events with EOSE tracking
   */
  subscribe(
    filters: NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    onEOSE?: () => void
  ): { subId: string; unsubscribe: () => void } {
    const sub = this.pool.subscribeMany([this.relayUrl], filters, {
      onevent: onEvent,
      oneose: () => {
        if (onEOSE) onEOSE();
      },
    });

    const subId = Math.random().toString(36).substring(7);

    return {
      subId,
      unsubscribe: () => {
        sub.close();
      },
    };
  }

  /**
   * Query events (one-time fetch)
   */
  async queryEvents(filters: NostrFilter[], timeoutMs: number = 5000): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        sub.close();
        reject(new Error('Query timeout'));
      }, timeoutMs);

      const sub = this.pool.subscribeMany([this.relayUrl], filters, {
        onevent: (event: NostrEvent) => {
          events.push(event);
        },
        oneose: () => {
          clearTimeout(timeout);
          sub.close();
          resolve(events);
        },
      });
    });
  }

  /**
   * Check if relay is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get relay URL
   */
  getUrl(): string {
    return this.relayUrl;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.disconnect();
  }
}

/**
 * Multi-relay fixture for testing failover and redundancy
 */
export class MultiRelayFixture {
  private fixtures: RelayFixture[];
  private relayUrls: string[];

  constructor(relayUrls: string[]) {
    this.relayUrls = relayUrls;
    this.fixtures = relayUrls.map((url) => new RelayFixture(url));
  }

  /**
   * Connect to all relays
   */
  async connectAll(timeoutMs: number = 5000): Promise<{
    successful: string[];
    failed: string[];
  }> {
    const results = await Promise.allSettled(
      this.fixtures.map((fixture) => fixture.connect(timeoutMs))
    );

    const successful: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      const url = this.relayUrls[index];
      if (result.status === 'fulfilled') {
        successful.push(url);
      } else {
        failed.push(url);
      }
    });

    return { successful, failed };
  }

  /**
   * Disconnect from all relays
   */
  disconnectAll(): void {
    this.fixtures.forEach((fixture) => fixture.disconnect());
  }

  /**
   * Publish to all relays
   */
  async publishToAll(
    event: NostrEvent,
    timeoutMs: number = 3000
  ): Promise<Array<{ relay: string; success: boolean; latency: number; error?: Error }>> {
    const results = await Promise.all(
      this.fixtures.map(async (fixture) => {
        const result = await fixture.publishEvent(event, timeoutMs);
        return {
          relay: fixture.getUrl(),
          ...result,
        };
      })
    );

    return results;
  }

  /**
   * Subscribe to all relays with deduplication
   */
  subscribeAll(
    filters: NostrFilter[],
    onEvent: (event: NostrEvent, relay: string) => void,
    onEOSE?: (relay: string) => void
  ): { subIds: string[]; unsubscribeAll: () => void } {
    const subscriptions = this.fixtures.map((fixture) => {
      const url = fixture.getUrl();
      return fixture.subscribe(
        filters,
        (event) => onEvent(event, url),
        () => {
          if (onEOSE) onEOSE(url);
        }
      );
    });

    return {
      subIds: subscriptions.map((sub) => sub.subId),
      unsubscribeAll: () => {
        subscriptions.forEach((sub) => sub.unsubscribe());
      },
    };
  }

  /**
   * Get connected relay count
   */
  getConnectedCount(): number {
    return this.fixtures.filter((f) => f.isConnected()).length;
  }

  /**
   * Get connected relay URLs
   */
  getConnectedUrls(): string[] {
    return this.fixtures.filter((f) => f.isConnected()).map((f) => f.getUrl());
  }

  /**
   * Cleanup all fixtures
   */
  cleanup(): void {
    this.fixtures.forEach((fixture) => fixture.cleanup());
  }
}

/**
 * Simulated relay for offline testing
 */
export class MockRelay {
  private events: Map<string, NostrEvent> = new Map();
  private subscriptions: Map<
    string,
    { filters: NostrFilter[]; callback: (event: NostrEvent) => void }
  > = new Map();
  private connected: boolean = true;
  private latencyMs: number;

  constructor(latencyMs: number = 50) {
    this.latencyMs = latencyMs;
  }

  /**
   * Simulate connection
   */
  async connect(): Promise<void> {
    await this.simulateLatency();
    this.connected = true;
  }

  /**
   * Simulate disconnection
   */
  disconnect(): void {
    this.connected = false;
  }

  /**
   * Simulate event publish
   */
  async publishEvent(event: NostrEvent): Promise<{ success: boolean; latency: number }> {
    if (!this.connected) {
      return { success: false, latency: 0 };
    }

    const startTime = performance.now();
    await this.simulateLatency();

    // Store event
    this.events.set(event.id, event);

    // Notify subscriptions
    for (const sub of this.subscriptions.values()) {
      if (this.matchesFilters(event, sub.filters)) {
        sub.callback(event);
      }
    }

    const latency = performance.now() - startTime;
    return { success: true, latency };
  }

  /**
   * Subscribe to events
   */
  subscribe(
    filters: NostrFilter[],
    callback: (event: NostrEvent) => void
  ): { subId: string; unsubscribe: () => void } {
    const subId = Math.random().toString(36).substring(7);
    this.subscriptions.set(subId, { filters, callback });

    // Send existing matching events
    setTimeout(() => {
      for (const event of this.events.values()) {
        if (this.matchesFilters(event, filters)) {
          callback(event);
        }
      }
    }, this.latencyMs);

    return {
      subId,
      unsubscribe: () => {
        this.subscriptions.delete(subId);
      },
    };
  }

  /**
   * Check if event matches filters
   */
  private matchesFilters(event: NostrEvent, filters: NostrFilter[]): boolean {
    return filters.some((filter) => {
      if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
      if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
      if (filter.ids && !filter.ids.includes(event.id)) return false;
      if (filter.since && event.created_at < filter.since) return false;
      if (filter.until && event.created_at > filter.until) return false;
      return true;
    });
  }

  /**
   * Simulate network latency
   */
  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  /**
   * Get statistics
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
