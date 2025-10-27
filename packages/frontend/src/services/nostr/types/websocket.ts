/**
 * 🔌 ELITE TYPE DEFINITIONS: WebSocket Connection Manager
 *
 * US-320: WebSocket Connection Manager
 * Epic 003: NOSTR Consolidation
 *
 * Advanced WebSocket connection management types:
 * - Connection lifecycle states
 * - Reconnection strategies
 * - Connection pooling
 * - Health monitoring
 * - Bandwidth optimization
 * - Performance metrics
 */

import type { Filter, Event as NostrEvent } from 'nostr-tools';

// ============================================
// CONNECTION STATES
// ============================================

/**
 * WebSocket connection state
 */
export enum ConnectionState {
  /** Not connected */
  DISCONNECTED = 'disconnected',
  /** Attempting to connect */
  CONNECTING = 'connecting',
  /** Successfully connected */
  CONNECTED = 'connected',
  /** Attempting to reconnect after failure */
  RECONNECTING = 'reconnecting',
  /** Connection is being intentionally closed */
  CLOSING = 'closing',
  /** Connection failed permanently (max retries exceeded) */
  FAILED = 'failed',
  /** Connection is in quarantine (temporary cooldown) */
  QUARANTINED = 'quarantined',
}

/**
 * WebSocket connection close reason
 */
export interface CloseReason {
  /** Close code */
  code: number;
  /** Close reason string */
  reason: string;
  /** Whether close was clean */
  wasClean: boolean;
  /** Timestamp */
  timestamp: number;
}

// ============================================
// RECONNECTION STRATEGY
// ============================================

/**
 * Reconnection strategy configuration
 */
export interface ReconnectionConfig {
  /** Enable automatic reconnection */
  enabled: boolean;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Maximum number of reconnection attempts */
  maxAttempts: number;
  /** Backoff multiplier (for exponential backoff) */
  backoffMultiplier: number;
  /** Add random jitter to prevent thundering herd */
  jitterEnabled: boolean;
  /** Maximum jitter in milliseconds */
  maxJitter: number;
}

/**
 * Reconnection attempt information
 */
export interface ReconnectionAttempt {
  /** Attempt number (1-indexed) */
  attemptNumber: number;
  /** Scheduled delay in milliseconds */
  delay: number;
  /** Timestamp when attempt was scheduled */
  scheduledAt: number;
  /** Timestamp when attempt was executed */
  executedAt?: number;
  /** Whether attempt succeeded */
  success?: boolean;
  /** Error if attempt failed */
  error?: Error;
}

/**
 * Reconnection state
 */
export interface ReconnectionState {
  /** Whether reconnection is in progress */
  active: boolean;
  /** Current attempt number */
  currentAttempt: number;
  /** Next attempt delay */
  nextDelay: number;
  /** Timer ID for next attempt */
  timerId?: NodeJS.Timeout;
  /** History of attempts */
  history: ReconnectionAttempt[];
}

// ============================================
// CONNECTION POOLING
// ============================================

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Minimum connections per relay */
  minConnections: number;
  /** Maximum connections per relay */
  maxConnections: number;
  /** Connection reuse strategy */
  reuseStrategy: 'round-robin' | 'least-loaded' | 'healthiest';
  /** Maximum subscriptions per connection */
  maxSubscriptionsPerConnection: number;
  /** Enable connection warming */
  enableWarmup: boolean;
  /** Warmup connection count */
  warmupCount: number;
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
  /** Total connections in pool */
  totalConnections: number;
  /** Active (in-use) connections */
  activeConnections: number;
  /** Idle connections */
  idleConnections: number;
  /** Failed connections */
  failedConnections: number;
  /** Total subscriptions */
  totalSubscriptions: number;
  /** Connection utilization (0-100) */
  utilization: number;
}

/**
 * Load balancing metrics per connection
 */
export interface ConnectionLoad {
  /** Connection ID */
  connectionId: string;
  /** Number of active subscriptions */
  subscriptionCount: number;
  /** Health score (0-100) */
  healthScore: number;
  /** Average latency */
  latency: number;
  /** Load score (lower is better) */
  loadScore: number;
}

// ============================================
// HEARTBEAT MONITORING
// ============================================

/**
 * Heartbeat configuration
 */
