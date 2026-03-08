---
status: pending
priority: p2
issue_id: 733
tags: [code-review, slice-8, error-handling, error-classes, security, monitoring]
dependencies: []
---

# #733 - ValidationError Used for DB/Internal Errors Across 30+ Sites

## Problem Statement

Community services throw `ValidationError` (HTTP 400) for database failures and internal errors that should be `DatabaseError` or `InternalError` (HTTP 500). This misclassification breaks error monitoring (500s vs 400s), leaks internal state to clients, and sends incorrect signals to client-side error handling logic that may retry 400s differently than 500s.

## Findings

Single agent finding during Slice 8 Creator Network review. 30+ call sites affected.

Files with misclassified error throws:

- `services/community/CreatorCircleService.ts`
- `services/community/MentorshipService.ts`
- `services/community/FollowService.ts`
- `services/community/NotificationPersistenceService.ts`

Pattern observed:

```typescript
// WRONG — ValidationError is for user input validation failures (400)
if (error) throw new ValidationError('Failed to fetch circle members');

// CORRECT — DatabaseError/InternalError for infrastructure failures (500)
if (error) throw new DatabaseError('Failed to fetch circle members', { cause: error });
```

Impact:

- Error monitoring dashboards show 400s instead of 500s for DB outages
- Clients may not retry on 400 (treating it as a "bad request" they caused)
- Internal Supabase error messages may be included in ValidationError payloads (information leak)
- Security tools that alert on 5xx rates miss these failures

## Proposed Solutions

Audit all `catch` blocks and error throws in the four affected service files. Apply the error class selection matrix (common-solutions.md #24):

| Failure cause               |  Correct error class | HTTP status |
| --------------------------- | -------------------: | ----------- |
| User input invalid          |    `ValidationError` | 400         |
| Resource not found          |      `NotFoundError` | 404         |
| Permission/ownership        | `AuthorizationError` | 403         |
| DB query failure            |      `DatabaseError` | 500         |
| Unexpected internal failure |      `InternalError` | 500         |

```typescript
// Example fix pattern:
const { data, error } = await this.db.from('circles').select('*').eq('id', circleId).single();
if (error) {
  if (error.code === 'PGRST116') throw new NotFoundError('Circle not found');
  throw new DatabaseError('Failed to fetch circle', { cause: error });
}
```

## Technical Details

- **Files**: `CreatorCircleService.ts`, `MentorshipService.ts`, `FollowService.ts`, `NotificationPersistenceService.ts`
- **Scale**: 30+ throw sites need reclassification
- **Pattern reference**: common-solutions.md #24 (error class selection matrix)
- **PostgREST error code reference**: `PGRST116` = no rows, `PGRST301` = JWT error, others are DB-level
- **Note**: Do NOT change error class for user input validation failures — those should remain `ValidationError`

## Acceptance Criteria

- [ ] All `DatabaseError`/`InternalError` cases no longer use `ValidationError`
- [ ] `ValidationError` remains only for user-supplied input validation failures
- [ ] Error class selection matrix from common-solutions.md #24 followed throughout
- [ ] Affected service unit tests updated to expect correct error types
- [ ] No internal Supabase error details leaked in error messages returned to clients
