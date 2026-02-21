---
status: pending
priority: p3
issue_id: 396
tags:
  - code-review
  - testing
  - security
dependencies: []
---

# SSRF Utility Needs Specification-Based Test Suite

## Problem Statement

Git history shows the SSRF utility (ssrf.ts) was modified in 4 separate commits, each adding a new bypass prevention. This pattern indicates gap-based testing (find bypass, add test) rather than specification-based testing (define all expected behaviors, test all). A comprehensive spec-based test suite would catch bypass vectors proactively instead of reactively.

## Findings

**Source agents:** git-history-agent, security-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/utils/__tests__/ssrf.test.ts`
- Issue: Test suite grew incrementally with each bypass discovery rather than being designed from a complete threat model. This means there may be untested bypass vectors that haven't been discovered yet.
- File: `packages/backend/src/utils/ssrf.ts`
- Issue: Implementation evolved reactively across 4 commits, suggesting the SSRF prevention may still have gaps that a specification-based approach would cover.

## Proposed Solutions

### Option A: OWASP-based comprehensive test suite

- **Approach:** Rewrite the SSRF test suite using the OWASP SSRF Prevention Cheat Sheet as the specification. Create test categories for every known bypass vector class: decimal IPs, octal IPs, IPv6 mappings, DNS rebinding, URL encoding tricks, redirect chains, alternate URL schemes, and more. Each category gets its own describe block with exhaustive test cases.
- **Effort:** Medium
- **Risk:** Low (tests only, no implementation changes unless gaps found)

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/utils/__tests__/ssrf.test.ts` (rewrite/expand)
- `packages/backend/src/utils/ssrf.ts` (fix any gaps found)

## Acceptance Criteria

- [ ] Test suite organized by OWASP SSRF bypass vector categories
- [ ] Decimal IP bypass vectors tested (e.g., 2130706433 for 127.0.0.1)
- [ ] Octal IP bypass vectors tested (e.g., 0177.0.0.1)
- [ ] IPv6 mapping bypass vectors tested (e.g., ::ffff:127.0.0.1, [::1])
- [ ] DNS rebinding scenarios documented (even if not fully testable in unit tests)
- [ ] URL encoding trick bypass vectors tested (e.g., %31%32%37%2e%30%2e%30%2e%31)
- [ ] Redirect chain handling tested
- [ ] Any new bypass vectors discovered during spec review are fixed in ssrf.ts
- [ ] Test suite references OWASP cheat sheet as source specification

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
- OWASP SSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
