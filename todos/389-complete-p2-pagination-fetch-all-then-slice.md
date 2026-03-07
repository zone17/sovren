---
status: pending
priority: p2
issue_id: '406'
tags: [code-review, performance, architecture, pr-87]
dependencies: []
---

# Pagination fetches all rows then slices in-memory (10 endpoints)

## Problem Statement

All 10 newly-paginated endpoints use a "fetch everything from DB, then `.slice(offset, offset + limit)`" pattern. This means even when the client requests `?limit=10&offset=0`, the server loads the entire dataset from Supabase into Node memory before discarding 99%+ of it.

For small datasets (<100 rows) this is acceptable. As the platform scales, endpoints like `/circles`, `/mentorship/mentors`, `/business/invoices`, and `/business/tax/expenses` could grow to thousands of rows per creator. At that point this pattern causes:

- Unnecessary DB-to-server data transfer
- High memory pressure on Node process
- Increased latency proportional to total dataset size, not page size

## Findings

- **10 endpoints affected** across 7 route files:
  - `business-contracts.routes.ts` (templates, contracts)
  - `business-invoices.routes.ts` (invoices)
  - `business-tax.routes.ts` (expenses, categories)
  - `circles.routes.ts` (circles, circle posts)
  - `collaboration.routes.ts` (collaborators)
  - `mentorship.routes.ts` (mentors, my-mentorships)
- All use identical pattern: `const data = await service.getAll(...)` then `data.slice(offset, offset + limit)`
- The underlying service methods (`getContracts()`, `getCircles()`, etc.) do not accept limit/offset parameters
- The PR description correctly identifies this as "#382: Pagination support" but the implementation is application-level, not database-level
- This is a known trade-off documented in the original P2 finding — the intent was to add the API contract (limit/offset params + paginated response shape) now, with DB-level pagination as a follow-up

## Proposed Solutions

### Option 1: Accept as-is, defer DB-level pagination

**Approach:** Keep the current `.slice()` pagination. The API contract (limit/offset query params, `{items, total, limit, offset}` response shape) is correct and forward-compatible. When any endpoint's dataset grows beyond ~500 rows, push pagination into the service/repository layer.

**Pros:**

- Zero risk of breaking existing functionality
- API contract is already correct — clients won't need to change
- Matches the intent of the original P2 finding

**Cons:**

- Performance ceiling for large datasets
- Technical debt that needs tracking

**Effort:** 0 hours (no change needed now)

**Risk:** Low (small datasets currently)

---

### Option 2: Push limit/offset into Supabase queries now

**Approach:** Add `limit` and `offset` parameters to each service method (e.g., `getContracts(creatorId, { limit, offset })`), then use `.range(offset, offset + limit - 1)` in the Supabase query. Use `.count('exact')` for the total.

**Pros:**

- True server-side pagination
- O(page_size) memory and transfer, not O(total)
- Eliminates the performance ceiling

**Cons:**

- Requires changes to 10+ service methods and their interfaces
- Need to verify Supabase `.range()` + `.count('exact')` behavior with each query
- Larger scope than a P2 follow-up

**Effort:** 4-6 hours

**Risk:** Medium (touching service layer contracts)

## Recommended Action

Accept as-is for this PR. The API contract is correct and forward-compatible. Create a follow-up P3 todo to push pagination into the service layer when any endpoint exceeds ~500 rows.

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/business-contracts.routes.ts:56,153`
- `packages/backend/src/routes/v2/business-invoices.routes.ts:83`
- `packages/backend/src/routes/v2/business-tax.routes.ts:83,132`
- `packages/backend/src/routes/v2/circles.routes.ts:68,164`
- `packages/backend/src/routes/v2/collaboration.routes.ts:136`
- `packages/backend/src/routes/v2/mentorship.routes.ts:91,110`

## Acceptance Criteria

- [ ] Decision documented: accept current pattern or refactor
- [ ] If accepted: follow-up P3 todo created for DB-level pagination
- [ ] If refactored: service methods accept limit/offset, use Supabase `.range()`

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

**Actions:**

- Identified fetch-all-then-slice pattern across 10 endpoints
- Verified services do not currently accept pagination params
- Confirmed API response shape is forward-compatible

**Learnings:**

- Application-level pagination is acceptable for API contract establishment
- The real risk is if this becomes permanent without a follow-up plan

## Resources

- **PR:** #87
- **Original finding:** Todo #382 (missing-pagination-10-endpoints)