export interface HeartbeatConfig {
  /** Enable heartbeat monitoring */
  enabled: boolean;
  /** Ping interval in milliseconds */
  pingInterval: number;
  /** Pong timeout in milliseconds */
  pongTimeout: number;
  /** Maximum missed pongs before reconnect */
  maxMissedPongs: number;
  /** Enable latency tracking via ping-pong */
  trackLatency: boolean;
}

/**
 * Heartbeat state
 */
export interface HeartbeatState {
  /** Whether heartbeat is active */
  active: boolean;
  /** Timer ID for next ping */
  pingTimerId?: NodeJS.Timeout;
  /** Timer ID for pong timeout */
  pongTimerId?: NodeJS.Timeout;
  /** Last ping timestamp */
  lastPingAt?: number;
  /** Last pong timestamp */
  lastPongAt?: number;
  /** Consecutive missed pongs */
  missedPongs: number;
  /** Recent latency measurements (from ping-pong) */
  recentLatencies: number[];
  /** Average ping-pong latency */
  averageLatency: number;
}

// ============================================
// BANDWIDTH OPTIMIZATION
// ============================================

/**
 * Message batching configuration
 */
export interface BatchingConfig {
  /** Enable message batching */
  enabled: boolean;
  /** Maximum batch size (number of messages) */
  maxBatchSize: number;
  /** Maximum batch delay in milliseconds */
  maxBatchDelay: number;
  /** Maximum batch bytes */
  maxBatchBytes: number;
}

/**
 * Message compression configuration
 */
export interface CompressionConfig {
  /** Enable message compression */
  enabled: boolean;
  /** Compression algorithm */
  algorithm: 'gzip' | 'deflate' | 'none';
  /** Minimum message size for compression (bytes) */
  minSize: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Enable rate limiting */
  enabled: boolean;
  /** Maximum messages per second */
  maxMessagesPerSecond: number;
  /** Maximum bytes per second */
  maxBytesPerSecond: number;
  /** Burst allowance (messages) */
  burstSize: number;
}

/**
 * Bandwidth optimization configuration
 */
export interface BandwidthConfig {
  /** Message batching */
  batching: BatchingConfig;
  /** Message compression */
  compression: CompressionConfig;
  /** Rate limiting */
  rateLimit: RateLimitConfig;
  /** Enable request deduplication */
  enableDeduplication: boolean;
}

/**
 * Bandwidth statistics
 */
export interface BandwidthStats {
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Total bytes sent */
  bytesSent: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Messages saved by batching */
  batchedMessages: number;
  /** Bytes saved by compression */
  compressionSavings: number;
  /** Deduplicated requests */
  deduplicatedRequests: number;
  /** Current send rate (messages/sec) */
  sendRate: number;
  /** Current receive rate (messages/sec) */
  receiveRate: number;
}

// ============================================
// CONNECTION HEALTH
// ============================================

/**
 * Connection health score components
 */
export interface HealthScoreComponents {
  /** Latency score (0-100) */
  latencyScore: number;
  /** Reliability score (0-100) */
  reliabilityScore: number;
  /** Uptime score (0-100) */
  uptimeScore: number;
  /** Throughput score (0-100) */
  throughputScore: number;
  /** Error rate score (0-100) */
  errorRateScore: number;
}

/**
 * Connection health metrics
 */
export interface ConnectionHealthMetrics {
  /** Overall health score (0-100) */
  score: number;
  /** Score components breakdown */
  components: HealthScoreComponents;
  /** Connection uptime (milliseconds) */
  uptime: number;
  /** Average latency (milliseconds) */
  latency: number;
  /** Success rate (0-100) */
  successRate: number;
  /** Error rate (0-100) */
  errorRate: number;
  /** Messages per second */
  throughput: number;
  /** Last health check timestamp */
  lastCheckAt: number;
}

/**
 * Connection quarantine information
 */
export interface QuarantineInfo {
  /** Whether connection is quarantined */
  active: boolean;
  /** Quarantine start timestamp */
  startedAt?: number;
  /** Quarantine duration (milliseconds) */
  duration?: number;
  /** Reason for quarantine */
  reason?: string;
  /** Release timestamp */
  releaseAt?: number;
}

