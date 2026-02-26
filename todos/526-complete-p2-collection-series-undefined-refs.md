---
status: complete
priority: p2
issue_id: '526'
tags: [code-review, typescript, pre-existing, content]
dependencies: []
---

# ContentCollectionManager + ContentSeriesBuilder: 15 undefined action creator references

## Problem Statement

Both components had tempStubs imports removed, but they were importing symbols that NEVER EXISTED in tempStubs (`createContentCollection`, `fetchContentCollections`, `addEpisodeToSeries`, etc.). These were pre-existing TypeScript errors. The import removal changes the error type but not the broken status.

**Consensus:** 8/8 review agents flagged; reclassified from P1→P2 because pre-existing.

## Findings

**ContentCollectionManager.tsx** — 7 undefined symbols at lines 92, 160, 174, 189, 211, 258, 265, 278, 292, 636
**ContentSeriesBuilder.tsx** — 8 undefined symbols at lines 69, 119, 133, 148, 169, 186, 207, 226

## Proposed Solutions

### Option A: Remove dispatch calls, add TODO stubs (Recommended)

- Match MediaEmbedder/PremiumContentPaywall pattern
- Complex: these have `.unwrap()`, error handling, and control flow dependent on dispatch results
- **Effort:** Medium (30-45 min per component)
- **Risk:** Medium — restructuring component logic

### Option B: Delete components entirely

- Neither is imported anywhere in the app (dead exports)
- They'll be rewritten from scratch during React Query migration
- **Effort:** Small (5 min)
- **Risk:** Low — no consumers

### Option C: Defer (leave as-is)

- Components were already broken before this PR
- Type error count still improved (2,728 → 1,247)
- **Effort:** None
- **Risk:** None (pre-existing)

## Acceptance Criteria

- [x] Decision made: delete (dead exports, neither imported anywhere)
- [x] If fixed/deleted: zero new TS errors from these files

## Work Log

| Date       | Action                      | Learnings                             |
| ---------- | --------------------------- | ------------------------------------- |
| 2026-02-26 | Created from 8-agent review | Pre-existing breakage, not regression |
