---
title: 'PR #73 Code Review Round 6: Cache-as-Primary-Store, Non-Atomic Persistence, API Coverage Gaps (23 Findings)'
category: security-issues
tags:
  - code-review
  - round-6
  - cache-anti-pattern
  - data-persistence
  - non-atomic-writes
  - payment-data-loss
  - lightning-invoices
  - receipts
  - subscriptions
  - webhook-performance
  - auth-middleware
  - api-coverage
  - dependency-injection
  - pr73
module:
  - backend-payment-services
  - backend-lightning-service
  - backend-receipt-service
  - backend-subscription-service
  - backend-persistence-layer
  - backend-middleware
  - backend-api-endpoints
severity: critical
symptoms:
  - 'In-memory Maps used as source of truth with no persistence fallback'
  - 'Non-atomic file writes (writeFileSync) = data loss on crash'
  - 'Invoice status mutated before persistence write'
  - 'O(n) webhook scanning via linear search'
  - 'New Puppeteer browser instance per receipt (500ms-2s, 100MB each)'
  - 'Dual DI system: inversify decorators ignored by custom container'
  - 'Auth middleware inconsistent: mixed next(error) and res.status().json()'
  - 'Only 54% of capabilities exposed via API (22/41)'
root_cause: 'Architecture decisions favor rapid iteration over durability; DI container not fully utilized; API coverage never completed after service layer built'
solution_verified: false
date_found: '2026-02-14'
solving_agent: '10 parallel review agents (security-sentinel, performance-oracle, architecture-strategist, pattern-recognition, kieran-typescript, code-simplicity, agent-native, data-integrity-guardian, git-history-analyzer, deployment-verification)'
related_issues:
  - 'PR #73 (194 files, +30K/-12K, 12 commits)'
  - 'Todos 112-134 (23 new findings)'
  - 'Prior rounds: infrastructure-sprint, p2-remediation-25, p1-critical-round4, p2-deferred-fixes'
---

# PR #73 Code Review Round 6: Cache-as-Primary-Store, Non-Atomic Persistence, API Coverage Gaps

## Problem Statement

After 5 prior review rounds that fixed 86 findings, Round 6 expanded scope from diff-focused to full-file audits across security-critical domains (payment, auth, Lightning). This revealed 23 pre-existing architectural issues — 7 P1 critical data loss risks, 11 P2 important fixes, and 5 P3 nice-to-haves — that prior diff-focused reviews missed entirely.

The dominant pattern: **cache-as-primary-store** across 3 payment services (Lightning invoices, receipts, subscriptions) where in-memory Maps are the only data store with no persistence fallback.

## Review Methodology

**10 parallel review agents** analyzed the full 194-file PR:

| Agent                   | Focus                                  | Key Findings                                               |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------- |
| Security Sentinel       | Auth bypasses, hardcoded secrets       | Auth middleware bypass, hardcoded receipt signing secret   |
| Performance Oracle      | Resource usage, algorithmic complexity | Puppeteer per receipt, O(n) webhook scan, unbounded caches |
| Architecture Strategist | System design, patterns                | Dual DI system, response envelope inconsistency, mock DB   |
| Pattern Recognition     | Recurring anti-patterns                | Cache-as-store across 3 services                           |
| Kieran TypeScript       | Type safety, compile errors            | ServiceError invalid options, (req as any) casts           |
| Code Simplicity         | Dead code, duplication                 | Dead error classes, duplicate shutdown handlers            |
| Agent-Native            | API accessibility                      | 54% coverage (22/41 capabilities)                          |
| Data Integrity Guardian | Persistence, transactions              | Non-atomic writes, premature mutations, no transactions    |
| Git History Analyzer    | Commit patterns                        | Fix-on-fix cycles, recommends squash merge                 |
| Deployment Verification | Deploy safety                          | Pre/post-deploy checklist generated                        |

## Findings: 8 Meta-Patterns

### 1. Cache-as-Primary-Store (Todos 112, 113, 114)

Three payment services use in-memory Maps as the sole data store:

- **Lightning invoices** (`lightning-service.ts`): `invoiceCache` (TTLCache, 1h TTL, 10k max) is the ONLY lookup source. Evicted invoices return "not found" — incoming payments silently lost.
- **Receipts** (`receipt-service.ts`): `receiptStorage = new Map<string, PaymentReceipt>()` with zero persistence. Restart = all receipts gone.
- **Payment persistence** (`payment-persistence.ts`): `writeFileSync` without temp+rename. Crash mid-write corrupts JSON; `loadFromDisk` silently starts empty.

**Cross-agent consensus**: Flagged independently by Performance, Architecture, Data Integrity, and Pattern Recognition agents.

### 2. Non-Atomic State Changes (Todos 115, 116)

- **Premature mutation** (`lightning-service.ts:589`): `invoice.status = 'paid'` BEFORE `savePayment()`. If persistence fails, in-memory state shows 'paid' but no record persisted.
- **Non-atomic subscription** (`subscription-management-service.ts:380-434`): 4 sequential DB operations (insert subscription, create payment, generate invoice, update count) without transaction. Partial failure = orphaned records.

### 3. Resource Exhaustion (Todos 117, 118)

