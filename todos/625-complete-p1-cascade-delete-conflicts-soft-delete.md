---
status: pending
priority: p1
issue_id: '625'
tags: [code-review, database, migration, data-integrity]
dependencies: []
---

# ON DELETE CASCADE on parent_comment_id conflicts with soft-delete model

## Problem Statement

The supplementary migration adds `ON DELETE CASCADE` to the `parent_comment_id` FK. However, the system uses soft-delete (status transitions to 'deleted'/'moderated'). A hard DELETE of a parent comment (e.g., via admin SQL, data cleanup) would cascade-delete all replies — contradicting the soft-delete model and causing data loss.

## Findings

- Data Integrity Guardian flagged as P1
- The service layer only uses soft-delete (UPDATE status), never hard DELETE
- CASCADE would only trigger from direct SQL DELETE, which could happen during maintenance or data cleanup
- Defense-in-depth principle: FK behavior should match the application's deletion model

## Proposed Solutions

### Option A: Change to ON DELETE SET NULL (Recommended)

Replace CASCADE with SET NULL — orphaned replies remain but lose parent reference.

- Pros: Preserves reply data, consistent with soft-delete model
- Cons: Orphaned replies need UI handling (show "deleted comment" placeholder)
- Effort: Small

### Option B: Change to ON DELETE RESTRICT

Prevent hard-delete of parent if replies exist.

- Pros: Strongest data protection
- Cons: Makes hard-delete cleanup harder
- Effort: Small

## Acceptance Criteria

- [ ] FK on parent_comment_id does NOT cascade hard deletes to replies
- [ ] Migration updated with corrected ON DELETE behavior
