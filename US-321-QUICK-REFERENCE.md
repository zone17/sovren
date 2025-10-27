# 🚦 US-321: NOSTR Rate Limiting - Quick Reference

**Status**: ✅ COMPLETE | **Test Coverage**: 89% | **Performance**: <1ms checks

---

## 📚 Quick Start

### Initialize Rate Limiter

```typescript
import { RateLimiter } from '@/services/nostr';

const rateLimiter = RateLimiter.getInstance();
await rateLimiter.initialize({
  enabled: true,
  enableQueuing: true,
  enablePriority: true,
});
```

### Check Rate Limit

```typescript
import { RateLimitOperation, RequestPriority } from '@/services/nostr';

const result = await rateLimiter.checkLimit({
  operation: RateLimitOperation.PUBLISH_EVENT,
  relay: 'wss://relay.damus.io',
  priority: RequestPriority.HIGH,
});

if (result.allowed) {
  // Proceed with operation
} else {
  // Handle rate limit
  console.log(`Rate limited: ${result.reason}`);
  console.log(`Retry after: ${result.retryAfter}ms`);
}
```

---

## 🎯 Default Rate Limits

| Operation | Limit | Window |
|-----------|-------|--------|
| Publish Event | 10 | 1 second |
| Subscribe | 5 | 1 second |
| Query | 20 | 1 second |
| NIP-05 Verify | 2 | 1 second |
| Fetch Event | 30 | 1 second |
| Batch | 3 | 1 second |
| **Global** | **100** | **1 second** |
| **Per-Relay** | **50** | **1 second** |

---

## 🔧 Configuration

### Set Custom Relay Limit

```typescript
rateLimiter.setRelayLimit('wss://custom-relay.io', {
  requests: 50,
  window: 1000,
});
```

### Update Operation Limits

```typescript
rateLimiter.updateConfig({
  operationLimits: {
    [RateLimitOperation.PUBLISH_EVENT]: { requests: 20, window: 1000 },
  },
  globalLimit: { requests: 200, window: 1000 },
});
```

### Enable/Disable Features

```typescript
await rateLimiter.initialize({
  enabled: true,
  enableQueuing: true,          // Queue requests that exceed limit
  enablePriority: true,          // Process queue by priority
  enableMetrics: true,           // Track statistics
  maxQueueSize: 1000,           // Max queued requests
  queueTimeout: 5000,           // Timeout in ms
});
```

---

## 📊 Monitoring

### Get Metrics

```typescript
import { RateLimitMonitor } from '@/services/nostr';

const monitor = RateLimitMonitor.getInstance();
await monitor.initialize();

// Dashboard data
const dashboard = monitor.getDashboardData();
console.log('Health:', dashboard.health);
console.log('Success rate:', dashboard.summary.successRate);
console.log('Queue size:', dashboard.summary.queueSize);

// Detailed metrics
const metrics = rateLimiter.getMetrics();
console.log('Total requests:', metrics.overall.totalRequests);
console.log('Allowed:', metrics.overall.allowed);
console.log('Denied:', metrics.overall.denied);
```

### Export Metrics

```typescript
// Prometheus format
const prometheusMetrics = monitor.exportPrometheus();
// Send to monitoring system

// JSON format
const jsonMetrics = monitor.exportJSON();
const parsed = JSON.parse(jsonMetrics);
```

### Get Alerts

```typescript
const alerts = monitor.getAlerts(10);
alerts.forEach(alert => {
  console.log(`[${alert.severity}] ${alert.type}: ${alert.message}`);
});
```

---

## 🎚️ Priority Levels

| Priority | Value | Use Case |
|----------|-------|----------|
| CRITICAL | 0 | Security, key operations |
| HIGH | 1 | User-initiated actions |
| NORMAL | 2 | Standard operations |
| LOW | 3 | Background tasks |
| LOWEST | 4 | Analytics, logging |

```typescript
await rateLimiter.checkLimit({
  operation: RateLimitOperation.PUBLISH_EVENT,
  priority: RequestPriority.CRITICAL, // Will be processed first
});
```

