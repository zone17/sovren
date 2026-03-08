---
status: pending
priority: p1
issue_id: '727'
tags: [code-review, slice-8, backend, data-integrity, community]
dependencies: [721]
---

# Mentorship capacity counts wrong status (data integrity)

## Problem Statement

`MentorshipService` enforces a mentor's capacity limit by counting how many mentees have `status = 'active'`. This excludes `'pending'` requests — meaning a mentor who has accepted their maximum number of active mentees can still receive unlimited pending requests, all of which can be accepted simultaneously, causing the mentor's active mentee count to exceed the declared capacity. This is a data integrity / business logic defect.

**Agent consensus: data integrity**

## Findings

In `packages/backend/src/services/community/MentorshipService.ts`, the capacity check looks similar to:

```typescript
// WRONG — only counts active, misses pending
const { count } = await this.db
  .from('mentorships')
  .select('id', { count: 'exact', head: true })
  .eq('mentor_id', mentorId)
  .eq('status', 'active');

if (count >= mentor.max_mentees) {
  throw new Error('Mentor has reached capacity');
}
```

A sequence that exploits this:

1. Mentor sets `max_mentees = 3`, has 3 active mentees (at capacity)
2. 5 users submit pending mentorship requests (capacity check passes because only 3 active are counted)
3. Mentor accepts all 5 pending requests simultaneously or in rapid succession
4. Result: mentor now has 8 active mentees instead of the declared maximum of 3

## Proposed Solutions

Change the capacity filter to count both `'active'` AND `'pending'` statuses:

```typescript
// CORRECT — counts active + pending to prevent over-acceptance
const { count, error } = await this.db
  .from('mentorships')
  .select('id', { count: 'exact', head: true })
  .eq('mentor_id', mentorId)
  .in('status', ['active', 'pending']);

if (error) throw new DatabaseError('Failed to check mentor capacity', error);
if ((count ?? 0) >= mentor.max_mentees) {
  throw new AuthorizationError('Mentor has reached capacity');
}
```

This ensures that pending requests consume capacity slots, preventing the over-acceptance scenario.

## Technical Details

- Affected file: `packages/backend/src/services/community/MentorshipService.ts`
- The capacity check may appear in multiple methods: `requestMentorship()` and potentially `updateMentorshipStatus()` (when accepting a pending request) — fix both if present
- Use `.in('status', ['active', 'pending'])` not two separate `.eq()` calls (Supabase `.eq()` chaining ANDs conditions, not ORs)
- The fix depends on #721 being resolved so that `mentorId` is a proper UUID
- Consider whether a `SERIALIZABLE` transaction or `SELECT FOR UPDATE` is needed to prevent TOCTOU between the count check and the accept — this is a lighter-weight concern than the filter bug but worth noting

## Acceptance Criteria

- [ ] Capacity check uses `.in('status', ['active', 'pending'])` in all relevant methods
- [ ] Unit test: mentor at `max_mentees = 2` with 2 pending requests cannot accept a third request (returns 403/capacity error)
- [ ] Unit test: mentor at `max_mentees = 2` with 1 active + 1 pending cannot accept a second pending request
- [ ] Unit test: mentor with capacity remaining can accept a pending request
- [ ] Existing tests that assumed only `active` is counted are updated to reflect the correct behavior
- [ ] Error thrown is `AuthorizationError` (403), not a generic `Error`
