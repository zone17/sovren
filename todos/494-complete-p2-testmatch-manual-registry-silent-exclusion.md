---
status: complete
priority: p2
issue_id: '494'
tags:
  - code-review
  - playwright
  - e2e-testing
  - agent-native
dependencies: []
---

# testMatch Regex Is a Manual Registry — New Specs Silently Excluded

## Problem Statement

`playwright.config.ts` uses hardcoded regex patterns in `testMatch` to assign spec files to projects:

```typescript
testMatch: /navigation\.spec\.ts|wellness\.spec\.ts/,  // chromium-authenticated
testMatch: /home\.spec\.ts|auth\.spec\.ts/,             // chromium-public
```

When a new spec file is added without updating these regexes, Playwright silently excludes it from all runs. Exit code is still 0, no error is surfaced. An agent or developer adding a new spec sees 0 new tests run with no indication of the problem.

## Findings

**Agent consensus: 1/4** (agent-native-reviewer flagged as critical)

- New specs are silently excluded until `playwright.config.ts` regex is manually updated
- Exit code 0 masks the missing registration — no test failure to alert
- Affects both human developers and agents writing new specs

## Proposed Solutions

### Option A: Convention-based file naming (Recommended)

Rename spec files with project suffix and use wildcard patterns:

```typescript
// chromium-authenticated
testMatch: /\.auth\.spec\.ts$/,

// chromium-public
testMatch: /\.public\.spec\.ts$/,
```

Rename: `navigation.spec.ts` → `navigation.auth.spec.ts`, etc.

- Pros: Auto-discovery, zero config changes for new specs, self-documenting
- Cons: File renames, requires updating CI references
- Effort: Medium
- Risk: Low

### Option B: Catch-all with explicit exclusion

```typescript
// chromium-public catches everything not explicitly authenticated
testMatch: /\.spec\.ts$/,
testIgnore: /navigation\.spec\.ts|wellness\.spec\.ts/,
```

- Pros: New specs default to public project (safer default)
- Cons: Still requires manual update for authenticated specs
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/playwright.config.ts` (lines 40, 49)
- All `e2e/*.spec.ts` files (if renaming)

## Acceptance Criteria

- [ ] New spec files are automatically included in a Playwright project without config changes
- [ ] Convention is documented in CLAUDE.md E2E section
- [ ] All 20 existing tests still pass

## Work Log

| Date       | Action                              | Outcome                                                                                    |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-02-24 | Identified by agent-native-reviewer | P2 — silent spec exclusion risk                                                            |
| 2026-02-24 | Fixed — convention-based naming     | Renamed specs to _.auth.spec.ts / _.public.spec.ts, updated testMatch to wildcard patterns |