---

## 📈 Statistics

### Operation Stats

```typescript
const publishStats = rateLimiter.getOperationStats(
  RateLimitOperation.PUBLISH_EVENT
);

console.log('Total requests:', publishStats.totalRequests);
console.log('Allowed:', publishStats.allowed);
console.log('Denied:', publishStats.denied);
console.log('Success rate:', publishStats.successRate);
```

### Relay Stats

```typescript
const relayStats = rateLimiter.getRelayStats('wss://relay.damus.io');
console.log('Requests to relay:', relayStats.totalRequests);
console.log('Success rate:', relayStats.successRate);
```

### Queue Metrics

```typescript
const queueMetrics = rateLimiter.getQueueMetrics();
console.log('Current queue size:', queueMetrics.size);
console.log('Total queued:', queueMetrics.totalQueued);
console.log('Total processed:', queueMetrics.totalProcessed);
console.log('Average wait time:', queueMetrics.averageWaitTime);
```

---

## 🚫 Error Handling

### Denial Reasons

```typescript
if (!result.allowed) {
  switch (result.reason) {
    case RateLimitDenialReason.GLOBAL_LIMIT_EXCEEDED:
      // Global rate limit hit
      break;
    case RateLimitDenialReason.OPERATION_LIMIT_EXCEEDED:
      // Operation-specific limit hit
      break;
    case RateLimitDenialReason.RELAY_LIMIT_EXCEEDED:
      // Relay-specific limit hit
      break;
    case RateLimitDenialReason.QUEUE_FULL:
      // Queue is at max capacity
      break;
    case RateLimitDenialReason.QUEUE_TIMEOUT:
      // Request timed out in queue
      break;
  }
}
```

### Handle Rate Limit Error

```typescript
try {
  await eventPublisher.publish(event);
} catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    // Extract retry-after from error
    const retryAfter = parseInt(error.message.match(/\d+/)?.[0] || '1000');

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter));
    await eventPublisher.publish(event);
  }
}
```

---

## 🎨 Events

### Listen to Rate Limit Events

```typescript
import { RateLimitEventType } from '@/services/nostr';

rateLimiter.on('rate-limit-event', (event) => {
  console.log(`[${event.type}] ${event.operation}`);

  switch (event.type) {
    case RateLimitEventType.ALLOWED:
      console.log('Request allowed');
      break;
    case RateLimitEventType.DENIED:
      console.log('Request denied');
      break;
    case RateLimitEventType.QUEUED:
      console.log('Request queued');
      break;
    case RateLimitEventType.PROCESSED:
      console.log('Request processed from queue');
      break;
    case RateLimitEventType.TIMEOUT:
      console.log('Request timed out');
      break;
  }
});
```

### Listen to Alerts

```typescript
rateLimitMonitor.on('alert', (alert) => {
  console.log(`[${alert.severity}] ${alert.type}`);
  console.log(alert.message);
  console.log(alert.metadata);
});
```

---

## 🧪 Testing

### Unit Tests

```bash
cd packages/frontend
npm test -- RateLimiter.test.ts
```

### Integration Tests

```bash
npm test -- RateLimiter.integration.test.ts
```

### Coverage Report

```bash
npm test -- RateLimiter --coverage
```

---

## 📦 File Locations

```
packages/frontend/src/services/nostr/
├── RateLimiter.ts                           # Core rate limiter
├── RateLimitMonitor.ts                      # Monitoring service
├── types/
│   └── rate-limit.ts                        # Type definitions
└── __tests__/
    ├── RateLimiter.test.ts                  # Unit tests
    └── RateLimiter.integration.test.ts      # Integration tests
```

---

## 🔗 Related Services

- **EventPublisherService** - Uses rate limiter for publishing
- **SubscriptionManagerService** - Uses rate limiter for subscriptions
- **MonitoringService** - Integrates with rate limit monitoring
- **RelayPoolManager** - Provides relay information

