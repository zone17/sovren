# NOSTR Implementation Possibilities (NIPs) Documentation

Complete documentation of all NIPs implemented in Sovren.

---

## Table of Contents

1. [Implemented NIPs](#implemented-nips)
2. [Core Protocol NIPs](#core-protocol-nips)
3. [Sovren Custom NIPs](#sovren-custom-nips)

---

## Implemented NIPs

Sovren implements the following NOSTR Implementation Possibilities:

| NIP                             | Title                     | Status      | Service          |
| ------------------------------- | ------------------------- | ----------- | ---------------- |
| [NIP-01](./nip-01.md)           | Basic Protocol            | ✅ Complete | Core             |
| [NIP-04](./nip-04.md)           | Encrypted Direct Messages | ✅ Complete | NIP04Service     |
| [NIP-05](./nip-05.md)           | DNS-based Verification    | ✅ Complete | NIP05Service     |
| [NIP-19](./nip-19.md)           | Bech32-encoded Entities   | ✅ Complete | NIP19Service     |
| [NIP-26](./nip-26.md)           | Delegated Event Signing   | ✅ Complete | NIP26Service     |
| [NIP-65](./nip-65.md)           | Relay List Metadata       | ✅ Complete | NIP65Service     |
| [30078-30082](./sovren-nips.md) | Sovren Custom NIPs        | ✅ Complete | SovrenNIPService |

---

## Core Protocol NIPs

### NIP-01: Basic Protocol Flow

**Purpose**: Foundational NOSTR protocol for events, filters, and relay messages.

**Implementation**: All services use NIP-01 event structure

**Key Features**:

- Event creation and validation
- Event signing and verification
- Filter-based subscriptions
- Relay message handling (EVENT, REQ, CLOSE, EOSE, OK, NOTICE)

**Code Example**:

```typescript
import { NostrEvent, NostrFilter } from '@shared/types/nostr';

// Create event (NIP-01 structure)
const event: NostrEvent = {
  id: 'event-hash',
  pubkey: 'creator-pubkey',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [['t', 'nostr']],
  content: 'Hello NOSTR!',
  sig: 'signature',
};

// Create filter (NIP-01 structure)
const filter: NostrFilter = {
  kinds: [1],
  authors: ['pubkey'],
  since: 1698432000,
  limit: 50,
};
```

**Documentation**: [NIP-01 Spec](https://github.com/nostr-protocol/nips/blob/master/01.md)

---

### NIP-04: Encrypted Direct Messages

**Purpose**: End-to-end encrypted private messaging between users.

**Implementation**: `NIP04Service`, `NIP04EnhancedService`

**Key Features**:

- AES-256-CBC encryption with shared secret
- Conversation threading
- Read receipts
- Message history

**Code Example**:

```typescript
import { NIP04Service } from '@/services/nostr/NIP04Service';

const nip04 = NIP04Service.getInstance();

// Encrypt message
const encrypted = await nip04.encryptMessage(recipientPubkey, 'Secret message');

// Publish encrypted DM
await publisher.createAndPublish({
  kind: 4,
  content: encrypted,
  tags: [['p', recipientPubkey]],
});

// Decrypt received message
const decrypted = await nip04.decryptMessage(senderPubkey, ciphertext);
```

**Security Notes**:

- Uses ECDH for shared secret derivation
- IV (initialization vector) prepended to ciphertext
- NOT forward-secure (consider NIP-17 for improved security)

**Documentation**: [NIP-04 Spec](https://github.com/nostr-protocol/nips/blob/master/04.md)

---

### NIP-05: DNS-based Verification

**Purpose**: Verify user identity using DNS-based identifiers (email-like format).

**Implementation**: `NIP05Service`

**Key Features**:

- Verify `user@domain.com` format identifiers
- Reverse lookup (pubkey to identifier)
- Caching for performance
- Retry logic for failed verifications

**Code Example**:

```typescript
import { NIP05Service } from '@/services/nostr/NIP05Service';

const nip05 = NIP05Service.getInstance();

// Verify identifier
const result = await nip05.verify('alice@example.com');

if (result.valid) {
  console.log('Verified pubkey:', result.pubkey);
  console.log('Relays:', result.relays);
}

// Reverse lookup
const identifier = await nip05.lookupIdentifier(pubkey);
console.log('Identifier:', identifier); // alice@example.com
```

**How it works**:

1. Query `https://domain.com/.well-known/nostr.json?name=user`
2. Verify returned pubkey matches expected value
3. Optional: Extract recommended relays

**Documentation**: [NIP-05 Spec](https://github.com/nostr-protocol/nips/blob/master/05.md)

---

### NIP-19: Bech32-encoded Entities

**Purpose**: Human-readable encoding for NOSTR entities (keys, events, profiles).

**Implementation**: `NIP19Service`, `NIP19BatchService`

**Key Features**:

- Encode/decode npub, nsec, note, nevent, nprofile, naddr
- Batch operations for efficiency
- Validation and error handling
- QR code generation support

**Code Example**:

```typescript
import { NIP19Service } from '@/services/nostr/NIP19Service';

const nip19 = NIP19Service.getInstance();

// Encode public key
const npub = await nip19.encodePubkey(hexPubkey);
// npub1...

// Encode private key
const nsec = await nip19.encodePrivkey(hexPrivkey);
// nsec1...

// Encode note (event ID)
const note = await nip19.encodeNote(eventId);
// note1...

// Encode event with relay hints
const nevent = await nip19.encodeEvent(eventId, {
  relays: ['wss://relay.damus.io'],
  author: authorPubkey,
});
// nevent1...

// Decode any bech32 entity
const decoded = await nip19.decode(npub);
console.log(decoded); // { type: 'npub', data: '...' }
```

**Entity Types**:

- `npub`: Public key
- `nsec`: Private key (⚠️ handle carefully!)
- `note`: Event ID
- `nevent`: Event with metadata (relays, author)
- `nprofile`: Profile with metadata
- `naddr`: Parameterized replaceable event

**Documentation**: [NIP-19 Spec](https://github.com/nostr-protocol/nips/blob/master/19.md)

---

### NIP-26: Delegated Event Signing

**Purpose**: Allow delegation of event signing authority to other keys.

**Implementation**: `NIP26Service`

**Key Features**:

- Create delegation tokens with conditions
- Verify delegated events
- Revoke delegations
- Time-limited and kind-limited delegations

**Code Example**:

```typescript
import { NIP26Service } from '@/services/nostr/NIP26Service';

const nip26 = NIP26Service.getInstance();

// Create delegation (as delegator)
const delegation = await nip26.createDelegation({
  delegatorKey: myPrivateKey,
  delegatePubkey: botPubkey,
  allowedKinds: [1], // Only text notes
  until: futureTimestamp,
  conditions: 'kind=1&created_at<1735689600',
});

// Delegate uses delegation to sign events
const event = await publisher.createAndPublish(
  {
    kind: 1,
    content: 'Posted by bot on behalf of user',
    tags: [['delegation', myPubkey, delegation.conditions, delegation.token]],
  },
  { delegation }
);

// Verify delegated event
const isValid = await nip26.verifyDelegation(event);
```

**Use Cases**:

- Automated posting bots
- Scheduled content
- Team accounts
- Cross-platform publishing

**Documentation**: [NIP-26 Spec](https://github.com/nostr-protocol/nips/blob/master/26.md)

---

### NIP-65: Relay List Metadata

**Purpose**: Discover user's preferred relays for reading and writing.

**Implementation**: `NIP65Service`

**Key Features**:

- Publish relay list (read/write preferences)
- Fetch user's relay preferences
- Automatic relay discovery
- Caching for performance

**Code Example**:

```typescript
import { NIP65Service } from '@/services/nostr/NIP65Service';

const nip65 = NIP65Service.getInstance();

// Publish relay list
await nip65.publishRelayList({
  'wss://relay.damus.io': { read: true, write: true },
  'wss://relay.nostr.band': { read: true, write: false },
  'wss://nos.lol': { read: true, write: true },
});

// Fetch user's preferred relays
const relays = await nip65.getUserRelays(pubkey);

console.log('Read relays:', relays.read);
console.log('Write relays:', relays.write);

// Use discovered relays for publishing
await publisher.publishEvent(event, relays.write);
```

**Event Kind**: 10002 (Relay List Metadata)

**Documentation**: [NIP-65 Spec](https://github.com/nostr-protocol/nips/blob/master/65.md)

---

## Sovren Custom NIPs (30078-30082)

### Overview

Sovren extends NOSTR with custom event kinds for creator monetization, analytics, and recommendations.

**See**: [Sovren NIPs Specification](../../nostr/sovren-nips-specification.md)

### NIP-30078: Creator Profile Extended

**Purpose**: Extended creator metadata beyond basic NIP-01 profile.

**Features**:

- Lightning address integration
- Social media links verification
- Creator categories
- Payment methods
- NIP-05 verification badge

**Example**:

```typescript
await sovrenNIP.publishCreatorProfile({
  displayName: 'Alice Creator',
  bio: 'Bitcoin educator',
  categories: ['technology', 'education'],
  lightningAddress: 'alice@getalby.com',
  links: [{ platform: 'twitter', url: 'https://twitter.com/alice', verified: true }],
});
```

---

### NIP-30079: Content Monetization

**Purpose**: Paywall configuration and pricing for content.

**Features**:

- Multiple pricing tiers
- Paywall settings (partial/full)
- Revenue sharing
- Subscription management

**Example**:

```typescript
await sovrenNIP.publishMonetizationSettings(contentId, {
  paywall: { enabled: true, type: 'partial' },
  pricingTiers: [
    {
      id: 'basic',
      price: 1000,
      currency: 'sats',
      interval: 'one-time',
    },
  ],
});
```

---

### NIP-30080: Analytics Event

**Purpose**: Track content performance metrics.

**Features**:

- View counts
- Engagement metrics
- Revenue tracking
- Regional analytics

**Example**:

```typescript
await sovrenNIP.trackAnalyticsEvent(analyticsId, {
  eventType: 'view',
  contentId: 'article-123',
  viewCount: 543,
  engagement: { likes: 45, shares: 12 },
});
```

---

### NIP-30081: Subscription Management

**Purpose**: Define subscription tiers and track subscribers.

**Features**:

- Multiple tiers
- Subscriber counts
- MRR tracking
- Trial periods

**Example**:

```typescript
await sovrenNIP.publishSubscriptionTiers({
  tiers: [
    {
      id: 'premium',
      name: 'Premium',
      price: 21000,
      currency: 'sats',
      interval: 'monthly',
      benefits: ['All content', 'Early access'],
    },
  ],
});
```

---

### NIP-30082: Content Recommendations

**Purpose**: AI-generated personalized content feeds.

**Features**:

- Confidence scoring
- Explainable recommendations
- Multiple algorithms
- Expiring recommendations

**Example**:

```typescript
const recommendations = await sovrenNIP.fetchRecommendations(userPubkey);

recommendations.forEach((rec) => {
  console.log(`${rec.title} (confidence: ${rec.score.confidence})`);
  console.log(`Reason: ${rec.reason}`);
});
```

---

## NIP Compliance Testing

Verify NIP compliance:

```typescript
import { testNIPCompliance } from '@/services/nostr/__tests__/nip-compliance';

// Test NIP-01 compliance
const nip01Results = await testNIPCompliance('NIP-01');

// Test all NIPs
const allResults = await testNIPCompliance('all');

console.log('Compliance:', allResults.passRate);
```

---

## Contributing

To propose new NIPs or suggest improvements:

1. Review [NOSTR NIPs repository](https://github.com/nostr-protocol/nips)
2. Open discussion in [GitHub Issues](https://github.com/sovren/sovren/issues)
3. Submit PR with implementation and tests
4. Update this documentation

---

**Maintained by**: Sovren Development Team
**Last Updated**: 2025-10-26
