import { z } from 'zod';

// 🌐 NOSTR Protocol Types - Elite Implementation
// Following NIPs (NOSTR Implementation Possibilities) standards

/**
 * NOSTR Event Kinds (NIP-01)
 * https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export enum NostrEventKind {
  // Core Protocol Events
  SET_METADATA = 0,           // User profile metadata
  TEXT_NOTE = 1,              // Short text note
  RECOMMEND_RELAY = 2,        // Recommend relay
  CONTACTS = 3,               // Contact list (NIP-02)
  ENCRYPTED_DIRECT_MESSAGE = 4, // Encrypted DM (NIP-04)
  DELETE = 5,                 // Event deletion
  REPOST = 6,                 // Repost/boost
  REACTION = 7,               // Like/reaction

  // Extended Protocol Events
  CHANNEL_CREATE = 40,        // Channel creation
  CHANNEL_METADATA = 41,      // Channel metadata
  CHANNEL_MESSAGE = 42,       // Channel message

  // Sovren-specific Events
  CREATOR_CONTENT = 30023,    // Long-form content
  CREATOR_PROFILE = 30024,    // Creator profile
  MONETIZATION_EVENT = 30025, // Payment/monetization
}

/**
 * NOSTR Event Schema (NIP-01)
 */
export const NostrEventSchema = z.object({
  id: z.string(),
  pubkey: z.string().length(64, 'Public key must be 64 characters'),
  created_at: z.number().int().positive(),
  kind: z.nativeEnum(NostrEventKind),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string().length(128, 'Signature must be 128 characters'),
});

export type NostrEvent = z.infer<typeof NostrEventSchema>;

/**
 * Unsigned NOSTR Event Schema
 */
export const UnsignedNostrEventSchema = NostrEventSchema.omit({ id: true, sig: true });
export type UnsignedNostrEvent = z.infer<typeof UnsignedNostrEventSchema>;

/**
 * NOSTR Filter Schema (NIP-01)
 */
export const NostrFilterSchema = z.object({
  ids: z.array(z.string()).optional(),
  authors: z.array(z.string()).optional(),
  kinds: z.array(z.nativeEnum(NostrEventKind)).optional(),
  since: z.number().int().optional(),
  until: z.number().int().optional(),
  limit: z.number().int().positive().max(5000).optional(),
  '#e': z.array(z.string()).optional(), // Event references
  '#p': z.array(z.string()).optional(), // Pubkey references
  search: z.string().optional(),
});

export type NostrFilter = z.infer<typeof NostrFilterSchema>;

/**
 * NOSTR Relay Message Types
 */
export type NostrRelayMessage =
  | ['EVENT', string, NostrEvent]
  | ['OK', string, boolean, string]
  | ['EOSE', string]
  | ['CLOSED', string, string]
  | ['NOTICE', string]
  | ['REQ', string, ...NostrFilter[]]
  | ['CLOSE', string];

/**
 * NOSTR Relay Connection State
 */
export enum NostrRelayState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * NOSTR Relay Schema
 */
export const NostrRelaySchema = z.object({
  url: z.string().url(),
  state: z.nativeEnum(NostrRelayState),
  lastConnected: z.number().optional(),
  lastError: z.string().optional(),
  reconnectAttempts: z.number().default(0),
  subscriptions: z.array(z.string()).default([]),
});

export type NostrRelay = z.infer<typeof NostrRelaySchema>;

/**
 * NOSTR User Profile (NIP-01 Metadata)
 */
export const NostrUserProfileSchema = z.object({
  name: z.string().optional(),
  about: z.string().optional(),
  picture: z.string().url().optional(),
  banner: z.string().url().optional(),
  website: z.string().url().optional(),
  nip05: z.string().email().optional(), // NIP-05 verification
  lud16: z.string().optional(),         // Lightning address
  lud06: z.string().optional(),         // LNURL-pay
});

export type NostrUserProfile = z.infer<typeof NostrUserProfileSchema>;

/**
 * NOSTR Contact (NIP-02)
 */
export const NostrContactSchema = z.object({
  pubkey: z.string().length(64),
  relay: z.string().url().optional(),
  petname: z.string().optional(),
});

export type NostrContact = z.infer<typeof NostrContactSchema>;

/**
 * NOSTR Direct Message (NIP-04)
 */
export const NostrDirectMessageSchema = z.object({
  id: z.string(),
  from: z.string().length(64),
  to: z.string().length(64),
  content: z.string(), // Encrypted content
  timestamp: z.number(),
  decrypted: z.string().optional(), // Decrypted content (client-side only)
});

export type NostrDirectMessage = z.infer<typeof NostrDirectMessageSchema>;

/**
 * NOSTR Service Configuration
 */
export const NostrServiceConfigSchema = z.object({
  relays: z.array(z.string().url()),
  privateKey: z.string().length(64).optional(),
  publicKey: z.string().length(64).optional(),
  autoConnect: z.boolean().default(true),
  connectionTimeout: z.number().positive().default(5000),
  maxRelays: z.number().positive().default(10),
  cacheTtl: z.number().positive().default(300000), // 5 minutes
  enableMobileOptimizations: z.boolean().default(true),
});

