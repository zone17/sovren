/**
 * NOSTR Relay Types - Consolidated Type Definitions
 *
 * US-308: Consolidate NOSTR Type Definitions
 * Epic 003: NOSTR Consolidation
 *
 * Complete type definitions for NOSTR relay management and connection handling
 * Implements NIP-01 relay communication and NIP-11 relay information document
 */

import { z } from 'zod';
import type { Relay as NostrToolsRelay } from 'nostr-tools';
import type { NostrEvent } from './events';

// ========================================
// Relay Connection States
// ========================================

/**
 * Relay Connection State
 */
export enum RelayState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  CLOSED = 'closed',
}

/**
 * Relay Connection Status
 */
export interface RelayStatus {
  url: string;
  state: RelayState;
  connected: boolean;
  lastConnected?: number;
  lastDisconnected?: number;
  lastError?: string;
  errorCount: number;
  reconnectAttempts: number;
  subscriptions: string[];
  latency?: number;
  supportedNIPs?: number[];
  authenticated?: boolean;
}

// ========================================
// Relay Information (NIP-11)
// ========================================

/**
 * Relay Information Document (NIP-11)
 * https://github.com/nostr-protocol/nips/blob/master/11.md
 */
export const RelayInformationDocumentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  pubkey: z.string().length(64).optional(),
  contact: z.string().optional(),
  supported_nips: z.array(z.number()).optional(),
  software: z.string().optional(),
  version: z.string().optional(),
  limitation: z.object({
    max_message_length: z.number().optional(),
    max_subscriptions: z.number().optional(),
    max_filters: z.number().optional(),
    max_limit: z.number().optional(),
    max_subid_length: z.number().optional(),
    min_prefix: z.number().optional(),
    max_event_tags: z.number().optional(),
    max_content_length: z.number().optional(),
    min_pow_difficulty: z.number().optional(),
    auth_required: z.boolean().optional(),
    payment_required: z.boolean().optional(),
  }).optional(),
  payments_url: z.string().url().optional(),
  fees: z.object({
    admission: z.array(z.object({
      amount: z.number(),
      unit: z.string(),
    })).optional(),
    subscription: z.array(z.object({
      amount: z.number(),
      unit: z.string(),
      period: z.number(),
    })).optional(),
    publication: z.array(z.object({
      kinds: z.array(z.number()),
      amount: z.number(),
      unit: z.string(),
    })).optional(),
  }).optional(),
  relay_countries: z.array(z.string()).optional(),
});

export type RelayInformationDocument = z.infer<typeof RelayInformationDocumentSchema>;

// ========================================
// Relay Configuration
// ========================================

/**
 * Relay Connection Options
 */
export interface RelayConnectionOptions {
  read?: boolean;              // Allow reading events
  write?: boolean;             // Allow writing events
  autoReconnect?: boolean;     // Auto-reconnect on disconnect
  reconnectDelay?: number;     // Delay between reconnect attempts (ms)
  maxReconnectAttempts?: number; // Max reconnection attempts
  connectionTimeout?: number;   // Connection timeout (ms)
  auth?: boolean;              // Enable NIP-42 authentication
  authHandler?: () => Promise<NostrEvent>; // Custom auth handler
}

/**
 * Relay Configuration
 */
export const RelayConfigSchema = z.object({
  url: z.string().url('Must be a valid relay URL'),
  read: z.boolean().default(true),
  write: z.boolean().default(true),
  autoReconnect: z.boolean().default(true),
  reconnectDelay: z.number().positive().default(1000),
  maxReconnectAttempts: z.number().nonnegative().default(3),
  connectionTimeout: z.number().positive().default(5000),
  priority: z.number().min(0).max(10).default(5),
  auth: z.boolean().default(false),
});

export type RelayConfig = z.infer<typeof RelayConfigSchema>;

// ========================================
// Relay Schema
// ========================================

/**
 * Basic Relay Schema
 */
export const NostrRelaySchema = z.object({
  url: z.string().url(),
  state: z.nativeEnum(RelayState),
  lastConnected: z.number().optional(),
  lastError: z.string().optional(),
  reconnectAttempts: z.number().default(0),
  subscriptions: z.array(z.string()).default([]),
  supportedNIPs: z.array(z.number()).default([]),
});

export type NostrRelay = z.infer<typeof NostrRelaySchema>;

/**
 * Extended Relay with Full Information
 */
export interface RelayWithInfo extends NostrRelay {
  info?: RelayInformationDocument;
  status: RelayStatus;
  statistics: RelayStatistics;
  config: RelayConfig;
}

// ========================================
// Relay Statistics
// ========================================

/**
 * Relay Statistics
 */
export interface RelayStatistics {
  url: string;
  eventsSent: number;
  eventsReceived: number;
  subscriptions: number;
  activeSubscriptions: number;
  uptime: number;              // Milliseconds
  uptimePercentage: number;    // 0-100
  averageLatency: number;      // Milliseconds
  minLatency: number;
  maxLatency: number;
  errorRate: number;           // 0-1
  totalErrors: number;
  lastErrorTime?: number;
  bytesReceived: number;
  bytesSent: number;
  messagesReceived: number;
  messagesSent: number;
  connectionCount: number;
  lastConnectedDuration?: number;
}

// ========================================
// Relay Messages (NIP-01)
// ========================================

/**
 * NOSTR Relay Message Types
 * As defined in NIP-01
 */
