# US-308: NOSTR Type Consolidation - Quick Reference

## Location
`/Users/fp/Desktop/Sovren/packages/shared/src/types/nostr/`

## Import Patterns

### Import Everything
```typescript
import * as Nostr from '@shared/types/nostr';
```

### Import Specific Types
```typescript
// Events
import { NostrEvent, NostrEventKind, EventTemplate } from '@shared/types/nostr';

// Keys
import { NostrKeyPair, NostrEnhancedKeyPair, NostrKeyFormat } from '@shared/types/nostr';

// Relays
import { RelayStatus, RelayState, RelayConfig } from '@shared/types/nostr';

// Filters
import { NostrFilter, SubscriptionInfo } from '@shared/types/nostr';

// Utilities
import { CommonFilters, NostrFilterBuilder } from '@shared/types/nostr';

// Schemas
import { NostrSchemas } from '@shared/types/nostr';

// Errors
import { NostrError, NostrConnectionError } from '@shared/types/nostr';
```

## Common Usage Patterns

### Creating an Event
```typescript
import { NostrEvent, NostrEventKind, NostrEventSchema } from '@shared/types/nostr';

const event: NostrEvent = {
  id: eventId,
  pubkey: userPublicKey,
  created_at: Math.floor(Date.now() / 1000),
  kind: NostrEventKind.TEXT_NOTE,
  tags: [['p', mentionedPubkey]],
  content: 'Hello NOSTR!',
  sig: signature,
};

// Validate with Zod
const result = NostrEventSchema.safeParse(event);
if (result.success) {
  // Event is valid
}
```

### Building a Filter
```typescript
import { NostrFilterBuilder, CommonFilters } from '@shared/types/nostr';

// Using builder pattern
const filter = new NostrFilterBuilder()
  .authors([myPubkey])
  .kinds([1, 6, 7])
  .since(yesterday)
  .limit(50)
  .build();

// Using common presets
const userNotes = CommonFilters.userNotes(pubkey, 100);
const globalFeed = CommonFilters.globalFeed(50);
const mentions = CommonFilters.mentions(myPubkey);
```

### Validating a Key Pair
```typescript
import { NostrEnhancedKeyPairSchema } from '@shared/types/nostr';

const keyPair = {
  privateKey: '...',
  publicKey: '...',
  npub: 'npub1...',
  nsec: 'nsec1...',
  keyId: '550e8400-e29b-41d4-a716-446655440000',
  created: Date.now(),
  entropySource: 'web_crypto_api',
  entropyBits: 256,
  storageType: 'indexed_db',
  encrypted: true,
  securityLevel: 'enhanced',
};

const result = NostrEnhancedKeyPairSchema.safeParse(keyPair);
```

### Using Type Guards
```typescript
import { isNostrEvent, isNostrFilter } from '@shared/types/nostr';

if (isNostrEvent(obj)) {
  // TypeScript knows obj is NostrEvent
  console.log(obj.id, obj.pubkey);
}

if (isNostrFilter(obj)) {
  // TypeScript knows obj is NostrFilter
  console.log(obj.authors, obj.kinds);
}
```

### Event Utilities
```typescript
import {
  isReplaceableEvent,
  getEventCoordinate,
  extractMentions,
} from '@shared/types/nostr';

// Check event type
if (isReplaceableEvent(event.kind)) {
  // This is a replaceable event (kind 0, 3, or 10000-19999)
}

// Get event coordinate (for NIP-33)
const coordinate = getEventCoordinate(event);
// Returns: "30023:pubkey:identifier"

// Extract mentions
const mentions = extractMentions(event);
// Returns: ['pubkey1', 'pubkey2']
```

## File Structure

```
packages/shared/src/types/nostr/
├── index.ts                 # Barrel export (import from here)
├── events.ts                # Event types
├── keys.ts                  # Key management
├── relays.ts                # Relay types
├── filters.ts               # Filter types
├── nips.ts                  # NIP-specific types
└── __tests__/
    └── index.test.ts        # Type tests
```

## Available Schemas

```typescript
import { NostrSchemas } from '@shared/types/nostr';

// Events
NostrSchemas.Event
NostrSchemas.UnsignedEvent
NostrSchemas.EventTag
NostrSchemas.EventCacheEntry

// Keys
NostrSchemas.KeyPair
NostrSchemas.EnhancedKeyPair
NostrSchemas.KeyDerivation
NostrSchemas.MnemonicBackup
NostrSchemas.KeyStorageConfig
NostrSchemas.HardwareWallet
NostrSchemas.BrowserExtension
NostrSchemas.KeyUsageAnalytics
NostrSchemas.KeySecurityMonitoring
NostrSchemas.KeyRotation
NostrSchemas.KeyRecovery

// Relays
NostrSchemas.Relay
NostrSchemas.RelayConfig
NostrSchemas.RelayInformationDocument

// Filters
NostrSchemas.Filter
NostrSchemas.SubscriptionInfo

// NIPs
NostrSchemas.DirectMessage
```

## Supported NIPs

- NIP-01: Basic protocol
- NIP-02: Contact lists
- NIP-04: Encrypted DMs
- NIP-05: DNS verification
- NIP-11: Relay information
- NIP-19: Bech32 entities
- NIP-23: Long-form content
- NIP-25: Reactions
- NIP-26: Delegated signing
- NIP-28: Public chat
- NIP-33: Parameterized replaceable
- NIP-42: Authentication
- NIP-57: Lightning zaps

Check support:
```typescript
import { isNIPSupported, SUPPORTED_NIPS } from '@shared/types/nostr';

if (isNIPSupported(4)) {
  // NIP-04 is supported
}

console.log(SUPPORTED_NIPS); // [1, 2, 4, 5, 9, 11, 19, ...]
```

## Error Handling

```typescript
import {
  NostrError,
  NostrConnectionError,
  NostrValidationError,
  NostrPublishError,
} from '@shared/types/nostr';

try {
  // NOSTR operation
} catch (error) {
  if (error instanceof NostrConnectionError) {
    console.error('Connection failed:', error.relay);
  } else if (error instanceof NostrValidationError) {
    console.error('Invalid event:', error.event);
  } else if (error instanceof NostrPublishError) {
    console.error('Publish failed:', error.failedRelays);
  }
}
```

## Constants

```typescript
import { DEFAULT_RELAYS, MAX_EVENT_SIZE, DEFAULT_TIMEOUTS } from '@shared/types/nostr';

// Default relays
console.log(DEFAULT_RELAYS);
// ['wss://relay.damus.io', 'wss://relay.nostr.band', ...]

// Max event sizes
console.log(MAX_EVENT_SIZE.TEXT_NOTE); // 10000 bytes

// Default timeouts
console.log(DEFAULT_TIMEOUTS.CONNECTION); // 5000ms
```

## Next Steps

The remaining implementation tasks (migration) are tracked in:
- US-301: Update NOSTR Service Implementations
- US-312: Implement NOSTR Event Cache
- US-313: Implement NOSTR Relay Pool

These stories will:
1. Update all imports to use new consolidated types
2. Delete old duplicate type files
3. Leverage new utility functions
4. Add runtime validation with Zod schemas

## Documentation

Full documentation: `/docs/US-308-NOSTR-TYPE-CONSOLIDATION-COMPLETE.md`
