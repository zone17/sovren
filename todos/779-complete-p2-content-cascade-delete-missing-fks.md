---
status: pending
priority: p2
issue_id: 779
tags: [code-review, data-integrity, database, cascade]
dependencies: []
---

# Content ON DELETE CASCADE + Missing FK Constraints

## Problem Statement

Deleting a user cascades through content, comments, analytics, premium_content_access, and more. Subscribers who paid lose access records. Also, 8+ creator-associated tables use TEXT NOT NULL without FK constraints, allowing orphaned records.

## Findings

- **Data Integrity Agent**: P2-5 — content.creator_id ON DELETE CASCADE
- **Data Integrity Agent**: P2-4 — platform_connections, cross_posts, expenses, revenue_entries etc. lack FKs

## Proposed Solutions

1. Change content.creator_id to ON DELETE RESTRICT
2. Implement soft-delete for users (status field already exists)
3. Add FK constraints with appropriate ON DELETE behavior

## Acceptance Criteria

- [ ] User deletion does not cascade to content
- [ ] Soft-delete pattern for users with financial history
- [ ] FK constraints on creator-associated tables
