/**
 * 🌐 NOSTR Service Types - Elite Implementation
 *
 * Comprehensive type definitions for NOSTR service operations
 * Epic 001 - Story 10: NOSTR Service Types
 *
 * Integrates with nostr-tools and provides complete type safety
 * for all NOSTR protocol operations
 */

import { Event, Filter, Relay } from 'nostr-tools';
import { z } from 'zod';

// ========================================
// NOSTR Service Configuration
// ========================================

/**
 * NOSTR Service Configuration Schema
 */
export const NostrServiceConfigSchema = z.object({
  relays: z.array(z.string().url()),
  privateKey: z.string().length(64).optional(),
  publicKey: z.string().length(64).optional(),
  autoConnect: z.boolean().default(true),
  connectionTimeout: z.number().positive().default(5000),
  maxRelays: z.number().positive().default(10),
  reconnectAttempts: z.number().nonnegative().default(3),
  reconnectDelay: z.number().positive().default(1000),
  cacheTtl: z.number().positive().default(300000), // 5 minutes
  enableMobileOptimizations: z.boolean().default(true),
  batchSize: z.number().positive().default(50),
  eventValidation: z.boolean().default(true),
});

export type NostrServiceConfig = z.infer<typeof NostrServiceConfigSchema>;

// ========================================
// NOSTR Event Publishing
// ========================================

/**
 * Event Publishing Options
 */
export interface PublishOptions {
  relays?: string[];
  timeout?: number;
  skipValidation?: boolean;
  requireMinRelays?: number;
}

/**
 * Publish Result for Single Relay
 */
export interface RelayPublishResult {
  relay: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

/**
 * Overall Publish Result
 */
export interface PublishResult {
  success: boolean;
  event: Event;
  eventId: string;
  relayResults: RelayPublishResult[];
  publishedTo: string[];
  failedRelays: string[];
  timestamp: number;
}

/**
 * Batch Publish Result
 */
export interface BatchPublishResult {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  results: PublishResult[];
  duration: number;
}

// ========================================
// NOSTR Event Querying
// ========================================

/**
 * Query Options
 */
export interface QueryOptions {
  relays?: string[];
  timeout?: number;
  eoseTimeout?: number;
  maxEvents?: number;
  cacheResults?: boolean;
}

/**
 * Query Result
 */
export interface QueryResult {
  events: Event[];
  relays: string[];
  eose: boolean;
  cached: boolean;
  timestamp: number;
  duration: number;
}

/**
 * Real-time Event Callback
 */
export type EventCallback = (event: Event, relay: string) => void | Promise<void>;

/**
 * EOSE (End of Stored Events) Callback
 */
export type EOSECallback = (relay: string) => void | Promise<void>;

/**
 * Subscription Options
 */
export interface SubscriptionOptions {
  filters: Filter[];
  relays?: string[];
  onEvent: EventCallback;
  onEOSE?: EOSECallback;
  autoUnsubscribe?: boolean;
  maxEvents?: number;
}

/**
 * Subscription Info
 */
export interface SubscriptionInfo {
  id: string;
  filters: Filter[];
  relays: string[];
  active: boolean;
  createdAt: number;
  eventCount: number;
  lastEvent?: number;
}

// ========================================
// NOSTR Relay Management
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
 * Relay Status
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
}

/**
 * Relay Statistics
 */
export interface RelayStatistics {
  url: string;
  eventsSent: number;
  eventsReceived: number;
  subscriptions: number;
  uptime: number;
  averageLatency: number;
  errorRate: number;
}

/**
 * Relay Connection Options
 */
export interface RelayConnectionOptions {
  read?: boolean;
  write?: boolean;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// ========================================
// NOSTR Service Interface
// ========================================

/**
 * Main NOSTR Service Interface
 */
export interface NostrService {
  // Connection Management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectedRelays(): string[];

