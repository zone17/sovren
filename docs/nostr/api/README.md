# NOSTR API Reference

Complete API documentation for all NOSTR services in Sovren.

---

## Table of Contents

1. [Core Services](#core-services)
2. [NIP Implementation Services](#nip-implementation-services)
3. [Utility Services](#utility-services)
4. [Type Definitions](#type-definitions)

---

## Core Services

### [RelayPoolManager](./relay-pool-manager.md)
Centralized relay connection pool with health monitoring and intelligent routing.

**Key Features**:
- Multi-relay WebSocket management
- Automatic failover and reconnection
- Health-based relay selection
- Event deduplication

**Quick Example**:
```typescript
const manager = RelayPoolManager.getInstance();
await manager.initialize({ relays: ['wss://relay.damus.io'] });
await manager.connectAll();

const result = await manager.publishEvent(signedEvent);
```

---

### [KeyManagementService](./key-management-service.md)
Secure key generation, storage, and signing operations.

**Key Features**:
- AES-256-GCM encrypted storage
- Browser extension integration (NIP-07)
- Multiple import formats (nsec, hex, mnemonic)
- Security scoring

**Quick Example**:
```typescript
const keyService = KeyManagementService.getInstance();
await keyService.initialize();

// Generate new key
const keyPair = await keyService.generateKey();

// Sign event
const signedEvent = await keyService.signEvent(unsignedEvent);
```

---

### [EventPublisherService](./event-publisher-service.md)
Centralized event publishing with validation and retry logic.

**Key Features**:
- Multiple publishing strategies (broadcast, targeted, smart)
- Automatic retry with exponential backoff
- Pre-publish validation
- Batch publishing

**Quick Example**:
```typescript
const publisher = EventPublisherService.getInstance();
await publisher.initialize();

const result = await publisher.createAndPublish({
  kind: 1,
  content: 'Hello NOSTR!',
  tags: [['t', 'sovren']],
});
```

---

### [SubscriptionManagerService](./subscription-manager-service.md)
Advanced subscription management with pooling and deduplication.

**Key Features**:
- Subscription pooling for efficiency
- Pause/resume functionality
- EOSE tracking per relay
- Automatic event caching

**Quick Example**:
```typescript
const subManager = SubscriptionManagerService.getInstance();

const subId = subManager.subscribe(
  [{ kinds: [1], limit: 50 }],
  (event, relay) => console.log('Event:', event),
  { onEOSE: (relay) => console.log('EOSE from', relay) }
);
```

---

### [EventCacheService](./event-cache-service.md)
Intelligent event caching with persistence and deduplication.

**Key Features**:
- In-memory and IndexedDB persistence
- Automatic deduplication
- TTL-based expiration
- Query by filter

**Quick Example**:
```typescript
const cache = getEventCache();

await cache.cacheEvent(event, 'wss://relay.damus.io');
const cachedEvent = await cache.getCachedEvent(eventId);
const events = await cache.queryCachedEvents({ kinds: [1] });
```

---

### [MonitoringService](./monitoring-service.md)
Real-time metrics collection and health monitoring.

**Key Features**:
- Relay health tracking
- Performance metrics
- Alert generation
- Dashboard integration

**Quick Example**:
```typescript
const monitor = MonitoringService.getInstance();
await monitor.initialize();

monitor.recordMetric('event_published', 1);
const health = monitor.getRelayHealth('wss://relay.damus.io');
```

---

## NIP Implementation Services

### [NIP04Service](./nip-04-service.md)
Encrypted Direct Messages (NIP-04)

**Features**:
- End-to-end encrypted messaging
- Conversation threading
- Read receipts

**Quick Example**:
```typescript
const nip04 = NIP04Service.getInstance();
const encrypted = await nip04.encryptMessage(recipientPubkey, plaintext);
const decrypted = await nip04.decryptMessage(senderPubkey, ciphertext);
```

---

### [NIP05Service](./nip-05-service.md)
DNS-based Verification (NIP-05)

**Features**:
- Verify NIP-05 identifiers
- Domain-based trust
- Reverse lookups

**Quick Example**:
```typescript
const nip05 = NIP05Service.getInstance();
const result = await nip05.verify('alice@example.com');
if (result.valid) {
  console.log('Verified pubkey:', result.pubkey);
}
```

---

### [NIP19Service](./nip-19-service.md)
Bech32-encoded Entities (NIP-19)

**Features**:
- Encode/decode npub, nsec, note, nevent, nprofile
- Batch operations
- Validation

**Quick Example**:
```typescript
const nip19 = NIP19Service.getInstance();
const npub = await nip19.encodePubkey(hexPubkey);
const decoded = await nip19.decode(npub);
```

---

### [NIP26Service](./nip-26-service.md)
Delegated Event Signing (NIP-26)

**Features**:
- Create delegation tokens
- Verify delegated events
- Revoke delegations

**Quick Example**:
```typescript
const nip26 = NIP26Service.getInstance();
const delegation = await nip26.createDelegation({
  delegatorKey: myPrivateKey,
  delegatePubkey: delegatePubkey,
  allowedKinds: [1],
  until: futureTimestamp,
});
```

---

### [NIP65Service](./nip-65-service.md)
Relay List Metadata (NIP-65)

**Features**:
- Discover user's preferred relays
- Read/write relay specifications
- Relay list caching

**Quick Example**:
```typescript
const nip65 = NIP65Service.getInstance();
const relays = await nip65.getUserRelays(pubkey);
await nip65.publishRelayList({
  'wss://relay.damus.io': { read: true, write: true },
});
```

---

### [SovrenNIPService](./sovren-nip-service.md)
Custom NIPs (30078-30082)

**Features**:
- Creator profile extended (30078)
- Content monetization (30079)
- Analytics events (30080)
- Subscription management (30081)
- Content recommendations (30082)

**Quick Example**:
```typescript
const sovrenNIP = SovrenNIPService.getInstance();

// Publish creator profile
await sovrenNIP.publishCreatorProfile({
  displayName: 'Alice Creator',
  categories: ['technology'],
  lightningAddress: 'alice@getalby.com',
});

// Fetch monetization settings
const settings = await sovrenNIP.fetchMonetizationSettings(contentId);
```

---

## Utility Services

### [EventDeduplicationService](./event-deduplication-service.md)
Event deduplication and fingerprinting.

### [CacheInvalidationService](./cache-invalidation-service.md)
Cache invalidation strategies and policies.

### [CachePersistenceService](./cache-persistence-service.md)
IndexedDB persistence layer for event cache.

---

## Type Definitions

### Core Types
- [NostrEvent](../types/nostr-event.md)
- [NostrFilter](../types/nostr-filter.md)
- [NostrRelay](../types/nostr-relay.md)

### Service Types
- [PublishResult](../types/publish-result.md)
- [SubscriptionInfo](../types/subscription-info.md)
- [RelayHealth](../types/relay-health.md)

### NIP Types
- [NIP04 Types](../types/nip-04.md)
- [NIP19 Types](../types/nip-19.md)
- [NIP26 Types](../types/nip-26.md)

---

## Common Patterns

### Singleton Pattern

All core services use the singleton pattern to prevent duplicate instances:

```typescript
// ✓ CORRECT
const manager = RelayPoolManager.getInstance();

// ✗ INCORRECT (will throw error)
const manager = new RelayPoolManager();
```

### Error Handling

All async operations should be wrapped in try-catch:

```typescript
try {
  const result = await publisher.publishEvent(event);
  console.log('Published:', result);
} catch (error) {
  if (error instanceof NostrError) {
    console.error('NOSTR error:', error.code, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Event Listeners

Services emit events for loose coupling:

```typescript
relayPoolManager.on('relay:connected', (relay) => {
  console.log(`Connected to ${relay.url}`);
});

relayPoolManager.on('relay:error', (relay, error) => {
  console.error(`Relay error ${relay.url}:`, error);
});
```

### Type Validation

Use Zod schemas for runtime type validation:

```typescript
import { NostrEventSchema } from '@shared/types/nostr';

const validatedEvent = NostrEventSchema.parse(rawEvent);
// Throws if validation fails
```

---

## Performance Best Practices

### Connection Reuse

Always reuse service instances:

```typescript
// ✓ CORRECT: Reuse singleton
const manager = RelayPoolManager.getInstance();

// ✗ INCORRECT: Repeatedly getting instance in loops
for (const event of events) {
  const manager = RelayPoolManager.getInstance(); // Wasteful
  await manager.publishEvent(event);
}
```

### Batch Operations

Use batch operations when publishing multiple events:

```typescript
// ✓ CORRECT: Batch publish
const results = await publisher.publishBatch([event1, event2, event3]);

// ✗ INCORRECT: Individual publishes
for (const event of events) {
  await publisher.publishEvent(event); // Slower
}
```

### Subscription Pooling

Enable subscription pooling for common filters:

```typescript
// ✓ CORRECT: Pooling enabled (default)
const subId = subManager.subscribe(filters, callback);

// ✗ INCORRECT: Pooling disabled unnecessarily
const subId = subManager.subscribe(filters, callback, { pool: false });
```

---

## Next Steps

- Explore detailed [Service Documentation](./relay-pool-manager.md)
- Read [Getting Started Guide](../guides/getting-started.md)
- Check [Integration Examples](../examples/README.md)
- Review [NIPs Documentation](../nips/README.md)

---

**Maintained by**: Sovren Development Team
**Questions**: [GitHub Issues](https://github.com/sovren/sovren/issues)