---

## 🐛 Troubleshooting

### High Denial Rate

```typescript
// Check metrics
const metrics = rateLimiter.getMetrics();
console.log('Denial rate:', metrics.overall.denied / metrics.overall.totalRequests);

// Check which limit is hit most
metrics.byOperation.forEach((stats, operation) => {
  if (stats.denied > 10) {
    console.log(`${operation}: ${stats.denied} denied`);
  }
});

// Increase limits if legitimate traffic
rateLimiter.updateConfig({
  operationLimits: {
    [RateLimitOperation.QUERY]: { requests: 50, window: 1000 },
  },
});
```

### Queue Growing

```typescript
const queueMetrics = rateLimiter.getQueueMetrics();
if (queueMetrics.size > 500) {
  console.warn('Queue is growing!');

  // Option 1: Increase rate limits
  rateLimiter.updateConfig({
    globalLimit: { requests: 200, window: 1000 },
  });

  // Option 2: Increase queue size
  rateLimiter.updateConfig({
    maxQueueSize: 2000,
  });

  // Option 3: Reduce queue timeout
  rateLimiter.updateConfig({
    queueTimeout: 3000, // 3 seconds
  });
}
```

### High Timeout Rate

```typescript
const queueMetrics = rateLimiter.getQueueMetrics();
const timeoutRate = queueMetrics.totalTimedOut / queueMetrics.totalQueued;

if (timeoutRate > 0.1) {
  console.warn(`High timeout rate: ${(timeoutRate * 100).toFixed(1)}%`);

  // Increase queue timeout
  rateLimiter.updateConfig({
    queueTimeout: 10000, // 10 seconds
  });

  // Or increase rate limits
  rateLimiter.updateConfig({
    globalLimit: { requests: 150, window: 1000 },
  });
}
```

---

## ⚡ Performance Tips

1. **Skip Queue for Non-Critical Operations**
   ```typescript
   await rateLimiter.checkLimit({
     operation: RateLimitOperation.QUERY,
     skipQueue: true, // Don't queue if denied
   });
   ```

2. **Use Appropriate Priorities**
   ```typescript
   // User actions = HIGH
   // Background = LOW
   ```

3. **Set Relay-Specific Limits**
   ```typescript
   // Higher limits for reliable relays
   rateLimiter.setRelayLimit('wss://fast-relay.io', {
     requests: 100,
     window: 1000,
   });
   ```

4. **Monitor and Adjust**
   ```typescript
   // Check metrics regularly
   setInterval(() => {
     const metrics = rateLimiter.getMetrics();
     // Adjust limits based on metrics
   }, 60000);
   ```

---

## 📖 API Reference

### RateLimiter

| Method | Description |
|--------|-------------|
| `getInstance()` | Get singleton instance |
| `initialize(config?)` | Initialize with config |
| `isInitialized()` | Check initialization status |
| `checkLimit(options)` | Check if request is allowed |
| `getMetrics()` | Get all metrics |
| `getOperationStats(op)` | Get stats for operation |
| `getRelayStats(relay)` | Get stats for relay |
| `getQueueMetrics()` | Get queue metrics |
| `updateConfig(config)` | Update configuration |
| `setRelayLimit(relay, policy)` | Set relay-specific limit |
| `resetStats()` | Reset all statistics |
| `destroy()` | Cleanup and destroy |

### RateLimitMonitor

| Method | Description |
|--------|-------------|
| `getInstance()` | Get singleton instance |
| `initialize(interval?)` | Initialize with update interval |
| `getDashboardData()` | Get dashboard data |
| `exportPrometheus()` | Export Prometheus metrics |
| `exportJSON()` | Export JSON metrics |
| `getAlerts(limit?)` | Get recent alerts |
| `clearAlerts()` | Clear all alerts |
| `destroy()` | Cleanup and destroy |

---

*Quick Reference for US-321 Rate Limiting Implementation*
*For detailed documentation, see US-321-RATE-LIMITING-COMPLETE.md*
