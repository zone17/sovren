---
status: pending
priority: p3
issue_id: 804
tags: [cleanup, e2e, dead-code]
dependencies: []
---

# Delete 9 Duplicate " 2" E2E Files

## Problem Statement
9 macOS duplicate files with " 2" suffix exist in the e2e directory. These are never matched by Playwright's regex test matchers and are dead artifacts.

## Findings
The following files are macOS copy artifacts (created by Finder "Duplicate" action):
- Various `*.spec 2.ts` and `*.page 2.ts` files in packages/frontend/e2e/
- Never matched by Playwright config (`*.auth.spec.ts`, `*.public.spec.ts` patterns)
- Zero test coverage impact — purely dead files
- Take up space and create confusion

## Proposed Solutions

### Option A: Delete all (Recommended)
```bash
find packages/frontend/e2e -name "* 2.*" -delete
```
- Pros: Clean, simple
- Effort: Tiny
- Risk: None

## Acceptance Criteria
- [ ] All " 2" duplicate files deleted
- [ ] No E2E tests break after deletion

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | macOS artifacts, zero impact |
