---
status: pending
priority: p2
issue_id: '618'
tags: [code-review, frontend, error-handling, content-shield]
dependencies: []
---

# P2: usePublishWithProvenance Propagates Provenance Errors to Publish Flow

## Problem Statement

The hook has try/finally but no catch for the provenance signing path. If `signWithExtension` or `mutateAsync` throws, the error propagates and breaks the entire publish. The JSDoc says "graceful degradation" but provenance errors are not caught.

## Findings

- **Kieran TS (P2-3)**: "Provenance signing is supposed to be optional... errors in the provenance path should be caught and logged, not propagated"

## Proposed Solutions

Wrap the provenance-specific code in a nested try/catch:

```typescript
try {
  await onPublish(content);
  try {
    // ... sign and register provenance
  } catch (provenanceError) {
    console.warn('Provenance signing failed', provenanceError);
  }
} finally {
  savingRef.current = false;
}
```

## Acceptance Criteria

- [ ] Failed provenance signing does not block publish
- [ ] Error is logged with `console.warn`
- [ ] Content is still published on provenance failure

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
