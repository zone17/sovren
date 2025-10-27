/**
 * NOSTR NIP-Specific Types - Consolidated Type Definitions
 *
 * US-308: Consolidate NOSTR Type Definitions
 * Epic 003: NOSTR Consolidation
 *
 * Type definitions for specific NOSTR Implementation Possibilities (NIPs)
 * https://github.com/nostr-protocol/nips
 */

import { z } from 'zod';
import type { NostrEvent } from './events';

// ========================================
// NIP-04: Encrypted Direct Messages
// ========================================

/**
 * Encrypted Direct Message (NIP-04)
 */
export const NostrDirectMessageSchema = z.object({
  id: z.string().length(64),
  from: z.string().length(64),
  to: z.string().length(64),
  content: z.string(),         // Encrypted content
  timestamp: z.number().positive(),
  decrypted: z.string().optional(), // Decrypted content (client-side only)
});

export type NostrDirectMessage = z.infer<typeof NostrDirectMessageSchema>;

/**
 * DM Encryption Options
 */
export interface DMEncryptionOptions {
  algorithm?: 'aes-256-cbc';   // Default encryption algorithm
  encoding?: 'base64' | 'hex'; // Encoding for encrypted data
}

/**
 * Read Receipt Event (Custom - follows NIP convention)
 * Kind 1515: DM Read Receipt
 */
export interface ReadReceiptEvent extends NostrEvent {
  kind: 1515;
  tags: Array<
    | ['e', string]           // Message event ID being acknowledged
    | ['p', string]           // Sender of original message
    | string[]
  >;
  content: string;            // Empty or timestamp
}

/**
 * Read Receipt Status
 */
export interface ReadReceiptStatus {
  messageId: string;
  read: boolean;
  readAt?: number;
  receiptEventId?: string;
}

/**
 * Typing Indicator (Ephemeral Event)
 * Kind 20004: Typing Indicator (Custom)
 */
export interface TypingIndicatorEvent extends NostrEvent {
  kind: 20004;
  tags: Array<
    | ['p', string]           // Recipient pubkey
    | string[]
  >;
  content: 'typing' | 'stopped';
}

/**
 * Message History Request
 */
export interface MessageHistoryRequest {
  conversationWith: string;
  limit?: number;
  before?: number;            // Timestamp
  after?: number;             // Timestamp
  offset?: number;
}

/**
 * Session Key Info (Forward Secrecy)
 */
export interface SessionKeyInfo {
  keyId: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
  messageCount: number;
  rotationThreshold: number;
}

/**
 * Spam Protection Config
 */
export interface SpamProtectionConfig {
  rateLimit: {
    maxMessagesPerMinute: number;
    maxMessagesPerHour: number;
  };
  requirePoW: boolean;
  powDifficulty: number;      // Leading zeros required
  blockList: Set<string>;     // Blocked pubkeys
  allowList: Set<string>;     // Always allowed pubkeys
}

// ========================================
// NIP-05: DNS-based Verification
// ========================================

/**
 * NIP-05 Verification Result
 */
export interface NIP05VerificationResult {
  verified: boolean;
  identifier: string;          // name@domain.com
  pubkey: string;
  relays?: string[];
  error?: string;
}

/**
 * NIP-05 Verification Options
 */
export interface NIP05VerificationOptions {
  timeout?: number;            // Verification timeout (ms)
  allowHttp?: boolean;         // Allow HTTP (not recommended)
  cacheDuration?: number;      // Cache duration (ms)
}

// ========================================
// NIP-19: Bech32 Encoded Entities
// ========================================

/**
 * NIP-19 Entity Types
 */
export enum NIP19EntityType {
  NPUB = 'npub',               // Public key
  NSEC = 'nsec',               // Private key (secret)
  NOTE = 'note',               // Event ID
  NPROFILE = 'nprofile',       // Profile with relays
  NEVENT = 'nevent',           // Event with relays
  NRELAY = 'nrelay',           // Relay URL
  NADDR = 'naddr',             // Parameterized replaceable event
}

/**
 * Decoded npub/nsec
 */
export interface DecodedKey {
  type: NIP19EntityType.NPUB | NIP19EntityType.NSEC;
  data: string;                // Hex public or private key
}

/**
 * Decoded note
 */
export interface DecodedNote {
  type: NIP19EntityType.NOTE;
  data: string;                // Hex event ID
}

/**
 * Decoded nprofile
 */
export interface DecodedProfile {
  type: NIP19EntityType.NPROFILE;
  data: {
    pubkey: string;
    relays?: string[];
  };
}

/**
 * Decoded nevent
 */
export interface DecodedEvent {
  type: NIP19EntityType.NEVENT;
  data: {
    id: string;
    relays?: string[];
    author?: string;
    kind?: number;
  };
}

