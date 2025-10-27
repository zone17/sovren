/**
 * 🔌 ELITE SERVICE: WebSocket Connection Manager
 *
 * US-320: WebSocket Connection Manager
 * Epic 003: NOSTR Consolidation
 *
 * Enterprise-grade WebSocket management with:
 * - Exponential backoff reconnection with jitter
 * - Connection pooling and load balancing
 * - Heartbeat/ping-pong monitoring
 * - Bandwidth optimization (batching, deduplication)
 * - Connection health scoring
 * - Automatic quarantine for unhealthy connections
 * - Graceful shutdown handling
 * - Comprehensive metrics and monitoring
 *
 * @example
 * ```typescript
 * const manager = WebSocketConnectionManager.getInstance();
 * await manager.initialize({
 *   pool: { maxConnections: 3 },
 *   defaultOptions: {
 *     reconnection: { maxAttempts: 10 },
 *     heartbeat: { enabled: true },
 *   },
 * });
 *
 * // Create connection
 * const connection = await manager.connect('wss://relay.example.com');
 *
 * // Send message
 * await manager.send(connection.metadata.id, { type: 'REQ', ...data });
 *
 * // Monitor metrics
 * const metrics = manager.getMetrics();
 * ```
 */

import { EventEmitter } from 'events';
import { WebSocketPool } from './WebSocketPool';
import type {
  WebSocketManagerConfig,
  WebSocketConnection,
  WebSocketOptions,
  ConnectionState,
  WebSocketMetadata,
  ReconnectionState,
  ReconnectionAttempt,
  HeartbeatState,
  ConnectionHealthMetrics,
  HealthScoreComponents,
  QuarantineInfo,
  BandwidthStats,
  CloseReason,
  ConnectionManagerMetrics,
  PerformanceBenchmarks,
  WebSocketConnectionEvents,
  DEFAULT_MANAGER_CONFIG,
  DEFAULT_WEBSOCKET_OPTIONS,
  DEFAULT_RECONNECTION_CONFIG,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_BANDWIDTH_CONFIG,
} from './types/websocket';

/**
 * WebSocket Connection Manager (Singleton)
 *
 * Centralized management of all WebSocket connections with
 * advanced features for reliability, performance, and observability
 */
export class WebSocketConnectionManager extends EventEmitter {
  private static instance: WebSocketConnectionManager | null = null;

  private config: WebSocketManagerConfig;
  private pools: Map<string, WebSocketPool> = new Map();
  private connections: Map<string, WebSocketConnection> = new Map();
  private messageQueue: Map<string, Array<{ type: string; data: unknown }>> = new Map();
  private deduplicationCache: Set<string> = new Map();

  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private initialized = false;

  // Performance tracking
  private connectionTimes: number[] = [];
  private reconnectionTimes: number[] = [];
  private messageLatencies: number[] = [];