export type NostrServiceConfig = z.infer<typeof NostrServiceConfigSchema>;

/**
 * NOSTR Event Cache Entry
 */
export const NostrEventCacheEntrySchema = z.object({
  event: NostrEventSchema,
  timestamp: z.number(),
  relay: z.string().url(),
  verified: z.boolean().default(false),
});

export type NostrEventCacheEntry = z.infer<typeof NostrEventCacheEntrySchema>;

/**
 * NOSTR Subscription
 */
export const NostrSubscriptionSchema = z.object({
  id: z.string(),
  filters: z.array(NostrFilterSchema),
  relay: z.string().url(),
  active: z.boolean().default(true),
  createdAt: z.number(),
  lastEvent: z.number().optional(),
});

export type NostrSubscription = z.infer<typeof NostrSubscriptionSchema>;

/**
 * NOSTR Key Pair
 */
export const NostrKeyPairSchema = z.object({
  privateKey: z.string().length(64),
  publicKey: z.string().length(64),
  created: z.number(),
  encrypted: z.boolean().default(false),
});

export type NostrKeyPair = z.infer<typeof NostrKeyPairSchema>;

/**
 * NOSTR Service State
 */
export interface NostrServiceState {
  isInitialized: boolean;
  isConnecting: boolean;
  connectedRelays: NostrRelay[];
  subscriptions: Map<string, NostrSubscription>;
  eventCache: Map<string, NostrEventCacheEntry>;
  userProfile: NostrUserProfile | null;
  contacts: NostrContact[];
  directMessages: NostrDirectMessage[];
  lastActivity: number;
}

/**
 * NOSTR Service Events
 */
export interface NostrServiceEvents {
  'relay:connected': (relay: NostrRelay) => void;
  'relay:disconnected': (relay: NostrRelay) => void;
  'relay:error': (relay: NostrRelay, error: Error) => void;
  'event:received': (event: NostrEvent, relay: string) => void;
  'event:published': (event: NostrEvent) => void;
  'subscription:started': (subscription: NostrSubscription) => void;
  'subscription:ended': (subscriptionId: string) => void;
  'profile:updated': (profile: NostrUserProfile) => void;
  'contacts:updated': (contacts: NostrContact[]) => void;
  'message:received': (message: NostrDirectMessage) => void;
}

/**
 * NOSTR AI Content Discovery Types
 */
export const NostrAIContentRecommendationSchema = z.object({
  eventId: z.string(),
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  category: z.string(),
  timestamp: z.number(),
});

export type NostrAIContentRecommendation = z.infer<typeof NostrAIContentRecommendationSchema>;

/**
 * NOSTR Error Types
 */
export class NostrError extends Error {
  constructor(
    message: string,
    public code: string,
    public relay?: string,
    public event?: NostrEvent
  ) {
    super(message);
    this.name = 'NostrError';
  }
}

export class NostrConnectionError extends NostrError {
  constructor(message: string, relay: string) {
    super(message, 'CONNECTION_ERROR', relay);
    this.name = 'NostrConnectionError';
  }
}

export class NostrValidationError extends NostrError {
  constructor(message: string, event?: NostrEvent) {
    super(message, 'VALIDATION_ERROR', undefined, event);
    this.name = 'NostrValidationError';
  }
}

export class NostrCryptographyError extends NostrError {
  constructor(message: string) {
    super(message, 'CRYPTOGRAPHY_ERROR');
    this.name = 'NostrCryptographyError';
  }
}

/**
 * NOSTR Utility Types
 */
export type NostrEventHandler = (event: NostrEvent) => void | Promise<void>;
export type NostrRelayHandler = (relay: NostrRelay) => void | Promise<void>;
export type NostrErrorHandler = (error: NostrError) => void | Promise<void>;

/**
 * NOSTR Mobile Optimization Types
 */
export interface NostrMobileConfig {
  batchSize: number;
  connectionPoolSize: number;
  backgroundSyncInterval: number;
  cacheStrategy: 'aggressive' | 'conservative' | 'minimal';
  offlineMode: boolean;
}

/**
 * Export all schemas for validation
 */
export const NostrSchemas = {
  Event: NostrEventSchema,
  UnsignedEvent: UnsignedNostrEventSchema,
  Filter: NostrFilterSchema,
  Relay: NostrRelaySchema,
  UserProfile: NostrUserProfileSchema,
  Contact: NostrContactSchema,
  DirectMessage: NostrDirectMessageSchema,
  ServiceConfig: NostrServiceConfigSchema,
  EventCacheEntry: NostrEventCacheEntrySchema,
  Subscription: NostrSubscriptionSchema,
  KeyPair: NostrKeyPairSchema,
  AIContentRecommendation: NostrAIContentRecommendationSchema,
} as const;
