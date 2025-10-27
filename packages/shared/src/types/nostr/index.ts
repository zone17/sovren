/**
 * NOSTR Types - Consolidated Type System
 *
 * US-308: Consolidate NOSTR Type Definitions
 * Epic 003: NOSTR Consolidation
 *
 * Single source of truth for all NOSTR-related TypeScript types
 * Organized by category for easy imports and maintenance
 *
 * @example
 * ```typescript
 * // Import everything
 * import * as Nostr from '@shared/types/nostr';
 *
 * // Import specific categories
 * import { NostrEvent, NostrEventKind } from '@shared/types/nostr';
 * import { NostrKeyPair, NostrKeyFormat } from '@shared/types/nostr';
 * import { NostrFilter, CommonFilters } from '@shared/types/nostr';
 * import { RelayStatus, RelayState } from '@shared/types/nostr';
 * ```
 */

// ========================================
// Events
// ========================================

export type {
  NostrEvent,
  UnsignedNostrEvent,
  EventTemplate,
  EventWithMetadata,
  EventCacheEntry,
  EventValidationResult,
  EventValidationOptions,
  PublishOptions,
  PublishResult,
  BatchPublishResult,
  RelayPublishResult,
  EventCallback as EventCallbackFromEvents,
  EventErrorHandler,
  EventValidator,
  TextNoteOptions,
  MetadataEventOptions,
  ContactListOptions,
  DirectMessageOptions,
  DeletionEventOptions,
  ReactionEventOptions,
  RepostEventOptions,
} from './events';

export {
  NostrEventKind,
  NostrEventSchema,
  UnsignedNostrEventSchema,
  NostrEventTagSchema,
  EventCacheEntrySchema,
  isReplaceableEvent,
  isEphemeralEvent,
  isParameterizedReplaceableEvent,
  getEventCoordinate,
  extractMentions,
  extractEventRefs,
  extractHashtags,
  toNostrToolsEvent,
  fromNostrToolsEvent,
} from './events';

// Import all schemas explicitly for NostrSchemas object
import {
  NostrEventSchema,
  UnsignedNostrEventSchema,
  NostrEventTagSchema,
  EventCacheEntrySchema
} from './events';
import {
  NostrKeyPairSchema,
  NostrEnhancedKeyPairSchema,
  NostrKeyDerivationSchema,
  NostrMnemonicBackupSchema,
  NostrKeyStorageConfigSchema,
  NostrHardwareWalletSchema,
  NostrBrowserExtensionSchema,
  NostrKeyUsageAnalyticsSchema,
  NostrKeySecurityMonitoringSchema,
  NostrKeyRotationSchema,
  NostrKeyRecoverySchema,
} from './keys';
import {
  NostrRelaySchema,
  RelayConfigSchema,
  RelayInformationDocumentSchema,
} from './relays';
import {
  NostrFilterSchema,
  SubscriptionInfoSchema,
} from './filters';
import {
  NostrDirectMessageSchema,
} from './nips';

// Re-export for re-use elsewhere
import type { NostrEvent as NostrEventType } from './events';
import { SUPPORTED_NIPS } from './nips';

// ========================================
// Keys
// ========================================

export type {
  NostrKeyPair,
  NostrEnhancedKeyPair,
  NostrKeyDerivation,
  NostrMnemonicBackup,
  NostrKeyStorageConfig,
  NostrHardwareWallet,
  NostrBrowserExtension,
  NostrKeyUsageAnalytics,
  NostrKeySecurityMonitoring,
  NostrKeyRotation,
  NostrKeyRecovery,
  NostrKeyValidationResult,
  KeyFormatValidation,
  NostrKeyManagementOperation,
  NostrKeyManagementResult,
  NostrKeyManagementState,
} from './keys';

export {
  NostrKeyFormat,
  NostrEntropySource,
  NostrKeyStorageType,
  NostrKeyBackupMethod,
  NostrKeySecurityLevel,
  NostrKeyPairSchema,
  NostrEnhancedKeyPairSchema,
  NostrKeyDerivationSchema,
  NostrMnemonicBackupSchema,
  NostrKeyStorageConfigSchema,
  NostrHardwareWalletSchema,
  NostrBrowserExtensionSchema,
  NostrKeyUsageAnalyticsSchema,
  NostrKeySecurityMonitoringSchema,
  NostrKeyRotationSchema,
  NostrKeyRecoverySchema,
  NostrKeySchemas,
} from './keys';

// ========================================
// Relays
// ========================================

export type {
  NostrRelay,
  RelayStatus,
  RelayConfig,
  RelayWithInfo,
  RelayStatistics,
  RelayInformationDocument,
  RelayConnectionOptions,
  RelayEventHandlers,
  RelayPoolConfig,
  RelayHealthCheck,
  RelayHealthMonitoringConfig,
  RelayRecommendation,
  RelayDiscoveryOptions,
  RelayPerformanceMetrics,
  RelayLoadBalancer,
  NostrRelayMessage,
  NostrClientMessage,
  RelayConnectedCallback,
  RelayDisconnectedCallback,
  RelayErrorCallback,
  RelayNoticeCallback,
  RelayAuthCallback,
} from './relays';