/**
 * Decoded naddr (NIP-33)
 */
export interface DecodedAddress {
  type: NIP19EntityType.NADDR;
  data: {
    identifier: string;
    pubkey: string;
    kind: number;
    relays?: string[];
  };
}

/**
 * Any decoded NIP-19 entity
 */
export type DecodedNIP19 =
  | DecodedKey
  | DecodedNote
  | DecodedProfile
  | DecodedEvent
  | DecodedAddress;

// ========================================
// NIP-26: Delegated Event Signing
// ========================================

/**
 * Delegation Token (NIP-26)
 */
export interface DelegationToken {
  delegator: string;           // Delegator's pubkey
  delegatee: string;           // Delegatee's pubkey
  conditions: string;          // Delegation conditions
  signature: string;           // Delegator's signature
}

/**
 * Delegation Conditions
 */
export interface DelegationConditions {
  kind?: number;               // Allowed event kind
  created_at_after?: number;   // Min timestamp
  created_at_before?: number;  // Max timestamp
}

/**
 * Delegated Event
 */
export interface DelegatedEvent extends NostrEvent {
  tags: Array<['delegation', string, string, string]> | string[][];
}

// ========================================
// NIP-42: Authentication
// ========================================

/**
 * Auth Challenge (NIP-42)
 */
export interface AuthChallenge {
  challenge: string;
  relay: string;
}

/**
 * Auth Response Event
 */
export interface AuthEvent extends NostrEvent {
  kind: 22242;
  tags: Array<['relay', string] | ['challenge', string]>;
}

// ========================================
// NIP-65: Relay List Metadata
// ========================================

/**
 * Relay Metadata (NIP-65)
 */
export interface RelayMetadata {
  /** Relay WebSocket URL */
  url: string;
  /** Supports reading events */
  read: boolean;
  /** Supports writing/publishing events */
  write: boolean;
}

/**
 * Relay List Event (kind 10002)
 */
export interface RelayListEvent extends NostrEvent {
  kind: 10002;
  tags: Array<
    | ['r', string]                // read + write
    | ['r', string, 'read']        // read-only
    | ['r', string, 'write']       // write-only
    | string[]
  >;
  content: string;                 // Should be empty string
}

/**
 * Parsed Relay List
 */
export interface ParsedRelayList {
  /** All relays with capabilities */
  relays: RelayMetadata[];
  /** Read-capable relay URLs */
  readRelays: string[];
  /** Write-capable relay URLs */
  writeRelays: string[];
  /** Event metadata */
  publishedAt: number;
  /** Event ID */
  eventId: string;
}

/**
 * Relay Preference Update
 */
export interface RelayPreferenceUpdate {
  /** Relay URL */
  url: string;
  /** New read capability (undefined = no change) */
  read?: boolean;
  /** New write capability (undefined = no change) */
  write?: boolean;
  /** Remove relay entirely */
  remove?: boolean;
}

// ========================================
// NIP-23: Long-form Content
// ========================================

/**
 * Long-form Content Metadata
 */
export interface LongFormContentMetadata {
  title?: string;
  image?: string;
  summary?: string;
  published_at?: number;
  tags?: string[];
}

/**
 * Long-form Content Event
 */
export interface LongFormContentEvent extends NostrEvent {
  kind: 30023;
  tags: Array<
    | ['d', string]           // Unique identifier
    | ['title', string]
    | ['image', string]
    | ['summary', string]
    | ['published_at', string]
    | ['t', string]           // Hashtags
    | string[]
  >;
}

// ========================================
// NIP-25: Reactions
// ========================================

/**
 * Reaction Content Types
 */
export enum ReactionType {
  LIKE = '+',
  DISLIKE = '-',
  HEART = '❤️',
  FIRE = '🔥',
  ROCKET = '🚀',
  THUMBS_UP = '👍',
  THUMBS_DOWN = '👎',
}

/**
 * Reaction Event
 */
export interface ReactionEvent extends NostrEvent {
  kind: 7;
  content: string;             // Reaction emoji or +/-
  tags: Array<
    | ['e', string]           // Event being reacted to
    | ['p', string]           // Event author
    | ['k', string]           // Event kind
    | string[]
  >;
}

// ========================================
// NIP-28: Public Chat (Channels)
// ========================================

/**
 * Channel Metadata
 */
export interface ChannelMetadata {
  name: string;
  about?: string;
  picture?: string;
}

/**
 * Channel Create Event
 */
export interface ChannelCreateEvent extends NostrEvent {
  kind: 40;
  content: string;             // JSON stringified ChannelMetadata
}

/**
 * Channel Message Event
 */
