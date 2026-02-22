---
status: complete
priority: p2
issue_id: 460
tags: [code-review, dry, quality]
dependencies: []
---

# P2: MAX_PORTFOLIO_URLS duplicated in two methods

## Problem Statement

`MAX_PORTFOLIO_URLS = 20` is declared as a local `const` inside both `createListing` (line 122) and `updateListing` (line 238) in `MarketplaceService.ts`. This violates DRY — if the limit changes, both must be updated independently.

## Findings

- Duplicate constant at lines 122 and 238
- Other constants like `ESCROW_EXPIRE_DAYS` and `MAX_PAYOUT_ATTEMPTS` are already module-level
- Flagged independently by Pattern, Architecture, and Performance reviewers

Source: Pattern recognition, Architecture strategist, Performance oracle (PR #93)

## Proposed Solutions

### Option A: Hoist to module-level constant (Recommended)
Move `MAX_PORTFOLIO_URLS` to the top of the file alongside `VALID_SERVICE_TYPES`, `ESCROW_EXPIRE_DAYS`, etc.
- Pros: Single source of truth, follows existing pattern
- Cons: None
- Effort: Small (1 line change)
- Risk: None

## Recommended Action

Option A

## Technical Details

- **Affected files**: `packages/backend/src/services/community/MarketplaceService.ts`

## Acceptance Criteria

- [ ] `MAX_PORTFOLIO_URLS` declared once at module level
- [ ] Both `createListing` and `updateListing` reference the module-level constant
- [ ] Tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from PR #93 review | 3 reviewers independently flagged this |

## Resources

- PR #93: https://github.com/zone17/sovren/pull/93
