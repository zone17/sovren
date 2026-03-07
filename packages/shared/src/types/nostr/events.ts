/**
 * NOSTR Event Types - Consolidated Type Definitions
 *
 * US-308: Consolidate NOSTR Type Definitions
 * Epic 003: NOSTR Consolidation
 *
 * Complete type definitions for NOSTR events following NIP-01 specification
 * https://github.com/nostr-protocol/nips/blob/master/01.md
 */

import { z } from 'zod';
import type { Event as NostrToolsEvent } from 'nostr-tools';

// ========================================
// NOSTR Event Kinds (NIP-01)
// ========================================

/**
 * Standard NOSTR event kinds
 * Extended with Sovren-specific kinds for creator monetization
 */
export enum NostrEventKind {
  // Core Protocol Events (NIP-01)
  SET_METADATA = 0, // User profile metadata
  TEXT_NOTE = 1, // Short text note
  RECOMMEND_RELAY = 2, // Recommend relay
  CONTACTS = 3, // Contact list (NIP-02)
  ENCRYPTED_DIRECT_MESSAGE = 4, // Encrypted DM (NIP-04)
  DELETE = 5, // Event deletion
  REPOST = 6, // Repost/boost
  REACTION = 7, // Like/reaction

  // Channel Events (NIP-28)
  CHANNEL_CREATE = 40, // Channel creation
  CHANNEL_METADATA = 41, // Channel metadata
  CHANNEL_MESSAGE = 42, // Channel message
  CHANNEL_HIDE_MESSAGE = 43, // Hide channel message
  CHANNEL_MUTE_USER = 44, // Mute user in channel

  // Replaceable Events (NIP-16)
  CHANNEL_CREATE_REPLACEABLE = 40,
  CHANNEL_METADATA_REPLACEABLE = 41,

  // Parameterized Replaceable Events (NIP-33)
  LONG_FORM_CONTENT = 30023, // Long-form article (NIP-23)

  // Sovren-specific Events (30024-30030 range reserved)
  CREATOR_PROFILE = 30024, // Enhanced creator profile
  MONETIZATION_EVENT = 30025, // Payment/subscription event
  CREATOR_CONTENT = 30026, // Gated creator content
  SUBSCRIPTION_TIER = 30027, // Subscription tier definition
  PAYMENT_REQUEST = 30028, // Payment request/invoice
  PAYMENT_RECEIPT = 30029, // Payment confirmation
  CONTENT_UNLOCK = 30030, // Content access grant
}

// ========================================
// Base Event Schemas
// ========================================

/**
 * NOSTR Event Tag Schema
 * Tags are arrays of strings with semantic meaning
 */
export const NostrEventTagSchema = z.array(z.string()).min(1);

/**
 * Complete NOSTR Event Schema (Signed)
 */
export const NostrEventSchema = z.object({
  id: z.string().length(64, 'Event ID must be 64 character hex string'),
  pubkey: z.string().length(64, 'Public key must be 64 character hex string'),
  created_at: z.number().int().positive('Created timestamp must be positive unix timestamp'),
  kind: z.number().int().min(0).max(40000, 'Event kind must be between 0 and 40000'),
  tags: z.array(NostrEventTagSchema).default([]),
  content: z.string().default(''),
  sig: z.string().length(128, 'Signature must be 128 character hex string'),
});

export type NostrEvent = z.infer<typeof NostrEventSchema>;

/**
 * Unsigned NOSTR Event Schema (Before Signing)
 */
export const UnsignedNostrEventSchema = z.object({
  pubkey: z.string().length(64, 'Public key must be 64 character hex string'),
  created_at: z.number().int().positive('Created timestamp must be positive unix timestamp'),
  kind: z.number().int().min(0).max(40000, 'Event kind must be between 0 and 40000'),
  tags: z.array(NostrEventTagSchema).default([]),
  content: z.string().default(''),
});

export type UnsignedNostrEvent = z.infer<typeof UnsignedNostrEventSchema>;

/**
 * Event Template (For creating new events)
 */
export interface EventTemplate {
  kind: NostrEventKind | number;
  tags?: string[][];
  content?: string;
  created_at?: number;
}

// ========================================
// Event Creation Options
// ========================================

/**
 * Text Note Creation Options
 */
export interface TextNoteOptions {
  content: string;
  tags?: string[][];
  replyTo?: string; // Event ID being replied to
  mentions?: string[]; // Pubkeys being mentioned
  hashtags?: string[]; // Hashtags
  relays?: string[]; // Relay hints
}

/**
 * Metadata Event Options (Kind 0)
 */
export interface MetadataEventOptions {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string; // NIP-05 verification identifier
  lud16?: string; // Lightning address (user@domain.com)
  lud06?: string; // LNURL-pay
  [key: string]: unknown; // Allow additional metadata fields
}

/**
 * Contact List Options (Kind 3)
 */
export interface ContactListOptions {
  contacts: Array<{
    pubkey: string;
    relay?: string;
    petname?: string;
  }>;
}

/**
 * Direct Message Options (Kind 4)
 */
export interface DirectMessageOptions {
  recipient: string; // Recipient pubkey
  content: string; // Plain text (will be encrypted)
  tags?: string[][];
}

/**
 * Deletion Event Options (Kind 5)
 */
export interface DeletionEventOptions {
  eventIds: string[]; // Event IDs to delete
  reason?: string; // Optional deletion reason
}

/**
 * Reaction Event Options (Kind 7)
 */
