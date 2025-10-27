# Getting Started with Sovren NOSTR Integration

Complete beginner's guide to using NOSTR in Sovren.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Publishing Events](#publishing-events)
5. [Subscribing to Events](#subscribing-to-events)
6. [Next Steps](#next-steps)

---

## Prerequisites

### System Requirements

- Node.js 18+ installed
- TypeScript 5.3+ configured
- React 18.3+ application
- Modern browser (Chrome, Firefox, Brave)

### Dependencies

The NOSTR integration is already included in Sovren. No additional installation needed!

```bash
# Already installed in Sovren
- nostr-tools@^2.0.0
- @noble/secp256k1@^2.0.0
```

---

## Quick Start

### 1. Initialize NOSTR Services

Create a NOSTR context in your app:

```typescript
// src/contexts/NostrContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { RelayPoolManager } from '@/services/nostr/RelayPoolManager';
import { KeyManagementService } from '@/services/nostr/KeyManagementService';
import { EventPublisherService } from '@/services/nostr/EventPublisherService';

interface NostrContextValue {
  isConnected: boolean;
  publicKey: string | null;
  publishEvent: (event: any) => Promise<any>;
}

const NostrContext = createContext<NostrContextValue | null>(null);

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    async function initNostr() {
      // Initialize services
      const relayPool = RelayPoolManager.getInstance();
      const keyManagement = KeyManagementService.getInstance();
      const publisher = EventPublisherService.getInstance();

      // Connect to default relays
      await relayPool.initialize();
      await relayPool.connectAll();

      // Initialize key management
      await keyManagement.initialize();

      // Initialize publisher
      await publisher.initialize();

      // Check for existing key or extension
      const extension = await keyManagement.detectExtension();
      if (extension) {
        const pubkey = await extension.getPublicKey();
        setPublicKey(pubkey);
      }

      setIsConnected(true);
    }

    initNostr();
  }, []);

  const publishEvent = async (event: any) => {
    const publisher = EventPublisherService.getInstance();
    return await publisher.createAndPublish(event);
  };

  return (
    <NostrContext.Provider value={{ isConnected, publicKey, publishEvent }}>
      {children}
    </NostrContext.Provider>
  );
}

export const useNostr = () => {
  const context = useContext(NostrContext);
  if (!context) {
    throw new Error('useNostr must be used within NostrProvider');
  }
  return context;
};
```

### 2. Wrap Your App

```typescript
// src/main.tsx
import { NostrProvider } from '@/contexts/NostrContext';

function App() {
  return (
    <NostrProvider>
      <YourApp />
    </NostrProvider>
  );
}
```

### 3. Use NOSTR in Components

```typescript
// src/components/PublishNote.tsx
import { useState } from 'react';
import { useNostr } from '@/contexts/NostrContext';

export function PublishNote() {
  const { isConnected, publishEvent } = useNostr();
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');

  const handlePublish = async () => {
    if (!content.trim()) return;

    try {
      setStatus('Publishing...');

      const result = await publishEvent({
        kind: 1, // Text note
        content,
        tags: [['t', 'sovren']], // Tag
      });

      if (result.success) {
        setStatus('Published successfully!');
        setContent('');
      } else {
        setStatus('Failed to publish');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div className="publish-note">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        disabled={!isConnected}
      />
      <button onClick={handlePublish} disabled={!isConnected}>
        Publish Note
      </button>
      {status && <p>{status}</p>}
    </div>
  );
}
```

---

## Authentication

### Option 1: Browser Extension (Recommended)

Users with NOSTR extensions (Alby, nos2x) can sign in automatically:

```typescript
import { KeyManagementService } from '@/services/nostr/KeyManagementService';

const keyService = KeyManagementService.getInstance();
await keyService.initialize();

// Detect extension
const extension = await keyService.detectExtension();

if (extension) {
  // Get public key from extension
  const pubkey = await extension.getPublicKey();
  console.log('Logged in with extension:', pubkey);

  // Extension will handle all signing
  const signedEvent = await keyService.signEvent(unsignedEvent);
} else {
  console.log('No extension detected');
}
```

### Option 2: Import Existing Key

Users can import their private key (nsec format):

```typescript
const nsec = 'nsec1...'; // From user input

try {
  const keyPair = await keyService.importKey(nsec, 'nsec');
  console.log('Key imported successfully');
  console.log('Public key:', keyPair.publicKey);
} catch (error) {
  console.error('Invalid key:', error);
}
```

### Option 3: Generate New Key

Create a new NOSTR identity:

```typescript
const keyPair = await keyService.generateKey({
  saveToStorage: true,
  encrypt: true,
});

console.log('New key generated!');
console.log('Public key (npub):', keyPair.npub);
console.log('Private key (nsec):', keyPair.nsec);

// ⚠️ IMPORTANT: Show nsec to user for backup!
alert(`Backup your private key: ${keyPair.nsec}`);
```

### Signing Events

Once authenticated, sign events:

```typescript
const unsignedEvent = {
  kind: 1,
  content: 'Hello NOSTR!',
  tags: [],
  created_at: Math.floor(Date.now() / 1000),
  pubkey: keyPair.publicKey,
};

const signedEvent = await keyService.signEvent(unsignedEvent);
console.log('Signed event:', signedEvent);
```

---

## Publishing Events

### Publish a Text Note

```typescript
import { EventPublisherService } from '@/services/nostr/EventPublisherService';

const publisher = EventPublisherService.getInstance();
await publisher.initialize();

const result = await publisher.createAndPublish({
  kind: 1,
  content: 'Hello from Sovren! #nostr #bitcoin',
  tags: [
    ['t', 'nostr'],
    ['t', 'bitcoin'],
  ],
});

console.log('Published to', result.successfulRelays.length, 'relays');
```

### Publish with Images

```typescript
const result = await publisher.createAndPublish({
  kind: 1,
  content: 'Check out this image!',
  tags: [
    ['image', 'https://example.com/image.jpg'],
    ['alt', 'Description of image'],
  ],
});
```

### Publish Long-Form Content

```typescript
const result = await publisher.createAndPublish({
  kind: 30023, // Long-form content
  content: '# My Article\n\nThis is a long-form article...',
  tags: [
    ['d', 'my-article-slug'], // Identifier
    ['title', 'My Amazing Article'],
    ['published_at', Math.floor(Date.now() / 1000).toString()],
    ['t', 'article'],
  ],
});
```

### Publish with Retry

```typescript
const result = await publisher.publishWithRetry(event, {
  maxRetries: 3,
  backoffMs: 1000,
});

console.log('Retry attempts:', result.retryAttempts);
```

### Batch Publish

```typescript
const events = [event1, event2, event3];
const results = await publisher.publishBatch(events);

results.forEach((result, index) => {
  console.log(`Event ${index + 1}:`, result.success ? 'OK' : 'Failed');
});
```

---

## Subscribing to Events

### Basic Subscription

```typescript
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';

const subManager = SubscriptionManagerService.getInstance();

const subId = subManager.subscribe(
  [
    {
      kinds: [1], // Text notes
      limit: 50,  // Latest 50
    },
  ],
  (event, relay) => {
    console.log('New event from', relay, ':', event.content);
  }
);
```

### Subscribe to Specific Author

```typescript
const authorPubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

const subId = subManager.subscribe(
  [
    {
      authors: [authorPubkey],
      kinds: [1],
      limit: 20,
    },
  ],
  (event) => {
    console.log('Event from author:', event.content);
  }
);
```

### Subscribe with EOSE Handler

```typescript
const subId = subManager.subscribe(
  [{ kinds: [1], limit: 10 }],
  (event) => {
    console.log('Event:', event);
  },
  {
    onEOSE: (relay) => {
      console.log('End of stored events from', relay);
    },
  }
);
```

### Subscribe to Reactions

```typescript
const noteId = 'event-id-here';

const subId = subManager.subscribe(
  [
    {
      kinds: [7], // Reactions
      '#e': [noteId], // For this note
    },
  ],
  (event) => {
    const emoji = event.content || '👍';
    console.log('Reaction:', emoji, 'from', event.pubkey);
  }
);
```

### Pause/Resume Subscription

```typescript
// Pause when component unmounts or hidden
subManager.pauseSubscription(subId);

// Resume when component remounts or visible
subManager.resumeSubscription(subId);

// Clean up when done
subManager.unsubscribe(subId);
```

### Real-Time Feed Example

```typescript
function useNostrFeed(filters: NostrFilter[]) {
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const subManagerRef = useRef(SubscriptionManagerService.getInstance());

  useEffect(() => {
    const subId = subManagerRef.current.subscribe(
      filters,
      (event) => {
        setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep latest 100
      },
      {
        onEOSE: (relay) => console.log('Loaded from', relay),
      }
    );

    return () => {
      subManagerRef.current.unsubscribe(subId);
    };
  }, []);

  return events;
}

// Usage
function Feed() {
  const events = useNostrFeed([{ kinds: [1], limit: 50 }]);

  return (
    <div>
      {events.map((event) => (
        <div key={event.id}>
          <p>{event.content}</p>
          <small>{new Date(event.created_at * 1000).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}
```

---

## Event Caching

### Cache Events Automatically

```typescript
import { getEventCache } from '@/services/nostr/EventCacheService';

const cache = getEventCache();

// Events are automatically cached when received from subscriptions
// or when published

// Query cached events
const cachedEvents = await cache.queryCachedEvents({
  kinds: [1],
  authors: [pubkey],
});

console.log('Cached events:', cachedEvents);
```

### Get Specific Event

```typescript
const eventId = '...';
const event = await cache.getCachedEvent(eventId);

if (event) {
  console.log('Found in cache:', event);
} else {
  console.log('Not in cache');
}
```

### Cache Stats

```typescript
const stats = cache.getCacheStats();

console.log('Total cached events:', stats.totalEvents);
console.log('Cache hit rate:', stats.hitRate);
console.log('Memory usage:', stats.memorySizeMB, 'MB');
```

---

## Error Handling

### Handle Connection Errors

```typescript
const relayPool = RelayPoolManager.getInstance();

relayPool.on('relay:error', (relayUrl, error) => {
  console.error(`Relay error ${relayUrl}:`, error.message);
  // Show user-friendly message
  toast.error(`Connection error: ${relayUrl}`);
});

relayPool.on('relay:connected', (relayUrl) => {
  console.log('Connected:', relayUrl);
  toast.success(`Connected to ${relayUrl}`);
});
```

### Handle Publishing Errors

```typescript
try {
  const result = await publisher.createAndPublish(event);

  if (result.successfulRelays.length === 0) {
    throw new Error('Failed to publish to any relay');
  }

  if (result.successfulRelays.length < result.totalRelays / 2) {
    console.warn('Published to fewer than half of relays');
  }
} catch (error) {
  if (error instanceof NostrError) {
    console.error('NOSTR error:', error.code, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Best Practices

### 1. Initialize Services Once

```typescript
// ✓ CORRECT: Use singleton pattern
const manager = RelayPoolManager.getInstance();

// ✗ INCORRECT: Don't create new instances
const manager = new RelayPoolManager(); // Will throw error
```

### 2. Always Handle Cleanup

```typescript
useEffect(() => {
  const subId = subManager.subscribe(filters, callback);

  // Cleanup on unmount
  return () => {
    subManager.unsubscribe(subId);
  };
}, []);
```

### 3. Validate User Input

```typescript
import { NostrEventSchema } from '@shared/types/nostr';

try {
  const validEvent = NostrEventSchema.parse(userEvent);
  await publisher.publishEvent(validEvent);
} catch (error) {
  console.error('Invalid event structure:', error);
}
```

### 4. Use Batching for Multiple Operations

```typescript
// ✓ CORRECT: Batch publish
await publisher.publishBatch([event1, event2, event3]);

// ✗ INCORRECT: Individual publishes in loop
for (const event of events) {
  await publisher.publishEvent(event); // Slower
}
```

### 5. Show Key Backup Warnings

```typescript
const keyPair = await keyService.generateKey();

// ⚠️ CRITICAL: User must backup their key!
alert(`
  IMPORTANT: Save your private key in a secure location!

  Private Key (nsec): ${keyPair.nsec}

  You cannot recover this key if lost!
`);
```

---

## Next Steps

Now that you understand the basics, explore:

- [API Reference](../api/README.md) - Complete API documentation
- [Service Guides](../api/relay-pool-manager.md) - Detailed service docs
- [NIPs Documentation](../nips/README.md) - Protocol implementations
- [Integration Guide](./integration.md) - Advanced integration patterns
- [Code Examples](../examples/README.md) - Working code samples
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

---

## Common Tasks Quick Reference

```typescript
// Connect to relays
const relayPool = RelayPoolManager.getInstance();
await relayPool.initialize();
await relayPool.connectAll();

// Generate key
const keyService = KeyManagementService.getInstance();
const keyPair = await keyService.generateKey();

// Publish note
const publisher = EventPublisherService.getInstance();
const result = await publisher.createAndPublish({
  kind: 1,
  content: 'Hello NOSTR!',
  tags: [],
});

// Subscribe to events
const subManager = SubscriptionManagerService.getInstance();
const subId = subManager.subscribe(
  [{ kinds: [1], limit: 50 }],
  (event) => console.log(event)
);

// Unsubscribe
subManager.unsubscribe(subId);

// Disconnect
await relayPool.disconnectAll();
```

---

**Questions?** Check the [Troubleshooting Guide](./troubleshooting.md) or [open an issue](https://github.com/sovren/sovren/issues).

**Maintained by**: Sovren Development Team