export {
  RelayState,
  RelaySelectionStrategy,
  RelayHealthStatus,
  NostrRelaySchema,
  RelayConfigSchema,
  RelayInformationDocumentSchema,
  NostrRelaySchemas,
} from './relays';

// ========================================
// Filters & Subscriptions
// ========================================

export type {
  NostrFilter,
  SubscriptionInfo,
  EnhancedSubscriptionInfo,
  SubscriptionOptions,
  EventCallback as EventCallbackFromFilters,
  EOSECallback,
  SubscriptionErrorCallback,
  QueryOptions,
  QueryResult,
  FilterValidationResult,
} from './filters';

export {
  SubscriptionState,
  NostrFilterSchema,
  SubscriptionInfoSchema,
  NostrFilterSchemas,
  NostrFilterBuilder,
  CommonFilters,
  validateFilter,
  optimizeFilter,
  eventMatchesFilter,
} from './filters';

// ========================================
// Authentication
// ========================================

export type {
  NostrAuthChallenge,
  NostrAuthToken,
  NostrAuthUser,
  NostrProfile,
  NostrSession,
  NostrAuthRequest,
  NostrAuthResponse,
  NostrTokenRefreshRequest,
  NostrSecurityEvent,
  NostrRateLimitInfo,
  NostrAuthConfig,
  NostrAuthResult,
  NostrAuthMethod,
  NostrSessionState,
} from './auth';

export {
  NostrAuthChallengeSchema,
  NostrAuthTokenSchema,
  NostrAuthRequestSchema,
  NostrAuthResponseSchema,
  DEFAULT_AUTH_CONFIG,
  NostrAuthError,
  isNostrAuthChallenge,
  isNostrAuthToken,
  isAuthenticated,
} from './auth';

// ========================================
// NIPs (NOSTR Implementation Possibilities)
// ========================================

export type {
  // NIP-04
  NostrDirectMessage,
  DMEncryptionOptions,
  // NIP-05
  NIP05VerificationResult,
  NIP05VerificationOptions,
  // NIP-19
  DecodedKey,
  DecodedNote,
  DecodedProfile,
  DecodedEvent,
  DecodedAddress,
  DecodedNIP19,
  // NIP-26
  DelegationToken,
  DelegationConditions,
  DelegatedEvent,
  // NIP-42
  AuthChallenge,
  AuthEvent,
  // NIP-65
  RelayMetadata,
  RelayListEvent,
  ParsedRelayList,
  RelayPreferenceUpdate,
  // NIP-23
  LongFormContentMetadata,
  LongFormContentEvent,
  // NIP-25
  ReactionEvent,
  // NIP-28
  ChannelMetadata,
  ChannelCreateEvent,
  ChannelMessageEvent,
  // NIP-33
  ParameterizedReplaceableEvent,
  EventCoordinate,
  // NIP-40
  ExpiringEvent,
  // NIP-45
  CountRequest,
  CountResponse,
  // NIP-50
  SearchOptions,
  // NIP-56
  ReportEvent,
  // NIP-57
  ZapRequest,
  ZapReceipt,
  // Sovren Custom
  CreatorProfileEvent,
  MonetizationEvent,
} from './nips';

export {
  NIP19EntityType,
  ReactionType,
  ReportType,
  SUPPORTED_NIPS,
  isNIPSupported,
  NostrDirectMessageSchema,
  NostrNIPSchemas,
} from './nips';

// ========================================
// Sovren Custom NIPs
// ========================================

export type {
  // Event Kinds
  SovrenEventKind,
  // Creator Profile Extended (Kind 30078)
  SocialLink,
  PaymentMethod,
  CreatorProfileExtendedContent,
  CreatorProfileExtendedEvent,
  // Content Monetization (Kind 30079)
  PricingTier,
  PaywallConfig,
  ContentMonetizationContent,
  ContentMonetizationEvent,
  // Analytics Event (Kind 30080)
  EngagementMetrics,
  RevenueMetrics,
  AnalyticsEventContent,
  AnalyticsEvent,
  // Subscription Management (Kind 30081)
  SubscriptionBenefits,
  SubscriptionTier,
  SubscriptionStats,
  SubscriptionManagementContent,
  SubscriptionManagementEvent,
  // Content Recommendations (Kind 30082)
  ContentRecommendation,
  RecommendationScore,
  ContentRecommendationsContent,
  ContentRecommendationsEvent,
} from './sovren-nips';

export {
  // Enums
  SovrenEventKind as SovrenEventKindEnum,
  SocialPlatform,
  CreatorCategory,
  AnalyticsEventType,
  RecommendationSource,
  // Schemas
  SovrenNIPSchemas,
  // Parsers
  parseCreatorProfileExtended,
  parseContentMonetization,
  parseAnalyticsEvent,
  parseSubscriptionManagement,
  parseContentRecommendations,
  // Builders
  buildCreatorProfileExtendedTemplate,
  buildContentMonetizationTemplate,
  buildAnalyticsEventTemplate,
  buildSubscriptionManagementTemplate,
  buildContentRecommendationsTemplate,
} from './sovren-nips';

