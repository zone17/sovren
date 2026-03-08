---
status: pending
priority: p2
issue_id: '586'
tags: [code-review, pr-108, data-integrity, database]
---

# NULL columns not COALESCEd in VIEW — TypeScript types lie

## Problem Statement

`bio`, `categories`, `display_name`, `username`, `nip05_verified` can be NULL in the DB but the `DiscoveryCreatorRow` TypeScript interface declares them as non-nullable. A NULL `display_name` causes `charAt(0)` crash in CreatorCard.

**Flagged by: Data Integrity Guardian**

## Proposed Solutions

Add COALESCE in the VIEW (preferred — single source of truth):

```sql
COALESCE(cp.bio, '') AS bio,
COALESCE(cp.categories, ARRAY[]::text[]) AS categories,
COALESCE(u.display_name, u.username, 'Anonymous') AS display_name,
COALESCE(u.username, '') AS username,
COALESCE(u.nip05_verified, false) AS nip05_verified,
```

## Acceptance Criteria

- [ ] All nullable columns COALESCEd in the VIEW definition
- [ ] TypeScript DiscoveryCreatorRow matches non-nullable COALESCEd output
