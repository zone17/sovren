/**
 * 🔌 ELITE SERVICE: WebSocket Connection Pool
 *
 * US-320: WebSocket Connection Manager
 * Epic 003: NOSTR Consolidation
 *
 * Advanced connection pooling with:
 * - Multiple connections per relay
 * - Intelligent load balancing (round-robin, least-loaded, healthiest)
 * - Connection reuse optimization
 * - Health-based routing
 * - Subscription distribution
 * - Pool statistics and monitoring
 *
 * @example
 * ```typescript
 * const pool = new WebSocketPool('wss://relay.example.com', {
 *   minConnections: 1,
 *   maxConnections: 3,
 *   reuseStrategy: 'least-loaded',
 * });
 *
 * await pool.initialize();
 *
 * // Get optimal connection for new subscription
 * const connection = pool.getOptimalConnection();
 *
 * // Add subscription to connection
 * pool.addSubscription(connection.metadata.id, 'sub_123');
 * ```
 */

import { EventEmitter } from 'events';
import type {
  ConnectionPoolConfig,
  WebSocketConnection,
  WebSocketOptions,
  ConnectionState,
  PoolStats,
  ConnectionLoad,
  DEFAULT_POOL_CONFIG,
} from './types/websocket';

/**
 * WebSocket Connection Pool
 *
 * Manages multiple WebSocket connections to a single relay
 * with intelligent load balancing and health-based routing
 */
export class WebSocketPool extends EventEmitter {
  private readonly relayUrl: string;
  private readonly config: ConnectionPoolConfig;
  private connections: Map<string, WebSocketConnection> = new Map();
  private nextRoundRobinIndex = 0;
  private initialized = false;

  constructor(relayUrl: string, config: Partial<ConnectionPoolConfig> = {}) {
    super();
    this.relayUrl = relayUrl;
    this.config = {
      ...DEFAULT_POOL_CONFIG,
      ...config,
    };
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn(`[WebSocketPool] Pool for ${this.relayUrl} already initialized`);
      return;
    }

    // Warm up connections if enabled
    if (this.config.enableWarmup && this.config.warmupCount > 0) {
      const warmupCount = Math.min(this.config.warmupCount, this.config.maxConnections);
      console.log(`[WebSocketPool] Warming up ${warmupCount} connections to ${this.relayUrl}`);

      // Note: Actual connection creation will be delegated to WebSocketConnectionManager
      // This just prepares the pool structure
      for (let i = 0; i < warmupCount; i++) {
        this.emit('warmup:needed', this.relayUrl);
      }
    }

