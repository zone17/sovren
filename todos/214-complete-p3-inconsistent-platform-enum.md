---
status: pending
priority: p3
issue_id: '214'
tags: [code-review, pr-85, database]
---

# Inconsistent Platform Enum Across Tables

## Problem Statement

inbox_messages and platform_metrics_history include 'nostr' in platform enum, but cross_posts, platform_connections, repurposed_content do not. Intentional but creates join gaps.

## Findings

- Tables with 'nostr' in platform enum: `inbox_messages`, `platform_metrics_history`
- Tables without 'nostr' in platform enum: `cross_posts`, `platform_connections`, `repurposed_content`
- Files: `supabase/migrations/` for inbox_messages vs cross_posts
- JOINs between these tables on platform column could silently drop nostr rows or produce unexpected NULLs

## Proposed Solutions

1. Document in an ADR why 'nostr' is intentionally only in some tables (e.g., nostr supports receiving messages and metrics but not publishing or connections)
2. Unify the enum across all tables if nostr support is planned for publishing

## Acceptance Criteria

- [ ] An ADR documents the rationale for the inconsistent platform enum values across tables
- [ ] Any queries joining these tables on platform handle the enum mismatch explicitly
- [ ] If unification is chosen, all 5 tables use the same platform enum values
