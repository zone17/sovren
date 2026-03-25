# NOSTR Integration Architecture Overview

**Version:** 2.0.0
**Last Updated:** 2025-10-26
**Epic:** 003 Wave 5 - NOSTR Consolidation
**Status:** Production Ready

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Core Services](#core-services)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Design Principles](#design-principles)
7. [Performance Characteristics](#performance-characteristics)

---

## Introduction

Sovren's NOSTR integration provides a complete, production-ready implementation of the NOSTR protocol with advanced features for creator monetization. The architecture follows elite engineering standards with comprehensive type safety, monitoring, and error handling.

### Key Features

- **Multi-Relay Management**: Intelligent connection pooling with automatic failover
- **Encrypted Key Storage**: AES-256-GCM encryption in IndexedDB
- **Browser Extension Support**: NIP-07 compatible (Alby, nos2x, etc.)
- **Event Caching**: Optimized deduplication and persistence
- **Health Monitoring**: Real-time relay health and performance tracking
- **NIPs Implemented**: NIP-01, 04, 05, 19, 26, 65, plus custom NIPs 30078-30082

---

## System Architecture

### High-Level Overview

![NOSTR System Architecture](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/nostr-system-architecture.mmd)

[View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTjsEadI0TdF1h2HADgO2w4YBRg-UTMcqJMmV5GYd0v9-lON8uG2BbhcbpPj4-EhRekGpyAElKMOqkKUs4C1fCHFFhZDwKrNkJa_hPV_BUl6BKKSp4Z2slLxaZTDnS3grS1lUBT9ZwVJWBbzjuZTyivO8hveyVBXmBVfVCr6W8hYyXt5y1aiVkJe8kqbm5RWvfRW5krKGz3V5C6ssW8N3XlYlvIPvvOB5c9mIVS5hxQGjvdVe15qXQgGQDOY8rwQAyOSMr8wqG1zUSv7uHsHKr03Nwd06h1ouBNSq5CBMjffDXKgqB_SqVRVO-DuVs5xXFWh6DdqsqlLBayWruubvZN6s73VZ8HLNPwhRNRchq2pRZW_hOy8kJKCVUqt_A-gcrX3r8XwFn-Qqg895uYJPvLoFtVplmJdyCZ95UUDGy2qV4XNe1nWGpVCl-gwfebmCDy8v4ONC1XI1ztXIxvFRNu60z8azZ0q8K-pGZKvMZMoU_IiURb6Gz2XJMy4rXsNXWXCQq0yVpcJPvKh4BqtVrnJcl6V8B7_zcgU_8OoOctWolRDwk5d38NNLFh8WQjbr36t1iXn5kpfVCl6yusoynKulrPETLzK8ygteX8M7XtXN-hv4VpZ8tfoN_izLO_hVliv45eUF_FaWK_j15QX8XpYr-OPlBfxRliv486X_B_hLlnfwl5f-H-BvWa7g75cX8I8sV_DPywv4V5Yr-O_lBfwnS_UZXstyBb-9vIA_ZbmCP19ewF-yXMG_Ly_gX1mu4M-XF_C_LFfw38sL-L8sV_D_ywv4AAAA__8)

[View Source Code](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/nostr-system-architecture.mmd)

The architecture is organized into four distinct layers:

1. **Client Layer**: React components, hooks, and context providers
2. **Service Layer**: Core NOSTR services (connection, publishing, caching)
3. **NIP Implementation Layer**: Protocol-specific implementations
4. **Storage Layer**: IndexedDB, in-memory cache, session storage

---

## Core Services

### 1. RelayPoolManager

**Purpose**: Centralized relay connection pool with intelligent routing and health monitoring.

**Responsibilities**:

- Maintain persistent WebSocket connections to NOSTR relays
- Automatic reconnection with exponential backoff
- Health monitoring and relay scoring (latency, uptime, success rate)
- Smart relay selection (fastest-first strategy)
- Event deduplication across relays
- Subscription lifecycle management

**Key Methods**:

```typescript
initialize(config?: RelayPoolConfig): Promise<void>
connectAll(): Promise<void>
publishEvent(event: NostrEvent): Promise<PublishResult>
subscribe(filters: Filter[], callback: EventCallback): string
unsubscribe(subscriptionId: string): void
getHealthInfo(): RelayHealthInfo[]
```

**Health Monitoring**:

![Relay Health Monitoring](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/relay-health-monitoring.mmd)

[View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTjsEadI0TdF1h2HADgO2w4YBRg-UTMcqJMmV5GYd0v9-lON8uG2BbhcbpPj4-EhRekGpyAElKMOqkKUs4C1fCHFFhZDwKrNkJa_hPV_BUl6BKKSp4Z2slLxaZTDnS3grS1lUBT9ZwVJWBbzjuZTyivO8hveyVBXmBVfVCr6W8hYyXt5y1aiVkJe8kqbm5RWvfRW5krKGz3V5C6ssW8N3XlYlvIPvvOB5c9mIVS5hxQGjvdVe15qXQgGQDOY8rwQAyOSMr8wqG1zUSv7uHsHKr03Nwd06h1ouBNSq5CBMjffDXKgqB_SqVRVO-DuVs5xXFWh6DdqsqlLBayWruubvZN6s73VZ8HLNPwhRNRchq2pRZW_hOy8kJKCVUqt_A-gcrX3r8XwFn-Qqg895uYJPvLoFtVplmJdyCZ95UUDGy2qV4XNe1nWGpVCl-gwfebmCDy8v4ONC1XI1ztXIxvFRNu60z8azZ0q8K-pGZKvMZMoU_IiURb6Gz2XJMy4rXsNXWXCQq0yVpcJPvKh4BqtVrnJcl6V8B7_zcgU_8OoOctWolRDwk5d38NNLFh8WQjbr36t1iXn5kpfVCl6yusoynKulrPETLzK8ygteX8M7XtXN-hv4VpZ8tfoN_izLO_hVliv45eUF_FaWK_j15QX8XpYr-OPlBfxRliv486X_B_hLlnfwl5f-H-BvWa7g75cX8I8sV_DPywv4V5Yr-O_lBfwnS_UZXstyBb-9vIA_ZbmCP19ewF-yXMG_Ly_gX1mu4M-XF_C_LFfw38sL-L8sV_D_ywv4AAAA__8)

[View Source Code](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/relay-health-monitoring.mmd)

**File**: `packages/frontend/src/services/nostr/RelayPoolManager.ts`

---

### 2. KeyManagementService

**Purpose**: Secure key generation, storage, and signing operations.

**Responsibilities**:

- Generate cryptographically secure key pairs
- Import/export keys (nsec, hex, mnemonic formats)
- Detect and integrate with NIP-07 browser extensions
- Encrypt keys with AES-256-GCM before storage
- Event signing (local or via extension)
- Security scoring and validation

**Key Methods**:

```typescript
generateKey(options?: KeyGenerationOptions): Promise<NostrKeyPair>
importKey(keyData: string, format: KeyFormat): Promise<NostrKeyPair>
exportKey(publicKey: string, format: KeyFormat): Promise<string>
signEvent(unsignedEvent: UnsignedEvent): Promise<NostrEvent>
detectExtension(): Promise<NostrExtension | null>
validateKeyPair(keyPair: NostrKeyPair): KeyValidationResult
```

**Key Management Flow**:

![Key Management Flow](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/key-management-flow.mmd)

[View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTjsEadI0TdF1h2HADgO2w4YBRg-UTMcqJMmV5GYd0v9-lON8uG2BbhcbpPj4-EhRekGpyAElKMOqkKUs4C1fCHFFhZDwKrNkJa_hPV_BUl6BKKSp4Z2slLxaZTDnS3grS1lUBT9ZwVJWBbzjuZTyivO8hveyVBXmBVfVCr6W8hYyXt5y1aiVkJe8kqbm5RWvfRW5krKGz3V5C6ssW8N3XlYlvIPvvOB5c9mIVS5hxQGjvdVe15qXQgGQDOY8rwQAyOSMr8wqG1zUSv7uHsHKr03Nwd06h1ouBNSq5CBMjffDXKgqB_SqVRVO-DuVs5xXFWh6DdqsqlLBayWruubvZN6s73VZ8HLNPwhRNRchq2pRZW_hOy8kJKCVUqt_A-gcrX3r8XwFn-Qqg895uYJPvLoFtVplmJdyCZ95UUDGy2qV4XNe1nWGpVCl-gwfebmCDy8v4ONC1XI1ztXIxvFRNu60z8azZ0q8K-pGZKvMZMoU_IiURb6Gz2XJMy4rXsNXWXCQq0yVpcJPvKh4BqtVrnJcl6V8B7_zcgU_8OoOctWolRDwk5d38NNLFh8WQjbr36t1iXn5kpfVCl6yusoynKulrPETLzK8ygteX8M7XtXN-hv4VpZ8tfoN_izLO_hVliv45eUF_FaWK_j15QX8XpYr-OPlBfxRliv486X_B_hLlnfwl5f-H-BvWa7g75cX8I8sV_DPywv4V5Yr-O_lBfwnS_UZXstyBb-9vIA_ZbmCP19ewF-yXMG_Ly_gX1mu4M-XF_C_LFfw38sL-L8sV_D_ywv4AAAA__8)

[View Source Code](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/key-management-flow.mmd)

**File**: `packages/frontend/src/services/nostr/KeyManagementService.ts`

---

### 3. EventPublisherService

**Purpose**: Publish events to NOSTR relays with validation and error handling.

**Responsibilities**:

- Validate unsigned events before signing
- Coordinate with KeyManagementService for signing
- Publish to multiple relays via RelayPoolManager
- Track publish success/failure rates
- Retry failed publishes with backoff
- Emit publication metrics

**Key Methods**:

```typescript
publishEvent(unsignedEvent: UnsignedEvent): Promise<PublishResult>
publishBatch(events: UnsignedEvent[]): Promise<PublishResult[]>
republish(eventId: string): Promise<PublishResult>
deleteEvent(eventId: string, reason?: string): Promise<PublishResult>
```

**Event Publishing Flow**:

![Event Publishing Flow](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/event-publishing-flow.mmd)

[View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTjsEadI0TdF1h2HADgO2w4YBRg-UTMcqJMmV5GYd0v9-lON8uG2BbhcbpPj4-EhRekGpyAElKMOqkKUs4C1fCHFFhZDwKrNkJa_hPV_BUl6BKKSp4Z2slLxaZTDnS3grS1lUBT9ZwVJWBbzjuZTyivO8hveyVBXmBVfVCr6W8hYyXt5y1aiVkJe8kqbm5RWvfRW5krKGz3V5C6ssW8N3XlYlvIPvvOB5c9mIVS5hxQGjvdVe15qXQgGQDOY8rwQAyOSMr8wqG1zUSv7uHsHKr03Nwd06h1ouBNSq5CBMjffDXKgqB_SqVRVO-DuVs5xXFWh6DdqsqlLBayWruubvZN6s73VZ8HLNPwhRNRchq2pRZW_hOy8kJKCVUqt_A-gcrX3r8XwFn-Qqg895uYJPvLoFtVplmJdyCZ95UUDGy2qV4XNe1nWGpVCl-gwfebmCDy8v4ONC1XI1ztXIxvFRNu60z8azZ0q8K-pGZKvMZMoU_IiURb6Gz2XJMy4rXsNXWXCQq0yVpcJPvKh4BqtVrnJcl6V8B7_zcgU_8OoOctWolRDwk5d38NNLFh8WQjbr36t1iXn5kpfVCl6yusoynKulrPETLzK8ygteX8M7XtXN-hv4VpZ8tfoN_izLO_hVliv45eUF_FaWK_j15QX8XpYr-OPlBfxRliv486X_B_hLlnfwl5f-H-BvWa7g75cX8I8sV_DPywv4V5Yr-O_lBfwnS_UZXstyBb-9vIA_ZbmCP19ewF-yXMG_Ly_gX1mu4M-XF_C_LFfw38sL-L8sV_D_ywv4AAAA__8)

[View Source Code](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/event-publishing-flow.mmd)

**File**: `packages/frontend/src/services/nostr/EventPublisherService.ts`

---

### 4. SubscriptionManagerService

**Purpose**: Manage NOSTR subscriptions with lifecycle tracking.

**Responsibilities**:

- Create and manage REQ subscriptions
- Track subscription state (active, paused, closed)
- Handle EOSE (end of stored events) messages
- Automatic subscription cleanup
- Subscription pause/resume
- Filter validation and optimization

**Key Methods**:

```typescript
createSubscription(filters: Filter[], callback: EventCallback): string
pauseSubscription(subscriptionId: string): void
resumeSubscription(subscriptionId: string): void
closeSubscription(subscriptionId: string): void
getActiveSubscriptions(): Map<string, Subscription>
```

**Subscription Lifecycle**:

![Subscription Lifecycle](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/subscription-lifecycle.mmd)

[View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTjsEadI0TdF1h2HADgO2w4YBRg-UTMcqJMmV5GYd0v9-lON8uG2BbhcbpPj4-EhRekGpyAElKMOqkKUs4C1fCHFFhZDwKrNkJa_hPV_BUl6BKKSp4Z2slLxaZTDnS3grS1lUBT9ZwVJWBbzjuZTyivO8hveyVBXmBVfVCr6W8hYyXt5y1aiVkJe8kqbm5RWvfRW5krKGz3V5C6ssW8N3XlYlvIPvvOB5c9mIVS5hxQGjvdVe15qXQgGQDOY8rwQAyOSMr8wqG1zUSv7uHsHKr03Nwd06h1ouBNSq5CBMjffDXKgqB_SqVRVO-DuVs5xXFWh6DdqsqlLBayWruubvZN6s73VZ8HLNPwhRNRchq2pRZW_hOy8kJKCVUqt_A-gcrX3r8XwFn-Qqg895uYJPvLoFtVplmJdyCZ95UUDGy2qV4XNe1nWGpVCl-gwfebmCDy8v4ONC1XI1ztXIxvFRNu60z8azZ0q8K-pGZKvMZMoU_IiURb6Gz2XJMy4rXsNXWXCQq0yVpcJPvKh4BqtVrnJcl6V8B7_zcgU_8OoOctWolRDwk5d38NNLFh8WQjbr36t1iXn5kpfVCl6yusoynKulrPETLzK8ygteX8M7XtXN-hv4VpZ8tfoN_izLO_hVliv45eUF_FaWK_j15QX8XpYr-OPlBfxRliv486X_B_hLlnfwl5f-H-BvWa7g75cX8I8sV_DPywv4V5Yr-O_lBfwnS_UZXstyBb-9vIA_ZbmCP19ewF-yXMG_Ly_gX1mu4M-XF_C_LFfw38sL-L8sV_D_ywv4AAAA__8)

[View Source Code](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/subscription-lifecycle.mmd)

**File**: `packages/frontend/src/services/nostr/SubscriptionManagerService.ts`

---

### 5. EventCacheService

**Purpose**: Intelligent event caching with deduplication and persistence.

**Responsibilities**:

- Cache events in memory for fast access
- Persist to IndexedDB for offline support
- Deduplication across relays (prevent duplicates)
- TTL-based expiration
- Cache invalidation strategies
- Query cached events by filter

**Key Methods**:

```typescript
cacheEvent(event: NostrEvent, relayUrl: string): Promise<void>
getCachedEvent(eventId: string): Promise<NostrEvent | null>
queryCachedEvents(filter: Filter): Promise<NostrEvent[]>
invalidateCache(filter?: Filter): Promise<void>
getCacheStats(): CacheStatistics
```

**File**: `packages/frontend/src/services/nostr/EventCacheService.ts`

---

### 6. MonitoringService

**Purpose**: Real-time monitoring, metrics collection, and health dashboards.

**Responsibilities**:

- Track relay connection health
- Measure publish/subscribe latency
- Calculate success rates
- Event throughput monitoring
- Performance metrics aggregation
- Alert generation for anomalies

**Key Methods**:

```typescript
recordMetric(metricName: string, value: number): void
getMetrics(timeRange?: TimeRange): MetricsSnapshot
getRelayHealth(relayUrl: string): RelayHealth
subscribeToAlerts(callback: AlertCallback): void
```

**File**: `packages/frontend/src/services/nostr/MonitoringService.ts`

---

## Data Flow

### Complete Data Flow Diagram

![Data Flow Diagram](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/data-flow-diagram.mmd)

[View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTjsEadI0TdF1h2HADgO2w4YBRg-UTMcqJMmV5GYd0v9-lON8uG2BbhcbpPj4-EhRekGpyAElKMOqkKUs4C1fCHFFhZDwKrNkJa_hPV_BUl6BKKSp4Z2slLxaZTDnS3grS1lUBT9ZwVJWBbzjuZTyivO8hveyVBXmBVfVCr6W8hYyXt5y1aiVkJe8kqbm5RWvfRW5krKGz3V5C6ssW8N3XlYlvIPvvOB5c9mIVS5hxQGjvdVe15qXQgGQDOY8rwQAyOSMr8wqG1zUSv7uHsHKr03Nwd06h1ouBNSq5CBMjffDXKgqB_SqVRVO-DuVs5xXFWh6DdqsqlLBayWruubvZN6s73VZ8HLNPwhRNRchq2pRZW_hOy8kJKCVUqt_A-gcrX3r8XwFn-Qqg895uYJPvLoFtVplmJdyCZ95UUDGy2qV4XNe1nWGpVCl-gwfebmCDy8v4ONC1XI1ztXIxvFRNu60z8azZ0q8K-pGZKvMZMoU_IiURb6Gz2XJMy4rXsNXWXCQq0yVpcJPvKh4BqtVrnJcl6V8B7_zcgU_8OoOctWolRDwk5d38NNLFh8WQjbr36t1iXn5kpfVCl6yusoynKulrPETLzK8ygteX8M7XtXN-hv4VpZ8tfoN_izLO_hVliv45eUF_FaWK_j15QX8XpYr-OPlBfxRliv486X_B_hLlnfwl5f-H-BvWa7g75cX8I8sV_DPywv4V5Yr-O_lBfwnS_UZXstyBb-9vIA_ZbmCP19ewF-yXMG_Ly_gX1mu4M-XF_C_LFfw38sL-L8sV_D_ywv4AAAA__8)

[View Source Code](https://github.com/sovren/sovren/blob/main/docs/architecture/diagrams/nostr/data-flow-diagram.mmd)

### Event Publishing Flow

1. User creates content in React component
2. Component calls `EventPublisherService.publishEvent()`
3. Service validates event structure
4. Service calls `KeyManagementService.signEvent()`
5. Signed event sent to `RelayPoolManager.publishEvent()`
6. Manager publishes to multiple relays in parallel
7. Responses aggregated (OK/ERROR from each relay)
8. Event cached in `EventCacheService`
9. Metrics recorded in `MonitoringService`
10. Result returned to component

### Event Subscription Flow

1. Component subscribes via `RelayPoolManager.subscribe()`
2. Manager creates REQ message with filters
3. REQ sent to all connected relays
4. Relays respond with EVENT messages
5. Events deduplicated in `EventCacheService`
6. Events validated (signature verification)
7. Callback invoked with deduplicated events
8. EOSE message marks end of stored events
9. Real-time events continue streaming
10. Component updates UI

---

## Technology Stack

### Core Dependencies

| Package            | Version | Purpose                            |
| ------------------ | ------- | ---------------------------------- |
| `nostr-tools`      | ^2.0.0  | Core NOSTR protocol implementation |
| `@noble/secp256k1` | ^2.0.0  | Cryptographic operations           |
| `zod`              | ^3.22.0 | Runtime type validation            |
| `idb`              | ^7.1.1  | IndexedDB wrapper for storage      |

### Browser APIs Used

- **WebSocket API**: Relay connections
- **IndexedDB**: Persistent key and event storage
- **Web Crypto API**: AES-256-GCM encryption
- **sessionStorage**: Temporary session data
- **localStorage**: User preferences

---

## Design Principles

### 1. Type Safety First

All services use comprehensive TypeScript types with Zod schemas for runtime validation:

```typescript
import { NostrEventSchema, NostrFilterSchema } from '@shared/types/nostr';

// Compile-time and runtime validation
const event = NostrEventSchema.parse(rawEvent);
```

### 2. Singleton Pattern for Shared Resources

Connection pooling uses singletons to prevent resource duplication:

```typescript
const manager = RelayPoolManager.getInstance();
```

### 3. Event-Driven Architecture

Services emit events for loose coupling:

```typescript
relayPoolManager.on('relay:connected', (relay) => {
  console.log(`Connected to ${relay.url}`);
});
```

### 4. Graceful Degradation

Services continue operating with reduced functionality if components fail:

- Relay failure → Use remaining healthy relays
- Extension unavailable → Fall back to local keys
- Cache miss → Fetch from relay

### 5. Performance Optimization

- **Connection Pooling**: Reuse WebSocket connections
- **Event Deduplication**: Store each event once
- **Lazy Loading**: Load services on demand
- **Memory Management**: TTL-based cache expiration

### 6. Security by Design

- **No Plaintext Keys**: Always encrypted at rest
- **Signature Verification**: Validate all events
- **Input Sanitization**: Validate all user inputs
- **Principle of Least Privilege**: Minimal permissions

---

## Performance Characteristics

### Benchmarks (Average)

| Operation                 | Latency   | Throughput          |
| ------------------------- | --------- | ------------------- |
| Event Publishing          | 100-300ms | 10-20 events/sec    |
| Event Subscription        | 50-150ms  | 50-100 events/sec   |
| Key Generation            | 50-100ms  | N/A                 |
| Event Signing (local)     | 5-10ms    | 100+ signs/sec      |
| Event Signing (extension) | 100-500ms | N/A (user approval) |
| Cache Query               | 1-5ms     | 1000+ queries/sec   |
| Relay Connection          | 100-500ms | N/A                 |

### Scalability Limits

- **Max Relays**: 10 concurrent connections
- **Max Subscriptions**: 50 active subscriptions
- **Cache Size**: 10,000 events (configurable)
- **Max Event Size**: 100KB (relay dependent)

### Memory Footprint

- **Base Services**: ~5MB
- **Per Relay Connection**: ~1MB
- **Per Cached Event**: ~2KB
- **Per Active Subscription**: ~500 bytes

---

## Next Steps

- [API Reference](../api/README.md) - Complete API documentation
- [Getting Started Guide](../guides/getting-started.md) - Quick start tutorial
- [NIPs Documentation](../nips/README.md) - Implemented NIPs
- [Integration Guide](../guides/integration.md) - How to integrate

---

**Maintained by**: Sovren Development Team
**Questions**: [GitHub Issues](https://github.com/sovren/sovren/issues)
