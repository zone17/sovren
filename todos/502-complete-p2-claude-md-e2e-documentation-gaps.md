---
status: complete
priority: p2
issue_id: '502'
tags:
  - code-review
  - documentation
  - agent-native
  - e2e-testing
dependencies: []
---

# CLAUDE.md E2E Documentation Gaps (4 Sub-Items)

## Problem Statement

The CLAUDE.md E2E section is missing several conventions that agents need to operate autonomously. Agent-native review scored 6/10 tasks as fully discoverable — 4 require reading source files to discover the convention. These gaps will produce recurring P2/P3 findings in future review cycles as agents create E2E artifacts without full context.

## Findings

**Agent consensus: 1/4** (agent-native-reviewer — specialist)

### Gap 1: "Required Reading" pattern count is stale

CLAUDE.md states "12 P2/P3-class patterns" but `common-solutions.md` now has 31 entries. The hardcoded count and parenthetical list are from many sprints ago. Agents reading "12 patterns" and counting 31 will distrust the document.

**Location:** CLAUDE.md, "Required Reading" section

### Gap 2: `.first()` convention undocumented

The commit fixed two `.first()` disambiguations (sovrenLogo, userName) but the rule — "if a locator could match multiple elements, add `.first()` in the POM constructor" — appears nowhere in CLAUDE.md. Agents will keep hitting strict-mode violations.

**Location:** CLAUDE.md, Conventions block

### Gap 3: `USE_BACKEND` toggle undocumented

`playwright.config.ts` implements `USE_BACKEND=1` mode that starts the backend and enables real auth. Neither the E2E section nor Commands block mentions this. Agents writing features requiring real backend auth have no way to discover the toggle.

**Location:** CLAUDE.md, Commands block

### Gap 4: `helpers/` directory invisible

The structure diagram lists `pages/`, `fixtures/`, and spec files but omits `helpers/`. The `nostr-auth.ts` helper implementing real NOSTR challenge-response auth is completely invisible to agents.

**Location:** CLAUDE.md, Structure block

## Proposed Solutions

### Option A: Update all 4 gaps in CLAUDE.md (Recommended)

1. Replace hardcoded "12" count with stable description (no count)
2. Add `.first()` convention bullet to Conventions block
3. Add `USE_BACKEND=1` command to Commands block
4. Add `helpers/` to structure diagram

- Pros: All 4 gaps closed, agent discoverability improves from 6/10 to ~9/10
- Cons: None
- Effort: Small (text-only changes)
- Risk: Low

## Technical Details

**Affected files:**

- `CLAUDE.md` (E2E section, ~4 edits)

## Acceptance Criteria

- [ ] "Required Reading" section has no hardcoded pattern count
- [ ] `.first()` convention documented in Conventions block
- [ ] `USE_BACKEND=1` command documented
- [ ] `helpers/` directory in structure diagram
- [ ] All 20 E2E tests still pass (no code changes)

## Work Log

| Date       | Action                                                                     | Outcome                         |
| ---------- | -------------------------------------------------------------------------- | ------------------------------- |
| 2026-02-24 | Flagged by agent-native-reviewer                                           | P2 — agent discoverability gaps |
| 2026-02-24 | Fixed all 4 gaps: stale count, .first() convention, USE_BACKEND, structure | Fixed — 20/20 pass              |