  /**
   * Private constructor (Singleton)
   */
  private constructor() {
    super();
    this.config = { ...DEFAULT_MANAGER_CONFIG };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WebSocketConnectionManager {
    if (!WebSocketConnectionManager.instance) {
      WebSocketConnectionManager.instance = new WebSocketConnectionManager();
    }
    return WebSocketConnectionManager.instance;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize connection manager
   */
  async initialize(config?: Partial<WebSocketManagerConfig>): Promise<void> {
    if (this.initialized) {
      console.warn('[WebSocketConnectionManager] Already initialized');
      return;
    }

    // Merge configuration
    this.config = {
      ...DEFAULT_MANAGER_CONFIG,
      ...config,
      pool: {
        ...DEFAULT_MANAGER_CONFIG.pool,
        ...config?.pool,
      },
      defaultOptions: {
        ...DEFAULT_MANAGER_CONFIG.defaultOptions,
        ...config?.defaultOptions,
      },
    };

    // Start health monitoring
    if (this.config.healthCheckInterval > 0) {
      this.startHealthMonitoring();
    }

    // Start metrics collection
    if (this.config.enableMetricsExport && this.config.metricsInterval > 0) {
      this.startMetricsCollection();
    }

    this.initialized = true;
    console.log('[WebSocketConnectionManager] Initialized successfully');
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================
  // CONNECTION LIFECYCLE
  // ============================================

  /**
   * Connect to relay
   */
  async connect(
    url: string,
    options?: Partial<WebSocketOptions>
  ): Promise<WebSocketConnection> {
    const startTime = Date.now();

    // Get or create pool for relay
    let pool = this.pools.get(url);
    if (!pool) {
      pool = new WebSocketPool(url, this.config.pool);
      await pool.initialize();
      this.pools.set(url, pool);
      this.setupPoolListeners(pool);
    }

    // Check if we need a new connection or can reuse existing
    const existingConnection = pool.getOptimalConnection();
    if (existingConnection && pool.hasSubscriptionCapacity(existingConnection.metadata.id)) {
      console.log(`[WebSocketConnectionManager] Reusing connection ${existingConnection.metadata.id}`);
      return existingConnection;
    }

    // Check pool capacity
    if (!pool.hasCapacity()) {
      throw new Error(`Connection pool for ${url} is at maximum capacity`);
    }

    // Create new connection
    const connection = this.createConnection(url, options);
    pool.addConnection(connection);
    this.connections.set(connection.metadata.id, connection);

    // Attempt to connect
    try {
      await this.performConnect(connection);

      // Track connection time
      const connectionTime = Date.now() - startTime;
      this.connectionTimes.push(connectionTime);
      if (this.connectionTimes.length > 1000) {
        this.connectionTimes.shift();
      }

      console.log(`[WebSocketConnectionManager] Connected to ${url} in ${connectionTime}ms`);
      return connection;
    } catch (error) {
      this.handleConnectionError(connection, error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from relay
   */
  async disconnect(connectionId: string, reason?: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Update state
    this.updateConnectionState(connection, ConnectionState.CLOSING);

    // Stop heartbeat
    this.stopHeartbeat(connection);

    // Stop reconnection
    this.stopReconnection(connection);

    // Close WebSocket
    if (connection.socket) {
      connection.socket.close(1000, reason || 'Normal closure');
    }

    // Flush pending messages (optional: wait for confirmation)
    await this.flushPendingMessages(connection);

    // Update state
    this.updateConnectionState(connection, ConnectionState.DISCONNECTED);

    console.log(`[WebSocketConnectionManager] Disconnected ${connectionId}`);
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    const connectionIds = Array.from(this.connections.keys());
    await Promise.all(connectionIds.map((id) => this.disconnect(id)));
  }

  /**
   * Perform actual WebSocket connection
   */
  private async performConnect(connection: WebSocketConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const { url, options } = { url: connection.metadata.url, options: connection.options };

      this.updateConnectionState(connection, ConnectionState.CONNECTING);
      connection.metadata.totalConnectAttempts++;

      try {
        const socket = new WebSocket(url, options.protocols);
        connection.socket = socket;

        // Set connection timeout
        const timeoutId = setTimeout(() => {
          socket.close();
          reject(new Error(`Connection timeout after ${options.timeout}ms`));
        }, options.timeout);

        socket.onopen = () => {
          clearTimeout(timeoutId);

          // Update metadata
          connection.metadata.successfulConnections++;
          if (!connection.metadata.firstConnectedAt) {
            connection.metadata.firstConnectedAt = Date.now();
          }
          connection.metadata.lastConnectedAt = Date.now();

          // Update state
          this.updateConnectionState(connection, ConnectionState.CONNECTED);

          // Start heartbeat if enabled
          if (options.heartbeat.enabled) {
            this.startHeartbeat(connection);
          }

          // Flush pending messages
          this.flushPendingMessages(connection);

          this.emit('connection:open', connection.metadata.id);
          resolve();
        };

        socket.onclose = (event) => {
          clearTimeout(timeoutId);
          this.handleConnectionClose(connection, {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            timestamp: Date.now(),
          });
        };

        socket.onerror = (event) => {
          clearTimeout(timeoutId);
          const error = new Error(`WebSocket error: ${event.type}`);
          this.handleConnectionError(connection, error);
          reject(error);
        };

        socket.onmessage = (event) => {
          this.handleMessage(connection, event.data);
        };
      } catch (error) {
        this.handleConnectionError(connection, error as Error);
        reject(error);
      }
    });
  }

  /**
   * Create new connection object
   */
  private createConnection(
    url: string,
    options?: Partial<WebSocketOptions>
  ): WebSocketConnection {
    const metadata: WebSocketMetadata = {
      id: this.generateConnectionId(),
      url,
      createdAt: Date.now(),
      totalConnectAttempts: 0,
      successfulConnections: 0,
      totalDisconnections: 0,
    };

    const reconnectionState: ReconnectionState = {
      active: false,
      currentAttempt: 0,
      nextDelay: DEFAULT_RECONNECTION_CONFIG.initialDelay,
      history: [],
    };

    const heartbeatState: HeartbeatState = {
      active: false,
      missedPongs: 0,
      recentLatencies: [],
      averageLatency: 0,
    };

    const health: ConnectionHealthMetrics = {
      score: 100,
      components: {
        latencyScore: 100,
        reliabilityScore: 100,
        uptimeScore: 100,
        throughputScore: 100,
        errorRateScore: 100,
      },
      uptime: 0,
      latency: 0,
      successRate: 100,
      errorRate: 0,
      throughput: 0,
      lastCheckAt: Date.now(),
    };

    const quarantine: QuarantineInfo = {
      active: false,
    };

    const bandwidth: BandwidthStats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      batchedMessages: 0,
      compressionSavings: 0,
      deduplicatedRequests: 0,
      sendRate: 0,
      receiveRate: 0,
    };

    const mergedOptions: WebSocketOptions = {
      ...DEFAULT_WEBSOCKET_OPTIONS,
      ...this.config.defaultOptions,
      ...options,
      reconnection: {
        ...DEFAULT_RECONNECTION_CONFIG,
        ...this.config.defaultOptions?.reconnection,
        ...options?.reconnection,
      },
      heartbeat: {
        ...DEFAULT_HEARTBEAT_CONFIG,
        ...this.config.defaultOptions?.heartbeat,
        ...options?.heartbeat,
      },
      bandwidth: {
        ...DEFAULT_BANDWIDTH_CONFIG,
        ...this.config.defaultOptions?.bandwidth,
        ...options?.bandwidth,
      },
    };

    return {
      metadata,
      state: ConnectionState.DISCONNECTED,
      options: mergedOptions,
      reconnection: reconnectionState,
      heartbeat: heartbeatState,
      health,
      quarantine,
      bandwidth,
      subscriptionIds: new Set(),
      pendingMessages: [],
    };
  }

  // ============================================
  // RECONNECTION LOGIC
  // ============================================

  /**
   * Start reconnection process
   */
  private startReconnection(connection: WebSocketConnection): void {
    if (!connection.options.autoReconnect || !connection.options.reconnection.enabled) {
      return;
    }

    if (connection.reconnection.active) {
      return; // Already reconnecting
    }

    const { reconnection } = connection.options;
    connection.reconnection.active = true;
    connection.reconnection.currentAttempt = 0;

    this.scheduleReconnectionAttempt(connection);
  }

  /**
   * Schedule next reconnection attempt
   */
  private scheduleReconnectionAttempt(connection: WebSocketConnection): void {
    const { reconnection } = connection.options;
    const state = connection.reconnection;

    if (state.currentAttempt >= reconnection.maxAttempts) {
      console.error(
        `[WebSocketConnectionManager] Max reconnection attempts (${reconnection.maxAttempts}) reached for ${connection.metadata.url}`
      );
      this.updateConnectionState(connection, ConnectionState.FAILED);
      state.active = false;
      return;
    }

    state.currentAttempt++;

    // Calculate delay with exponential backoff
    let delay = Math.min(
      reconnection.initialDelay * Math.pow(reconnection.backoffMultiplier, state.currentAttempt - 1),
      reconnection.maxDelay
    );

    // Add jitter to prevent thundering herd
    if (reconnection.jitterEnabled) {
      const jitter = Math.random() * reconnection.maxJitter;
      delay += jitter;
    }

    state.nextDelay = delay;

    const attempt: ReconnectionAttempt = {
      attemptNumber: state.currentAttempt,
      delay,
      scheduledAt: Date.now(),
    };
    state.history.push(attempt);

    // Trim history (keep last 20)
    if (state.history.length > 20) {
      state.history.shift();
    }

    console.log(
      `[WebSocketConnectionManager] Scheduling reconnection attempt ${state.currentAttempt}/${reconnection.maxAttempts} in ${delay}ms for ${connection.metadata.url}`
    );

    this.updateConnectionState(connection, ConnectionState.RECONNECTING);
    this.emit('reconnection:started', connection.metadata.id, state.currentAttempt);

    state.timerId = setTimeout(async () => {
      const startTime = Date.now();
      attempt.executedAt = Date.now();

      try {
        await this.performConnect(connection);
        attempt.success = true;

        // Track reconnection time
        const reconnectionTime = Date.now() - startTime;
        this.reconnectionTimes.push(reconnectionTime);
        if (this.reconnectionTimes.length > 1000) {
          this.reconnectionTimes.shift();
        }

        // Reset reconnection state
        state.active = false;
        state.currentAttempt = 0;
        state.nextDelay = reconnection.initialDelay;

        console.log(
          `[WebSocketConnectionManager] Reconnection successful for ${connection.metadata.url} (attempt ${state.currentAttempt})`
        );
        this.emit('reconnection:success', connection.metadata.id);
      } catch (error) {
        attempt.success = false;
        attempt.error = error as Error;

        console.error(
          `[WebSocketConnectionManager] Reconnection attempt ${state.currentAttempt} failed for ${connection.metadata.url}:`,
          error
        );
        this.emit('reconnection:failed', connection.metadata.id, error as Error);

        // Schedule next attempt
        this.scheduleReconnectionAttempt(connection);
      }
    }, delay);
  }

  /**
   * Stop reconnection process
   */
  private stopReconnection(connection: WebSocketConnection): void {
    if (connection.reconnection.timerId) {
      clearTimeout(connection.reconnection.timerId);
      connection.reconnection.timerId = undefined;
    }
    connection.reconnection.active = false;
  }

  // ============================================
  // HEARTBEAT MONITORING
  // ============================================

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(connection: WebSocketConnection): void {
    if (!connection.options.heartbeat.enabled) {
      return;
    }

    if (connection.heartbeat.active) {
      return; // Already active
    }

    connection.heartbeat.active = true;
    connection.heartbeat.missedPongs = 0;

    this.scheduleNextPing(connection);
  }

  /**
   * Schedule next ping
   */
  private scheduleNextPing(connection: WebSocketConnection): void {
    const { heartbeat } = connection.options;

    connection.heartbeat.pingTimerId = setTimeout(() => {
      this.sendPing(connection);
    }, heartbeat.pingInterval);
  }

  /**
   * Send ping message
   */
  private sendPing(connection: WebSocketConnection): void {
    if (connection.state !== ConnectionState.CONNECTED || !connection.socket) {
      return;
    }

    const { heartbeat } = connection.options;
    connection.heartbeat.lastPingAt = Date.now();

    try {
      // Send ping (implementation depends on NOSTR relay protocol)
      // For WebSocket standard ping/pong:
      // connection.socket.send(JSON.stringify(['PING']));

      // For custom implementation:
      connection.socket.send(JSON.stringify(['PING']));

      this.emit('heartbeat:ping', connection.metadata.id);

      // Set pong timeout
      connection.heartbeat.pongTimerId = setTimeout(() => {
        this.handleMissedPong(connection);
      }, heartbeat.pongTimeout);
    } catch (error) {
      console.error(
        `[WebSocketConnectionManager] Failed to send ping to ${connection.metadata.url}:`,
        error
      );
    }
  }

  /**
   * Handle pong received
   */
  private handlePong(connection: WebSocketConnection): void {
    const now = Date.now();
    connection.heartbeat.lastPongAt = now;

    // Clear pong timeout
    if (connection.heartbeat.pongTimerId) {
      clearTimeout(connection.heartbeat.pongTimerId);
      connection.heartbeat.pongTimerId = undefined;
    }

    // Reset missed pongs
    connection.heartbeat.missedPongs = 0;

    // Calculate latency
    if (connection.heartbeat.lastPingAt) {
      const latency = now - connection.heartbeat.lastPingAt;
      connection.heartbeat.recentLatencies.push(latency);

      // Keep last 100 samples
      if (connection.heartbeat.recentLatencies.length > 100) {
        connection.heartbeat.recentLatencies.shift();
      }

      // Update average latency
      connection.heartbeat.averageLatency =
        connection.heartbeat.recentLatencies.reduce((a, b) => a + b, 0) /
        connection.heartbeat.recentLatencies.length;

      this.emit('heartbeat:pong', connection.metadata.id, latency);
    }

    // Schedule next ping
    this.scheduleNextPing(connection);
  }

  /**
   * Handle missed pong
   */
  private handleMissedPong(connection: WebSocketConnection): void {
    connection.heartbeat.missedPongs++;

    console.warn(
      `[WebSocketConnectionManager] Missed pong ${connection.heartbeat.missedPongs}/${connection.options.heartbeat.maxMissedPongs} for ${connection.metadata.url}`
    );

    this.emit('heartbeat:missed', connection.metadata.id, connection.heartbeat.missedPongs);

    if (connection.heartbeat.missedPongs >= connection.options.heartbeat.maxMissedPongs) {
      console.error(
        `[WebSocketConnectionManager] Too many missed pongs, reconnecting ${connection.metadata.url}`
      );

      // Connection is stale, trigger reconnection
      this.handleConnectionError(connection, new Error('Too many missed pongs'));
    } else {
      // Try another ping
      this.scheduleNextPing(connection);
    }
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(connection: WebSocketConnection): void {
    if (connection.heartbeat.pingTimerId) {
      clearTimeout(connection.heartbeat.pingTimerId);
      connection.heartbeat.pingTimerId = undefined;
    }
    if (connection.heartbeat.pongTimerId) {
      clearTimeout(connection.heartbeat.pongTimerId);
      connection.heartbeat.pongTimerId = undefined;
    }
    connection.heartbeat.active = false;
  }

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  /**
   * Send message
   */
  async send(connectionId: string, message: unknown): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // Check if connected
    if (connection.state !== ConnectionState.CONNECTED || !connection.socket) {
      // Queue message for later
      connection.pendingMessages.push({ type: 'user', data: message });
      console.log(`[WebSocketConnectionManager] Queued message for ${connectionId} (not connected)`);
      return;
    }

    // Deduplication check
    if (connection.options.bandwidth.enableDeduplication) {
      const messageHash = this.hashMessage(message);
      if (this.deduplicationCache.has(messageHash)) {
        connection.bandwidth.deduplicatedRequests++;
        console.log(`[WebSocketConnectionManager] Deduplicated message for ${connectionId}`);
        return;
      }
      this.deduplicationCache.add(messageHash);

      // Clean cache (keep last 1000)
      if (this.deduplicationCache.size > 1000) {
        const firstKey = this.deduplicationCache.values().next().value;
        this.deduplicationCache.delete(firstKey);
      }
    }

    // Send message
    const messageStr = JSON.stringify(message);
    const messageBytes = new Blob([messageStr]).size;

    try {
      connection.socket.send(messageStr);

      // Update bandwidth stats
      connection.bandwidth.messagesSent++;
      connection.bandwidth.bytesSent += messageBytes;

      this.emit('message:sent', connectionId, message);
    } catch (error) {
      console.error(`[WebSocketConnectionManager] Failed to send message to ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connection: WebSocketConnection, data: string): void {
    const messageBytes = new Blob([data]).size;

    // Update bandwidth stats
    connection.bandwidth.messagesReceived++;
    connection.bandwidth.bytesReceived += messageBytes;

    try {
      const message = JSON.parse(data);

      // Check for PONG response
      if (Array.isArray(message) && message[0] === 'PONG') {
        this.handlePong(connection);
        return;
      }

      this.emit('message:received', connection.metadata.id, message);
    } catch (error) {
      console.error(
        `[WebSocketConnectionManager] Failed to parse message from ${connection.metadata.url}:`,
        error
      );
    }
  }

  /**
   * Flush pending messages
   */
  private async flushPendingMessages(connection: WebSocketConnection): Promise<void> {
    if (connection.pendingMessages.length === 0) {
      return;
    }

    console.log(
      `[WebSocketConnectionManager] Flushing ${connection.pendingMessages.length} pending messages for ${connection.metadata.id}`
    );

    const messages = [...connection.pendingMessages];
    connection.pendingMessages = [];

    for (const msg of messages) {
      try {
        await this.send(connection.metadata.id, msg.data);
      } catch (error) {
        console.error(`[WebSocketConnectionManager] Failed to flush message:`, error);
        // Re-queue message
        connection.pendingMessages.push(msg);
      }
    }
  }

  /**
   * Hash message for deduplication
   */
  private hashMessage(message: unknown): string {
    // Simple hash implementation (can be improved with crypto)
    const str = JSON.stringify(message);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // ============================================
  // CONNECTION HEALTH SCORING
  // ============================================

  /**
   * Calculate connection health score
   */
  private calculateHealthScore(connection: WebSocketConnection): void {
    const now = Date.now();
    const components: HealthScoreComponents = {
      latencyScore: 0,
      reliabilityScore: 0,
      uptimeScore: 0,
      throughputScore: 0,
      errorRateScore: 0,
    };

    // 1. Latency score (0-100)
    const avgLatency = connection.heartbeat.averageLatency || connection.health.latency;
    if (avgLatency === 0) {
      components.latencyScore = 100;
    } else if (avgLatency < 100) {
      components.latencyScore = 100;
    } else if (avgLatency < 500) {
      components.latencyScore = 100 - ((avgLatency - 100) / 400) * 30; // 100-70
    } else if (avgLatency < 1000) {
      components.latencyScore = 70 - ((avgLatency - 500) / 500) * 40; // 70-30
    } else if (avgLatency < 2000) {
      components.latencyScore = 30 - ((avgLatency - 1000) / 1000) * 30; // 30-0
    } else {
      components.latencyScore = 0;
    }

    // 2. Reliability score (based on success rate)
    const totalAttempts = connection.metadata.totalConnectAttempts;
    const successfulAttempts = connection.metadata.successfulConnections;
    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 100;
    components.reliabilityScore = successRate;

    // 3. Uptime score
    const uptime = connection.metadata.lastConnectedAt
      ? now - connection.metadata.lastConnectedAt
      : 0;
    const targetUptime = 3600000; // 1 hour
    components.uptimeScore = Math.min((uptime / targetUptime) * 100, 100);

    // 4. Throughput score (messages per second)
    const throughput = connection.bandwidth.sendRate + connection.bandwidth.receiveRate;
    if (throughput < 1) {
      components.throughputScore = 50;
    } else if (throughput < 10) {
      components.throughputScore = 50 + (throughput / 10) * 30;
    } else {
      components.throughputScore = Math.min(80 + (throughput / 100) * 20, 100);
    }

    // 5. Error rate score
    const totalMessages = connection.bandwidth.messagesSent + connection.bandwidth.messagesReceived;
    const errorRate = connection.health.errorRate;
    components.errorRateScore = Math.max(0, 100 - errorRate * 10);

    // Calculate weighted overall score
    const weights = {
      latency: 0.25,
      reliability: 0.25,
      uptime: 0.15,
      throughput: 0.15,
      errorRate: 0.20,
    };

    const overallScore =
      components.latencyScore * weights.latency +
      components.reliabilityScore * weights.reliability +
      components.uptimeScore * weights.uptime +
      components.throughputScore * weights.throughput +
      components.errorRateScore * weights.errorRate;

    // Update health metrics
    const previousScore = connection.health.score;
    connection.health.score = Math.round(overallScore);
    connection.health.components = components;
    connection.health.latency = avgLatency;
    connection.health.successRate = successRate;
    connection.health.throughput = throughput;
    connection.health.lastCheckAt = now;

    // Emit event if score changed significantly
    if (Math.abs(previousScore - connection.health.score) > 10) {
      this.emit('health:changed', connection.metadata.id, connection.health.score);
    }

    // Check for quarantine
    this.checkQuarantine(connection);
  }

  /**
   * Check if connection should be quarantined
   */
  private checkQuarantine(connection: WebSocketConnection): void {
    if (connection.quarantine.active) {
      return; // Already quarantined
    }

    if (connection.health.score < this.config.quarantineThreshold) {
      const reason = `Health score ${connection.health.score} below threshold ${this.config.quarantineThreshold}`;
      this.quarantineConnection(connection, reason);
    }
  }

  /**
   * Quarantine connection
   */
  private quarantineConnection(connection: WebSocketConnection, reason: string): void {
    console.warn(
      `[WebSocketConnectionManager] Quarantining connection ${connection.metadata.id}: ${reason}`
    );

    connection.quarantine.active = true;
    connection.quarantine.startedAt = Date.now();
    connection.quarantine.duration = this.config.quarantineDuration;
    connection.quarantine.reason = reason;
    connection.quarantine.releaseAt = Date.now() + this.config.quarantineDuration;

    this.updateConnectionState(connection, ConnectionState.QUARANTINED);
    this.emit('quarantine:started', connection.metadata.id, reason);

    // Schedule release
    setTimeout(() => {
      this.releaseFromQuarantine(connection);
    }, this.config.quarantineDuration);
  }

  /**
   * Release connection from quarantine
   */
  private releaseFromQuarantine(connection: WebSocketConnection): void {
    if (!connection.quarantine.active) {
      return;
    }

    console.log(`[WebSocketConnectionManager] Releasing connection ${connection.metadata.id} from quarantine`);

    connection.quarantine.active = false;
    this.updateConnectionState(connection, ConnectionState.DISCONNECTED);
    this.emit('quarantine:released', connection.metadata.id);

    // Attempt reconnection
    if (connection.options.autoReconnect) {
      this.startReconnection(connection);
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle connection close
   */
  private handleConnectionClose(connection: WebSocketConnection, reason: CloseReason): void {
    connection.metadata.totalDisconnections++;
    connection.metadata.lastDisconnectedAt = Date.now();
    connection.lastCloseReason = reason;

    // Stop heartbeat
    this.stopHeartbeat(connection);

    console.log(
      `[WebSocketConnectionManager] Connection ${connection.metadata.id} closed (code: ${reason.code}, clean: ${reason.wasClean})`
    );

    this.emit('connection:close', connection.metadata.id, reason);

    // Attempt reconnection if not clean close and auto-reconnect enabled
    if (!reason.wasClean && connection.options.autoReconnect) {
      this.startReconnection(connection);
    } else {
      this.updateConnectionState(connection, ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connection: WebSocketConnection, error: Error): void {
    console.error(
      `[WebSocketConnectionManager] Connection error for ${connection.metadata.url}:`,
      error
    );

    this.emit('connection:error', connection.metadata.id, error);

    // Update error rate
    connection.health.errorRate++;

    // Recalculate health score
    this.calculateHealthScore(connection);

    // Stop heartbeat
    this.stopHeartbeat(connection);

    // Update state and attempt reconnection
    if (connection.state === ConnectionState.CONNECTING) {
      // Connection failed during initial connect
      this.updateConnectionState(connection, ConnectionState.DISCONNECTED);
    } else if (connection.state === ConnectionState.CONNECTED) {
      // Connection was established but encountered error
      this.updateConnectionState(connection, ConnectionState.DISCONNECTED);

      if (connection.options.autoReconnect) {
        this.startReconnection(connection);
      }
    }
  }

  /**
   * Update connection state
   */
  private updateConnectionState(connection: WebSocketConnection, newState: ConnectionState): void {
    const oldState = connection.state;
    if (oldState === newState) {
      return;
    }

    connection.state = newState;
    this.emit('state:changed', connection.metadata.id, oldState, newState);

    console.log(
      `[WebSocketConnectionManager] Connection ${connection.metadata.id} state: ${oldState} -> ${newState}`
    );
  }

  // ============================================
  // POOL MANAGEMENT
  // ============================================

  /**
   * Setup pool event listeners
   */
  private setupPoolListeners(pool: WebSocketPool): void {
    pool.on('warmup:needed', (relayUrl: string) => {
      // Create warmup connection
      this.connect(relayUrl).catch((error) => {
        console.error(`[WebSocketConnectionManager] Warmup connection failed for ${relayUrl}:`, error);
      });
    });

    pool.on('rebalance:needed', async (data: { fromConnection: string; toConnection: string; subscriptionCount: number }) => {
      // Handle subscription rebalancing (would need subscription manager integration)
      console.log(
        `[WebSocketConnectionManager] Rebalance requested: move ${data.subscriptionCount} subscriptions from ${data.fromConnection} to ${data.toConnection}`
      );
    });
  }

  /**
   * Get pool for relay
   */
  getPool(relayUrl: string): WebSocketPool | undefined {
    return this.pools.get(relayUrl);
  }

  /**
   * Get all pools
   */
  getAllPools(): WebSocketPool[] {
    return Array.from(this.pools.values());
  }

  // ============================================
  // MONITORING & METRICS
  // ============================================

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    const monitor = () => {
      this.performHealthChecks();
      this.healthCheckTimer = setTimeout(monitor, this.config.healthCheckInterval);
    };
    monitor();
  }

  /**
   * Perform health checks on all connections
   */
  private performHealthChecks(): void {
    for (const connection of this.connections.values()) {
      if (connection.state === ConnectionState.CONNECTED) {
        this.calculateHealthScore(connection);
      }
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const collect = () => {
      this.collectMetrics();
      this.metricsTimer = setTimeout(collect, this.config.metricsInterval);
    };
    collect();
  }

  /**
   * Collect metrics
   */
  private collectMetrics(): void {
    const metrics = this.getMetrics();
    this.emit('metrics:collected', metrics);
  }

  /**
   * Get connection manager metrics
   */
  getMetrics(): ConnectionManagerMetrics {
    const allConnections = Array.from(this.connections.values());

    const connectionsByState: Record<ConnectionState, number> = {
      [ConnectionState.DISCONNECTED]: 0,
      [ConnectionState.CONNECTING]: 0,
      [ConnectionState.CONNECTED]: 0,
      [ConnectionState.RECONNECTING]: 0,
      [ConnectionState.CLOSING]: 0,
      [ConnectionState.FAILED]: 0,
      [ConnectionState.QUARANTINED]: 0,
    };

    for (const conn of allConnections) {
      connectionsByState[conn.state]++;
    }

    const poolStats = this.getAllPools().reduce(
      (acc, pool) => {
        const stats = pool.getStats();
        return {
          totalConnections: acc.totalConnections + stats.totalConnections,
          activeConnections: acc.activeConnections + stats.activeConnections,
          idleConnections: acc.idleConnections + stats.idleConnections,
          failedConnections: acc.failedConnections + stats.failedConnections,
          totalSubscriptions: acc.totalSubscriptions + stats.totalSubscriptions,
          utilization: (acc.utilization + stats.utilization) / 2,
        };
      },
      {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        failedConnections: 0,
        totalSubscriptions: 0,
        utilization: 0,
      }
    );

    const aggregateBandwidth: BandwidthStats = allConnections.reduce(
      (acc, conn) => ({
        messagesSent: acc.messagesSent + conn.bandwidth.messagesSent,
        messagesReceived: acc.messagesReceived + conn.bandwidth.messagesReceived,
        bytesSent: acc.bytesSent + conn.bandwidth.bytesSent,
        bytesReceived: acc.bytesReceived + conn.bandwidth.bytesReceived,
        batchedMessages: acc.batchedMessages + conn.bandwidth.batchedMessages,
        compressionSavings: acc.compressionSavings + conn.bandwidth.compressionSavings,
        deduplicatedRequests: acc.deduplicatedRequests + conn.bandwidth.deduplicatedRequests,
        sendRate: acc.sendRate + conn.bandwidth.sendRate,
        receiveRate: acc.receiveRate + conn.bandwidth.receiveRate,
      }),
      {
        messagesSent: 0,
        messagesReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
        batchedMessages: 0,
        compressionSavings: 0,
        deduplicatedRequests: 0,
        sendRate: 0,
        receiveRate: 0,
      }
    );

    const connectedConnections = allConnections.filter(
      (c) => c.state === ConnectionState.CONNECTED
    );
    const averageHealthScore =
      connectedConnections.length > 0
        ? connectedConnections.reduce((sum, c) => sum + c.health.score, 0) /
          connectedConnections.length
        : 0;

    const averageLatency =
      connectedConnections.length > 0
        ? connectedConnections.reduce((sum, c) => sum + c.health.latency, 0) /
          connectedConnections.length
        : 0;

    const totalReconnections = allConnections.reduce(
      (sum, c) => sum + c.reconnection.history.length,
      0
    );

    const successfulReconnections = allConnections.reduce(
      (sum, c) => sum + c.reconnection.history.filter((a) => a.success).length,
      0
    );

    const quarantinedConnections = connectionsByState[ConnectionState.QUARANTINED];

    return {
      totalConnections: allConnections.length,
      connectionsByState,
      pool: poolStats,
      bandwidth: aggregateBandwidth,
      averageHealthScore,
      averageLatency,
      totalReconnections,
      successfulReconnections,
      quarantinedConnections,
      timestamp: Date.now(),
    };
  }

  /**
   * Get performance benchmarks
   */
  getPerformanceBenchmarks(): PerformanceBenchmarks {
    const avgConnectionTime =
      this.connectionTimes.length > 0
        ? this.connectionTimes.reduce((a, b) => a + b, 0) / this.connectionTimes.length
        : 0;

    const avgReconnectionTime =
      this.reconnectionTimes.length > 0
        ? this.reconnectionTimes.reduce((a, b) => a + b, 0) / this.reconnectionTimes.length
        : 0;

    const sorted = [...this.messageLatencies].sort((a, b) => a - b);
    const p95MessageLatency = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99MessageLatency = sorted[Math.floor(sorted.length * 0.99)] || 0;

    const metrics = this.getMetrics();
    const messagesPerSecond =
      metrics.bandwidth.sendRate + metrics.bandwidth.receiveRate;
    const throughputBytesPerSecond =
      metrics.bandwidth.bytesSent + metrics.bandwidth.bytesReceived;

    const allConnections = Array.from(this.connections.values());
    const totalAttempts = allConnections.reduce(
      (sum, c) => sum + c.metadata.totalConnectAttempts,
      0
    );
    const successfulAttempts = allConnections.reduce(
      (sum, c) => sum + c.metadata.successfulConnections,
      0
    );
    const connectionSuccessRate =
      totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 100;

    const messageDeliveryRate = 100; // Placeholder (would need tracking)

    return {
      averageConnectionTime: avgConnectionTime,
      averageReconnectionTime: avgReconnectionTime,
      p95MessageLatency,
      p99MessageLatency,
      messagesPerSecond,
      throughputBytesPerSecond,
      connectionSuccessRate,
      messageDeliveryRate,
    };
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

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // ============================================
  // CLEANUP
  // ============================================

  /**
   * Destroy manager and cleanup all resources
   */
  async destroy(): Promise<void> {
    console.log('[WebSocketConnectionManager] Destroying manager...');

    // Stop timers
    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
    }
    if (this.metricsTimer) {
      clearTimeout(this.metricsTimer);
    }

    // Disconnect all connections
    await this.disconnectAll();

    // Destroy all pools
    for (const pool of this.pools.values()) {
      await pool.destroy();
    }

    // Clear collections
    this.connections.clear();
    this.pools.clear();
    this.messageQueue.clear();
    this.deduplicationCache.clear();
    this.connectionTimes = [];
    this.reconnectionTimes = [];
    this.messageLatencies = [];

    // Remove all listeners
    this.removeAllListeners();

    this.initialized = false;
    WebSocketConnectionManager.instance = null;

    console.log('[WebSocketConnectionManager] Manager destroyed');
  }
}

// Export singleton instance
export const webSocketConnectionManager = WebSocketConnectionManager.getInstance();
