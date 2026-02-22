---
id: 447
severity: P3
status: complete
title: 'NostrKeyManagementService: setInterval in startBackgroundTasks never cleared on destroy'
file: packages/shared/src/services/NostrKeyManagementService.ts
found_in: PR #89
reviewer: review-backend
---

# NostrKeyManagementService leaks intervals on destroy

## Problem

`startBackgroundTasks()` creates two `setInterval` timers (lines 917-925) but `destroy()` at line 1013 only clears event listeners and Maps — it does NOT clear the intervals:

```typescript
private startBackgroundTasks(): void {
  setInterval(() => { this.cleanupExpiredData(); }, 3600000);
  setInterval(() => { this.processRotationQueue(); }, 60000);
}

destroy(): void {
  this.removeAllListeners();
  this.state.keys.clear();
  // ... clears maps, but NOT the intervals
}
```

This causes:

1. Memory leak — destroyed instances continue running cleanup/rotation tasks
2. Zombie callbacks — after `destroy()`, the interval callbacks reference cleared maps, potentially causing errors
3. In tests, leaked intervals can cause "open handles" warnings and prevent clean test exit

## Location

```
packages/shared/src/services/NostrKeyManagementService.ts  lines 915-925 (startBackgroundTasks)
packages/shared/src/services/NostrKeyManagementService.ts  lines 1013-1021 (destroy)
```

## Fix

Store interval IDs and clear them in `destroy()`:

```typescript
private cleanupInterval?: NodeJS.Timeout;
private rotationInterval?: NodeJS.Timeout;

private startBackgroundTasks(): void {
  this.cleanupInterval = setInterval(() => this.cleanupExpiredData(), 3600000);
  this.rotationInterval = setInterval(() => this.processRotationQueue(), 60000);
}

destroy(): void {
  if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  if (this.rotationInterval) clearInterval(this.rotationInterval);
  this.removeAllListeners();
  this.state.keys.clear();
  // ...
}
```

## Severity Justification

P3: Resource leak. Won't crash production but accumulates zombie timers if the service is instantiated/destroyed multiple times (e.g., in tests or hot-reload).