  // Relay Management
  addRelay(url: string, options?: RelayConnectionOptions): Promise<void>;
  removeRelay(url: string): Promise<void>;
  getRelayStatus(url: string): RelayStatus | undefined;
  getAllRelayStatuses(): RelayStatus[];

  // Event Publishing
  publishEvent(event: Event, options?: PublishOptions): Promise<PublishResult>;
  publishEvents(events: Event[], options?: PublishOptions): Promise<BatchPublishResult>;

  // Event Querying
  queryEvents(filters: Filter[], options?: QueryOptions): Promise<QueryResult>;
  getEvent(eventId: string, options?: QueryOptions): Promise<Event | null>;

  // Subscriptions
  subscribe(options: SubscriptionOptions): string;
  unsubscribe(subscriptionId: string): void;
  unsubscribeAll(): void;
  getSubscription(subscriptionId: string): SubscriptionInfo | undefined;
  getActiveSubscriptions(): SubscriptionInfo[];

  // Event Creation Helpers
  createTextNote(content: string, tags?: string[][]): Promise<Event>;
  createMetadataEvent(metadata: Record<string, unknown>): Promise<Event>;
  createReaction(eventId: string, content: string): Promise<Event>;
  createRepost(event: Event): Promise<Event>;
  createDeletion(eventIds: string[], reason?: string): Promise<Event>;

  // Profile Management
  getProfile(pubkey: string): Promise<Record<string, unknown> | null>;
  updateProfile(metadata: Record<string, unknown>): Promise<Event>;

  // Contact Management
  getContacts(pubkey: string): Promise<string[]>;
  updateContacts(contacts: string[]): Promise<Event>;

  // Direct Messages (NIP-04)
  sendDirectMessage(recipientPubkey: string, content: string): Promise<Event>;
  getDirectMessages(senderPubkey: string): Promise<Event[]>;
  decryptDirectMessage(event: Event, senderPubkey: string): Promise<string>;

  // Statistics
  getStatistics(): NostrServiceStatistics;

  // Cleanup
  destroy(): void;
}

/**
 * NOSTR Service Statistics
 */
export interface NostrServiceStatistics {
  totalRelays: number;
  connectedRelays: number;
  activeSubscriptions: number;
  totalEventsSent: number;
  totalEventsReceived: number;
  cacheHits: number;
  cacheMisses: number;
  uptime: number;
  averageLatency: number;
}

// ========================================
// NOSTR Event Creation Helpers
// ========================================

/**
 * Text Note Options
 */
export interface TextNoteOptions {
  content: string;
  tags?: string[][];
  replyTo?: string;
  mentions?: string[];
  hashtags?: string[];
}

/**
 * Metadata Event Options
 */
export interface MetadataOptions {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
  [key: string]: unknown;
}

/**
 * Direct Message Options
 */
export interface DirectMessageOptions {
  recipient: string;
  content: string;
  tags?: string[][];
}

/**
 * Deletion Event Options
 */
export interface DeletionOptions {
  eventIds: string[];
  reason?: string;
}

// ========================================
// NOSTR Cache Management
// ========================================

/**
 * Cache Entry
 */
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  relay?: string;
}

/**
 * Cache Strategy
 */
export enum CacheStrategy {
  AGGRESSIVE = 'aggressive',
  CONSERVATIVE = 'conservative',
  MINIMAL = 'minimal',
  NONE = 'none',
}

/**
 * Cache Configuration
 */
export interface CacheConfig {
  strategy: CacheStrategy;
  maxSize: number;
  defaultTTL: number;
  enablePersistence: boolean;
}

// ========================================
// NOSTR Service Error Types
// ========================================

/**
 * Base NOSTR Service Error
 */
export class NostrServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NostrServiceError';
  }
}

/**
 * Service Connection Error
 */
export class NostrServiceConnectionError extends NostrServiceError {
  constructor(
    message: string,
    public relay: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONNECTION_ERROR', { ...context, relay });
    this.name = 'NostrServiceConnectionError';
  }
}

/**
 * Publishing Error
 */