export interface ChannelMessageEvent extends NostrEvent {
  kind: 42;
  content: string;
  tags: Array<
    | ['e', string, (string | undefined)?, ('root' | 'reply' | undefined)?]  // Channel ID or message being replied to
    | ['p', string]                               // Mentioned pubkeys
    | string[]
  >;
}

// ========================================
// NIP-33: Parameterized Replaceable Events
// ========================================

/**
 * Parameterized Replaceable Event
 */
export interface ParameterizedReplaceableEvent extends NostrEvent {
  kind: number;                // 30000-39999
  tags: Array<['d', string] | string[]>; // Must include 'd' tag
}

/**
 * Event Coordinate (NIP-33)
 */
export interface EventCoordinate {
  kind: number;
  pubkey: string;
  identifier: string;          // 'd' tag value
}

// ========================================
// NIP-40: Expiration Timestamp
// ========================================

/**
 * Event with Expiration
 */
export interface ExpiringEvent extends NostrEvent {
  tags: Array<['expiration', string] | string[]>;
}

// ========================================
// NIP-45: Event Counts
// ========================================

/**
 * Count Request
 */
export interface CountRequest {
  id: string;
  filters: object[];
}

/**
 * Count Response
 */
export interface CountResponse {
  id: string;
  count: number;
  approximate?: boolean;
}

// ========================================
// NIP-50: Search Capability
// ========================================

/**
 * Search Options
 */
export interface SearchOptions {
  query: string;
  kinds?: number[];
  authors?: string[];
  limit?: number;
  since?: number;
  until?: number;
}

// ========================================
// NIP-56: Reporting
// ========================================

/**
 * Report Type
 */
export enum ReportType {
  NUDITY = 'nudity',
  PROFANITY = 'profanity',
  ILLEGAL = 'illegal',
  SPAM = 'spam',
  IMPERSONATION = 'impersonation',
  OTHER = 'other',
}

/**
 * Report Event
 */
export interface ReportEvent extends NostrEvent {
  kind: 1984;
  tags: Array<
    | ['e', string]           // Event being reported
    | ['p', string]           // Pubkey being reported
    | ['report', string]      // Report type
    | string[]
  >;
}

// ========================================
// NIP-57: Lightning Zaps
// ========================================

/**
 * Zap Request
 */
export interface ZapRequest extends NostrEvent {
  kind: 9734;
  tags: Array<
    | ['relays', ...string[]]
    | ['amount', string]
    | ['lnurl', string]
    | ['p', string]           // Recipient pubkey
    | ['e', string]           // Event being zapped
    | string[]
  >;
}

/**
 * Zap Receipt
 */
export interface ZapReceipt extends NostrEvent {
  kind: 9735;
  tags: Array<
    | ['bolt11', string]      // Lightning invoice
    | ['description', string] // Zap request
    | ['p', string]           // Recipient
    | ['e', string]           // Zapped event
    | string[]
  >;
}

// ========================================
// Sovren-Specific NIPs (Custom)
// ========================================

/**
 * Sovren Creator Profile (Custom)
 */
export interface CreatorProfileEvent extends NostrEvent {
  kind: 30024;
  tags: Array<
    | ['d', string]           // Profile identifier
    | ['name', string]
    | ['about', string]
    | ['picture', string]
    | ['banner', string]
    | ['subscription_tiers', string] // JSON
    | ['payment_methods', string]    // JSON
    | string[]
  >;
}

/**
 * Sovren Monetization Event (Custom)
 */
export interface MonetizationEvent extends NostrEvent {
  kind: 30025;
  tags: Array<
    | ['d', string]           // Transaction ID
    | ['amount', string]
    | ['currency', string]
    | ['payment_method', string]
    | ['content_id', string]
    | ['tier', string]
    | string[]
  >;
}

// ========================================
// NIP Support Detection
// ========================================

/**
 * Supported NIPs
 */
export const SUPPORTED_NIPS = [
  1,   // Basic protocol
  2,   // Contact list
  4,   // Encrypted DMs
  5,   // Event deletion
  9,   // Event deletion
  11,  // Relay information
  19,  // Bech32 entities
  23,  // Long-form content
  25,  // Reactions
  26,  // Delegated signing
  28,  // Public chat
  33,  // Parameterized replaceable events
  40,  // Expiration
  42,  // Authentication
  45,  // Event counts
  50,  // Search
  56,  // Reporting
  57,  // Lightning zaps
  65,  // Relay list metadata
] as const;

/**
 * Check if NIP is supported
 */
export function isNIPSupported(nip: number): boolean {
  return SUPPORTED_NIPS.includes(nip as typeof SUPPORTED_NIPS[number]);
}

// ========================================
// Export Schemas for Validation
// ========================================

export const NostrNIPSchemas = {
  DirectMessage: NostrDirectMessageSchema,
} as const;
