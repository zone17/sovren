/**
 * 🔐 ELITE TYPE DEFINITIONS: Relay Pool Manager
 *
 * US-301: Migrated to use consolidated NOSTR types from @shared/types/nostr
 * Specialized extensions for RelayPoolManager implementation
 */

import type { Event as NostrEvent, Filter } from 'nostr-tools';

/**
 * Relay connection status (extends consolidated RelayState)
 * @deprecated Use RelayState from @shared/types/nostr instead
 */
export enum RelayStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  FAILED = 'failed',
}

/**
 * Relay health status
 * @deprecated Use RelayHealthStatus from @shared/types/nostr instead
 */
export enum RelayHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Relay tag types (NIP-65 compliant)
 */
export type RelayTag = 'read' | 'write' | 'both';

/**
 * Relay metrics for health monitoring
 */
export interface RelayMetrics {
  /** Average latency in milliseconds */
  latency: number;
  /** Success rate percentage (0-100) */
  successRate: number;
  /** Uptime percentage (0-100) */
  uptime: number;
  /** Total requests sent */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Last successful connection timestamp */
  lastSuccess?: number;
  /** Last error timestamp */
  lastError?: number;
  /** Error message if any */
  lastErrorMessage?: string;
}

/**
 * Relay health information
 */
export interface RelayHealthInfo {
  /** Relay URL */
  url: string;
  /** Health status */
  status: RelayHealth;
  /** Overall health score (0-100) */
  score: number;
  /** Current metrics */
  metrics: RelayMetrics;
  /** Timestamp of last health check */
  lastCheck: number;
}

/**
 * Relay connection information
 */
export interface RelayConnection {
  /** Relay URL */
  url: string;
  /** Connection status */
  status: RelayStatus;
  /** Relay tag (read/write/both) */
  tag: RelayTag;
  /** Connection timestamp */
  connectedAt?: number;
  /** Disconnection timestamp */
  disconnectedAt?: number;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Health information */
  health: RelayHealthInfo;
}

/**
 * Relay pool configuration
 */
export interface RelayPoolConfig {
  /** List of relay URLs to connect to */
  relays: string[];
  /** Maximum number of concurrent relay connections */
  maxRelays?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Enable health monitoring */
  enableHealthMonitoring?: boolean;
  /** Enable event deduplication */
  enableDeduplication?: boolean;
}

/**
 * Event publish result
 */
export interface PublishResult {
  /** Relay URL */
  relay: string;
  /** Whether publish was successful */
  success: boolean;
  /** Error if publish failed */
  error?: Error;
  /** Publish latency in milliseconds */
  latency: number;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Filters for the subscription */
  filters: Filter[];
  /** Callback when event is received */
  onEvent: (event: NostrEvent) => void;
  /** Callback when EOSE is received */
  onEose?: () => void;
  /** Callback when subscription error occurs */
  onError?: (error: Error) => void;
  /** Specific relays to subscribe to (defaults to all connected) */
  relays?: string[];
}

/**
 * Active subscription information
 */
export interface ActiveSubscription {
  /** Subscription ID */
  id: string;
  /** Subscription filters */
  filters: Filter[];
  /** Relays this subscription is active on */
  relays: string[];
  /** Creation timestamp */
  createdAt: number;
  /** Event callback */
  onEvent: (event: NostrEvent) => void;
  /** EOSE callback */
  onEose?: () => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Relay pool manager events
 */
export interface RelayPoolEvents {
  'relay:connected': (url: string) => void;
  'relay:disconnected': (url: string) => void;
  'relay:error': (url: string, error: Error) => void;
  'relay:reconnecting': (url: string, attempt: number) => void;
  'relay:health:changed': (url: string, health: RelayHealth) => void;
  'event:received': (event: NostrEvent, relay: string) => void;
  'event:published': (event: NostrEvent, results: PublishResult[]) => void;
  'subscription:created': (subscriptionId: string) => void;
  'subscription:closed': (subscriptionId: string) => void;
}

/**
 * Connection options
 */
export interface ConnectionOptions {
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable automatic reconnection for this connection */
  autoReconnect?: boolean;
}

/**
 * Metrics update payload
 */
export interface MetricsUpdate {
  /** Latency measurement in milliseconds */
  latency: number;
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Relay discovery options (NIP-65)
 */
export interface RelayDiscoveryOptions {
  /** Public key to discover relays for */
  pubkey: string;
  /** Include read relays */
  includeRead?: boolean;
  /** Include write relays */
  includeWrite?: boolean;
  /** Maximum number of relays to discover */
  limit?: number;
}

/**
 * Discovered relay information (NIP-65)
 */
export interface DiscoveredRelay {
  /** Relay URL */
  url: string;
  /** Relay tag */
  tag: RelayTag;
  /** Discovery source */
  source: 'nip65' | 'manual' | 'default';
}
