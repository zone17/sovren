/**
 * 🌐 ELITE SERVICE: Relay Pool Manager
 *
 * Centralized NOSTR relay connection pool manager with:
 * - Singleton pattern for shared connection pool
 * - Multi-relay support with automatic failover
 * - Health monitoring and performance tracking
 * - Automatic reconnection with exponential backoff
 * - Event deduplication and aggregation
 * - Relay selection (fastest/healthiest)
 * - NIP-65 relay discovery support
 *
 * @example
 * ```typescript
 * const manager = RelayPoolManager.getInstance();
 * await manager.initialize({ relays: ['wss://relay.damus.io'] });
 * await manager.connectAll();
 *
 * // Publish event
 * await manager.publishEvent(event);
 *
 * // Subscribe to events
 * const subId = manager.subscribe([{ kinds: [1], limit: 10 }], (event) => {
 *   console.log('Received:', event);
 * });
 * ```
 */

import { EventEmitter } from 'events';
import { SimplePool, Event as NostrEvent, Filter } from 'nostr-tools';
import { RelayConfig } from '@shared/config/relay-config';
import {
  RelayPoolConfig,
  RelayConnection,
  RelayStatus,
  RelayHealth,
  RelayHealthInfo,
  RelayMetrics,
  RelayTag,
  PublishResult,
  SubscriptionOptions,
  ActiveSubscription,
  ConnectionOptions,
  MetricsUpdate,
  RelayPoolEvents,
  DiscoveredRelay,
  RelayDiscoveryOptions,
} from './types';

/**
 * Default relay pool configuration
 */
const DEFAULT_CONFIG = {
  maxRelays: 10,
  connectionTimeout: 5000,
  healthCheckInterval: 30000,
  maxReconnectAttempts: 5,
  autoReconnect: true,
  enableHealthMonitoring: true,
  enableDeduplication: true,
};

export class RelayPoolManager extends EventEmitter {
  private static instance: RelayPoolManager;
  private pool: SimplePool;
  private config: RelayPoolConfig & typeof DEFAULT_CONFIG;
  private connections: Map<string, RelayConnection> = new Map();
  private subscriptions: Map<string, ActiveSubscription> = new Map();
  private seenEventIds: Set<string> = new Set();
  private healthCheckTimer?: NodeJS.Timeout;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  private constructor() {
    super();
    this.pool = new SimplePool();
    this.config = { ...DEFAULT_CONFIG, relays: [] };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RelayPoolManager {
    if (!RelayPoolManager.instance) {
      RelayPoolManager.instance = new RelayPoolManager();
    }
    return RelayPoolManager.instance;
  }

  /**
   * Initialize the relay pool manager
   */
  public async initialize(config?: Partial<RelayPoolConfig>): Promise<void> {
    if (this.isInitialized) {
      console.warn('⚠️ RelayPoolManager already initialized');
      return;
    }

    // Build configuration - use centralized RelayConfig
    const relays = config?.relays || RelayConfig.getRelayUrls();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      relays,
    };

    // Validate relay URLs
    this.validateRelayUrls(this.config.relays);

    // Initialize relay connections
    for (const url of this.config.relays) {
      this.connections.set(url, this.createRelayConnection(url));
    }

    // Start health monitoring if enabled
    if (this.config.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }

    this.isInitialized = true;
    console.log(`🌐 RelayPoolManager initialized with ${this.config.relays.length} relays`);
  }

  /**
   * Connect to all configured relays
   */
  public async connectAll(): Promise<void> {
    const connectionPromises = Array.from(this.connections.keys())
      .slice(0, this.config.maxRelays)
      .map(url => this.connect(url));

    await Promise.allSettled(connectionPromises);
  }