export interface ReactionEventOptions {
  eventId: string; // Event being reacted to
  content: string; // Reaction (e.g., "+", "❤️")
  eventAuthor?: string; // Author of event being reacted to
}

/**
 * Repost Event Options (Kind 6)
 */
export interface RepostEventOptions {
  event: NostrEvent; // Event being reposted
  comment?: string; // Optional comment on repost
}

// ========================================
// Event Validation
// ========================================

/**
 * Event Validation Result
 */
export interface EventValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Event Validation Options
 */
export interface EventValidationOptions {
  checkSignature?: boolean;
  checkId?: boolean;
  checkTimestamp?: boolean;
  allowFutureTimestamps?: boolean;
  maxFutureOffset?: number; // Max seconds in future
  maxPastOffset?: number; // Max seconds in past
}

// ========================================
// Event Metadata and Extensions
// ========================================

/**
 * Event with Additional Metadata
 * Used for storing events with relay/cache information
 */
export interface EventWithMetadata extends NostrEvent {
  relay?: string; // Relay where event was received
  received?: number; // Unix timestamp when received
  verified?: boolean; // Signature verified flag
  cached?: boolean; // Whether event is from cache
  seenOn?: string[]; // List of relays event was seen on
}

/**
 * Event Cache Entry
 */
export const EventCacheEntrySchema = z.object({
  event: NostrEventSchema,
  timestamp: z.number().positive(),
  relay: z.string().url(),
  verified: z.boolean().default(false),
  ttl: z.number().positive().optional(),
  expiresAt: z.number().positive().optional(),
});

export type EventCacheEntry = z.infer<typeof EventCacheEntrySchema>;

// ========================================
// Event Publishing
// ========================================

/**
 * Event Publishing Options
 */
export interface PublishOptions {
  relays?: string[]; // Specific relays to publish to
  timeout?: number; // Publish timeout in ms
  skipValidation?: boolean; // Skip event validation
  requireMinRelays?: number; // Minimum successful relays required
  requireAll?: boolean; // Require all relays to succeed
}

/**
 * Relay Publish Result
 */
export interface RelayPublishResult {
  relay: string;
  success: boolean;
  error?: string;
  timestamp: number;
  latency?: number;
}

/**
 * Overall Publish Result
 */
export interface PublishResult {
  success: boolean;
  event: NostrEvent;
  eventId: string;
  relayResults: RelayPublishResult[];
  publishedTo: string[];
  failedRelays: string[];
  timestamp: number;
  totalLatency: number;
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
  averageLatency: number;
}

// ========================================
// Event Callbacks and Handlers
// ========================================

/**
 * Event Handler Callback
 */
export type EventCallback = (event: NostrEvent, relay?: string) => void | Promise<void>;

/**
 * Event Error Handler
 */
export type EventErrorHandler = (
  error: Error,
  event?: NostrEvent,
  relay?: string
) => void | Promise<void>;

/**
 * Event Validator Function
 */
export type EventValidator = (
  event: NostrEvent
) => EventValidationResult | Promise<EventValidationResult>;

// ========================================
// Utility Functions
// ========================================

/**
 * Check if event is replaceable (NIP-16)
 */
export function isReplaceableEvent(kind: number): boolean {
  return kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);
}

/**
 * Check if event is ephemeral (NIP-16)
 */
export function isEphemeralEvent(kind: number): boolean {
  return kind >= 20000 && kind < 30000;
}

/**
 * Check if event is parameterized replaceable (NIP-33)
 */
export function isParameterizedReplaceableEvent(kind: number): boolean {
  return kind >= 30000 && kind < 40000;
}

/**
 * Get event coordinate (for parameterized replaceable events)
 */
export function getEventCoordinate(event: NostrEvent): string | null {
  if (!isParameterizedReplaceableEvent(event.kind)) {
    return null;
  }

  const dTag = event.tags.find((tag) => tag[0] === 'd');
  const identifier = dTag?.[1] || '';

  return `${event.kind}:${event.pubkey}:${identifier}`;
}

/**
 * Extract mentions (p tags) from event
 */
export function extractMentions(event: NostrEvent): string[] {
  return event.tags.filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1]);
}

/**
 * Extract event references (e tags) from event
 */
export function extractEventRefs(event: NostrEvent): string[] {
  return event.tags.filter((tag) => tag[0] === 'e' && tag[1]).map((tag) => tag[1]);
}

/**
 * Extract hashtags (t tags) from event
 */
export function extractHashtags(event: NostrEvent): string[] {
  return event.tags.filter((tag) => tag[0] === 't' && tag[1]).map((tag) => tag[1]);
}

// ========================================
// Type Compatibility
// ========================================

/**
 * Ensure compatibility with nostr-tools Event type
 */
export type NostrToolsEventCompat = NostrToolsEvent;

/**
 * Convert our event type to nostr-tools event
 */
export function toNostrToolsEvent(event: NostrEvent): NostrToolsEvent {
  return event as unknown as NostrToolsEvent;
}

/**
 * Convert nostr-tools event to our event type
 */
export function fromNostrToolsEvent(event: NostrToolsEvent): NostrEvent {
  return event as unknown as NostrEvent;
}

// ========================================
// Export Schemas for Validation
// ========================================

export const NostrEventSchemas = {
  Event: NostrEventSchema,
  UnsignedEvent: UnsignedNostrEventSchema,
  EventTag: NostrEventTagSchema,
  EventCacheEntry: EventCacheEntrySchema,
} as const;
