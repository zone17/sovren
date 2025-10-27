# NOSTR Developer Guide

**Version**: 2.0.0
**Last Updated**: 2025-10-25
**Status**: Epic 003 - NOSTR Consolidation Complete
**Maintainer**: Technical Documentation Team

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Services](#4-core-services)
5. [NIP Implementations](#5-nip-implementations)
6. [Common Workflows](#6-common-workflows)
7. [Code Examples](#7-code-examples)
8. [API Reference](#8-api-reference)
9. [Best Practices](#9-best-practices)
10. [Troubleshooting](#10-troubleshooting)
11. [Testing Strategies](#11-testing-strategies)
12. [Performance Optimization](#12-performance-optimization)
13. [Security Considerations](#13-security-considerations)

---

## 1. Introduction

### What is NOSTR?

**NOSTR** (Notes and Other Stuff Transmitted by Relays) is a decentralized protocol for creating censorship-resistant social networks and applications. Unlike traditional platforms, NOSTR:

- **Decentralized**: No central authority controls the network
- **Censorship-Resistant**: Content cannot be removed by any single entity
- **User-Owned**: Users control their identity and data via cryptographic keys
- **Protocol-Based**: Apps communicate via standard event formats

### Why Sovren Uses NOSTR

Sovren leverages NOSTR to empower creators with:

1. **True Content Ownership**: Creators own their content via cryptographic signatures
2. **Audience Portability**: Followers and content are portable across applications
3. **Revenue Independence**: Direct monetization via Lightning Network integration
4. **Censorship Resistance**: No platform can deplatform creators
5. **Open Standards**: Interoperability with the entire NOSTR ecosystem

### Architecture Philosophy

Sovren's NOSTR implementation follows **Elite Engineering Standards** with:

- **Single Source of Truth**: Unified services eliminate duplicate code
- **Type Safety**: Comprehensive TypeScript types (96.79% type coverage)
- **Test-Driven**: 95%+ test coverage for all NOSTR services
- **Performance Optimized**: Event deduplication, intelligent relay selection
- **Security First**: Private keys never touch the server, AES-256-GCM encryption

---

## 2. Getting Started

### Prerequisites

```bash
# Node.js 18+ and npm
node --version  # v18.0.0+
npm --version   # v9.0.0+

# TypeScript knowledge
# Basic understanding of cryptographic signatures
# Familiarity with WebSocket connections
```

### Installation

NOSTR services are included in the Sovren monorepo:

```bash
# Clone repository
git clone https://github.com/sovren/sovren.git
cd sovren

# Install dependencies
npm install

# Configure environment
cp env.example .env
```

### Environment Configuration

Add these variables to your `.env` file:

```bash
# NOSTR Relay Configuration
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.info,wss://relay.snort.social
NOSTR_AUTO_CONNECT=true
NOSTR_CONNECTION_TIMEOUT=5000
NOSTR_MAX_RELAYS=10
NOSTR_CACHE_TTL=3600000

# Optional: Your NOSTR key (for testing)
NOSTR_PRIVATE_KEY=your_private_key_hex
NOSTR_PUBLIC_KEY=your_public_key_hex
```

### Quick Start Example

```typescript
import { NostrService } from '@/lib/services/nostrService';
import { relayPoolManager } from '@/services/nostr/RelayPoolManager';

// Initialize NOSTR service
const nostr = NostrService.getInstance();
await nostr.initialize();

// Connect to relays
await nostr.connectToRelays();

// Publish a note
const event = await nostr.publishNote('Hello NOSTR world!');
console.log(`Published event: ${event.id}`);

// Subscribe to events
const subscriptionId = nostr.subscribe(
  [{ kinds: [1], limit: 10 }],
  (event) => console.log('Received:', event.content)
);

// Clean up
nostr.unsubscribe(subscriptionId);
await nostr.disconnect();
```

---

## 3. Architecture Overview

### System Architecture

Sovren's NOSTR integration consists of multiple layers:

```
┌─────────────────────────────────────────────┐
│         Application Layer                   │
│  (React Components, Pages, Hooks)           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Service Layer                       │
│  NostrService, KeyManagement,               │
│  EventPublisher, SubscriptionManager        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Relay Pool Layer                    │
│  RelayPoolManager (Connection Pool,         │
│  Health Monitoring, Event Deduplication)    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Protocol Layer                      │
│  nostr-tools (SimplePool, WebSocket)        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         NOSTR Relays                        │
│  relay.damus.io, nos.lol, etc.              │
└─────────────────────────────────────────────┘
```

### Visual Architecture Diagrams

Comprehensive Mermaid diagrams are available for visual learners:

- [NOSTR Architecture Overview](../architecture/diagrams/nostr/nostr-architecture-overview.mmd) - Complete system architecture
- [Key Management Flow](../architecture/diagrams/nostr/nostr-key-management-flow.mmd) - Key lifecycle and security
- [Event Publishing Flow](../architecture/diagrams/nostr/nostr-event-publishing-flow.mmd) - Multi-relay publishing
- [Relay Management Flow](../architecture/diagrams/nostr/nostr-relay-management-flow.mmd) - Connection and health monitoring
- [NIP Compliance Map](../architecture/diagrams/nostr/nostr-nip-compliance.mmd) - Implemented NIPs

View the [complete diagram index](../architecture/diagrams/nostr/README.md) for interactive editors and GitHub visuals.

### Feature-Based Organization

NOSTR services follow Sovren's **feature-based architecture**:

```
packages/frontend/src/services/nostr/
├── KeyManagementService.ts       # US-315: Secure key operations
├── RelayPoolManager.ts            # US-302: Multi-relay management
├── EventPublisherService.ts       # US-303: Event publishing
├── SubscriptionManagerService.ts  # US-304: Event subscriptions
├── EventCacheService.ts           # US-312: Event caching
├── EventDeduplicationService.ts   # US-307: Deduplication
├── NIP04Service.ts                # US-305: Encrypted DMs
├── NIP05Service.ts                # US-306: Identity verification
├── types.ts                       # Comprehensive types
├── index.ts                       # Barrel exports
└── __tests__/                     # 95%+ test coverage
```

### Key Design Patterns

**Singleton Pattern**:
```typescript
// All major services use singleton for shared state
const nostr = NostrService.getInstance();
const relayPool = relayPoolManager; // Already singleton instance
```

**Event-Driven Architecture**:
```typescript
// Services emit events for reactive updates
relayPoolManager.on('relay:connected', (url) => {
  console.log(`Connected to ${url}`);
});

relayPoolManager.on('relay:health:changed', (url, health) => {
  console.log(`${url} health: ${health.status}`);
});
```

**Dependency Injection**:
```typescript
// Services accept configuration and dependencies
const keyManager = new KeyManagementService(
  config,
  {
    storage: customStorageService,
    crypto: customCryptoService,
  }
);
```

---

## 4. Core Services

### 4.1 NostrService (Main Service)

**Location**: `packages/frontend/lib/services/nostrService.ts`
**Pattern**: Singleton
**Purpose**: High-level API for all NOSTR operations

#### Initialization

```typescript
import { NostrService } from '@/lib/services/nostrService';

const nostr = NostrService.getInstance();

// Initialize with default configuration
await nostr.initialize();

// Or with custom config
await nostr.initialize({
  relays: ['wss://custom.relay.io'],
  autoConnect: true,
  connectionTimeout: 10000,
  maxRelays: 5,
});
```

#### Key Methods

```typescript
// Key Management
const keyPair = await nostr.generateKeyPair();
await nostr.importKeyPair(privateKeyHex);
const publicKey = nostr.getPublicKey();

// Connection
await nostr.connectToRelays();
await nostr.disconnect();

// Publishing
const noteEvent = await nostr.publishNote('Hello world!');
const profileEvent = await nostr.publishProfile({
  name: 'Alice',
  about: 'Creator on Sovren',
  picture: 'https://example.com/avatar.jpg',
});

// Subscriptions
const subId = nostr.subscribe(
  [{ kinds: [1], authors: [publicKey], limit: 10 }],
  (event) => console.log('Event:', event),
  () => console.log('EOSE')
);
nostr.unsubscribe(subId);

// Encrypted DMs (NIP-04)
await nostr.sendDirectMessage(recipientPubkey, 'Secret message');

// Caching
const cachedEvents = nostr.getCachedEvents({ kinds: [1] });
```

#### Event Emitters

```typescript
// Listen to service events
nostr.on('event:published', (event) => {
  console.log(`Published: ${event.id}`);
});

nostr.on('event:received', (event, relay) => {
  console.log(`Received from ${relay}: ${event.content}`);
});

nostr.on('subscription:started', (subscription) => {
  console.log(`Subscription ${subscription.id} started`);
});
```

---

### 4.2 KeyManagementService (US-315)

**Location**: `packages/frontend/src/services/nostr/KeyManagementService.ts`
**Purpose**: Secure NOSTR key generation, storage, rotation, and backup

#### Security Levels

```typescript
enum NostrKeySecurityLevel {
  BASIC = 'basic',       // 128-bit entropy, basic protection
  ENHANCED = 'enhanced', // 256-bit entropy, encryption enabled
  MAXIMUM = 'maximum',   // 256-bit entropy, hardware wallet, MFA
}
```

#### Key Generation

```typescript
import { KeyManagementService } from '@/services/nostr/KeyManagementService';

const keyManager = new KeyManagementService();
await keyManager.initialize();

// Generate with enhanced security
const result = await keyManager.generateKeyPair({
  name: 'My Primary Key',
  description: 'Main identity for Sovren',
  securityLevel: NostrKeySecurityLevel.ENHANCED,
  entropySource: NostrEntropySource.WEB_CRYPTO_API,
  backupMethod: NostrKeyBackupMethod.MNEMONIC_PHRASE,
});

if (result.success && result.data) {
  const keyPair = result.data;
  console.log('Public Key (npub):', keyPair.npub);
  console.log('Private Key (nsec):', keyPair.nsec);
  console.log('Security Level:', keyPair.securityLevel);
  console.log('Entropy Bits:', keyPair.entropyBits);
}
```

#### Key Import

```typescript
// Import from hex private key
const importResult = await keyManager.importKey(
  '0123456789abcdef...', // 64-char hex private key
  {
    name: 'Imported Key',
    validate: true,
    backup: true,
  }
);
```

#### Key Backup

```typescript
// Create mnemonic backup (BIP39)
const backupResult = await keyManager.createBackup(
  keyId,
  NostrKeyBackupMethod.MNEMONIC_PHRASE,
  {
    passphrase: 'my-secure-passphrase', // Optional
    verify: true,
  }
);

if (backupResult.success && backupResult.data) {
  const backup = backupResult.data;
  console.log('Mnemonic:', backup.mnemonic);
  console.log('Word Count:', backup.wordCount);
  console.log('Checksum:', backup.checksum);

  // IMPORTANT: User should write down mnemonic securely
  alert(`Write down these ${backup.wordCount} words: ${backup.mnemonic}`);
}
```

#### Key Rotation

```typescript
// Rotate key (creates new key, marks old as rotated)
const rotationResult = await keyManager.rotateKey(oldKeyId, {
  type: 'scheduled',
  reason: 'Quarterly key rotation',
  migrateData: true,
});

if (rotationResult.success && rotationResult.data) {
  const rotation = rotationResult.data;
  console.log('Old Key:', rotation.oldKeyId);
  console.log('New Key:', rotation.newKeyId);
  console.log('Migration Progress:', rotation.migrationProgress);
}
```

#### Key Validation

```typescript
// Validate key security
const validation = await keyManager.validateKeyPair(keyPair);

console.log('Valid:', validation.valid);
console.log('Security Score:', validation.securityScore); // 0-100
console.log('Issues:', validation.issues);
console.log('Recommendations:', validation.recommendations);

// Example output:
// Valid: true
// Security Score: 95
// Issues: [{ severity: 'warning', code: 'NO_BACKUP', message: 'Key should be backed up' }]
// Recommendations: ['Create a secure backup of this key']
```

#### Browser Extension Support

```typescript
// Detect browser extensions (Alby, nos2x, Nostore)
await keyManager.initialize();

// Service automatically detects extensions
const stats = keyManager.getStats();
console.log('Browser Extensions:', stats.browserExtensions);

// Extension detected events
keyManager.on('extension:detected', (extension) => {
  console.log(`Detected ${extension.extensionName} v${extension.version}`);
  console.log('Supported NIPs:', extension.supportedNips);
});
```

---

### 4.3 RelayPoolManager (US-302)

**Location**: `packages/frontend/src/services/nostr/RelayPoolManager.ts`
**Purpose**: Unified relay connection pool with health monitoring and automatic failover

#### Initialization

```typescript
import { relayPoolManager } from '@/services/nostr/RelayPoolManager';

await relayPoolManager.initialize({
  relays: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.info',
  ],
  maxRelays: 10,
  connectionTimeout: 5000,
  autoReconnect: true,
  enableHealthMonitoring: true,
  enableDeduplication: true,
});
```

#### Connection Management

```typescript
// Connect to all configured relays
await relayPoolManager.connectAll();

// Connect to specific relay
await relayPoolManager.connect('wss://custom.relay.io');

// Add relay at runtime
await relayPoolManager.addRelay('wss://new.relay.io', 'both');

// Set relay tag (NIP-65)
relayPoolManager.setRelayTag('wss://relay.damus.io', 'write');

// Get relays by tag
const writeRelays = relayPoolManager.getRelaysByTag('write');
const readRelays = relayPoolManager.getRelaysByTag('read');

// Remove relay
await relayPoolManager.removeRelay('wss://old.relay.io');

// Disconnect
await relayPoolManager.disconnect('wss://relay.damus.io');
await relayPoolManager.disconnectAll();
```

#### Health Monitoring

```typescript
// Get relay health information
const health = relayPoolManager.getRelayHealth('wss://relay.damus.io');

console.log('Health Status:', health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log('Health Score:', health.score); // 0-100
console.log('Metrics:', {
  latency: health.metrics.latency,
  successRate: health.metrics.successRate,
  uptime: health.metrics.uptime,
  totalRequests: health.metrics.totalRequests,
});

// Get all relay health
const allHealth = relayPoolManager.getAllRelayHealth();
allHealth.forEach(h => {
  console.log(`${h.url}: ${h.score}/100 (${h.status})`);
});

// Listen to health changes
relayPoolManager.on('relay:health:changed', (url, health) => {
  if (health.status === 'unhealthy') {
    console.warn(`⚠️ Relay ${url} is unhealthy (score: ${health.score})`);
  }
});
```

#### Event Publishing

```typescript
// Publish to all connected relays
const results = await relayPoolManager.publishEvent(event);
console.log(`Published to ${results.filter(r => r.success).length}/${results.length} relays`);

// Publish to fastest 3 relays
const fastResults = await relayPoolManager.publishEventToFastest(event, 3);

// Publish to specific relays
const specificResults = await relayPoolManager.publishEvent(event, [
  'wss://relay.damus.io',
  'wss://nos.lol',
]);

// Publish with retry
const retryResults = await relayPoolManager.publishEventWithRetry(event, 3);
```

#### Subscription Management

```typescript
// Subscribe across all relays with automatic deduplication
const subscriptionId = relayPoolManager.subscribe(
  [{ kinds: [1], authors: [myPubkey], limit: 20 }],
  (event) => {
    console.log('Event received:', event.content);
    // Event is automatically deduplicated by ID
  },
  () => console.log('EOSE - End of stored events')
);

// Unsubscribe
relayPoolManager.unsubscribe(subscriptionId);
```

#### Relay Selection

```typescript
// Get fastest relay
const fastest = relayPoolManager.getFastestRelay();
console.log('Fastest relay:', fastest);

// Get fastest N relays
const top3 = relayPoolManager.getFastestRelays(3);
console.log('Top 3 fastest:', top3);

// Get healthiest relay
const healthiest = relayPoolManager.getHealthiestRelay();
console.log('Healthiest relay:', healthiest);
```

#### Connection Events

```typescript
relayPoolManager.on('relay:connected', (url) => {
  console.log(`✅ Connected to ${url}`);
});

relayPoolManager.on('relay:disconnected', (url) => {
  console.log(`❌ Disconnected from ${url}`);
});

relayPoolManager.on('relay:error', (url, error) => {
  console.error(`🔴 Error on ${url}:`, error.message);
});

relayPoolManager.on('relay:reconnecting', (url, attempt) => {
  console.log(`🔄 Reconnecting to ${url} (attempt ${attempt})`);
});
```

---

### 4.4 EventPublisherService (US-303)

**Location**: `packages/frontend/src/services/nostr/EventPublisherService.ts`
**Purpose**: High-level event publishing with validation and analytics

#### Publishing Events

```typescript
import { EventPublisherService } from '@/services/nostr/EventPublisherService';

const publisher = new EventPublisherService();
await publisher.initialize();

// Publish text note (kind 1)
const noteResult = await publisher.publishTextNote('Hello NOSTR!', {
  tags: [['t', 'introduction']],
  relays: ['wss://relay.damus.io'],
});

// Publish long-form content (kind 30023 - NIP-23)
const articleResult = await publisher.publishLongFormContent(
  'My First Article',
  'This is the content of my article...',
  {
    summary: 'An introduction to NOSTR',
    tags: ['nostr', 'tutorial'],
    image: 'https://example.com/cover.jpg',
  }
);

// Publish metadata (kind 0)
const metadataResult = await publisher.publishMetadata({
  name: 'Alice',
  about: 'Creator and developer',
  picture: 'https://example.com/alice.jpg',
  nip05: 'alice@sovren.app',
  lud16: 'alice@getalby.com',
});
```

#### Event Validation

```typescript
// Validate event before publishing
const validation = publisher.validateEvent(event);

if (!validation.valid) {
  console.error('Invalid event:', validation.errors);
  // [{ field: 'content', message: 'Content exceeds maximum length' }]
} else {
  await publisher.publishEvent(event);
}
```

#### Publishing Analytics

```typescript
publisher.on('event:published', (event, results) => {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Published ${event.id}`);
  console.log(`Success: ${successful}, Failed: ${failed}`);

  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.relay} (${r.latency}ms)`);
    } else {
      console.error(`❌ ${r.relay}: ${r.error?.message}`);
    }
  });
});
```

---

### 4.5 SubscriptionManagerService (US-304)

**Location**: `packages/frontend/src/services/nostr/SubscriptionManagerService.ts`
**Purpose**: Advanced subscription management with filtering and aggregation

#### Creating Subscriptions

```typescript
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';

const subscriptionManager = new SubscriptionManagerService();
await subscriptionManager.initialize();

// Subscribe to user's notes
const myNotesSubscription = await subscriptionManager.subscribe({
  filters: [
    { kinds: [1], authors: [myPubkey], limit: 50 }
  ],
  onEvent: (event) => console.log('My note:', event.content),
  onEose: () => console.log('Loaded all my notes'),
  name: 'My Notes Feed',
});

// Subscribe to global feed
const globalSubscription = await subscriptionManager.subscribe({
  filters: [
    { kinds: [1], limit: 100 }
  ],
  onEvent: (event) => console.log('Global:', event.content),
  name: 'Global Feed',
});

// Subscribe to specific hashtags
const hashtagSubscription = await subscriptionManager.subscribe({
  filters: [
    { kinds: [1], '#t': ['nostr', 'bitcoin'], limit: 50 }
  ],
  onEvent: (event) => console.log('Tagged:', event.content),
  name: 'Hashtag Feed',
});
```

#### Subscription Lifecycle

```typescript
// Pause subscription
subscriptionManager.pauseSubscription(myNotesSubscription.id);

// Resume subscription
subscriptionManager.resumeSubscription(myNotesSubscription.id);

// Update subscription filters
subscriptionManager.updateSubscription(myNotesSubscription.id, {
  filters: [
    { kinds: [1, 6], authors: [myPubkey], limit: 100 }
  ],
});

// Close subscription
subscriptionManager.unsubscribe(myNotesSubscription.id);

// Close all subscriptions
subscriptionManager.unsubscribeAll();
```

#### Active Subscriptions

```typescript
// Get all active subscriptions
const activeSubscriptions = subscriptionManager.getActiveSubscriptions();

activeSubscriptions.forEach(sub => {
  console.log(`${sub.name}: ${sub.id}`);
  console.log(`  Filters: ${JSON.stringify(sub.filters)}`);
  console.log(`  Active: ${sub.active}`);
  console.log(`  Event count: ${sub.eventCount || 0}`);
});

// Get subscription by ID
const subscription = subscriptionManager.getSubscription(myNotesSubscription.id);
```

---

### 4.6 EventCacheService (US-312)

**Location**: `packages/frontend/src/services/nostr/EventCacheService.ts`
**Purpose**: Efficient event caching with TTL and LRU eviction

#### Caching Events

```typescript
import { EventCacheService } from '@/services/nostr/EventCacheService';

const cache = new EventCacheService({
  maxSize: 10000,
  ttl: 3600000, // 1 hour
  enablePersistence: true,
});

await cache.initialize();

// Cache event
await cache.cacheEvent(event, 'wss://relay.damus.io');

// Get cached event
const cachedEvent = cache.getEvent(eventId);

// Query cached events
const recentNotes = cache.queryEvents({
  kinds: [1],
  since: Math.floor(Date.now() / 1000) - 3600, // Last hour
});

// Get all cached events
const allCached = cache.getAllEvents();

// Clear cache
cache.clearCache();
```

#### Cache Statistics

```typescript
const stats = cache.getStats();

console.log('Cache Stats:', {
  size: stats.size,
  maxSize: stats.maxSize,
  hitRate: stats.hitRate,
  missRate: stats.missRate,
  evictions: stats.evictions,
});
```

---

### 4.7 EventDeduplicationService (US-307)

**Location**: `packages/frontend/src/services/nostr/EventDeduplicationService.ts`
**Purpose**: Eliminate duplicate events from multiple relays

#### Automatic Deduplication

```typescript
import { EventDeduplicationService } from '@/services/nostr/EventDeduplicationService';

const deduplication = new EventDeduplicationService({
  maxCacheSize: 50000,
  cleanupInterval: 300000, // 5 minutes
});

// Process event (returns null if duplicate)
const uniqueEvent = deduplication.processEvent(event);

if (uniqueEvent) {
  console.log('New event:', uniqueEvent.id);
  // Process the event
} else {
  console.log('Duplicate event filtered');
}

// Check if event is duplicate
const isDuplicate = deduplication.isDuplicate(eventId);

// Get statistics
const stats = deduplication.getStats();
console.log('Deduplication Rate:', stats.deduplicationRate);
console.log('Bandwidth Saved:', stats.bandwidthSaved);
```

**Note**: RelayPoolManager includes automatic deduplication when `enableDeduplication: true` in config.

---

## 5. NIP Implementations

Sovren implements multiple **NOSTR Implementation Possibilities (NIPs)** for protocol compliance and feature richness.

### 5.1 NIP-01: Basic Protocol Flow

**Status**: ✅ Fully Implemented
**Purpose**: Core event structure, signatures, relay communication

#### Event Structure

```typescript
interface NostrEvent {
  id: string;           // 32-byte lowercase hex SHA256 hash
  pubkey: string;       // 32-byte lowercase hex public key
  created_at: number;   // Unix timestamp in seconds
  kind: number;         // Event kind
  tags: string[][];     // Tags (arbitrary data)
  content: string;      // Arbitrary event content
  sig: string;          // 64-byte lowercase hex Schnorr signature
}
```

#### Event Kinds (NIP-01)

```typescript
enum NostrEventKind {
  SET_METADATA = 0,              // User profile metadata
  TEXT_NOTE = 1,                 // Short text note
  RECOMMEND_RELAY = 2,           // Relay recommendation
  CONTACTS = 3,                  // Contact list
  ENCRYPTED_DIRECT_MESSAGE = 4,  // Encrypted DM (NIP-04)
  DELETE = 5,                    // Event deletion request (NIP-09)
  REPOST = 6,                    // Repost/boost
  REACTION = 7,                  // Like/reaction (NIP-25)
  LONG_FORM = 30023,             // Long-form content (NIP-23)
  APP_DATA = 30078,              // Application-specific data (NIP-78)
  ZAP_REQUEST = 9734,            // Lightning zap request (NIP-57)
  ZAP = 9735,                    // Lightning zap (NIP-57)
}
```

#### Creating Events

```typescript
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';

// Generate keys
const privateKey = generateSecretKey();
const publicKey = getPublicKey(privateKey);

// Create unsigned event
const unsignedEvent = {
  pubkey: publicKey,
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'Hello NOSTR!',
};

// Sign and finalize event
const signedEvent = finalizeEvent(unsignedEvent, privateKey);

console.log('Event ID:', signedEvent.id);
console.log('Signature:', signedEvent.sig);
```

#### Verifying Events

```typescript
import { verifyEvent } from 'nostr-tools';

const isValid = verifyEvent(event);

if (isValid) {
  console.log('✅ Event signature valid');
} else {
  console.error('❌ Invalid event signature');
}
```

---

### 5.2 NIP-04: Encrypted Direct Messages

**Status**: ✅ Fully Implemented
**Location**: `packages/frontend/src/services/nostr/NIP04Service.ts`
**Purpose**: End-to-end encrypted private messages

#### Sending Encrypted DMs

```typescript
import { NIP04Service } from '@/services/nostr/NIP04Service';

const nip04 = new NIP04Service();
await nip04.initialize();

// Send encrypted DM
const result = await nip04.sendEncryptedDM(
  recipientPubkey,
  'This is a secret message',
  myPrivateKey
);

if (result.success && result.event) {
  console.log('DM sent:', result.event.id);
}
```

#### Receiving and Decrypting DMs

```typescript
// Decrypt received DM
const decryptResult = await nip04.decryptDM(
  encryptedEvent,
  myPrivateKey
);

if (decryptResult.success && decryptResult.content) {
  console.log('Decrypted message:', decryptResult.content);
}

// Get all DMs for a user
const dms = await nip04.getDirectMessages(myPubkey, myPrivateKey);

dms.forEach(dm => {
  console.log(`From ${dm.sender}: ${dm.content}`);
  console.log(`  Sent at: ${new Date(dm.timestamp * 1000)}`);
});
```

#### Encryption Details

- **Algorithm**: AES-256-CBC
- **Key Exchange**: ECDH (Elliptic Curve Diffie-Hellman)
- **Base64 Encoding**: Encrypted content is base64 encoded
- **IV**: Random 16-byte initialization vector

```typescript
// Low-level encryption (usually handled by NIP04Service)
import { nip04 } from 'nostr-tools';

const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyHex, 'hex'));
const encrypted = await nip04.encrypt(privateKeyBytes, recipientPubkey, plaintext);
const decrypted = await nip04.decrypt(privateKeyBytes, senderPubkey, encrypted);
```

---

### 5.3 NIP-05: DNS-Based Identity Verification

**Status**: ✅ Fully Implemented
**Location**: `packages/frontend/src/services/nostr/NIP05Service.ts`, `packages/backend/src/services/nip05-verification-service.ts`
**Purpose**: Verify NOSTR identities via DNS (name@domain.com)

#### User-Side Verification

```typescript
import { NIP05Service } from '@/services/nostr/NIP05Service';

const nip05 = new NIP05Service();

// Verify a NIP-05 identifier
const verification = await nip05.verifyIdentifier('alice@sovren.app');

if (verification.verified) {
  console.log('✅ Verified!');
  console.log('Public Key:', verification.pubkey);
  console.log('Relays:', verification.relays);
} else {
  console.error('❌ Verification failed:', verification.error);
}
```

#### Server-Side Verification (Backend)

```typescript
import { NIP05VerificationService } from '@/services/nip05-verification-service';

const verificationService = new NIP05VerificationService();

// Create verification request
const request = await verificationService.createVerificationRequest({
  user_id: userId,
  nostr_pubkey: userPubkey,
  nip05_identifier: 'alice@sovren.app',
  domain: 'sovren.app',
  local_part: 'alice',
  verification_method: 'http', // or 'dns'
});

// Verification happens automatically via HTTP or DNS
// HTTP: Checks https://sovren.app/.well-known/nostr.json
// DNS: Checks _nostr.sovren.app TXT records
```

#### Setting Up NIP-05 for Your Domain

**HTTP Method** (Recommended):

1. Create `/.well-known/nostr.json` on your domain:

```json
{
  "names": {
    "alice": "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e",
    "bob": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  },
  "relays": {
    "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e": [
      "wss://relay.damus.io",
      "wss://nos.lol"
    ]
  }
}
```

2. Serve with CORS headers:
```
Access-Control-Allow-Origin: *
Content-Type: application/json
```

**DNS Method**:

1. Add TXT record for `_nostr.yourdomain.com`:
```
nostr={"names":{"alice":"7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e"}}
```

#### Displaying Verification Badge

```typescript
// In your React component
const NIP05Badge: React.FC<{ nip05: string }> = ({ nip05 }) => {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    nip05Service.verifyIdentifier(nip05).then(result => {
      setVerified(result.verified);
    });
  }, [nip05]);

  if (!verified) return null;

  return (
    <span className="nip05-badge">
      ✅ {nip05}
    </span>
  );
};
```

---

### 5.4 NIP-19: bech32-Encoded Identifiers

**Status**: ✅ Fully Implemented
**Purpose**: Human-readable encoding for keys and event IDs

#### Identifier Types

```typescript
// Public key: npub1...
// Private key: nsec1...
// Note ID: note1...
// Profile: nprofile1...
// Event: nevent1...
// Relay: nrelay1...
```

#### Encoding

```typescript
import { nip19 } from 'nostr-tools';

// Encode public key
const npub = nip19.npubEncode(publicKeyHex);
// npub1wn3ukuchg9mz5uj8smevsnvfq0vwyf44g487squ8dyf3rcsxmqqqwchmgk

// Encode private key
const nsec = nip19.nsecEncode(privateKeyBytes);
// nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5

// Encode note ID
const noteId = nip19.noteEncode(eventIdHex);
// note1fhfadjqhv9t5l9lkdnl9j8phcz7xhw5hqrtejsqw2zrhj6v2dsssj4e5ej

// Encode profile with relays
const nprofile = nip19.nprofileEncode({
  pubkey: publicKeyHex,
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
});
// nprofile1qqsw3dy8c...

// Encode event with context
const nevent = nip19.neventEncode({
  id: eventIdHex,
  relays: ['wss://relay.damus.io'],
  author: publicKeyHex,
});
// nevent1qqsr5nhx...
```

#### Decoding

```typescript
import { nip19 } from 'nostr-tools';

// Decode npub
const decoded = nip19.decode(npub);
console.log('Type:', decoded.type); // 'npub'
console.log('Data:', decoded.data); // hex public key

// Decode with error handling
try {
  const result = nip19.decode(userInput);

  switch (result.type) {
    case 'npub':
      console.log('Public key:', result.data);
      break;
    case 'nsec':
      console.log('Private key:', result.data);
      // Handle securely!
      break;
    case 'note':
      console.log('Note ID:', result.data);
      break;
    case 'nprofile':
      console.log('Public key:', result.data.pubkey);
      console.log('Relays:', result.data.relays);
      break;
    case 'nevent':
      console.log('Event ID:', result.data.id);
      console.log('Relays:', result.data.relays);
      console.log('Author:', result.data.author);
      break;
  }
} catch (error) {
  console.error('Invalid bech32 identifier');
}
```

---

### 5.5 NIP-23: Long-Form Content

**Status**: ✅ Fully Implemented
**Purpose**: Articles, blog posts, long-form writing

#### Publishing Long-Form Content

```typescript
import { EventPublisherService } from '@/services/nostr/EventPublisherService';

const publisher = new EventPublisherService();

const articleResult = await publisher.publishLongFormContent(
  'The Future of Decentralized Social Media',
  `
# Introduction

NOSTR represents a paradigm shift...

## Key Benefits

1. Censorship resistance
2. User ownership
3. Portability

## Conclusion

The future is decentralized.
  `,
  {
    summary: 'An exploration of NOSTR and decentralization',
    tags: ['nostr', 'decentralization', 'web3'],
    image: 'https://example.com/cover.jpg',
    publishedAt: Math.floor(Date.now() / 1000),
  }
);
```

#### Event Structure (Kind 30023)

```typescript
{
  kind: 30023,
  tags: [
    ['d', 'unique-identifier'],        // Required: Article identifier
    ['title', 'Article Title'],
    ['summary', 'Short summary'],
    ['published_at', '1704067200'],
    ['t', 'tag1'],
    ['t', 'tag2'],
    ['image', 'https://example.com/cover.jpg'],
  ],
  content: '# Article\n\nLong markdown content...',
}
```

---

### 5.6 NIP-57: Lightning Zaps

**Status**: ✅ Fully Implemented
**Purpose**: Bitcoin Lightning Network payments

See the [Lightning Integration Guide](./lightning-integration-guide.md) for complete documentation.

#### Quick Example

```typescript
// Request Lightning invoice for zap
const zapRequest = await publisher.createZapRequest(
  recipientPubkey,
  1000, // sats
  'Great article!',
  myPrivateKey
);

// Pay invoice via WebLN
await window.webln.sendPayment(zapRequest.invoice);
```

---

### 5.7 NIP-78: Application-Specific Data

**Status**: ✅ Fully Implemented
**Purpose**: Store application preferences and state

#### Storing App Data

```typescript
// Kind 30078 for app-specific data
const appDataEvent = {
  kind: 30078,
  tags: [
    ['d', 'sovren-preferences'],
  ],
  content: JSON.stringify({
    theme: 'dark',
    language: 'en',
    notifications: {
      mentions: true,
      zaps: true,
      dms: true,
    },
  }),
};

await publisher.publishEvent(appDataEvent);
```

---

## 6. Common Workflows

### 6.1 Complete User Onboarding Flow

```typescript
import { NostrService } from '@/lib/services/nostrService';
import { KeyManagementService, NostrKeySecurityLevel } from '@/services/nostr/KeyManagementService';

async function onboardNewUser() {
  // Step 1: Initialize services
  const nostr = NostrService.getInstance();
  const keyManager = new KeyManagementService();

  await nostr.initialize();
  await keyManager.initialize();

  // Step 2: Generate key with enhanced security
  const keyResult = await keyManager.generateKeyPair({
    name: 'Sovren Identity',
    securityLevel: NostrKeySecurityLevel.ENHANCED,
  });

  if (!keyResult.success || !keyResult.data) {
    throw new Error('Key generation failed');
  }

  const keyPair = keyResult.data;

  // Step 3: Create backup (CRITICAL - show to user)
  const backupResult = await keyManager.createBackup(
    keyPair.keyId,
    NostrKeyBackupMethod.MNEMONIC_PHRASE
  );

  if (backupResult.success && backupResult.data) {
    alert(`IMPORTANT: Write down these words:\n\n${backupResult.data.mnemonic}`);
  }

  // Step 4: Import key into NostrService
  await nostr.importKeyPair(keyPair.privateKey);

  // Step 5: Connect to relays
  await nostr.connectToRelays();

  // Step 6: Publish initial profile
  await nostr.publishProfile({
    name: 'New User',
    about: 'Just joined Sovren!',
  });

  // Step 7: Display npub to user
  console.log('Your NOSTR identity:', keyPair.npub);

  return {
    npub: keyPair.npub,
    publicKey: keyPair.publicKey,
  };
}
```

---

### 6.2 Publishing Content Workflow

```typescript
async function publishContentWithAnalytics(content: string, tags: string[] = []) {
  const nostr = NostrService.getInstance();

  // Publish note
  const event = await nostr.publishNote(
    content,
    tags.map(t => ['t', t])
  );

  // Subscribe to interactions (likes, reposts)
  const interactionSub = nostr.subscribe(
    [
      { kinds: [7], '#e': [event.id] }, // Reactions
      { kinds: [6], '#e': [event.id] }, // Reposts
    ],
    (interactionEvent) => {
      if (interactionEvent.kind === 7) {
        console.log(`👍 Like from ${interactionEvent.pubkey}`);
      } else if (interactionEvent.kind === 6) {
        console.log(`🔄 Repost by ${interactionEvent.pubkey}`);
      }
    }
  );

  return { event, interactionSub };
}
```

---

### 6.3 Building a Feed

```typescript
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';

async function buildPersonalizedFeed(userPubkey: string, following: string[]) {
  const subscriptionManager = new SubscriptionManagerService();
  await subscriptionManager.initialize();

  // Subscribe to posts from followed users
  const feedSubscription = await subscriptionManager.subscribe({
    filters: [
      {
        kinds: [1, 6], // Text notes and reposts
        authors: following,
        limit: 100,
      }
    ],
    onEvent: (event) => {
      // Add to feed UI
      addToFeed(event);
    },
    onEose: () => {
      console.log('Feed loaded');
    },
    name: 'Personal Feed',
  });

  return feedSubscription;
}

function addToFeed(event: NostrEvent) {
  // Your UI update logic
  console.log(`[${new Date(event.created_at * 1000).toLocaleString()}] ${event.content}`);
}
```

---

### 6.4 Implementing Real-Time Notifications

```typescript
async function setupNotifications(userPubkey: string) {
  const nostr = NostrService.getInstance();

  // Subscribe to mentions
  const mentionsSub = nostr.subscribe(
    [
      {
        kinds: [1],
        '#p': [userPubkey],
        since: Math.floor(Date.now() / 1000),
      }
    ],
    (event) => {
      showNotification('Mention', `@${event.pubkey} mentioned you`);
    }
  );

  // Subscribe to DMs
  const dmSub = nostr.subscribe(
    [
      {
        kinds: [4],
        '#p': [userPubkey],
        since: Math.floor(Date.now() / 1000),
      }
    ],
    async (event) => {
      // Decrypt and show
      const decrypted = await nip04.decrypt(
        privateKeyBytes,
        event.pubkey,
        event.content
      );
      showNotification('Direct Message', decrypted);
    }
  );

  // Subscribe to zaps
  const zapSub = nostr.subscribe(
    [
      {
        kinds: [9735], // Zap receipts
        '#p': [userPubkey],
        since: Math.floor(Date.now() / 1000),
      }
    ],
    (event) => {
      const amount = getZapAmount(event);
      showNotification('Zap', `You received ${amount} sats!`);
    }
  );

  return { mentionsSub, dmSub, zapSub };
}

function showNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
```

---

### 6.5 Implementing Search

```typescript
import { EventCacheService } from '@/services/nostr/EventCacheService';

async function searchContent(query: string) {
  const cache = new EventCacheService();
  await cache.initialize();

  // Search cached events
  const allEvents = cache.getAllEvents();

  const results = allEvents.filter(event => {
    // Search in content
    if (event.content.toLowerCase().includes(query.toLowerCase())) {
      return true;
    }

    // Search in tags
    const tags = event.tags.flat().join(' ');
    if (tags.toLowerCase().includes(query.toLowerCase())) {
      return true;
    }

    return false;
  });

  // Sort by relevance (simple: most recent first)
  results.sort((a, b) => b.created_at - a.created_at);

  return results;
}
```

---

## 7. Code Examples

### 7.1 Complete Chat Application

```typescript
import { NostrService } from '@/lib/services/nostrService';
import { NIP04Service } from '@/services/nostr/NIP04Service';

class NostrChat {
  private nostr: NostrService;
  private nip04: NIP04Service;
  private myPubkey: string;
  private myPrivateKey: string;
  private activeChatPubkey: string | null = null;

  constructor() {
    this.nostr = NostrService.getInstance();
    this.nip04 = new NIP04Service();
  }

  async initialize(privateKey: string) {
    this.myPrivateKey = privateKey;

    await this.nostr.initialize();
    await this.nip04.initialize();

    await this.nostr.importKeyPair(privateKey);
    this.myPubkey = this.nostr.getPublicKey()!;

    await this.nostr.connectToRelays();

    // Subscribe to incoming DMs
    this.nostr.subscribe(
      [
        {
          kinds: [4],
          '#p': [this.myPubkey],
        }
      ],
      (event) => this.handleIncomingDM(event)
    );
  }

  async startChat(recipientPubkey: string) {
    this.activeChatPubkey = recipientPubkey;

    // Load chat history
    const history = await this.nip04.getDirectMessages(
      this.myPubkey,
      this.myPrivateKey
    );

    // Filter for this conversation
    const conversationHistory = history.filter(
      dm => dm.sender === recipientPubkey || dm.recipient === recipientPubkey
    );

    // Display history
    conversationHistory.forEach(dm => {
      this.displayMessage(dm.sender, dm.content, dm.timestamp);
    });
  }

  async sendMessage(content: string) {
    if (!this.activeChatPubkey) {
      throw new Error('No active chat');
    }

    const result = await this.nip04.sendEncryptedDM(
      this.activeChatPubkey,
      content,
      this.myPrivateKey
    );

    if (result.success) {
      this.displayMessage(
        this.myPubkey,
        content,
        Math.floor(Date.now() / 1000),
        true
      );
    }
  }

  private async handleIncomingDM(event: NostrEvent) {
    const decryptResult = await this.nip04.decryptDM(
      event,
      this.myPrivateKey
    );

    if (decryptResult.success && decryptResult.content) {
      // Only display if from active chat
      if (event.pubkey === this.activeChatPubkey) {
        this.displayMessage(
          event.pubkey,
          decryptResult.content,
          event.created_at
        );
      } else {
        // Show notification for other chats
        this.showNewMessageNotification(event.pubkey, decryptResult.content);
      }
    }
  }

  private displayMessage(
    sender: string,
    content: string,
    timestamp: number,
    sent: boolean = false
  ) {
    const messageElement = document.createElement('div');
    messageElement.className = sent ? 'message-sent' : 'message-received';
    messageElement.innerHTML = `
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-time">${new Date(timestamp * 1000).toLocaleTimeString()}</div>
    `;
    document.getElementById('messages')?.appendChild(messageElement);
  }

  private showNewMessageNotification(sender: string, preview: string) {
    new Notification('New Message', {
      body: `${sender.slice(0, 8)}...: ${preview.slice(0, 50)}`,
    });
  }
}

// Usage
const chat = new NostrChat();
await chat.initialize(myPrivateKey);
await chat.startChat(friendPubkey);
await chat.sendMessage('Hello!');
```

---

### 7.2 Social Media Profile Component

```typescript
import React, { useEffect, useState } from 'react';
import { NostrService } from '@/lib/services/nostrService';
import { NIP05Service } from '@/services/nostr/NIP05Service';
import { nip19 } from 'nostr-tools';

interface NostrProfile {
  pubkey: string;
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  nip05Verified?: boolean;
  lud16?: string;
  banner?: string;
  website?: string;
}

const ProfileCard: React.FC<{ pubkey: string }> = ({ pubkey }) => {
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  const nostr = NostrService.getInstance();
  const nip05 = new NIP05Service();

  useEffect(() => {
    loadProfile();
  }, [pubkey]);

  async function loadProfile() {
    setLoading(true);

    // Subscribe to profile metadata (kind 0)
    const subId = nostr.subscribe(
      [{ kinds: [0], authors: [pubkey], limit: 1 }],
      async (event) => {
        try {
          const metadata = JSON.parse(event.content);

          // Verify NIP-05 if present
          let nip05Verified = false;
          if (metadata.nip05) {
            const verification = await nip05.verifyIdentifier(metadata.nip05);
            nip05Verified = verification.verified && verification.pubkey === pubkey;
          }

          setProfile({
            pubkey,
            ...metadata,
            nip05Verified,
          });

          setLoading(false);
          nostr.unsubscribe(subId);
        } catch (error) {
          console.error('Failed to parse profile:', error);
          setLoading(false);
        }
      }
    );
  }

  async function handleFollow() {
    // Get current contact list
    const currentContacts = nostr.getContacts();

    // Add new contact
    const updatedContacts = [
      ...currentContacts,
      { pubkey, relay: 'wss://relay.damus.io' },
    ];

    // Publish updated contact list
    await nostr.publishContactList(updatedContacts);
    setFollowing(true);
  }

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="error">Profile not found</div>;
  }

  const npub = nip19.npubEncode(pubkey);

  return (
    <div className="profile-card">
      {profile.banner && (
        <img src={profile.banner} alt="Banner" className="profile-banner" />
      )}

      <div className="profile-header">
        <img
          src={profile.picture || '/default-avatar.png'}
          alt={profile.name || 'User'}
          className="profile-avatar"
        />

        <div className="profile-info">
          <h2>
            {profile.name || 'Anonymous'}
            {profile.nip05Verified && (
              <span className="verified-badge" title="NIP-05 Verified">
                ✅
              </span>
            )}
          </h2>

          {profile.nip05 && (
            <div className="nip05">{profile.nip05}</div>
          )}

          <div className="npub" title={pubkey}>
            {npub.slice(0, 20)}...
          </div>

          {profile.about && (
            <p className="about">{profile.about}</p>
          )}

          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              🌐 {profile.website}
            </a>
          )}

          {profile.lud16 && (
            <div className="lightning">⚡ {profile.lud16}</div>
          )}
        </div>
      </div>

      <div className="profile-actions">
        <button
          onClick={handleFollow}
          disabled={following}
          className="btn-follow"
        >
          {following ? '✓ Following' : '+ Follow'}
        </button>

        <button
          onClick={() => window.open(`https://njump.me/${npub}`, '_blank')}
          className="btn-view"
        >
          View on njump.me
        </button>
      </div>
    </div>
  );
};

export default ProfileCard;
```

---

### 7.3 Content Publishing Form

```typescript
import React, { useState } from 'react';
import { EventPublisherService } from '@/services/nostr/EventPublisherService';

const ContentPublisher: React.FC = () => {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const publisher = new EventPublisherService();

  async function handlePublish() {
    if (!content.trim()) return;

    setPublishing(true);
    setPublishResult(null);

    try {
      await publisher.initialize();

      const result = await publisher.publishTextNote(
        content,
        { tags: tags.map(t => ['t', t]) }
      );

      if (result.success && result.event) {
        setPublishResult(`✅ Published! Event ID: ${result.event.id.slice(0, 16)}...`);
        setContent('');
        setTags([]);

        // Show publish results
        if (result.results) {
          const successful = result.results.filter(r => r.success).length;
          const total = result.results.length;
          console.log(`Published to ${successful}/${total} relays`);
        }
      } else {
        setPublishResult(`❌ Publish failed: ${result.error}`);
      }
    } catch (error) {
      setPublishResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  }

  function addTag(tag: string) {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag));
  }

  return (
    <div className="content-publisher">
      <h3>Publish to NOSTR</h3>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={6}
        maxLength={2000}
        disabled={publishing}
      />

      <div className="char-count">
        {content.length} / 2000 characters
      </div>

      <div className="tags-section">
        <input
          type="text"
          placeholder="Add tag"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              addTag((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
          disabled={publishing}
        />

        <div className="tags">
          {tags.map(tag => (
            <span key={tag} className="tag">
              #{tag}
              <button onClick={() => removeTag(tag)}>×</button>
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={handlePublish}
        disabled={publishing || !content.trim()}
        className="btn-publish"
      >
        {publishing ? 'Publishing...' : 'Publish'}
      </button>

      {publishResult && (
        <div className={`publish-result ${publishResult.startsWith('✅') ? 'success' : 'error'}`}>
          {publishResult}
        </div>
      )}
    </div>
  );
};

export default ContentPublisher;
```

---

## 8. API Reference

### NostrService API

```typescript
class NostrService {
  // Singleton
  static getInstance(): NostrService;

  // Initialization
  initialize(config?: Partial<NostrServiceConfig>): Promise<void>;

  // Key Management
  generateKeyPair(): Promise<NostrKeyPair>;
  importKeyPair(privateKey: string): Promise<NostrKeyPair>;
  getPublicKey(): string | null;

  // Connection
  connectToRelays(): Promise<void>;
  disconnect(): Promise<void>;

  // Publishing
  publishNote(content: string, tags?: string[][]): Promise<NostrEvent>;
  publishProfile(profile: NostrUserProfile): Promise<NostrEvent>;
  publishContactList(contacts: NostrContact[]): Promise<NostrEvent>;
  sendDirectMessage(recipientPubkey: string, content: string): Promise<NostrEvent>;

  // Subscription
  subscribe(
    filters: NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ): string;
  unsubscribe(subscriptionId: string): void;

  // Cache
  getCachedEvents(filter?: Partial<NostrFilter>): NostrEvent[];

  // State
  getUserProfile(): NostrUserProfile | null;
  getContacts(): NostrContact[];
  getDirectMessages(): NostrDirectMessage[];

  // Events
  on(event: 'event:published', listener: (event: NostrEvent) => void): void;
  on(event: 'event:received', listener: (event: NostrEvent, relay: string) => void): void;
  on(event: 'subscription:started', listener: (subscription: NostrSubscription) => void): void;
}
```

### RelayPoolManager API

```typescript
class RelayPoolManager {
  // Initialization
  initialize(config: RelayPoolConfig): Promise<void>;

  // Connection
  connect(url: string): Promise<void>;
  connectAll(): Promise<void>;
  disconnect(url: string): Promise<void>;
  disconnectAll(): Promise<void>;
  addRelay(url: string, tag?: RelayTag): Promise<void>;
  removeRelay(url: string): Promise<void>;

  // Configuration
  setRelayTag(url: string, tag: RelayTag): void;
  getRelaysByTag(tag: RelayTag): string[];
  getConnectedRelays(): string[];

  // Publishing
  publishEvent(event: NostrEvent, relays?: string[]): Promise<PublishResult[]>;
  publishEventToFastest(event: NostrEvent, count: number): Promise<PublishResult[]>;
  publishEventWithRetry(event: NostrEvent, maxAttempts: number): Promise<PublishResult[]>;

  // Subscription
  subscribe(
    filters: NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ): string;
  unsubscribe(subscriptionId: string): void;

  // Health
  getRelayHealth(url: string): RelayHealthInfo;
  getAllRelayHealth(): RelayHealthInfo[];
  getFastestRelay(): string | null;
  getFastestRelays(count: number): string[];
  getHealthiestRelay(): string | null;

  // Events
  on(event: 'relay:connected', listener: (url: string) => void): void;
  on(event: 'relay:disconnected', listener: (url: string) => void): void;
  on(event: 'relay:error', listener: (url: string, error: Error) => void): void;
  on(event: 'relay:health:changed', listener: (url: string, health: RelayHealthInfo) => void): void;
}
```

### KeyManagementService API

```typescript
class KeyManagementService {
  constructor(config?: Partial<NostrKeyManagementConfig>);

  // Initialization
  initialize(): Promise<NostrKeyManagementResult<void>>;

  // Key Generation
  generateKeyPair(options?: {
    name?: string;
    description?: string;
    securityLevel?: NostrKeySecurityLevel;
    entropySource?: NostrEntropySource;
    backupMethod?: NostrKeyBackupMethod;
  }): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair>>;

  // Key Import
  importKey(privateKey: string, options?: {
    name?: string;
    description?: string;
    validate?: boolean;
    backup?: boolean;
  }): Promise<NostrKeyManagementResult<NostrEnhancedKeyPair>>;

  // Backup
  createBackup(
    keyId: string,
    method: NostrKeyBackupMethod,
    options?: {
      passphrase?: string;
      encryptionKey?: string;
      verify?: boolean;
    }
  ): Promise<NostrKeyManagementResult<NostrMnemonicBackup>>;

  // Rotation
  rotateKey(keyId: string, options?: {
    type?: 'scheduled' | 'manual' | 'emergency' | 'compromised';
    reason?: string;
    migrateData?: boolean;
  }): Promise<NostrKeyManagementResult<NostrKeyRotation>>;

  // Validation
  validateKeyPair(keyPair: NostrEnhancedKeyPair): Promise<NostrKeyValidationResult>;

  // Statistics
  getStats(): {
    totalKeys: number;
    backedUpKeys: number;
    compromisedKeys: number;
    hardwareWallets: number;
    browserExtensions: number;
  };

  // Cleanup
  destroy(): void;
}
```

---

## 9. Best Practices

### 9.1 Security Best Practices

**Never Store Private Keys on Server**:
```typescript
// ❌ BAD: Sending private key to server
await fetch('/api/save-key', {
  method: 'POST',
  body: JSON.stringify({ privateKey }),
});

// ✅ GOOD: Keep private keys client-side only
const keyPair = await keyManager.generateKeyPair();
// Store encrypted in IndexedDB, never send to server
```

**Use Encrypted Storage**:
```typescript
// ✅ Enable encryption for stored keys
const keyManager = new KeyManagementService({
  encryptionEnabled: true,
  defaultStorageType: 'encrypted_indexeddb',
});
```

**Implement Key Rotation**:
```typescript
// ✅ Rotate keys periodically
setInterval(async () => {
  await keyManager.rotateKey(currentKeyId, {
    type: 'scheduled',
    reason: 'Quarterly rotation policy',
  });
}, 90 * 24 * 60 * 60 * 1000); // Every 90 days
```

**Validate All Events**:
```typescript
// ✅ Always verify event signatures
import { verifyEvent } from 'nostr-tools';

if (!verifyEvent(event)) {
  throw new Error('Invalid event signature');
}
```

**Use Browser Extensions When Available**:
```typescript
// ✅ Prefer browser extensions for signing
if (window.nostr) {
  const pubkey = await window.nostr.getPublicKey();
  const signedEvent = await window.nostr.signEvent(unsignedEvent);
}
```

---

### 9.2 Performance Best Practices

**Enable Event Deduplication**:
```typescript
// ✅ Reduce bandwidth by 50-80%
await relayPoolManager.initialize({
  enableDeduplication: true,
});
```

**Cache Events Locally**:
```typescript
// ✅ Reduce relay queries
const cache = new EventCacheService({
  maxSize: 10000,
  ttl: 3600000, // 1 hour
  enablePersistence: true,
});

// Check cache first
const cached = cache.getEvent(eventId);
if (cached) {
  return cached;
}
```

**Use Intelligent Relay Selection**:
```typescript
// ✅ Publish to fastest relays
await relayPoolManager.publishEventToFastest(event, 3);
```

**Limit Subscription Scope**:
```typescript
// ❌ BAD: Too broad
nostr.subscribe([{ kinds: [1] }], onEvent); // ALL text notes

// ✅ GOOD: Specific filters
nostr.subscribe([
  {
    kinds: [1],
    authors: followedPubkeys,
    limit: 100,
    since: Math.floor(Date.now() / 1000) - 3600,
  }
], onEvent);
```

**Batch Operations**:
```typescript
// ❌ BAD: Multiple separate subscriptions
following.forEach(pubkey => {
  nostr.subscribe([{ kinds: [1], authors: [pubkey] }], onEvent);
});

// ✅ GOOD: Single subscription with all authors
nostr.subscribe([
  { kinds: [1], authors: following, limit: 100 }
], onEvent);
```

---

### 9.3 Code Quality Best Practices

**Type Safety**:
```typescript
// ✅ Use TypeScript strict mode
import { NostrEvent, NostrFilter } from '@/services/nostr/types';

function processEvent(event: NostrEvent): void {
  // TypeScript ensures event has all required fields
  console.log(event.id, event.content);
}
```

**Error Handling**:
```typescript
// ✅ Comprehensive error handling
try {
  await nostr.publishNote(content);
} catch (error) {
  if (error instanceof NostrCryptographyError) {
    console.error('Crypto error:', error.message);
  } else if (error instanceof NostrValidationError) {
    console.error('Validation error:', error.event);
  } else {
    console.error('Unknown error:', error);
  }
}
```

**Resource Cleanup**:
```typescript
// ✅ Clean up subscriptions
useEffect(() => {
  const subId = nostr.subscribe(filters, onEvent);

  return () => {
    nostr.unsubscribe(subId);
  };
}, []);
```

---

## 10. Troubleshooting

### Common Issues

#### Issue: Events Not Publishing

**Symptoms**: `publishNote()` succeeds but events don't appear

**Solutions**:
```typescript
// 1. Check relay connections
const connected = relayPoolManager.getConnectedRelays();
console.log('Connected relays:', connected);

if (connected.length === 0) {
  await relayPoolManager.connectAll();
}

// 2. Check relay health
const health = relayPoolManager.getAllRelayHealth();
health.forEach(h => {
  if (h.status === 'unhealthy') {
    console.warn(`Unhealthy relay: ${h.url}`);
  }
});

// 3. Publish with results
const results = await relayPoolManager.publishEvent(event);
results.forEach(r => {
  if (!r.success) {
    console.error(`Failed on ${r.relay}:`, r.error);
  }
});
```

---

#### Issue: Subscriptions Not Receiving Events

**Symptoms**: Subscription created but `onEvent` never called

**Solutions**:
```typescript
// 1. Verify filters are correct
const filters = [{ kinds: [1], authors: [pubkey] }];
console.log('Filters:', JSON.stringify(filters));

// 2. Check if filters are too restrictive
// Try broader filter first
nostr.subscribe([{ kinds: [1], limit: 10 }], onEvent);

// 3. Verify relay connections
relayPoolManager.on('relay:connected', (url) => {
  console.log(`Connected to ${url}, re-subscribing...`);
});

// 4. Check for errors
relayPoolManager.on('relay:error', (url, error) => {
  console.error(`Relay error on ${url}:`, error);
});
```

---

#### Issue: Encrypted DMs Fail to Decrypt

**Symptoms**: `nip04.decrypt()` throws error or returns garbage

**Solutions**:
```typescript
// 1. Verify you're using the correct private key
console.log('My pubkey:', myPubkey);
console.log('Sender pubkey:', event.pubkey);

// 2. Check encryption format
console.log('Encrypted content:', event.content);
// Should be base64 string like: "base64string?iv=base64iv"

// 3. Try decrypting step-by-step
try {
  const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyHex, 'hex'));
  const decrypted = await nip04.decrypt(
    privateKeyBytes,
    event.pubkey,
    event.content
  );
  console.log('Decrypted:', decrypted);
} catch (error) {
  console.error('Decryption error:', error);
  console.error('Event:', event);
}
```

---

#### Issue: High Memory Usage

**Symptoms**: Browser memory grows over time

**Solutions**:
```typescript
// 1. Limit cache size
const cache = new EventCacheService({
  maxSize: 5000, // Reduce from default 10000
  ttl: 1800000,  // 30 minutes instead of 1 hour
});

// 2. Clean up old subscriptions
const activeSubscriptions = subscriptionManager.getActiveSubscriptions();
activeSubscriptions.forEach(sub => {
  if (!sub.active || sub.eventCount === 0) {
    subscriptionManager.unsubscribe(sub.id);
  }
});

// 3. Destroy services when unmounting
useEffect(() => {
  return () => {
    cache.destroy();
    keyManager.destroy();
  };
}, []);
```

---

#### Issue: NIP-05 Verification Fails

**Symptoms**: `nip05.verifyIdentifier()` returns `verified: false`

**Solutions**:
```typescript
// 1. Test .well-known endpoint manually
const domain = 'sovren.app';
const localPart = 'alice';
const url = `https://${domain}/.well-known/nostr.json`;

const response = await fetch(url);
const data = await response.json();
console.log('NIP-05 data:', data);
console.log('Expected pubkey:', expectedPubkey);
console.log('Actual pubkey:', data.names[localPart]);

// 2. Check CORS headers
console.log('CORS:', response.headers.get('access-control-allow-origin'));

// 3. Verify case sensitivity
// NIP-05 identifiers should be lowercase
const identifier = 'alice@sovren.app'.toLowerCase();
```

---

### Debugging Tools

#### Enable Verbose Logging

```typescript
// Enable debug logs for RelayPoolManager
relayPoolManager.on('relay:connected', console.log);
relayPoolManager.on('relay:disconnected', console.log);
relayPoolManager.on('relay:error', console.error);
relayPoolManager.on('relay:health:changed', console.log);

// Enable debug logs for NostrService
nostr.on('event:published', (event) => {
  console.log('Published:', event.id, event.content.slice(0, 50));
});
nostr.on('event:received', (event, relay) => {
  console.log('Received:', relay, event.kind, event.content.slice(0, 50));
});
```

#### Inspect Relay Health

```typescript
// Get detailed health report
function logRelayHealth() {
  const health = relayPoolManager.getAllRelayHealth();

  console.table(health.map(h => ({
    Relay: h.url,
    Status: h.status,
    Score: h.score,
    Latency: `${h.metrics.latency}ms`,
    'Success Rate': `${(h.metrics.successRate * 100).toFixed(1)}%`,
    Uptime: `${(h.metrics.uptime * 100).toFixed(1)}%`,
  })));
}

// Call periodically
setInterval(logRelayHealth, 30000); // Every 30 seconds
```

---

## 11. Testing Strategies

### 11.1 Unit Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { KeyManagementService, NostrKeySecurityLevel } from '@/services/nostr/KeyManagementService';

describe('KeyManagementService', () => {
  let keyManager: KeyManagementService;

  beforeEach(async () => {
    keyManager = new KeyManagementService();
    await keyManager.initialize();
  });

  afterEach(() => {
    keyManager.destroy();
  });

  describe('generateKeyPair', () => {
    it('should generate valid key pair with enhanced security', async () => {
      const result = await keyManager.generateKeyPair({
        name: 'Test Key',
        securityLevel: NostrKeySecurityLevel.ENHANCED,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const keyPair = result.data!;
      expect(keyPair.privateKey).toMatch(/^[0-9a-f]{64}$/);
      expect(keyPair.publicKey).toMatch(/^[0-9a-f]{64}$/);
      expect(keyPair.npub).toMatch(/^npub1/);
      expect(keyPair.nsec).toMatch(/^nsec1/);
      expect(keyPair.securityLevel).toBe(NostrKeySecurityLevel.ENHANCED);
      expect(keyPair.entropyBits).toBeGreaterThanOrEqual(256);
    });

    it('should validate generated key pair', async () => {
      const result = await keyManager.generateKeyPair();
      const keyPair = result.data!;

      const validation = await keyManager.validateKeyPair(keyPair);

      expect(validation.valid).toBe(true);
      expect(validation.securityScore).toBeGreaterThan(80);
      expect(validation.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });
  });

  describe('importKey', () => {
    it('should import valid private key', async () => {
      const testPrivateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const result = await keyManager.importKey(testPrivateKey, {
        name: 'Imported Key',
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.privateKey).toBe(testPrivateKey);
    });

    it('should reject invalid private key', async () => {
      const invalidKey = 'invalid';

      const result = await keyManager.importKey(invalidKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid private key');
    });
  });
});
```

---

### 11.2 Integration Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NostrService } from '@/lib/services/nostrService';
import { relayPoolManager } from '@/services/nostr/RelayPoolManager';

describe('NOSTR Integration Tests', () => {
  let nostr: NostrService;
  let testPrivateKey: string;
  let testPublicKey: string;

  beforeAll(async () => {
    nostr = NostrService.getInstance();
    await nostr.initialize({
      relays: ['wss://relay.damus.io'],
      autoConnect: true,
    });

    const keyPair = await nostr.generateKeyPair();
    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;

    await nostr.connectToRelays();
  });

  afterAll(async () => {
    await nostr.disconnect();
  });

  it('should publish and receive event', async () => {
    const testContent = `Test note ${Date.now()}`;

    // Publish note
    const publishedEvent = await nostr.publishNote(testContent);

    expect(publishedEvent.id).toBeDefined();
    expect(publishedEvent.content).toBe(testContent);

    // Subscribe and wait for event
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        nostr.unsubscribe(subId);
        throw new Error('Event not received within timeout');
      }, 10000);

      const subId = nostr.subscribe(
        [{ ids: [publishedEvent.id] }],
        (receivedEvent) => {
          clearTimeout(timeout);
          expect(receivedEvent.id).toBe(publishedEvent.id);
          expect(receivedEvent.content).toBe(testContent);
          nostr.unsubscribe(subId);
          resolve(true);
        }
      );
    });
  }, 15000);

  it('should handle relay failover', async () => {
    // Disconnect from all relays
    await relayPoolManager.disconnectAll();

    // Add multiple relays
    await relayPoolManager.addRelay('wss://relay.damus.io');
    await relayPoolManager.addRelay('wss://nos.lol');
    await relayPoolManager.connectAll();

    // Publish event
    const event = await nostr.publishNote('Failover test');

    // Check results
    const results = await relayPoolManager.publishEvent(event);
    const successful = results.filter(r => r.success);

    expect(successful.length).toBeGreaterThan(0);
  });
});
```

---

### 11.3 E2E Testing

```typescript
import { test, expect } from '@playwright/test';

test.describe('NOSTR User Journey', () => {
  test('new user can create key, publish note, and see it in feed', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');

    // Generate new key
    await page.click('[data-testid="generate-key"]');

    // Wait for key generation
    await page.waitForSelector('[data-testid="npub"]');
    const npub = await page.textContent('[data-testid="npub"]');
    expect(npub).toMatch(/^npub1/);

    // Save backup mnemonic
    await page.click('[data-testid="create-backup"]');
    const mnemonic = await page.textContent('[data-testid="mnemonic"]');
    expect(mnemonic?.split(' ').length).toBe(24);
    await page.click('[data-testid="confirm-backup"]');

    // Publish a note
    const testNote = `E2E test note ${Date.now()}`;
    await page.fill('[data-testid="note-input"]', testNote);
    await page.click('[data-testid="publish-note"]');

    // Wait for publish confirmation
    await page.waitForSelector('[data-testid="publish-success"]');

    // Check note appears in feed
    await page.waitForSelector(`text=${testNote}`);
    const noteContent = await page.textContent('[data-testid="feed-note"]');
    expect(noteContent).toContain(testNote);
  });

  test('user can send and receive encrypted DM', async ({ page, context }) => {
    // Open two browser contexts (two users)
    const page1 = page;
    const page2 = await context.newPage();

    // User 1: Generate key
    await page1.goto('http://localhost:3000');
    await page1.click('[data-testid="generate-key"]');
    const npub1 = await page1.textContent('[data-testid="npub"]');

    // User 2: Generate key
    await page2.goto('http://localhost:3000');
    await page2.click('[data-testid="generate-key"]');
    const npub2 = await page2.textContent('[data-testid="npub"]');

    // User 1: Start chat with User 2
    await page1.click('[data-testid="new-chat"]');
    await page1.fill('[data-testid="recipient-npub"]', npub2!);
    await page1.click('[data-testid="start-chat"]');

    // User 1: Send message
    const testMessage = `E2E DM test ${Date.now()}`;
    await page1.fill('[data-testid="message-input"]', testMessage);
    await page1.click('[data-testid="send-message"]');

    // User 2: Receive message
    await page2.waitForSelector(`text=${testMessage}`, { timeout: 10000 });
    const receivedMessage = await page2.textContent('[data-testid="dm-content"]');
    expect(receivedMessage).toBe(testMessage);
  });
});
```

---

## 12. Performance Optimization

### Bandwidth Optimization

```typescript
// ✅ Enable deduplication (50-80% bandwidth savings)
await relayPoolManager.initialize({
  enableDeduplication: true,
});

// ✅ Use specific filters to reduce event volume
const optimizedFilters = [
  {
    kinds: [1],
    authors: followedUsers,
    since: Math.floor(Date.now() / 1000) - 3600, // Last hour only
    limit: 50,
  }
];
```

### Memory Optimization

```typescript
// ✅ Limit cache size
const cache = new EventCacheService({
  maxSize: 5000,
  ttl: 1800000, // 30 minutes
});

// ✅ Clean up old subscriptions
subscriptionManager.getActiveSubscriptions().forEach(sub => {
  if (sub.eventCount === 0 && Date.now() - sub.createdAt > 300000) {
    subscriptionManager.unsubscribe(sub.id);
  }
});
```

### Connection Optimization

```typescript
// ✅ Use fastest relays for publishing
await relayPoolManager.publishEventToFastest(event, 3);

// ✅ Limit concurrent relay connections
await relayPoolManager.initialize({
  maxRelays: 5, // Reduce from default 10
});
```

---

## 13. Security Considerations

### Key Security Checklist

- [ ] Private keys stored encrypted (AES-256-GCM)
- [ ] Private keys never sent to server
- [ ] Keys only in memory during signing
- [ ] Mnemonic backups created and saved securely
- [ ] Key rotation policy implemented (quarterly)
- [ ] Browser extension support for hardware wallets
- [ ] Multi-factor authentication for high-value keys

### Event Security Checklist

- [ ] All events signature-verified before processing
- [ ] Content sanitized to prevent XSS
- [ ] NIP-04 encryption for private messages
- [ ] Event timestamps validated (not too old/future)
- [ ] Rate limiting on event publishing
- [ ] Spam detection and filtering

### Network Security Checklist

- [ ] All relay connections use WSS (encrypted WebSocket)
- [ ] CORS properly configured for .well-known endpoints
- [ ] Rate limiting on relay requests
- [ ] Relay health monitoring enabled
- [ ] Automatic failover to healthy relays
- [ ] No sensitive data in relay URLs

---

## Appendix: Quick Reference

### Environment Variables

```bash
NOSTR_RELAYS=wss://relay1,wss://relay2
NOSTR_AUTO_CONNECT=true
NOSTR_CONNECTION_TIMEOUT=5000
NOSTR_MAX_RELAYS=10
NOSTR_CACHE_TTL=3600000
NOSTR_PRIVATE_KEY=<hex_key>
NOSTR_PUBLIC_KEY=<hex_key>
```

### Event Kinds

| Kind | Description | NIP |
|------|-------------|-----|
| 0 | Metadata (profile) | NIP-01 |
| 1 | Short text note | NIP-01 |
| 2 | Recommend relay | NIP-01 |
| 3 | Contacts | NIP-02 |
| 4 | Encrypted DM | NIP-04 |
| 5 | Event deletion | NIP-09 |
| 6 | Repost | NIP-18 |
| 7 | Reaction | NIP-25 |
| 30023 | Long-form content | NIP-23 |
| 30078 | App data | NIP-78 |
| 9735 | Zap | NIP-57 |

### Relay URLs

Default relays:
- wss://relay.damus.io
- wss://nos.lol
- wss://relay.nostr.info
- wss://relay.snort.social
- wss://nostr-pub.wellorder.net

### Useful Links

- [NOSTR Protocol](https://github.com/nostr-protocol/nostr)
- [NIP Specifications](https://github.com/nostr-protocol/nips)
- [nostr-tools Documentation](https://github.com/nbd-wtf/nostr-tools)
- [Sovren Architecture Diagrams](../architecture/diagrams/nostr/README.md)
- [Epic 003 Documentation](../EPIC_003_NOSTR_CONSOLIDATION_READY.md)

---

**Document Version**: 2.0.0
**Last Updated**: 2025-10-25
**Maintainer**: Technical Documentation Team (docs@sovren.app)

For questions or corrections, please contact the NOSTR Integration Team or create an issue in the project repository.