  /**
   * Connect to a specific relay
   */
  public async connect(url: string, options?: ConnectionOptions): Promise<void> {
    const connection = this.connections.get(url);
    if (!connection) {
      throw new Error(`Relay not configured: ${url}`);
    }

    if (connection.status === RelayStatus.CONNECTED) {
      return;
    }

    connection.status = RelayStatus.CONNECTING;
    const startTime = Date.now();

    try {
      await this.pool.ensureRelay(url);

      connection.status = RelayStatus.CONNECTED;
      connection.connectedAt = Date.now();
      connection.reconnectAttempts = 0;

      // Update metrics
      this.updateMetrics(url, {
        latency: Date.now() - startTime,
        success: true,
      });

      this.emit('relay:connected', url);
      console.log(`✅ Connected to relay: ${url}`);
    } catch (error) {
      connection.status = RelayStatus.ERROR;
      connection.disconnectedAt = Date.now();

      this.updateMetrics(url, {
        latency: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.emit('relay:error', url, error instanceof Error ? error : new Error('Connection failed'));
      console.error(`❌ Failed to connect to relay: ${url}`, error);

      // Schedule reconnection if enabled
      if (this.config.autoReconnect || options?.autoReconnect) {
        this.scheduleReconnect(url);
      }
    }
  }

  /**
   * Disconnect from a specific relay
   */
  public async disconnect(url: string): Promise<void> {
    const connection = this.connections.get(url);
    if (!connection) {
      return;
    }

    // Clear reconnect timer if exists
    const timer = this.reconnectTimers.get(url);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(url);
    }

    connection.status = RelayStatus.DISCONNECTED;
    connection.disconnectedAt = Date.now();

    this.pool.close([url]);
    this.emit('relay:disconnected', url);
    console.log(`🔌 Disconnected from relay: ${url}`);
  }

  /**
   * Disconnect from all relays
   */
  public async disconnectAll(): Promise<void> {
    const urls = Array.from(this.connections.keys());
    await Promise.all(urls.map(url => this.disconnect(url)));
  }

  /**
   * Publish event to relays
   */
  public async publishEvent(
    event: NostrEvent,
    relays?: string[]
  ): Promise<PublishResult[]> {
    const targetRelays = relays || this.getConnectedRelays();

    if (targetRelays.length === 0) {
      throw new Error('No connected relays available for publishing');
    }

    const results: PublishResult[] = [];
    const publishPromises = targetRelays.map(async relay => {
      const startTime = Date.now();

      try {
        await this.pool.publish([relay], event);

        const result: PublishResult = {
          relay,
          success: true,
          latency: Date.now() - startTime,
        };

        this.updateMetrics(relay, {
          latency: result.latency,
          success: true,
        });

        results.push(result);
      } catch (error) {
        const result: PublishResult = {
          relay,
          success: false,
          error: error instanceof Error ? error : new Error('Publish failed'),
          latency: Date.now() - startTime,
        };

        this.updateMetrics(relay, {
          latency: result.latency,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        results.push(result);
      }
    });

    await Promise.allSettled(publishPromises);

    this.emit('event:published', event, results);
    return results;
  }

  /**
   * Publish event to fastest relays
   */
  public async publishEventToFastest(
    event: NostrEvent,
    count: number = 3
  ): Promise<PublishResult[]> {
    const fastestRelays = this.getFastestRelays(count);
    return this.publishEvent(event, fastestRelays);
  }

  /**
   * Publish event with retry logic
   */
  public async publishEventWithRetry(
    event: NostrEvent,
    maxRetries: number = 3
  ): Promise<PublishResult[]> {
    let lastResults: PublishResult[] = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      lastResults = await this.publishEvent(event);

      const successCount = lastResults.filter(r => r.success).length;
      if (successCount > 0) {
        return lastResults;
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return lastResults;
  }

  /**
   * Subscribe to events
   */
  public subscribe(
    filters: Filter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const relays = this.getConnectedRelays();

    if (relays.length === 0) {
      throw new Error('No connected relays available for subscription');
    }

    const sub = this.pool.subscribeMany(relays, filters, {
      onevent: (event: NostrEvent) => {
        // Deduplicate events
        if (this.config.enableDeduplication) {
          if (this.seenEventIds.has(event.id)) {
            return;
          }
          this.seenEventIds.add(event.id);

          // Cleanup old event IDs (keep last 10000)
          if (this.seenEventIds.size > 10000) {
            const idsArray = Array.from(this.seenEventIds);
            this.seenEventIds = new Set(idsArray.slice(-10000));
          }
        }

        onEvent(event);
        this.emit('event:received', event, 'pool');
      },
      oneose: () => {
        if (onEose) {
          onEose();
        }
      },
    });

    // Store subscription
    const subscription: ActiveSubscription = {
      id: subscriptionId,
      filters,
      relays,
      createdAt: Date.now(),
      onEvent,
      onEose,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.emit('subscription:created', subscriptionId);

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    this.subscriptions.delete(subscriptionId);
    this.emit('subscription:closed', subscriptionId);
  }

  /**
   * Get fastest relay
   */
  public getFastestRelay(): string | undefined {
    return this.getFastestRelays(1)[0];
  }

  /**
   * Get fastest relays
   */
  public getFastestRelays(count: number): string[] {
    const connected = this.getConnectedRelays();

    return connected
      .map(url => ({
        url,
        latency: this.connections.get(url)!.health.metrics.latency,
      }))
      .sort((a, b) => a.latency - b.latency)
      .slice(0, count)
      .map(item => item.url);
  }

  /**
   * Get healthiest relay
   */
  public getHealthiestRelay(): string | undefined {
    const connected = this.getConnectedRelays();

    const sorted = connected
      .map(url => ({
        url,
        score: this.connections.get(url)!.health.score,
      }))
      .sort((a, b) => b.score - a.score);

    return sorted[0]?.url;
  }

  /**
   * Get relay health information
   */
  public getRelayHealth(url: string): RelayHealthInfo {
    const connection = this.connections.get(url);
    if (!connection) {
      throw new Error(`Relay not found: ${url}`);
    }

    return connection.health;
  }

  /**
   * Get relay status
   */
  public getRelayStatus(url: string): RelayStatus {
    const connection = this.connections.get(url);
    return connection?.status || RelayStatus.DISCONNECTED;
  }

  /**
   * Get connected relays
   */
  public getConnectedRelays(): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.status === RelayStatus.CONNECTED)
      .map(([url]) => url);
  }

  /**
   * Get configured relays
   */
  public getConfiguredRelays(): string[] {
    return this.config.relays;
  }

  /**
   * Get active subscriptions
   */
  public getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get reconnect attempts for a relay
   */
  public getReconnectAttempts(url: string): number {
    const connection = this.connections.get(url);
    return connection?.reconnectAttempts || 0;
  }

  /**
   * Add relay to pool
   */
  public async addRelay(url: string, tag: RelayTag = 'both'): Promise<void> {
    this.validateRelayUrls([url]);

    if (this.connections.has(url)) {
      console.warn(`⚠️ Relay already exists: ${url}`);
      return;
    }

    const connection = this.createRelayConnection(url, tag);
    this.connections.set(url, connection);
    this.config.relays.push(url);

    console.log(`➕ Added relay: ${url}`);
  }

  /**
   * Remove relay from pool
   */
  public async removeRelay(url: string): Promise<void> {
    await this.disconnect(url);

    this.connections.delete(url);
    this.config.relays = this.config.relays.filter(r => r !== url);

    console.log(`➖ Removed relay: ${url}`);
  }

  /**
   * Set relay tag
   */
  public setRelayTag(url: string, tag: RelayTag): void {
    const connection = this.connections.get(url);
    if (!connection) {
      throw new Error(`Relay not found: ${url}`);
    }

    connection.tag = tag;
  }

  /**
   * Get relays by tag
   */
  public getRelaysByTag(tag: RelayTag): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.tag === tag || conn.tag === 'both')
      .map(([url]) => url);
  }

  /**
   * Update relay metrics
   */
  public updateRelayMetrics(url: string, update: MetricsUpdate): void {
    this.updateMetrics(url, update);
  }

  /**
   * Handle relay disconnect (for testing)
   */
  public handleRelayDisconnect(url: string): void {
    const connection = this.connections.get(url);
    if (!connection) {
      return;
    }

    connection.status = RelayStatus.ERROR;
    connection.disconnectedAt = Date.now();

    if (this.config.autoReconnect) {
      this.scheduleReconnect(url);
    }
  }

  /**
   * Destroy the manager and cleanup resources
   */
  public async destroy(): Promise<void> {
    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
    }

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Close all subscriptions
    for (const subId of this.subscriptions.keys()) {
      this.unsubscribe(subId);
    }

    // Disconnect all relays
    await this.disconnectAll();

    // Clear collections
    this.connections.clear();
    this.seenEventIds.clear();

    this.isInitialized = false;
    console.log('🔥 RelayPoolManager destroyed');
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private createRelayConnection(url: string, tag: RelayTag = 'both'): RelayConnection {
    return {
      url,
      status: RelayStatus.DISCONNECTED,
      tag,
      reconnectAttempts: 0,
      health: {
        url,
        status: RelayHealth.HEALTHY,
        score: 100,
        metrics: {
          latency: 0,
          successRate: 100,
          uptime: 100,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
        },
        lastCheck: Date.now(),
      },
    };
  }

  private validateRelayUrls(urls: string[]): void {
    for (const url of urls) {
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        throw new Error(`Invalid relay URL (must start with wss:// or ws://): ${url}`);
      }

      try {
        new URL(url);
      } catch {
        throw new Error(`Invalid relay URL format: ${url}`);
      }
    }
  }

