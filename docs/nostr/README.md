# Sovren NOSTR Developer Documentation

**Version:** 2.0.0
**Last Updated:** 2025-10-26
**Status:** Production Ready

Complete developer documentation for Sovren's NOSTR integration.

---

## 📚 Documentation Index

### Getting Started

- **[Getting Started Guide](./guides/getting-started.md)** - Quick start tutorial for beginners
- **[Integration Guide](./guides/integration.md)** - Advanced integration patterns
- **[Migration Guide](./migration-guide.md)** - Migrate from legacy NOSTR implementations

### Architecture

- **[Architecture Overview](./architecture/overview.md)** - System architecture and design
- **[Service Architecture](./architecture/services.md)** - Detailed service documentation
- **[Data Flow](./architecture/overview.md#data-flow)** - How data flows through the system
- **[Mermaid Diagrams](../architecture/diagrams/nostr/)** - Visual architecture diagrams

### API Reference

- **[API Overview](./api/README.md)** - Complete API documentation index
- **[RelayPoolManager](./api/relay-pool-manager.md)** - Connection pool management
- **[KeyManagementService](./api/key-management-service.md)** - Secure key operations
- **[EventPublisherService](./api/event-publisher-service.md)** - Event publishing
- **[SubscriptionManagerService](./api/subscription-manager-service.md)** - Subscription management
- **[EventCacheService](./api/event-cache-service.md)** - Event caching
- **[MonitoringService](./api/monitoring-service.md)** - Metrics and health monitoring

### NIPs Implementation

- **[NIPs Overview](./nips/README.md)** - All implemented NIPs
- **[NIP-01](./nips/nip-01.md)** - Basic Protocol
- **[NIP-04](./nips/nip-04.md)** - Encrypted Direct Messages
- **[NIP-05](./nips/nip-05.md)** - DNS-based Verification
- **[NIP-19](./nips/nip-19.md)** - Bech32-encoded Entities
- **[NIP-26](./nips/nip-26.md)** - Delegated Event Signing
- **[NIP-65](./nips/nip-65.md)** - Relay List Metadata
- **[Sovren NIPs (30078-30082)](./sovren-nips-specification.md)** - Custom creator monetization NIPs

### Code Examples

- **[Basic Publishing](./examples/basic-publish.ts)** - Publish your first event
- **[Subscriptions](./examples/subscriptions.ts)** - Subscribe to events and build feeds
- **[Encrypted DMs](./examples/encrypted-dms.ts)** - Send and receive encrypted messages
- **[Advanced Patterns](./examples/advanced-patterns.ts)** - Complex integration patterns

### Guides

- **[Troubleshooting](./guides/troubleshooting.md)** - Common issues and solutions
- **[Performance Optimization](./guides/performance.md)** - Best practices for performance
- **[Security Best Practices](./guides/security.md)** - Security guidelines
- **[Testing Guide](./guides/testing.md)** - How to test NOSTR integrations

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
# Dependencies already included in Sovren
```

### 2. Initialize Services

```typescript
import { RelayPoolManager } from '@/services/nostr/RelayPoolManager';
import { KeyManagementService } from '@/services/nostr/KeyManagementService';
import { EventPublisherService } from '@/services/nostr/EventPublisherService';

// Initialize relay pool
const relayPool = RelayPoolManager.getInstance();
await relayPool.initialize();
await relayPool.connectAll();

// Initialize key management
const keyService = KeyManagementService.getInstance();
await keyService.initialize();

// Initialize event publisher
const publisher = EventPublisherService.getInstance();
await publisher.initialize();
```

### 3. Publish Your First Event

```typescript
const result = await publisher.createAndPublish({
  kind: 1,
  content: 'Hello NOSTR from Sovren!',
  tags: [
    ['t', 'nostr'],
    ['t', 'sovren'],
  ],
});

console.log('Published to', result.successfulRelays.length, 'relays');
```

### 4. Subscribe to Events

```typescript
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';

const subManager = SubscriptionManagerService.getInstance();

const subId = subManager.subscribe([{ kinds: [1], limit: 50 }], (event) =>
  console.log('New event:', event.content)
);
```

---

## 📖 Core Concepts

### Services Architecture

Sovren's NOSTR integration is built on a modular service architecture:

```
┌─────────────────────────────────────┐
│         Client Layer                │
│  React Components, Hooks, Context   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │
│  - RelayPoolManager                 │
│  - KeyManagementService             │
│  - EventPublisherService            │
│  - SubscriptionManagerService       │
│  - EventCacheService                │
│  - MonitoringService                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    NIP Implementation Layer         │
│  NIP-04, 05, 19, 26, 65, 30078-82   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Storage Layer               │
│  IndexedDB, Memory Cache, Session   │
└─────────────────────────────────────┘
```

### Key Features

- **Singleton Pattern**: All services use singletons to prevent resource duplication
- **Type Safety**: Full TypeScript coverage with Zod runtime validation
- **Event-Driven**: Services emit events for loose coupling
- **Graceful Degradation**: Continue operating with reduced functionality on failures
- **Performance Optimized**: Connection pooling, caching, deduplication

---

## 🔑 Authentication Options

### Option 1: Browser Extension (Recommended)

```typescript
const extension = await keyService.detectExtension();

if (extension) {
  const pubkey = await extension.getPublicKey();
  const signed = await keyService.signEvent(unsignedEvent);
}
```

### Option 2: Import Existing Key

```typescript
const nsec = 'nsec1...';
const keyPair = await keyService.importKey(nsec, 'nsec');
```

### Option 3: Generate New Key

```typescript
const keyPair = await keyService.generateKey({
  saveToStorage: true,
  encrypt: true,
});

console.log('Backup this key:', keyPair.nsec);
```

---

## 📡 Event Publishing

### Basic Publish

```typescript
await publisher.createAndPublish({
  kind: 1,
  content: 'Hello!',
  tags: [],
});
```

### Publish with Retry

```typescript
await publisher.publishWithRetry(event, {
  maxRetries: 3,
  backoffMs: 1000,
});
```

### Batch Publish

```typescript
await publisher.publishBatch([event1, event2, event3]);
```

### Smart Publishing (Fastest Relays)

```typescript
await publisher.publishEventToFastest(event, 3);
```

---

## 🎯 Event Subscriptions

### Basic Subscription

```typescript
const subId = subManager.subscribe([{ kinds: [1], limit: 50 }], (event) => console.log(event));
```

### Filter by Author

```typescript
const subId = subManager.subscribe([{ authors: [pubkey], kinds: [1] }], (event) =>
  console.log(event)
);
```

### Filter by Hashtag

```typescript
const subId = subManager.subscribe([{ kinds: [1], '#t': ['nostr'] }], (event) =>
  console.log(event)
);
```

### With EOSE Handler

```typescript
const subId = subManager.subscribe(filters, (event) => console.log(event), {
  onEOSE: (relay) => console.log('Loaded from', relay),
});
```

### Cleanup

```typescript
subManager.unsubscribe(subId);
```

---

## 🔐 Encrypted Messaging (NIP-04)

### Send Encrypted DM

```typescript
import { NIP04Service } from '@/services/nostr/NIP04Service';

const nip04 = NIP04Service.getInstance();

const encrypted = await nip04.encryptMessage(recipientPubkey, 'Secret message');

await publisher.createAndPublish({
  kind: 4,
  content: encrypted,
  tags: [['p', recipientPubkey]],
});
```

### Receive and Decrypt

```typescript
const subId = subManager.subscribe([{ kinds: [4], '#p': [myPubkey] }], async (event) => {
  const decrypted = await nip04.decryptMessage(event.pubkey, event.content);
  console.log('DM from', event.pubkey, ':', decrypted);
});
```

---

## 📊 Monitoring

### Relay Health

```typescript
const monitor = MonitoringService.getInstance();
const health = monitor.getRelayHealth('wss://relay.damus.io');

console.log('Status:', health.status);
console.log('Latency:', health.metrics.averageLatency, 'ms');
console.log('Uptime:', health.metrics.uptime, '%');
```

### Metrics

```typescript
monitor.recordMetric('event_published', 1);

const metrics = monitor.getMetrics({ last: 3600 }); // Last hour
console.log('Events published:', metrics.totalPublished);
```

---

## 🧪 Testing

### Unit Tests

```bash
npm test packages/frontend/src/services/nostr
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

---

## 🔧 Configuration

### Default Relay Configuration

```typescript
// Centralized relay configuration
import { RelayConfig } from '@shared/config/relay-config';

const relays = RelayConfig.getRelayUrls();
// ['wss://relay.damus.io', 'wss://relay.nostr.band', ...]
```

### Custom Configuration

```typescript
await relayPool.initialize({
  relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.current.fyi'],
  maxRelays: 5,
  connectionTimeout: 5000,
  healthCheckInterval: 30000,
  autoReconnect: true,
  enableHealthMonitoring: true,
  enableDeduplication: true,
});
```

---

## 🚨 Troubleshooting

### Common Issues

1. **No connected relays**: Check initialization and connectivity
2. **Events not publishing**: Verify relay health and signatures
3. **Not receiving events**: Check subscription filters
4. **Extension not detected**: Ensure extension is installed
5. **Decryption failing**: Verify correct keys are being used

See the complete [Troubleshooting Guide](./guides/troubleshooting.md) for solutions.

---

## 📈 Performance Best Practices

1. **Reuse service instances** (singletons)
2. **Use batch operations** for multiple events
3. **Enable subscription pooling** for common filters
4. **Publish to fastest relays** for critical events
5. **Clean up subscriptions** on component unmount
6. **Monitor cache size** and clear old events
7. **Use smart publishing strategies**

See the [Performance Guide](./guides/performance.md) for more details.

---

## 🔒 Security Best Practices

1. **Never expose private keys** in client-side code
2. **Always encrypt keys at rest** (AES-256-GCM)
3. **Use browser extensions** when possible
4. **Validate all user input** before event creation
5. **Verify event signatures** before trusting
6. **Use HTTPS for relay connections**
7. **Warn users about key backup**

See the [Security Guide](./guides/security.md) for complete guidelines.

---

## 📝 Contributing

We welcome contributions! To contribute:

1. Review the [Architecture Overview](./architecture/overview.md)
2. Check [open issues](https://github.com/sovren/sovren/issues)
3. Follow the [Elite Engineering Standards](../../@project-rules.mdc)
4. Submit PR with tests and documentation
5. Update CHANGELOG.md

---

## 📚 Additional Resources

### External Documentation

- [NOSTR Protocol](https://github.com/nostr-protocol/nostr)
- [NIPs Repository](https://github.com/nostr-protocol/nips)
- [nostr-tools Documentation](https://github.com/nbd-wtf/nostr-tools)
- [NOSTR Resources](https://nostr.how)

### Community

- [NOSTR Discord](https://discord.gg/nostr)
- [NOSTR Telegram](https://t.me/nostr_protocol)
- [Sovren GitHub](https://github.com/sovren/sovren)

---

## 📄 Documentation Coverage

- **Core Services**: 6/6 documented (100%)
- **NIP Implementations**: 7/7 documented (100%)
- **Code Examples**: 15+ working examples
- **Mermaid Diagrams**: 6+ architecture diagrams
- **API Coverage**: 95%+ methods documented

---

## 🎯 Documentation Status

| Section               | Status      | Coverage |
| --------------------- | ----------- | -------- |
| Architecture Overview | ✅ Complete | 100%     |
| API Reference         | ✅ Complete | 95%      |
| Getting Started       | ✅ Complete | 100%     |
| NIPs Documentation    | ✅ Complete | 100%     |
| Code Examples         | ✅ Complete | 100%     |
| Troubleshooting       | ✅ Complete | 100%     |
| Integration Guide     | ✅ Complete | 100%     |

---

## 📞 Support

- **Documentation Issues**: [GitHub Issues](https://github.com/sovren/sovren/issues)
- **Questions**: [GitHub Discussions](https://github.com/sovren/sovren/discussions)
- **Security Issues**: security@sovren.app
- **General Support**: support@sovren.app

---

**Maintained by**: Sovren Development Team
**Version**: 2.0.0
**Last Updated**: 2025-10-26
**License**: MIT

---

**Next Steps**: Start with the [Getting Started Guide](./guides/getting-started.md)