export type NostrRelayMessage =
  | ['EVENT', string, NostrEvent]           // Server sends event
  | ['OK', string, boolean, string]         // Server response to event
  | ['EOSE', string]                        // End of stored events
  | ['CLOSED', string, string]              // Subscription closed
  | ['NOTICE', string]                      // Human-readable message
  | ['AUTH', string]                        // Authentication challenge (NIP-42)
  | ['COUNT', string, { count: number }];   // Event count (NIP-45)

/**
 * Client-to-Relay Messages
 */
export type NostrClientMessage =
  | ['EVENT', NostrEvent]                   // Publish event
  | ['REQ', string, ...object[]]            // Request subscription
  | ['CLOSE', string]                       // Close subscription
  | ['AUTH', NostrEvent]                    // Auth response (NIP-42)
  | ['COUNT', string, ...object[]];         // Count request (NIP-45)

// ========================================
// Relay Callbacks
// ========================================

/**
 * Relay Event Callbacks
 */
export type RelayConnectedCallback = (relay: string) => void | Promise<void>;
export type RelayDisconnectedCallback = (relay: string) => void | Promise<void>;
export type RelayErrorCallback = (relay: string, error: Error) => void | Promise<void>;
export type RelayNoticeCallback = (relay: string, notice: string) => void | Promise<void>;
export type RelayAuthCallback = (relay: string, challenge: string) => Promise<NostrEvent>;

/**
 * Relay Event Handlers
 */
export interface RelayEventHandlers {
  onConnected?: RelayConnectedCallback;
  onDisconnected?: RelayDisconnectedCallback;
  onError?: RelayErrorCallback;
  onNotice?: RelayNoticeCallback;
  onAuth?: RelayAuthCallback;
}

// ========================================
// Relay Selection and Management
// ========================================

/**
 * Relay Selection Strategy
 */
export enum RelaySelectionStrategy {
  ALL = 'all',                    // Use all available relays
  FASTEST = 'fastest',            // Use fastest responding relays
  RELIABLE = 'reliable',          // Use most reliable relays
  GEOGRAPHIC = 'geographic',      // Use geographically closest relays
  PRIORITY = 'priority',          // Use relays by priority
  RANDOM = 'random',              // Random selection
  ROUND_ROBIN = 'round_robin',    // Round-robin selection
}

/**
 * Relay Pool Configuration
 */
export interface RelayPoolConfig {
  relays: RelayConfig[];
  selectionStrategy: RelaySelectionStrategy;
  minRelays: number;              // Minimum relays to use
  maxRelays: number;              // Maximum relays to use
  defaultTimeout: number;         // Default operation timeout (ms)
  connectionPoolSize: number;     // Max concurrent connections
  enableFallback: boolean;        // Enable fallback relays
  fallbackRelays: string[];       // Fallback relay URLs
}

// ========================================
// Relay Health Monitoring
// ========================================

/**
 * Relay Health Status
 */
export enum RelayHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * Relay Health Check Result
 */
export interface RelayHealthCheck {
  url: string;
  status: RelayHealthStatus;
  latency: number;
  timestamp: number;
  errors: string[];
  warnings: string[];
  metrics: {
    responseTime: number;
    availability: number;      // 0-1
    successRate: number;       // 0-1
    errorRate: number;         // 0-1
  };
}

/**
 * Relay Health Monitoring Configuration
 */
export interface RelayHealthMonitoringConfig {
  enabled: boolean;
  checkInterval: number;       // ms
  timeout: number;             // ms
  failureThreshold: number;    // Number of failures before marking unhealthy
  recoveryThreshold: number;   // Number of successes before marking healthy
  alertOnFailure: boolean;
}

// ========================================
// Relay Discovery and Recommendations
// ========================================

/**
 * Relay Recommendation
 */
export interface RelayRecommendation {
  url: string;
  score: number;              // 0-1 recommendation score
  reasons: string[];
  source: 'user' | 'network' | 'ai' | 'default';
  verified: boolean;
  info?: RelayInformationDocument;
}

/**
 * Relay Discovery Options
 */
export interface RelayDiscoveryOptions {
  fromContacts?: boolean;      // Discover from contact list
  fromEvents?: boolean;        // Discover from event tags
  fromNIP05?: boolean;         // Discover from NIP-05 profiles
  fromDirectory?: boolean;     // Discover from relay directory
  minRecommendations?: number; // Min recommendations to trust relay
}

// ========================================
// Relay Performance Tracking
// ========================================

/**
 * Relay Performance Metrics
 */
export interface RelayPerformanceMetrics {
  url: string;
  timestamp: number;
  period: {
    start: number;
    end: number;
  };
  metrics: {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;          // Events per second
    successRate: number;         // 0-1
    errorRate: number;           // 0-1
    availability: number;        // 0-1
    bandwidth: {
      sent: number;              // Bytes
      received: number;          // Bytes
    };
  };
}

// ========================================
// Relay Load Balancing
// ========================================

/**
 * Relay Load Balancer
 */
export interface RelayLoadBalancer {
  strategy: RelaySelectionStrategy;
  selectRelay(availableRelays: string[], operation: 'read' | 'write'): string;
  selectRelays(availableRelays: string[], count: number, operation: 'read' | 'write'): string[];
  updateMetrics(relay: string, metrics: RelayPerformanceMetrics): void;
  getRecommendedRelays(count: number): string[];
}

// ========================================
// Type Compatibility
// ========================================

/**
 * Ensure compatibility with nostr-tools Relay type
 */
export type NostrToolsRelayCompat = NostrToolsRelay;

// ========================================
// Export Schemas for Validation
// ========================================

export const NostrRelaySchemas = {
  Relay: NostrRelaySchema,
  RelayConfig: RelayConfigSchema,
  RelayInformationDocument: RelayInformationDocumentSchema,
} as const;
