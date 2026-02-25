---
status: complete
priority: p2
issue_id: '505'
tags:
  - code-review
  - e2e-review
  - documentation-gap
  - agent-native
  - claude-md
dependencies: []
---

# P2: CLAUDE.md E2E agent discoverability gaps

## Problem Statement

The agent-native reviewer scored E2E discoverability at 6-7/10 across 4 areas. Agents building new E2E specs lack guidance on POM structure, auth setup chain, credential enumeration, and USE_BACKEND context. These gaps cause agents to reinvent patterns or ask clarifying questions.

## Findings

**Location:** `CLAUDE.md` — Playwright E2E Testing section

**Agent-native reviewer scores (out of 10):**

| Capability                  | Score | Gap                                                                       |
| --------------------------- | ----- | ------------------------------------------------------------------------- |
| Create new POM              | 7/10  | No template showing constructor + locator + action method pattern         |
| Understand auth setup chain | 6/10  | Setup → storage state → project dependency chain not documented           |
| Know credential usage       | 6/10  | Doesn't enumerate available credentials (CREATOR, TEST_USER, SIGNUP_USER) |
| Know USE_BACKEND=1          | 7/10  | Command listed but no explanation of what changes (real auth vs demo)     |

## Proposed Solutions

### Option A: Expand CLAUDE.md E2E section (Recommended)

Add 4 targeted additions to the existing Playwright E2E Testing section:

1. **POM template**: Show minimal POM with constructor locators + goto() + action method
2. **Auth chain**: Diagram showing setup project → storageState save → authenticated project dependency
3. **Credentials**: List CREATOR_CREDENTIALS, TEST_USER, SIGNUP_USER with their purpose
4. **USE_BACKEND**: Explain that it starts real backend + uses real auth (not demo redirect)

**Pros:** Centralizes all E2E guidance in one place agents already read
**Cons:** CLAUDE.md grows slightly
**Effort:** Small (20-30 lines added)
**Risk:** None

### Option B: Create separate E2E guide document

**Pros:** Keeps CLAUDE.md concise
**Cons:** Agents may not read a separate file unless told to; reduces discoverability
**Effort:** Medium
**Risk:** Low but reduces the discoverability it's trying to improve

## Recommended Action

Option A — expand inline in CLAUDE.md.

## Technical Details

- **Affected files:** `CLAUDE.md`
- **Existing section:** Lines starting with "### Playwright E2E Testing"

## Acceptance Criteria

- [ ] POM template with constructor + locator + goto() + action method documented
- [ ] Auth setup chain (setup → storageState → authenticated project) documented
- [ ] Available credentials enumerated with their purposes
- [ ] USE_BACKEND=1 behavior explained (real backend, real auth vs demo)
- [ ] Agent-native discoverability improves to 8+/10 on rescore

## Work Log

| Date       | Action                                                                                                                                         | Result   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-02-24 | Created from agent-native review (4 gaps at 6-7/10)                                                                                            | Pending  |
| 2026-02-24 | Fixed: added auth chain, credentials table, POM template, beforeEach convention, locator centralization, import order, USE_BACKEND explanation | Complete |

## Resources

- Review: P2/P3 cleanup review of commits 14d0dd1..2eff87b
- Related: [E2E Review P2/P3 Cleanup Sprint](../docs/solutions/code-quality/e2e-review-p2p3-cleanup-sprint-20260224.md)
- Related: Todo #502 (prior CLAUDE.md gaps — fixed)