- **Puppeteer per receipt** (`receipt-service.ts:339-352`): New browser instance per PDF. 10 concurrent receipts = 1-2GB RAM + 5-20s.
- **O(n) webhook scan** (`lightning-service.ts:580-582`): `[...this.invoiceCache.values()].find()` copies 10k entries and scans linearly per webhook.

### 4. Incomplete API Surface (Todos 119, 120)

- **User relationships**: 13/15 `UserRelationshipService` methods have no route (block, mute, getFollowers, etc.)
- **Payments**: Missing transaction history, balance, webhook CRUD, invoice list, retry endpoints. Validators exist without routes.

### 5. Inconsistent Error Handling (Todo 121)

`authenticate()` correctly uses `next(error)`, but `authorize()` and `requireNostrSignature()` write `res.status().json()` directly — bypassing centralized error handler. Auth errors lack requestId, timestamp, and consistent error codes.

### 6. Response Envelope Mismatch (Todo 122)

`ContentController` returns `{ success, data, metadata: { requestId, timestamp, processingTime } }`. `PaymentController` and `UserController` return only `{ success, data }` without metadata. Machine clients cannot rely on consistent shape.

### 7. Dual DI System (Todo 127)

Controllers use inversify `@injectable()` and `@inject(TYPES.X)` decorators, but actual container is custom `ServiceContainer` that ignores inversify metadata. Constructor injection works by accident, not design.

### 8. Dead Code & Compile Errors (Todos 128, 129)

- 4 unused error classes + dead `handleUnhandledRejections()` in error-handler-middleware.ts
- `ServiceError` constructed with invalid options in ContentCreationService.ts (compile error)

## Why Prior Rounds Missed These

| Round | Scope                        | What It Caught                                          | What It Missed                |
| ----- | ---------------------------- | ------------------------------------------------------- | ----------------------------- |
| 1-3   | Diff-focused                 | 18 findings (regressions)                               | All pre-existing issues       |
| 4     | Full-file (auth/payment)     | 4 P1 (privilege escalation, JWT, persistence, imports)  | Deeper cache-as-store pattern |
| 5     | Diff + fixes                 | 25 P2 (dead code, consolidation)                        | Non-atomic writes, API gaps   |
| **6** | **Full-file + architecture** | **23 new (cache-as-store, transactions, API coverage)** | —                             |

**Key insight**: Diff reviews catch regressions. Full-file reviews catch pre-existing issues. Architecture reviews catch systemic patterns. Round 6 succeeded because it combined all three.

## Prevention Strategies

### Immediate Rules (Add to Review Checklists)

1. **Cache-as-Store**: Every cache storing durable data must have a documented, tested persistence layer
2. **Atomic Writes**: All durable file writes must use temp+rename pattern
3. **Persist-First**: Never mutate in-memory state before successful persistence
4. **API Completeness**: Every service must have REST endpoints or be marked `@Internal`
5. **Error Consistency**: All errors thrown via `next(error)`, never caught inline with `res.status().json()`
6. **Single DI**: One DI pattern per codebase — pick one, enforce in review
7. **RCA for Re-fixes**: Every fix requires documented root cause. Re-fixes require architect audit
8. **Full-File for Security**: Auth/payment/crypto PRs require full-file audit, not just diff review

### Detection Automation

| Anti-Pattern       | Detection Method                                                             |
| ------------------ | ---------------------------------------------------------------------------- |
| Cache-as-store     | Grep: `new Map\|TTLCache` without `persistence\|persist\|save` in same class |
| Non-atomic writes  | Grep: `writeFileSync` without `renameSync` in same function                  |
| Premature mutation | Code pattern: assignment before `await` without try/catch rollback           |
| Missing endpoints  | CI: Compare service class count vs route file count                          |
| Error bypass       | Grep: `res.status.*json` in middleware files (should use `next()`)           |

## Cumulative Review Statistics (6 Rounds)

| Metric                         | Value             |
| ------------------------------ | ----------------- |
| Total findings across 6 rounds | 116               |
| Fixed in prior rounds          | 86                |
| New in Round 6                 | 23                |
| Still pending (all rounds)     | 38                |
| Review agents used (Round 6)   | 10                |
| Files in PR                    | 194               |
| Lines changed                  | +30,325 / -12,229 |

## Todo Files Created

**P1 Critical (7):** 112-118
**P2 Important (11):** 119-129
**P3 Nice-to-Have (5):** 130-134

All files in `/todos/` with full problem statements, proposed solutions, and acceptance criteria.

## Related Documentation

- [Infrastructure Sprint (2026-02-12)](../../infrastructure-issues/infrastructure-sprint-software-factory-first.md)
- [PR #73 Initial Review](./pr73-code-review-remediation.md)
- [P1 Critical Fixes Round 4](./p1-critical-fixes-pr73-round4.md)
- [P2 Remediation Sprint: 25 Findings](./p2-remediation-sprint-25-findings.md)
- [P2 Deferred Fixes](../architecture-issues/p2-deferred-fixes-type-safety-di-api-coverage.md)
- [P1 Prevention Strategies](./P1-037-043-prevention-strategies.md)

## Key Takeaway

The real problem wasn't code — it was review process. Single-pass diff reviews are ~15x less effective than full-file + architecture + data-flow-tracing reviews for security-critical domains. Round 6 proved that expanding review scope from "what changed" to "what exists in touched domains" reveals an entirely different class of issues.