// ========================================
// Utility Types
// ========================================

/**
 * Generic NOSTR service error
 */
export class NostrError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NostrError';
  }
}

/**
 * Connection error
 */
export class NostrConnectionError extends NostrError {
  constructor(message: string, public relay: string) {
    super(message, 'CONNECTION_ERROR', { relay });
    this.name = 'NostrConnectionError';
  }
}

/**
 * Validation error
 */
export class NostrValidationError extends NostrError {
  constructor(message: string, public event?: NostrEventType) {
    super(message, 'VALIDATION_ERROR', { event });
    this.name = 'NostrValidationError';
  }
}

/**
 * Cryptography error
 */
export class NostrCryptographyError extends NostrError {
  constructor(message: string) {
    super(message, 'CRYPTOGRAPHY_ERROR');
    this.name = 'NostrCryptographyError';
  }
}

/**
 * Publishing error
 */
export class NostrPublishError extends NostrError {
  constructor(
    message: string,
    public event: NostrEventType,
    public failedRelays: string[]
  ) {
    super(message, 'PUBLISH_ERROR', { event, failedRelays });
    this.name = 'NostrPublishError';
  }
}

/**
 * Subscription error
 */
export class NostrSubscriptionError extends NostrError {
  constructor(message: string, public subscriptionId: string) {
    super(message, 'SUBSCRIPTION_ERROR', { subscriptionId });
    this.name = 'NostrSubscriptionError';
  }
}

/**
 * Timeout error
 */
export class NostrTimeoutError extends NostrError {
  constructor(message: string, public operation: string) {
    super(message, 'TIMEOUT_ERROR', { operation });
    this.name = 'NostrTimeoutError';
  }
}

// ========================================
// All Schemas Combined
// ========================================

/**
 * All NOSTR Zod schemas for runtime validation
 */
export const NostrSchemas = {
  // Events
  Event: NostrEventSchema,
  UnsignedEvent: UnsignedNostrEventSchema,
  EventTag: NostrEventTagSchema,
  EventCacheEntry: EventCacheEntrySchema,
  // Keys
  KeyPair: NostrKeyPairSchema,
  EnhancedKeyPair: NostrEnhancedKeyPairSchema,
  KeyDerivation: NostrKeyDerivationSchema,
  MnemonicBackup: NostrMnemonicBackupSchema,
  KeyStorageConfig: NostrKeyStorageConfigSchema,
  HardwareWallet: NostrHardwareWalletSchema,
  BrowserExtension: NostrBrowserExtensionSchema,
  KeyUsageAnalytics: NostrKeyUsageAnalyticsSchema,
  KeySecurityMonitoring: NostrKeySecurityMonitoringSchema,
  KeyRotation: NostrKeyRotationSchema,
  KeyRecovery: NostrKeyRecoverySchema,
  // Relays
  Relay: NostrRelaySchema,
  RelayConfig: RelayConfigSchema,
  RelayInformationDocument: RelayInformationDocumentSchema,
  // Filters
  Filter: NostrFilterSchema,
  SubscriptionInfo: SubscriptionInfoSchema,
  // NIPs
  DirectMessage: NostrDirectMessageSchema,
} as const;

// ========================================
// Type Guards
// ========================================

/**
 * Type guard for NostrEvent
 */
export function isNostrEvent(obj: unknown): obj is NostrEventType {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'pubkey' in obj &&
    'created_at' in obj &&
    'kind' in obj &&
    'tags' in obj &&
    'content' in obj &&
    'sig' in obj
  );
}

/**
 * Type guard for NostrFilter
 */
export function isNostrFilter(obj: unknown): obj is import('./filters').NostrFilter {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const validKeys = ['ids', 'authors', 'kinds', 'since', 'until', 'limit', 'search'];
  const objKeys = Object.keys(obj);

  return objKeys.some(key => validKeys.includes(key) || key.startsWith('#'));
}

// ========================================
// Constants
// ========================================

/**
 * Default relay list for Sovren
 * @deprecated Use RelayConfig.getRelayUrls() from @shared/config/relay-config instead
 * This constant is kept for backward compatibility but should not be used in new code.
 */
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.current.fyi',
] as const;

/**
 * Maximum event sizes (bytes)
 */
export const MAX_EVENT_SIZE = {
  TEXT_NOTE: 10000,
  METADATA: 5000,
  LONG_FORM: 100000,
  DIRECT_MESSAGE: 10000,
} as const;

/**
 * Default timeouts (milliseconds)
 */
export const DEFAULT_TIMEOUTS = {
  CONNECTION: 5000,
  PUBLISH: 10000,
  QUERY: 15000,
  EOSE: 10000,
} as const;

// ========================================
// Version
// ========================================

/**
 * NOSTR types package version
 */
export const NOSTR_TYPES_VERSION = '1.0.0';

/**
 * Implementation details
 */
export const NOSTR_IMPLEMENTATION = {
  name: 'Sovren NOSTR Types',
  version: NOSTR_TYPES_VERSION,
  supportedNIPs: SUPPORTED_NIPS,
  description: 'Consolidated NOSTR type definitions for Sovren platform',
} as const;