// ============================================
// WEBSOCKET CONNECTION
// ============================================

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
  /** Connection timeout (milliseconds) */
  timeout: number;
  /** Enable auto-reconnect */
  autoReconnect: boolean;
  /** Reconnection configuration */
  reconnection: ReconnectionConfig;
  /** Heartbeat configuration */
  heartbeat: HeartbeatConfig;
  /** Bandwidth optimization */
  bandwidth: BandwidthConfig;
  /** Connection protocols (WebSocket subprotocols) */
  protocols?: string[];
  /** Custom headers (if supported) */
  headers?: Record<string, string>;
}

/**
 * WebSocket connection metadata
 */
export interface WebSocketMetadata {
  /** Connection ID */
  id: string;
  /** Relay URL */
  url: string;
  /** Creation timestamp */
  createdAt: number;
  /** First connect timestamp */
  firstConnectedAt?: number;
  /** Last connect timestamp */
  lastConnectedAt?: number;
  /** Last disconnect timestamp */
  lastDisconnectedAt?: number;
  /** Total connection attempts */
  totalConnectAttempts: number;
  /** Total successful connections */
  successfulConnections: number;
  /** Total disconnections */
  totalDisconnections: number;
}

/**
 * Complete WebSocket connection state
 */
export interface WebSocketConnection {
  /** Connection metadata */
  metadata: WebSocketMetadata;
  /** Current connection state */
  state: ConnectionState;
  /** Underlying WebSocket instance */
  socket?: WebSocket;
  /** Connection options */
  options: WebSocketOptions;
  /** Reconnection state */
  reconnection: ReconnectionState;
  /** Heartbeat state */
  heartbeat: HeartbeatState;
  /** Health metrics */
  health: ConnectionHealthMetrics;
  /** Quarantine information */
  quarantine: QuarantineInfo;
  /** Bandwidth statistics */
  bandwidth: BandwidthStats;
  /** Active subscription IDs */
  subscriptionIds: Set<string>;
  /** Last close reason */
  lastCloseReason?: CloseReason;
  /** Pending messages queue */
  pendingMessages: Array<{ type: string; data: unknown }>;
}

// ============================================
// CONNECTION MANAGER CONFIGURATION
// ============================================

/**
 * WebSocket Connection Manager configuration
 */
export interface WebSocketManagerConfig {
  /** Connection pool configuration */
  pool: ConnectionPoolConfig;
  /** Default connection options */
  defaultOptions: Partial<WebSocketOptions>;
  /** Health check interval (milliseconds) */
  healthCheckInterval: number;
  /** Metrics collection interval (milliseconds) */
  metricsInterval: number;
  /** Enable performance tracking */
  enablePerformanceTracking: boolean;
  /** Enable metrics export */
  enableMetricsExport: boolean;
  /** Quarantine duration (milliseconds) */
  quarantineDuration: number;
  /** Quarantine health threshold (0-100) */
  quarantineThreshold: number;
}

// ============================================
// EVENTS
// ============================================

/**
 * WebSocket connection events
 */
export interface WebSocketConnectionEvents {
  /** Connection state changed */
  'state:changed': (connectionId: string, oldState: ConnectionState, newState: ConnectionState) => void;
  /** Connection opened */
  'connection:open': (connectionId: string) => void;
  /** Connection closed */
  'connection:close': (connectionId: string, reason: CloseReason) => void;
  /** Connection error */
  'connection:error': (connectionId: string, error: Error) => void;
  /** Message received */
  'message:received': (connectionId: string, message: unknown) => void;
  /** Message sent */
  'message:sent': (connectionId: string, message: unknown) => void;
  /** Reconnection started */
  'reconnection:started': (connectionId: string, attempt: number) => void;
  /** Reconnection succeeded */
  'reconnection:success': (connectionId: string) => void;
  /** Reconnection failed */
  'reconnection:failed': (connectionId: string, error: Error) => void;
  /** Heartbeat ping sent */
  'heartbeat:ping': (connectionId: string) => void;
  /** Heartbeat pong received */
  'heartbeat:pong': (connectionId: string, latency: number) => void;
  /** Heartbeat missed */
  'heartbeat:missed': (connectionId: string, missedCount: number) => void;
  /** Health score changed */
  'health:changed': (connectionId: string, score: number) => void;
  /** Connection quarantined */
  'quarantine:started': (connectionId: string, reason: string) => void;
  /** Connection released from quarantine */
  'quarantine:released': (connectionId: string) => void;
}

