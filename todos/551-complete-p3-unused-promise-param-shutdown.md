---
status: pending
priority: p3
issue_id: '551'
tags: [code-review, typescript, pr-103]
dependencies: []
---

# Prefix unused `promise` parameter with underscore in shutdown.ts

## Problem Statement

In `packages/backend/src/shutdown.ts:251`, the `unhandledRejection` handler captures `promise` but never uses it. Per TypeScript convention, unused parameters should be prefixed with `_`.

## Findings

- Line 251: `process.on('unhandledRejection', async (reason, promise) => {`
- `promise` is never referenced in the handler body
- Pre-existing but PR touched this line (console→logger migration)

## Proposed Solutions

### Option 1: Prefix with underscore (Recommended)

```typescript
process.on('unhandledRejection', async (reason, _promise) => {
```

**Effort:** Small (1 min) | **Risk:** None

## Acceptance Criteria

- [ ] No unused parameters without underscore prefix in shutdown.ts
