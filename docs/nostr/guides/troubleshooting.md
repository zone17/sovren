# NOSTR Troubleshooting Guide

Common issues and solutions for Sovren's NOSTR integration.

---

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Publishing Problems](#publishing-problems)
3. [Subscription Issues](#subscription-issues)
4. [Key Management Problems](#key-management-problems)
5. [Performance Issues](#performance-issues)
6. [Browser Extension Issues](#browser-extension-issues)

---

## Connection Issues

### Problem: "No connected relays available"

**Symptoms**:

- Publishing fails immediately
- Subscriptions don't receive events
- Error: `No connected relays available`

**Solutions**:

1. **Check relay initialization**:

```typescript
const relayPool = RelayPoolManager.getInstance();

// ✓ CORRECT: Initialize before connecting
await relayPool.initialize();
await relayPool.connectAll();

// ✗ INCORRECT: Trying to use without initialization
await relayPool.publishEvent(event); // Will fail
```

2. **Verify relay URLs**:

```typescript
// Check connected relays
const connected = relayPool.getConnectedRelays();
console.log('Connected relays:', connected);

if (connected.length === 0) {
  console.error('No relays connected!');
}
```

3. **Check relay health**:

```typescript
const healthInfo = relayPool.getHealthInfo();

healthInfo.forEach((relay) => {
  console.log(`${relay.url}: ${relay.status}`);
  if (relay.status === 'error') {
    console.error(`  Error: ${relay.lastError}`);
  }
});
```

---

### Problem: Relays keep disconnecting

**Symptoms**:

- Frequent `relay:disconnected` events
- Events fail to publish intermittently
- Poor performance

**Solutions**:

1. **Check network connection**:

```bash
# Test relay connectivity
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://relay.damus.io
```

2. **Enable auto-reconnect**:

```typescript
await relayPool.initialize({
  autoReconnect: true,
  maxReconnectAttempts: 5,
  healthCheckInterval: 30000,
});
```

3. **Monitor relay health**:

```typescript
relayPool.on('relay:error', (url, error) => {
  console.error(`Relay error ${url}:`, error);

  // Implement custom reconnection logic
  setTimeout(() => {
    relayPool.connect(url);
  }, 5000);
});
```

4. **Use multiple relays**:

```typescript
// More relays = better redundancy
await relayPool.initialize({
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.current.fyi',
    'wss://nostr.wine',
  ],
});
```

---

### Problem: Slow relay connections

**Symptoms**:

- `initialize()` takes more than 5 seconds
- High latency metrics
- Timeouts

**Solutions**:

1. **Increase connection timeout**:

```typescript
await relayPool.initialize({
  connectionTimeout: 10000, // 10 seconds
});
```

2. **Use fastest relays**:

```typescript
const fastestRelays = relayPool.getFastestRelays(3);
console.log('Fastest relays:', fastestRelays);

await publisher.publishEvent(event, fastestRelays);
```

3. **Check relay latency**:

```typescript
const monitor = MonitoringService.getInstance();
const health = monitor.getRelayHealth('wss://relay.damus.io');

console.log('Average latency:', health.metrics.averageLatency, 'ms');
```

---

## Publishing Problems

### Problem: "Event validation failed"

**Symptoms**:

- Events fail to publish
- Error: `Event validation failed`
- Invalid event structure errors

**Solutions**:

1. **Validate event structure**:

```typescript
import { NostrEventSchema } from '@shared/types/nostr';

try {
  const validated = NostrEventSchema.parse(event);
  await publisher.publishEvent(validated);
} catch (error) {
  console.error('Invalid event:', error.issues);
}
```

2. **Check required fields**:

```typescript
// Required fields for NostrEvent
const event = {
  kind: 1, // ✓ Required
  content: 'Hello', // ✓ Required
  tags: [], // ✓ Required
  created_at: Math.floor(Date.now() / 1000), // ✓ Required
  pubkey: '...', // ✓ Required
  id: '...', // ✓ Required (after signing)
  sig: '...', // ✓ Required (after signing)
};
```

3. **Use `createAndPublish` for auto-validation**:

```typescript
// ✓ CORRECT: Auto-validation
await publisher.createAndPublish({
  kind: 1,
  content: 'Hello',
  tags: [],
});

// ✗ INCORRECT: Manual event creation (error-prone)
const event = {
  /* manually created */
};
await publisher.publishEvent(event); // May fail validation
```

---

### Problem: Events publish but don't appear

**Symptoms**:

- `publishEvent()` succeeds
- Events not visible in other NOSTR clients
- No errors reported

**Solutions**:

1. **Check relay confirmation**:

```typescript
const result = await publisher.createAndPublish(event);

console.log('Total relays:', result.totalRelays);
console.log('Successful:', result.successfulRelays.length);

if (result.successfulRelays.length === 0) {
  console.error('Failed to publish to any relay!');
}
```

2. **Verify event ID**:

```typescript
// Get event ID and check on other clients
console.log('Event ID:', result.eventId);

// Visit: https://nostr.band/<eventId>
// Or: Use another NOSTR client to search for it
```

3. **Check relay write permissions**:

```typescript
// Some relays may be read-only or require authentication
const relayInfo = await relayPool.getRelayInfo('wss://relay.damus.io');
console.log('Relay info:', relayInfo);
```

---

### Problem: High publish failure rate

**Symptoms**:

- Only 1-2 out of 5 relays succeed
- Inconsistent publish results
- Timeout errors

**Solutions**:

1. **Use retry logic**:

```typescript
const result = await publisher.publishWithRetry(event, {
  maxRetries: 3,
  backoffMs: 1000,
});

console.log('Retry attempts:', result.retryAttempts);
```

2. **Publish to fastest relays first**:

```typescript
await publisher.publishEvent(event, { strategy: 'smart', relayCount: 3 });
```

3. **Check relay health before publishing**:

```typescript
const healthyRelays = relayPool
  .getHealthInfo()
  .filter((r) => r.health === 'good' || r.health === 'excellent')
  .map((r) => r.url);

await publisher.publishEvent(event, healthyRelays);
```

---

## Subscription Issues

### Problem: Not receiving events

**Symptoms**:

- Subscription created but callback never fires
- EOSE received but no events
- Empty event feed

**Solutions**:

1. **Check subscription filters**:

```typescript
// Too restrictive filters may match no events
const subId = subManager.subscribe(
  [
    {
      kinds: [1],
      authors: ['specific-pubkey'], // May have no events
      since: Math.floor(Date.now() / 1000) - 3600, // Last hour
      limit: 10,
    },
  ],
  (event) => console.log(event)
);
```

2. **Broaden filters**:

```typescript
// More permissive filter
const subId = subManager.subscribe(
  [
    {
      kinds: [1],
      limit: 50, // Get more events
    },
  ],
  (event) => console.log(event)
);
```

3. **Check relay connections**:

```typescript
// Ensure relays are connected before subscribing
const connected = relayPool.getConnectedRelays();

if (connected.length === 0) {
  await relayPool.connectAll();
}
```

4. **Verify callback is registered**:

```typescript
subManager.subscribe(filters, (event) => {
  console.log('Event received:', event); // Add logging
});
```

---

### Problem: Duplicate events in subscription

**Symptoms**:

- Same event received multiple times
- Event callback fires repeatedly
- Duplicate content in feed

**Solutions**:

1. **Enable deduplication (default)**:

```typescript
// Deduplication is enabled by default
const subId = subManager.subscribe(filters, callback);

// Explicitly enable
const subId = subManager.subscribe(filters, callback, {
  autoCache: true, // Enables deduplication
});
```

2. **Manual deduplication in callback**:

```typescript
const seenIds = new Set<string>();

subManager.subscribe(filters, (event) => {
  if (seenIds.has(event.id)) {
    return; // Skip duplicate
  }

  seenIds.add(event.id);
  console.log('New event:', event);
});
```

3. **Use React state with deduplication**:

```typescript
const [events, setEvents] = useState<NostrEvent[]>([]);

subManager.subscribe(filters, (event) => {
  setEvents((prev) => {
    if (prev.some((e) => e.id === event.id)) {
      return prev; // Already have it
    }
    return [...prev, event];
  });
});
```

---

### Problem: Subscription memory leak

**Symptoms**:

- Memory usage grows over time
- App becomes slow
- Browser tab crashes

**Solutions**:

1. **Always cleanup subscriptions**:

```typescript
useEffect(() => {
  const subId = subManager.subscribe(filters, callback);

  // ✓ CRITICAL: Cleanup on unmount
  return () => {
    subManager.unsubscribe(subId);
  };
}, []);
```

2. **Limit event retention**:

```typescript
const [events, setEvents] = useState<NostrEvent[]>([]);

subManager.subscribe(filters, (event) => {
  setEvents((prev) => [event, ...prev].slice(0, 100)); // Max 100 events
});
```

3. **Pause subscriptions when not needed**:

```typescript
// Pause when component is hidden
useEffect(() => {
  if (!isVisible) {
    subManager.pauseSubscription(subId);
  } else {
    subManager.resumeSubscription(subId);
  }
}, [isVisible]);
```

---

## Key Management Problems

### Problem: "No extension detected"

**Symptoms**:

- Browser extension not found
- Falls back to local key generation
- Signing fails

**Solutions**:

1. **Install NOSTR extension**:
   - Chrome/Brave: [Alby](https://chrome.google.com/webstore/detail/alby/iokeahhehimjnekafflcihljlcjccdbe)
   - Firefox: [nos2x](https://addons.mozilla.org/en-US/firefox/addon/nos2x/)

2. **Check extension detection**:

```typescript
const keyService = KeyManagementService.getInstance();
const extension = await keyService.detectExtension();

if (!extension) {
  console.log('No extension found');
  console.log('window.nostr:', window.nostr); // Should exist if extension present
}
```

3. **Verify extension permissions**:

```typescript
if (extension) {
  try {
    const pubkey = await extension.getPublicKey();
    console.log('Extension working:', pubkey);
  } catch (error) {
    console.error('Extension denied permission:', error);
  }
}
```

---

### Problem: "Failed to decrypt key"

**Symptoms**:

- Wrong password error
- Cannot load stored keys
- Error: `Failed to decrypt key`

**Solutions**:

1. **Verify password**:

```typescript
try {
  const keyPair = await keyService.loadKey(publicKey, password);
} catch (error) {
  console.error('Wrong password or corrupted key');
}
```

2. **Reset and reimport**:

```typescript
// If password is lost, keys cannot be recovered!
// User must import their nsec backup

const nsec = prompt('Enter your private key (nsec):');
const keyPair = await keyService.importKey(nsec, 'nsec');
```

3. **Check browser storage**:

```typescript
// Verify key exists in IndexedDB
const db = await indexedDB.open('sovren_nostr_keys', 1);
// Check if key is present
```

---

### Problem: Key import fails

**Symptoms**:

- Invalid key format error
- Import throws exception
- Key validation fails

**Solutions**:

1. **Check key format**:

```typescript
// Valid formats
const nsec = 'nsec1...'; // Bech32-encoded private key
const hex = '0123456789abcdef...'; // 64-character hex
const mnemonic = 'word1 word2 ...'; // BIP39 mnemonic

// Import based on format
if (key.startsWith('nsec')) {
  await keyService.importKey(key, 'nsec');
} else if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) {
  await keyService.importKey(key, 'hex');
} else {
  await keyService.importKey(key, 'mnemonic');
}
```

2. **Validate before import**:

```typescript
import { nip19 } from 'nostr-tools';

try {
  const decoded = nip19.decode(nsec);
  console.log('Valid nsec:', decoded);
} catch (error) {
  console.error('Invalid nsec format');
}
```

---

## Performance Issues

### Problem: Slow event publishing

**Symptoms**:

- `publishEvent()` takes > 1 second
- High latency metrics
- UI freezes during publish

**Solutions**:

1. **Use batch publishing**:

```typescript
// ✓ CORRECT: Batch publish
await publisher.publishBatch([event1, event2, event3]);

// ✗ INCORRECT: Sequential publishes
for (const event of events) {
  await publisher.publishEvent(event); // Slow
}
```

2. **Publish to fewer relays**:

```typescript
// Only publish to 3 fastest relays
await publisher.publishEventToFastest(event, 3);
```

3. **Use smart publishing strategy**:

```typescript
await publisher.publishEvent(event, {
  strategy: 'smart',
  relayCount: 3,
  timeout: 5000,
});
```

---

### Problem: High memory usage

**Symptoms**:

- Browser uses > 500MB memory
- App becomes sluggish
- Cache size growing indefinitely

**Solutions**:

1. **Clear event cache periodically**:

```typescript
const cache = getEventCache();

// Clear old events
await cache.invalidateCache({
  until: Math.floor(Date.now() / 1000) - 86400, // Older than 1 day
});
```

2. **Limit cache size**:

```typescript
await cache.initialize({
  maxEvents: 5000, // Limit to 5000 events
  cacheTtl: 3600000, // 1 hour TTL
});
```

3. **Monitor cache stats**:

```typescript
const stats = cache.getCacheStats();

if (stats.memorySizeMB > 100) {
  console.warn('Cache size:', stats.memorySizeMB, 'MB');
  await cache.invalidateCache();
}
```

---

## Browser Extension Issues

### Problem: Extension signing prompts are annoying

**Symptoms**:

- User must approve every event
- Slow publishing workflow
- Poor UX

**Solutions**:

1. **Batch events before signing**:

```typescript
// Collect events, then publish batch
const events = [event1, event2, event3];
await publisher.publishBatch(events);
// User approves once for all events
```

2. **Use local keys for high-frequency operations**:

```typescript
// Extension for important events
const importantEvent = await publisher.createAndPublish(event);

// Local key for frequent events (likes, etc.)
const keyPair = await keyService.generateKey();
const localSigned = await keyService.signEvent(event, keyPair);
```

---

### Problem: Extension compatibility issues

**Symptoms**:

- Extension detected but signing fails
- Inconsistent behavior across browsers
- Type errors

**Solutions**:

1. **Check NIP-07 compliance**:

```typescript
if (window.nostr) {
  console.log('Extension name:', window.nostr._metadata?.name);

  // Check required methods
  if (!window.nostr.signEvent) {
    console.error('Extension missing signEvent method!');
  }
}
```

2. **Handle extension errors**:

```typescript
try {
  const signed = await window.nostr.signEvent(event);
} catch (error) {
  if (error.message.includes('User rejected')) {
    console.log('User cancelled signing');
  } else {
    console.error('Extension error:', error);
  }
}
```

---

## Getting More Help

If these solutions don't resolve your issue:

1. **Check logs**: Enable verbose logging in MonitoringService
2. **Review documentation**: [Architecture Overview](../architecture/overview.md)
3. **Search issues**: [GitHub Issues](https://github.com/sovren/sovren/issues)
4. **Ask community**: NOSTR Discord or Telegram
5. **Open issue**: [Create new issue](https://github.com/sovren/sovren/issues/new)

---

## Debug Mode

Enable debug logging for more details:

```typescript
// Enable debug mode
localStorage.setItem('nostr_debug', 'true');

// Check logs in console
// All NOSTR operations will log verbose output
```

---

**Maintained by**: Sovren Development Team
**Last Updated**: 2025-10-26
