---
status: pending
priority: p3
issue_id: '621'
tags: [code-review, cleanup, content-shield]
dependencies: []
---

# P3: Miscellaneous Cleanup Items (8 sub-items)

## Items

1. **Tombstone files**: Delete `useDmcaReports.ts` and `useProvenanceVerification.ts` (comment-only files) — Kieran P3-3
2. **Dual exports**: Remove default exports from AuthenticityBadge, ProvenanceChainViewer etc. (barrel uses named only) — Kieran P3-2
3. **copyToClipboard**: Add error handling to `navigator.clipboard.writeText` in ProvenanceChainViewer — Races F8, Kieran P2-7
4. **Relay list index keys**: Use `conf.relay` as key instead of array index in ProvenanceChainViewer — Kieran P3-4
5. **Hardcoded verification URL**: `https://sovren.dev/verify/${contentId}` should use env config — Kieran P3-7
6. **as any in tests**: Replace `as any` with `vi.mocked()` in 6+ test locations — Kieran P2-4
7. **AlertsFeed split**: 282-line file with 3 sub-components should be split — Kieran P2-8
8. **shieldKeys barrel export**: Remove from index.ts (no external consumers, YAGNI) — Simplicity
9. **NOTE comments in shieldKeys.ts**: Remove stale migration comments — Simplicity
10. **Relay confirmations naming**: Rename to `relay_targets` since they're not verified — Security P3-002
11. **Inline import() types**: Replace with top-level imports in types/index.ts — Kieran P3-1

## Acceptance Criteria

- [ ] All items addressed or explicitly deferred with reason

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
