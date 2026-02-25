---
status: pending
priority: p2
issue_id: 515
tags: [code-review, dead-code, typescript, shared-package]
dependencies: []
---

# Delete or Relocate Excluded Shared Services

## Problem Statement

`packages/shared/tsconfig.json` excludes two service files by name:

```json
"src/services/NostrKeyManagementService.ts",
"src/services/NostrSecureKeyStorage.ts"
```

These files exist on disk, are version-controlled, but invisible to TypeScript compilation. They import browser-only dependencies (`bip39`, `idb`) that don't exist in the shared package. This creates invisible dead code that won't be type-checked, confuses developers, and will accumulate stale patterns.

## Findings

**5+ agent consensus:** Security Sentinel x2 (P2-P3), Pattern Recognition (P2), Architecture Strategist (P2), TypeScript Reviewer (P2), Code Simplicity (noted).

- `NostrKeyManagementService.ts` imports `bip39` (not installed)
- `NostrSecureKeyStorage.ts` imports `idb` (browser IndexedDB wrapper — not a backend dependency)
- Neither file is imported by backend or shared barrel exports
- Frontend has its own `KeyManagementService.ts` in `packages/frontend/src/services/nostr/`
- The types these services use ARE properly exported via `src/types/nostr/` (not affected)

## Proposed Solutions

### Option A: Delete both files (Recommended)

- Frontend already has its own key management implementation
- Types are preserved in `src/types/nostr-key-management.ts`
- **Pros:** Clean, no maintenance burden, removes tsconfig hack
- **Cons:** If unique logic exists, it's lost (mitigated: git history preserves it)
- **Effort:** Small
- **Risk:** Low

### Option B: Move to frontend package

- Move files to `packages/frontend/src/services/nostr/`
- Install `bip39` and `idb` in frontend
- **Pros:** Preserves code where its dependencies are appropriate
- **Cons:** May duplicate frontend's existing `KeyManagementService.ts`
- **Effort:** Medium
- **Risk:** Low

## Technical Details

**Affected files:**

- `packages/shared/src/services/NostrKeyManagementService.ts` — delete
- `packages/shared/src/services/NostrSecureKeyStorage.ts` — delete
- `packages/shared/tsconfig.json` — remove exclusion lines

## Acceptance Criteria

- [ ] No named file exclusions in `packages/shared/tsconfig.json`
- [ ] `cd packages/shared && npm run build` succeeds
- [ ] No broken imports in backend or frontend

## Work Log

| Date       | Action                       | Learnings                                         |
| ---------- | ---------------------------- | ------------------------------------------------- |
| 2026-02-25 | Created during PR #98 review | 5+ agents flagged; browser deps in shared package |

## Resources

- PR #98: fix/backend-startup
