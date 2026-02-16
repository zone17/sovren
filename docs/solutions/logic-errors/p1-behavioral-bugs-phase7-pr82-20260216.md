---
module: System
date: 2026-02-16
problem_type: logic_error
component: service_object
symptoms:
  - "GDPR deletion could fail mid-operation leaving orphaned wellness data across 4 tables"
  - "Concurrent alert status updates corrupt state machine via TOCTOU race"
  - "Work pattern upsert silently overwrites previous sessions instead of accumulating"
  - "BurnoutScoringService returns fake healthy scores when database is unreachable"
resolution_type: code_fix
root_cause: logic_error
severity: critical
tags: [p1-fixes, atomicity, toctou, race-condition, upsert-semantics, error-handling, supabase-rpc, plpgsql, phase-7, pr-82]
---

# Troubleshooting: 5 P1 Behavioral Bugs in Phase 7 Creator Safety Net

## Problem

Phase 7 PR #82 (90 new files, 24 endpoints) passed all structural gate checks (compiles, lints, endpoints exist) but contained 5 P1 critical behavioral bugs caught only during post-sprint `/workflows:review`. All 5 bugs involved correct structure with incorrect runtime behavior.

## Environment
- Module: WellnessService, AlertService, BurnoutScoringService
- Stack: Node.js + TypeScript + Supabase
- Affected Component: Backend service layer (packages/backend/src/services/)
- Date: 2026-02-16

## Symptoms
- GDPR deletion (deleteAllWellnessData) used 4 sequential `.delete()` calls without transaction — partial deletion on failure
- Alert status update (updateAlertStatus) used read-then-write pattern — TOCTOU race under concurrent requests
- Work pattern recording (recordWorkPattern) used `.upsert()` which replaced entire row — second session same day erased first
- Burnout scoring (calculateScore) caught DB errors and returned default "low risk" — callers couldn't distinguish "no data" from "DB down"
- v2 routes appeared unmounted (actually were mounted — false positive in review)

## What Didn't Work

**Sprint Gate 2 (Structural Checks):** All 7 structural checks passed — code compiled, linted, endpoints existed, tests present. But none of the checks verified *behavioral correctness* (atomicity, concurrency, merge semantics, error propagation).

**Root cause of gate gap:** Gate 2 checked "does the code exist and compile?" but not "does the code behave correctly under real conditions?"

## Solution

5 targeted fixes executed in parallel via `/resolve_todo_parallel`:

### Fix 1: Atomic GDPR Deletion (Todo 148)

**Before (broken):**
```typescript
// 4 sequential deletes — if 3rd fails, first 2 are already committed
await this.db.from('wellness_snapshots').delete().eq('creator_id', creatorId);
await this.db.from('creator_work_patterns').delete().eq('creator_id', creatorId);
await this.db.from('burnout_risk_history').delete().eq('creator_id', creatorId);
await this.db.from('creator_boundaries').delete().eq('creator_id', creatorId);
```

**After (fixed):**
```typescript
// Single RPC call — PL/pgSQL function wraps all DELETEs in one transaction
const { data, error } = await this.db.rpc('delete_all_wellness_data', {
  p_creator_id: creatorId,
});
if (error) {
  throw new Error(
    `GDPR deletion failed for creator ${creatorId}: ${error.message}. No data was deleted.`
  );
}
```

```sql
-- PL/pgSQL: all statements execute in single transaction
CREATE OR REPLACE FUNCTION delete_all_wellness_data(p_creator_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_snapshots INT; v_patterns INT; v_history INT; v_boundaries INT;
BEGIN
  DELETE FROM wellness_snapshots WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_snapshots = ROW_COUNT;
  DELETE FROM creator_work_patterns WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_patterns = ROW_COUNT;
  DELETE FROM burnout_risk_history WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_history = ROW_COUNT;
  DELETE FROM creator_boundaries WHERE creator_id = p_creator_id;
  GET DIAGNOSTICS v_boundaries = ROW_COUNT;
  RETURN jsonb_build_object(
    'wellness_snapshots', v_snapshots, 'creator_work_patterns', v_patterns,
    'burnout_risk_history', v_history, 'creator_boundaries', v_boundaries
  );
END; $$;
```

### Fix 2: TOCTOU Race — Atomic Conditional Update (Todo 149)

**Before (broken):**
```typescript
// Read current status, validate, then write — race window between read and write
const { data: alert } = await this.db.from('content_alerts').select('status').eq('id', alertId).single();
if (ALERT_STATUS_TRANSITIONS[alert.status]?.includes(newStatus)) {
  await this.db.from('content_alerts').update({ status: newStatus }).eq('id', alertId);
}
```

**After (fixed):**
```typescript
// Reverse-lookup: compute which statuses CAN transition to newStatus
const validFromStatuses: AlertStatus[] = [];
for (const [from, allowed] of Object.entries(ALERT_STATUS_TRANSITIONS)) {
  if (allowed.includes(newStatus)) validFromStatuses.push(from as AlertStatus);
}

// Single atomic update — database enforces the condition
const { data, error } = await this.db
  .from('content_alerts')
  .update({ status: newStatus, updated_at: now })
  .eq('id', alertId)
  .eq('creator_id', creatorId)
  .in('status', validFromStatuses)  // Atomic: only matches valid source states
  .select().single();

if (!data) {
  // Diagnostic read to return helpful error (NotFound vs Conflict)
  const { data: existing } = await this.db.from('content_alerts')
    .select('status').eq('id', alertId).eq('creator_id', creatorId).single();
  if (!existing) throw new NotFoundError(`Alert ${alertId}`);
  throw new ConflictError(`Cannot transition from '${existing.status}' to '${newStatus}'`);
}
```

### Fix 3: Accumulate Upsert via RPC (Todo 150)

