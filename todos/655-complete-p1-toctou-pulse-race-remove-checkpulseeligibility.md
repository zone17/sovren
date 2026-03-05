---
status: complete
priority: p1
issue_id: 655
tags: [code-review, security, toctou, p1]
dependencies: []
---

## Problem Statement

The wellness pulse recording flow has a classic TOCTOU (Time-Of-Check-To-Time-Of-Use) race condition. The route calls `checkPulseEligibility()` (SELECT COUNT) followed by `recordPulse()` (INSERT) as two separate round-trips with no atomicity guarantee. Concurrent requests can both pass the eligibility check and attempt to insert, relying solely on the DB UNIQUE constraint to catch the second insert via error code 23505. The pre-check is redundant, adds latency, and exposes a TOCTOU surface. Additionally, the eligibility check uses a UTC boundary without an upper bound, and ConflictError may not map to HTTP 409 in the global error handler.

## Findings

**Consensus**: 5/8 agents (pattern-recognition, security-sentinel, data-integrity-guardian, architecture-strategist, code-simplicity)

**Files**:

- `packages/backend/src/routes/v2/wellness.routes.ts:195-205`
- `packages/backend/src/services/wellness/WellnessService.ts:241-255`
- `packages/backend/src/interfaces/wellness/IWellnessService.ts:35`

1. **TOCTOU race**: Two concurrent POST /pulse requests from the same creator both call `checkPulseEligibility()`, both get count=0, both proceed to `recordPulse()`. The DB UNIQUE constraint catches the second, but the pre-check gives a false sense of safety and adds a wasted SELECT round-trip.

2. **Redundant getWellnessService() call**: The route may call `getWellnessService()` twice (once for eligibility, once for record). Should be called once and reused.

3. **UTC boundary mismatch**: `checkPulseEligibility()` filters `created_at >= today_utc_start` but has no upper bound. This is correct for "one per day" logic but the lack of upper bound means it scans all future rows too (minor perf issue).

4. **ConflictError -> 409 mapping**: If the global error handler doesn't map ConflictError to HTTP 409, the duplicate insert returns a generic 500 to the client instead of a meaningful 409.

5. **Public interface pollution**: `checkPulseEligibility` is on the public `IWellnessService` interface but is an internal implementation detail that should not be exposed to consumers.

## Proposed Solutions

### Option A: Remove Pre-Check Entirely (Recommended)

Delete `checkPulseEligibility()` from the route, interface, and service (or make it private). Let `recordPulse()` attempt the INSERT directly. Catch the 23505 unique violation and throw ConflictError. Verify the global error handler maps ConflictError to HTTP 409.

```typescript
// wellness.routes.ts — simplified
router.post('/pulse', requireCreator, async (req, res, next) => {
  try {
    const service = getWellnessService();
    const pulse = await service.recordPulse(req.user.id, req.body);
    res.status(201).json(createApiResponse(pulse));
  } catch (error) {
    next(error); // ConflictError -> 409 via global handler
  }
});

// WellnessService.ts — recordPulse catches 23505
async recordPulse(creatorId: string, data: RecordPulsePayload): Promise<WellnessPulse> {
  try {
    const { data: pulse, error } = await this.supabase
      .from('wellness_pulses')
      .insert({ creator_id: creatorId, ...data })
      .select()
      .single();
    if (error) throw error;
    return pulse;
  } catch (error: unknown) {
    if (isPostgresError(error) && error.code === '23505') {
      throw new ConflictError('Pulse already recorded today');
    }
    throw error;
  }
}
```

- **Pros**: Eliminates TOCTOU entirely. Removes redundant SELECT. Simplifies route. Cleans up interface.
- **Cons**: Loses the ability to give a "soft" pre-check response (e.g., UI polling eligibility before showing button). If needed, keep as a separate GET endpoint.
- **Effort**: Small (1-2 hours)
- **Risk**: Low — the DB constraint is already the real enforcement.

### Option B: Keep Pre-Check as Private + Add Error Handler Verification

Make `checkPulseEligibility()` private (remove from interface), keep it in the service for internal use or potential future GET endpoint, but remove it from the POST route flow. Still verify ConflictError -> 409 mapping.

- **Pros**: Preserves eligibility logic for potential reuse. Still eliminates TOCTOU in the write path.
- **Cons**: Dead code if never used elsewhere. Method still exists and could be re-added to the route by a future developer.
- **Effort**: Small (1 hour)
- **Risk**: Low

### Option C: Serializable Transaction Wrapping Both Calls

Wrap `checkPulseEligibility()` + `recordPulse()` in a SERIALIZABLE transaction so the check and insert are atomic.

- **Pros**: Eliminates TOCTOU without changing the code structure.
- **Cons**: SERIALIZABLE transactions have significant performance overhead and retry complexity. Overkill when the UNIQUE constraint already handles this.
- **Effort**: Medium (2-3 hours)
- **Risk**: Medium — serializable transactions can cause deadlocks under load.

## Recommended Action

<!-- To be filled by tech lead -->

## Technical Details

- **PostgreSQL error code 23505** = unique_violation. This is the standard way to detect duplicate inserts.
- **TOCTOU pattern**: This is the #1 recurring P1 class in this codebase (see MEMORY.md — 3 of 12 P1s in PR #86 R4 were TOCTOU). The canonical fix is always: remove the pre-check, let the DB constraint enforce, catch the violation error.
- **ConflictError mapping**: Check `packages/backend/src/middleware/error-handler.ts` for the error class -> HTTP status mapping. ConflictError should map to 409. If it maps to 500, that's a separate bug.
- **Interface change**: Removing `checkPulseEligibility` from `IWellnessService` is a breaking interface change. Check for any other consumers (DI bindings, tests) that reference it.
- See critical-patterns.md for TOCTOU patterns and the insert-then-verify approach.

## Acceptance Criteria

- [ ] `checkPulseEligibility()` removed from route POST /pulse flow
- [ ] `checkPulseEligibility()` removed from `IWellnessService` interface (or made private in service)
- [ ] `recordPulse()` catches PostgreSQL 23505 and throws ConflictError
- [ ] Global error handler maps ConflictError to HTTP 409 (verify, fix if needed)
- [ ] Route calls `getWellnessService()` only once
- [ ] Tests updated: remove eligibility pre-check test, add 23505 -> ConflictError test
- [ ] No regression in existing wellness pulse tests

## Work Log

<!-- Append entries as work progresses -->

## Resources

- critical-patterns.md (TOCTOU patterns)
- common-solutions.md #8 (insert-then-verify pattern from PR #86)
- [PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
- MEMORY.md: "TOCTOU is #1 recurring P1 class (3 of 12)"
