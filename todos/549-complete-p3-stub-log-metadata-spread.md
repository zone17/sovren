---
status: pending
priority: p3
issue_id: '549'
tags: [code-review, logging, pr-103]
dependencies: []
---

# Namespace properties in service stub log entries to prevent key collisions

## Problem Statement

The 3 new service stubs spread caller-provided properties directly into Winston log metadata. If a caller passes a property named `event`, `level`, `message`, or `timestamp`, it would shadow Winston's built-in fields.

**Files:**

- `packages/backend/src/services/analytics-service.ts:11` — `{ event, ...properties }`
- `packages/backend/src/services/websocket-service.ts:11,15` — `{ event, ...data }`, `{ userId, event, ...data }`

## Findings

- 4/7 review agents flagged this pattern
- Combined with pre-existing logger sanitization gap (sanitizeFormat only checks `info.metadata`, never populated), arbitrary caller data goes unsanitized
- Pattern is `logger.info('msg', { event, ...properties })` — if `properties` has `event: 'malicious'`, it shadows the explicit `event` field

## Proposed Solutions

### Option 1: Nest properties under named key (Recommended)

```typescript
// Before
logger.info('Analytics event', { event, ...properties });
// After
logger.info('Analytics event', { event, properties });
```

**Effort:** Small (5 min) | **Risk:** None

## Acceptance Criteria

- [ ] No spread of caller-controlled data into log metadata root level