export class NostrPublishError extends NostrServiceError {
  constructor(
    message: string,
    public event: Event,
    public failedRelays: string[],
    context?: Record<string, unknown>
  ) {
    super(message, 'PUBLISH_ERROR', { ...context, event, failedRelays });
    this.name = 'NostrPublishError';
  }
}

/**
 * Service Validation Error
 */
export class NostrServiceValidationError extends NostrServiceError {
  constructor(
    message: string,
    public event?: Event,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { ...context, event });
    this.name = 'NostrServiceValidationError';
  }
}

/**
 * Subscription Error
 */
export class NostrSubscriptionError extends NostrServiceError {
  constructor(
    message: string,
    public subscriptionId: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'SUBSCRIPTION_ERROR', { ...context, subscriptionId });
    this.name = 'NostrSubscriptionError';
  }
}

/**
 * Timeout Error
 */
export class NostrTimeoutError extends NostrServiceError {
  constructor(
    message: string,
    public operation: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', { ...context, operation });
    this.name = 'NostrTimeoutError';
  }
}

/**
 * Service Cryptography Error
 */
export class NostrServiceCryptographyError extends NostrServiceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CRYPTOGRAPHY_ERROR', context);
    this.name = 'NostrServiceCryptographyError';
  }
}

// ========================================
// NOSTR Event Listeners
// ========================================

/**
 * Service Event Types
 */
export interface NostrServiceEvents {
  'relay:connected': (relay: string) => void;
  'relay:disconnected': (relay: string) => void;
  'relay:error': (relay: string, error: Error) => void;
  'relay:reconnecting': (relay: string, attempt: number) => void;
  'event:published': (event: Event, relays: string[]) => void;
  'event:received': (event: Event, relay: string) => void;
  'event:invalid': (event: unknown, error: Error) => void;
  'subscription:started': (subscriptionId: string, filters: Filter[]) => void;
  'subscription:ended': (subscriptionId: string) => void;
  'subscription:eose': (subscriptionId: string, relay: string) => void;
  'cache:hit': (key: string) => void;
  'cache:miss': (key: string) => void;
  error: (error: NostrServiceError) => void;
}

// ========================================
// NOSTR Mobile Optimizations
// ========================================

/**
 * Mobile Optimization Configuration
 */
export interface MobileOptimizationConfig {
  enabled: boolean;
  batchSize: number;
  connectionPoolSize: number;
  backgroundSyncInterval: number;
  cacheStrategy: CacheStrategy;
  offlineMode: boolean;
  lowDataMode: boolean;
  compressionEnabled: boolean;
}

/**
 * Offline Queue Entry
 */
export interface OfflineQueueEntry {
  id: string;
  event: Event;
  options?: PublishOptions;
  timestamp: number;
  attempts: number;
  lastError?: string;
}

/**
 * Background Sync Status
 */
export interface BackgroundSyncStatus {
  enabled: boolean;
  lastSync: number;
  nextSync: number;
  queueSize: number;
  syncInProgress: boolean;
}

// ========================================
// Utility Types
// ========================================

/**
 * Event Handler
 */
export type NostrServiceEventHandler<T extends Event = Event> = (event: T) => void | Promise<void>;

/**
 * Relay Handler
 */
export type NostrServiceRelayHandler = (relay: string) => void | Promise<void>;

/**
 * Error Handler
 */
export type NostrServiceErrorHandler = (error: NostrServiceError) => void | Promise<void>;

/**
 * Event with Metadata
 */
export interface EventWithMetadata extends Event {
  relay?: string;
  received?: number;
  verified?: boolean;
  cached?: boolean;
}

/**
 * Relay with Connection Info
 */
export interface RelayWithInfo extends Relay {
  url: string;
  status: RelayStatus;
  statistics: RelayStatistics;
}

// ========================================
// Export All Types
// ========================================

export type { Event, Filter, Relay } from 'nostr-tools';

export const NostrServiceSchemas = {
  Config: NostrServiceConfigSchema,
} as const;