  /**
   * @deprecated Use RelayConfig.getRelayUrls() instead
   * Kept for backward compatibility
   */
  private getRelaysFromEnv(): string[] | undefined {
    return RelayConfig.getRelayUrls();
  }

  private scheduleReconnect(url: string): void {
    const connection = this.connections.get(url);
    if (!connection) {
      return;
    }

    if (connection.reconnectAttempts >= this.config.maxReconnectAttempts) {
      connection.status = RelayStatus.FAILED;
      console.error(`❌ Max reconnection attempts reached for: ${url}`);
      return;
    }

    connection.status = RelayStatus.RECONNECTING;
    connection.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.pow(2, connection.reconnectAttempts - 1) * 1000;

    this.emit('relay:reconnecting', url, connection.reconnectAttempts);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(url);
      this.connect(url).catch(error => {
        console.error(`Reconnection failed for ${url}:`, error);
      });
    }, delay);

    this.reconnectTimers.set(url, timer);
  }

  private updateMetrics(url: string, update: MetricsUpdate): void {
    const connection = this.connections.get(url);
    if (!connection) {
      return;
    }

    const metrics = connection.health.metrics;

    // Update counters
    metrics.totalRequests++;
    if (update.success) {
      metrics.successfulRequests++;
      metrics.lastSuccess = Date.now();
    } else {
      metrics.failedRequests++;
      metrics.lastError = Date.now();
      metrics.lastErrorMessage = update.error;
    }

    // Update success rate (moving average)
    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;

    // Update latency (exponential moving average)
    if (metrics.latency === 0) {
      metrics.latency = update.latency;
    } else {
      metrics.latency = metrics.latency * 0.8 + update.latency * 0.2;
    }

    // Calculate uptime
    const now = Date.now();
    const connectedTime = connection.connectedAt || now;
    const totalTime = now - connectedTime;
    const disconnectedTime = connection.disconnectedAt
      ? now - connection.disconnectedAt
      : 0;
    metrics.uptime = totalTime > 0 ? ((totalTime - disconnectedTime) / totalTime) * 100 : 100;

    // Update health score and status
    this.calculateHealthScore(connection);
  }

  private calculateHealthScore(connection: RelayConnection): void {
    const metrics = connection.health.metrics;

    // Latency score (0-100)
    let latencyScore = 100;
    if (metrics.latency > 2000) latencyScore = 0;
    else if (metrics.latency > 1000) latencyScore = 50;
    else if (metrics.latency > 500) latencyScore = 75;

    // Success rate score (0-100)
    let successScore = 0;
    if (metrics.successRate > 95) successScore = 100;
    else if (metrics.successRate > 80) successScore = 75;
    else if (metrics.successRate > 60) successScore = 50;

    // Uptime score (0-100)
    let uptimeScore = 50;
    if (metrics.uptime > 99) uptimeScore = 100;
    else if (metrics.uptime > 90) uptimeScore = 75;

    // Connection status score (0-100)
    const statusScore = connection.status === RelayStatus.CONNECTED ? 100 : 0;

    // Weighted overall score
    const weights = { latency: 0.3, success: 0.3, uptime: 0.2, status: 0.2 };
    const score =
      latencyScore * weights.latency +
      successScore * weights.success +
      uptimeScore * weights.uptime +
      statusScore * weights.status;

    connection.health.score = Math.round(score);

    // Determine health status
    const previousStatus = connection.health.status;
    if (score > 80) {
      connection.health.status = RelayHealth.HEALTHY;
    } else if (score > 50) {
      connection.health.status = RelayHealth.DEGRADED;
    } else {
      connection.health.status = RelayHealth.UNHEALTHY;
    }

    // Emit event if health status changed
    if (previousStatus !== connection.health.status) {
      this.emit('relay:health:changed', connection.url, connection.health.status);
    }

    connection.health.lastCheck = Date.now();
  }

  private startHealthMonitoring(): void {
    const performCheck = () => {
      this.performHealthCheck();

      this.healthCheckTimer = setTimeout(
        performCheck,
        this.config.healthCheckInterval
      );
    };

    performCheck();
  }

  private performHealthCheck(): void {
    for (const connection of this.connections.values()) {
      if (connection.status === RelayStatus.CONNECTED) {
        // Recalculate health score based on current metrics
        this.calculateHealthScore(connection);
      }
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Export singleton instance
export const relayPoolManager = RelayPoolManager.getInstance();

// Re-export types and enums
export { RelayStatus, RelayHealth } from './types';