// ============================================
// METRICS & MONITORING
// ============================================

/**
 * Connection manager metrics
 */
export interface ConnectionManagerMetrics {
  /** Total connections */
  totalConnections: number;
  /** Connections by state */
  connectionsByState: Record<ConnectionState, number>;
  /** Pool statistics */
  pool: PoolStats;
  /** Aggregate bandwidth statistics */
  bandwidth: BandwidthStats;
  /** Average health score */
  averageHealthScore: number;
  /** Average latency */
  averageLatency: number;
  /** Total reconnections */
  totalReconnections: number;
  /** Successful reconnections */
  successfulReconnections: number;
  /** Quarantined connections */
  quarantinedConnections: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Performance benchmarks
 */
export interface PerformanceBenchmarks {
  /** Average connection time (ms) */
  averageConnectionTime: number;
  /** Average reconnection time (ms) */
  averageReconnectionTime: number;
  /** p95 message latency (ms) */
  p95MessageLatency: number;
  /** p99 message latency (ms) */
  p99MessageLatency: number;
  /** Messages per second */
  messagesPerSecond: number;
  /** Throughput (bytes/sec) */
  throughputBytesPerSecond: number;
  /** Connection success rate (0-100) */
  connectionSuccessRate: number;
  /** Message delivery success rate (0-100) */
  messageDeliveryRate: number;
}

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  enabled: true,
  initialDelay: 1000, // 1 second
  maxDelay: 60000, // 60 seconds
  maxAttempts: 10,
  backoffMultiplier: 2,
  jitterEnabled: true,
  maxJitter: 1000, // 1 second
};

/**
 * Default heartbeat configuration
 */
export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: true,
  pingInterval: 30000, // 30 seconds
  pongTimeout: 10000, // 10 seconds
  maxMissedPongs: 3,
  trackLatency: true,
};

/**
 * Default batching configuration
 */
export const DEFAULT_BATCHING_CONFIG: BatchingConfig = {
  enabled: true,
  maxBatchSize: 10,
  maxBatchDelay: 100, // 100ms
  maxBatchBytes: 65536, // 64KB
};

/**
 * Default compression configuration
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enabled: false, // Disabled by default (requires implementation)
  algorithm: 'none',
  minSize: 1024, // 1KB
};

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: true,
  maxMessagesPerSecond: 100,
  maxBytesPerSecond: 1048576, // 1MB/s
  burstSize: 10,
};

/**
 * Default bandwidth configuration
 */
export const DEFAULT_BANDWIDTH_CONFIG: BandwidthConfig = {
  batching: DEFAULT_BATCHING_CONFIG,
  compression: DEFAULT_COMPRESSION_CONFIG,
  rateLimit: DEFAULT_RATE_LIMIT_CONFIG,
  enableDeduplication: true,
};

/**
 * Default connection pool configuration
 */
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  minConnections: 1,
  maxConnections: 3,
  reuseStrategy: 'least-loaded',
  maxSubscriptionsPerConnection: 10,
  enableWarmup: true,
  warmupCount: 1,
};

/**
 * Default WebSocket options
 */
export const DEFAULT_WEBSOCKET_OPTIONS: WebSocketOptions = {
  timeout: 10000, // 10 seconds
  autoReconnect: true,
  reconnection: DEFAULT_RECONNECTION_CONFIG,
  heartbeat: DEFAULT_HEARTBEAT_CONFIG,
  bandwidth: DEFAULT_BANDWIDTH_CONFIG,
};

/**
 * Default manager configuration
 */
export const DEFAULT_MANAGER_CONFIG: WebSocketManagerConfig = {
  pool: DEFAULT_POOL_CONFIG,
  defaultOptions: DEFAULT_WEBSOCKET_OPTIONS,
  healthCheckInterval: 30000, // 30 seconds
  metricsInterval: 5000, // 5 seconds
  enablePerformanceTracking: true,
  enableMetricsExport: true,
  quarantineDuration: 300000, // 5 minutes
  quarantineThreshold: 30, // Health score below 30
};
