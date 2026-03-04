---
status: pending
priority: p1
issue_id: '611'
tags: [code-review, frontend, react, content-shield, race-condition]
dependencies: []
---

# P1: usePublishWithProvenance Unmount During Async Chain → Ghost Writes

## Problem Statement

`usePublishWithProvenance` executes a 3-step async chain: `onPublish` → `signWithExtension` (browser popup, can take 30+ seconds) → `signProvenance.mutateAsync`. If the component unmounts mid-chain (user navigates away), the remaining steps still fire. The NOSTR extension popup stays open, and if confirmed, provenance is registered server-side with no UI feedback. User returns, clicks Publish again → duplicate provenance records.

Additionally, the hook returns a new closure on every render that captures stale `contentId` and `onPublish` props.

## Findings

- **Races Agent 1 (F2, F3)**: "Stale closure over contentId and onPublish" + "No unmount guard on 3-step async chain"
- **Races Agent 2 (F1)**: "Mutex leak on unmount — the await signProvenance.mutateAsync will still fire after the component has unmounted"
- **Consensus**: 2/5 agents (both race specialists)

## Proposed Solutions

### Option A: Add isMounted ref + useRef for latest values (Recommended)

```typescript
const mountedRef = useRef(true);
useEffect(
  () => () => {
    mountedRef.current = false;
  },
  []
);
const contentIdRef = useRef(contentId);
contentIdRef.current = contentId;

// Inside async chain:
await onPublish(content);
if (!mountedRef.current) return;
// ... sign
if (!mountedRef.current) return;
// ... register
```

- Pros: Prevents ghost writes, uses latest values
- Cons: Doesn't cancel the extension popup (can't)
- Effort: Small
- Risk: Low

### Option B: Wrap in useCallback + AbortController

Use mutation's signal parameter for cancellation.

- Pros: More React-idiomatic
- Cons: Extension popup still can't be cancelled
- Effort: Medium
- Risk: Low

## Recommended Action

Option A — simplest fix, prevents the most damaging scenario (API call after unmount).

## Technical Details

**Affected files:**

- `packages/frontend/src/features/content-shield/hooks/usePublishWithProvenance.ts`

## Acceptance Criteria

- [ ] `mountedRef` check between each async step
- [ ] `contentIdRef` and `onPublishRef` for latest values
- [ ] No API call fires after component unmount

## Work Log

| Date       | Action                      | Learnings                                    |
| ---------- | --------------------------- | -------------------------------------------- |
| 2026-03-03 | Created from PR #132 review | Both race-condition specialists flagged this |

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