**Before (broken):**
```typescript
// .upsert() replaces entire row — second session same day erases first
await this.db.from('creator_work_patterns').upsert({
  creator_id: creatorId, date: inputDate, duration_mins: input.duration_mins
});
```

**After (fixed):**
```typescript
// RPC with ON CONFLICT DO UPDATE accumulates durations
const { data, error } = await this.db.rpc('upsert_work_pattern', {
  p_creator_id: creatorId,
  p_date: input.timestamp.split('T')[0],
  p_content_time_mins: input.type === 'content_creation' ? input.duration_mins : 0,
  p_engagement_time_mins: input.type === 'engagement' ? input.duration_mins : 0,
  p_management_time_mins: input.type === 'management' ? input.duration_mins : 0,
  p_post_count: input.type === 'content_creation' ? 1 : 0,
  p_activity_at: input.timestamp,
});
```

```sql
-- ON CONFLICT accumulates instead of replacing
INSERT INTO creator_work_patterns (...) VALUES (...)
ON CONFLICT (creator_id, date) DO UPDATE SET
  content_time_mins = creator_work_patterns.content_time_mins + EXCLUDED.content_time_mins,
  engagement_time_mins = creator_work_patterns.engagement_time_mins + EXCLUDED.engagement_time_mins,
  management_time_mins = creator_work_patterns.management_time_mins + EXCLUDED.management_time_mins,
  post_count = creator_work_patterns.post_count + EXCLUDED.post_count,
  first_activity_at = LEAST(creator_work_patterns.first_activity_at, EXCLUDED.first_activity_at),
  last_activity_at = GREATEST(creator_work_patterns.last_activity_at, EXCLUDED.last_activity_at)
RETURNING *;
```

### Fix 4: Error Propagation (Todo 151)

**Before (broken):**
```typescript
// Catches DB error, returns default — caller thinks "no data yet" when DB is down
try {
  const { data } = await this.db.from('creator_work_patterns').select('*');
  return data || [];
} catch (error) {
  return []; // Silent failure — fake "healthy" burnout score
}
```

**After (fixed):**
```typescript
// Destructure error, check, log with context, re-throw
const { count: totalDays, error: countError } = await this.db
  .from('creator_work_patterns')
  .select('*', { count: 'exact', head: true })
  .eq('creator_id', creatorId);

if (countError) {
  this.logger.error('Failed to fetch work pattern count for burnout scoring', {
    error: countError instanceof Error ? countError.message : String(countError),
    creatorId,
  });
  throw countError;
}
```

Pattern applied to all 5 Supabase operations in BurnoutScoringService.

### Fix 5: v2 Routes (Todo 147)

Verified routes were already mounted at `app.ts:14` (import) and `app.ts:213` (mount). No code change needed — false positive from review agent.

## Why This Works

1. **Atomic transactions**: PL/pgSQL functions execute all statements in a single transaction. If any statement fails, the entire function rolls back. Supabase JS client doesn't support server-side transactions, so RPC is the correct pattern.

2. **Atomic conditional updates**: `.update().in('status', validFromStatuses)` makes the WHERE clause include the state check. The database evaluates condition and performs update as a single atomic operation — no gap between check and write.

3. **ON CONFLICT DO UPDATE with accumulation**: `existing + EXCLUDED.new` sums values instead of replacing them. `LEAST`/`GREATEST` maintain correct time boundaries across multiple sessions.

4. **Error destructuring and re-throw**: Supabase returns `{ data, error }` — explicit check of `error` field with logging and re-throw ensures callers get 5xx (not fake 2xx with default data) when the database is unreachable.

## Prevention

### Team-Builder Gate Improvements (Already Implemented)

Added 6 behavioral correctness rules to backend brief (`~/.claude/skills/team-builder/briefs/backend.md`) and 6 behavioral checks to Gate 2 (`~/.claude/skills/team-builder/gates/gate-2-implementation-done.md`):

| Gate Check | Prevents | Pattern |
|------------|----------|---------|
| Check 8: Route mounting | Todo 147 | Grep route files vs app.ts imports |
| Check 9: Error handling | Todo 151 | Grep catch blocks for return-without-throw |
| Check 10: Transactions | Todo 148 | Grep for 2+ `.delete()`/`.insert()` in same function |
| Check 11: No data loss | In-memory Maps | Grep for `new Map()` storing business data |
| Check 12: Concurrency | Todo 149 | Grep for `.select()` then `.update()` on same table |
| Check 13: Type safety | ServiceToken<any> | Count `as any` occurrences |

### Code-Level Prevention
- Use Supabase RPC for any multi-table write operation
- Use `.in('status', validStatuses)` instead of read-then-write for state machines
- Use `ON CONFLICT DO UPDATE SET field = field + new` for metrics/counters
- Never catch-and-return-default for database operations — always re-throw

### Testing-Level Prevention
- Write concurrent request tests for any state machine update
- Write multi-submission tests for any upsert on numeric fields
- Write DB-failure propagation tests for any service with Supabase calls

## Related Issues

- See also: [structural-gates-miss-behavioral-p1s-team-builder-20260215.md](../workflow-issues/structural-gates-miss-behavioral-p1s-team-builder-20260215.md) — Gate improvement analysis
- See also: [phase7-review-gap-analysis-5-p1s-in-90-files.md](../process-issues/phase7-review-gap-analysis-5-p1s-in-90-files.md) — Root cause analysis of why 5 P1s passed gates
- See also: [p1-critical-fixes-pr73-round4.md](../security-issues/p1-critical-fixes-pr73-round4.md) — Previous P1 fixes (PR #73) with similar patterns
- See also: [p2-remediation-sprint-25-findings.md](../security-issues/p2-remediation-sprint-25-findings.md) — Bulk remediation patterns