    this.initialized = true;
    console.log(`[WebSocketPool] Initialized pool for ${this.relayUrl}`);
  }

  /**
   * Check if pool is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  /**
   * Add connection to pool
   */
  addConnection(connection: WebSocketConnection): void {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error(
        `Cannot add connection: pool is at maximum capacity (${this.config.maxConnections})`
      );
    }

    this.connections.set(connection.metadata.id, connection);
    this.emit('connection:added', connection.metadata.id);

    console.log(
      `[WebSocketPool] Added connection ${connection.metadata.id} to pool (${this.connections.size}/${this.config.maxConnections})`
    );
  }

  /**
   * Remove connection from pool
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.connections.delete(connectionId);
    this.emit('connection:removed', connectionId);

    console.log(
      `[WebSocketPool] Removed connection ${connectionId} from pool (${this.connections.size}/${this.config.maxConnections})`
    );
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connected connections
   */
  getConnectedConnections(): WebSocketConnection[] {
    return this.getAllConnections().filter((c) => c.state === ConnectionState.CONNECTED);
  }

  /**
   * Check if pool has capacity for new connection
   */
  hasCapacity(): boolean {
    return this.connections.size < this.config.maxConnections;
  }

  /**
   * Check if pool needs more connections (below minimum)
   */
  needsMoreConnections(): boolean {
    const connectedCount = this.getConnectedConnections().length;
    return connectedCount < this.config.minConnections;
  }

  // ============================================
  // LOAD BALANCING
  // ============================================

  /**
   * Get optimal connection for new subscription
   */
  getOptimalConnection(): WebSocketConnection | undefined {
    const connectedConnections = this.getConnectedConnections();

    if (connectedConnections.length === 0) {
      return undefined;
    }

    switch (this.config.reuseStrategy) {
      case 'round-robin':
        return this.getRoundRobinConnection(connectedConnections);
      case 'least-loaded':
        return this.getLeastLoadedConnection(connectedConnections);
      case 'healthiest':
        return this.getHealthiestConnection(connectedConnections);
      default:
        return this.getLeastLoadedConnection(connectedConnections);
    }
  }

  /**
   * Round-robin connection selection
   */
  private getRoundRobinConnection(connections: WebSocketConnection[]): WebSocketConnection {
    const connection = connections[this.nextRoundRobinIndex % connections.length];
    this.nextRoundRobinIndex++;
    return connection;
  }

  /**
   * Get least loaded connection (fewest subscriptions)
   */
  private getLeastLoadedConnection(connections: WebSocketConnection[]): WebSocketConnection {
    return connections.reduce((least, current) => {
      const leastLoad = this.calculateConnectionLoad(least);
      const currentLoad = this.calculateConnectionLoad(current);
      return currentLoad.loadScore < leastLoad.loadScore ? current : least;
    });
  }

  /**
   * Get healthiest connection (highest health score)
   */
  private getHealthiestConnection(connections: WebSocketConnection[]): WebSocketConnection {
    return connections.reduce((healthiest, current) => {
      return current.health.score > healthiest.health.score ? current : healthiest;
    });
  }

  /**
   * Calculate connection load score
   */
  private calculateConnectionLoad(connection: WebSocketConnection): ConnectionLoad {
    const subscriptionCount = connection.subscriptionIds.size;
    const healthScore = connection.health.score;
    const latency = connection.health.latency;

    // Load score: lower is better
    // Factors: subscription count (40%), inverse health (30%), latency (30%)
    const subscriptionScore = (subscriptionCount / this.config.maxSubscriptionsPerConnection) * 40;
    const healthPenalty = ((100 - healthScore) / 100) * 30;
    const latencyScore = Math.min(latency / 1000, 1) * 30; // Normalize to 0-1, max 1000ms

    const loadScore = subscriptionScore + healthPenalty + latencyScore;

    return {
      connectionId: connection.metadata.id,
      subscriptionCount,
      healthScore,
      latency,
      loadScore,
    };
  }

  /**
   * Get all connection loads (sorted by load score)
   */
  getConnectionLoads(): ConnectionLoad[] {
    return this.getAllConnections()
      .map((c) => this.calculateConnectionLoad(c))
      .sort((a, b) => a.loadScore - b.loadScore);
  }

  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  /**
   * Add subscription to connection
   */
  addSubscription(connectionId: string, subscriptionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    if (connection.subscriptionIds.size >= this.config.maxSubscriptionsPerConnection) {
      console.warn(
        `[WebSocketPool] Connection ${connectionId} is at max subscriptions (${this.config.maxSubscriptionsPerConnection})`
      );
      return false;
    }

    connection.subscriptionIds.add(subscriptionId);
    this.emit('subscription:added', connectionId, subscriptionId);

    return true;
  }

  /**
   * Remove subscription from connection
   */
  removeSubscription(connectionId: string, subscriptionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const removed = connection.subscriptionIds.delete(subscriptionId);
    if (removed) {
      this.emit('subscription:removed', connectionId, subscriptionId);
    }

    return removed;
  }

  /**
   * Find connection for subscription
   */
  findConnectionForSubscription(subscriptionId: string): WebSocketConnection | undefined {
    return this.getAllConnections().find((c) => c.subscriptionIds.has(subscriptionId));
  }

  /**
   * Get subscriptions for connection
   */
  getSubscriptions(connectionId: string): string[] {
    const connection = this.connections.get(connectionId);
    return connection ? Array.from(connection.subscriptionIds) : [];
  }

  /**
   * Check if connection has capacity for more subscriptions
   */
  hasSubscriptionCapacity(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }
    return connection.subscriptionIds.size < this.config.maxSubscriptionsPerConnection;
  }

  // ============================================
  // POOL STATISTICS
  // ============================================

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const allConnections = this.getAllConnections();
    const connectedConnections = this.getConnectedConnections();

    const activeConnections = connectedConnections.filter(
      (c) => c.subscriptionIds.size > 0
    ).length;
    const idleConnections = connectedConnections.filter(
      (c) => c.subscriptionIds.size === 0
    ).length;
    const failedConnections = allConnections.filter(
      (c) => c.state === ConnectionState.FAILED
    ).length;

    const totalSubscriptions = allConnections.reduce(
      (sum, c) => sum + c.subscriptionIds.size,
      0
    );

    const maxPossibleSubscriptions =
      connectedConnections.length * this.config.maxSubscriptionsPerConnection;
    const utilization =
      maxPossibleSubscriptions > 0 ? (totalSubscriptions / maxPossibleSubscriptions) * 100 : 0;

    return {
      totalConnections: allConnections.length,
      activeConnections,
      idleConnections,
      failedConnections,
      totalSubscriptions,
      utilization,
    };
  }

  /**
   * Get relay URL
   */
  getRelayUrl(): string {
    return this.relayUrl;
  }

  /**
   * Get pool configuration
   */
  getConfig(): ConnectionPoolConfig {
    return { ...this.config };
  }

  // ============================================
  // HEALTH & MAINTENANCE
  // ============================================

  /**
   * Get average health score across all connections
   */
  getAverageHealthScore(): number {
    const connections = this.getConnectedConnections();
    if (connections.length === 0) {
      return 0;
    }
    const totalScore = connections.reduce((sum, c) => sum + c.health.score, 0);
    return totalScore / connections.length;
  }

  /**
   * Get average latency across all connections
   */
  getAverageLatency(): number {
    const connections = this.getConnectedConnections();
    if (connections.length === 0) {
      return 0;
    }
    const totalLatency = connections.reduce((sum, c) => sum + c.health.latency, 0);
    return totalLatency / connections.length;
  }

  /**
   * Identify underperforming connections (for quarantine)
   */
  getUnderperformingConnections(threshold: number = 30): WebSocketConnection[] {
    return this.getAllConnections().filter((c) => c.health.score < threshold);
  }

  /**
   * Rebalance subscriptions across connections
   */
  async rebalanceSubscriptions(): Promise<void> {
    // Get all connections and their loads
    const loads = this.getConnectionLoads();
    const connections = this.getAllConnections();

    if (connections.length < 2) {
      return; // No rebalancing needed with 0-1 connections
    }

    // Find overloaded and underloaded connections
    const avgLoad = loads.reduce((sum, l) => sum + l.subscriptionCount, 0) / loads.length;

    const overloaded = loads.filter((l) => l.subscriptionCount > avgLoad + 2);
    const underloaded = loads.filter((l) => l.subscriptionCount < avgLoad - 2);

    if (overloaded.length === 0 || underloaded.length === 0) {
      return; // Already balanced
    }

    console.log(`[WebSocketPool] Rebalancing subscriptions for ${this.relayUrl}`);
    this.emit('rebalance:started', this.relayUrl);

    // Emit rebalancing event (actual subscription migration handled by ConnectionManager)
    for (const over of overloaded) {
      const under = underloaded[0];
      if (!under) break;

      const connection = this.connections.get(over.connectionId);
      if (!connection) continue;

      // Calculate how many to move
      const toMove = Math.floor((over.subscriptionCount - avgLoad) / 2);

      this.emit('rebalance:needed', {
        fromConnection: over.connectionId,
        toConnection: under.connectionId,
        subscriptionCount: toMove,
      });
    }

    this.emit('rebalance:completed', this.relayUrl);
  }

  // ============================================
  // CLEANUP
  // ============================================

  /**
   * Clear all connections from pool
   */
  clear(): void {
    this.connections.clear();
    this.nextRoundRobinIndex = 0;
    this.emit('pool:cleared', this.relayUrl);
  }

  /**
   * Destroy pool and cleanup
   */
  async destroy(): Promise<void> {
    this.clear();
    this.removeAllListeners();
    this.initialized = false;
    console.log(`[WebSocketPool] Destroyed pool for ${this.relayUrl}`);
  }
}
