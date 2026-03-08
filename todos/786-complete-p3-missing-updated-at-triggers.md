---
status: pending
priority: p3
issue_id: 786
tags: [code-review, data-integrity, database, triggers]
dependencies: []
---

# Missing updated_at Triggers on Many Tables

## Problem Statement

Only users, content, payments, comments have updated_at triggers. Many other tables with updated_at columns (unified_sessions, platform_connections, cross_posts, service_listings, contracts, subscriptions, recurring_payments) lack triggers.

## Findings

- **Data Integrity Agent**: P2-8

## Proposed Solutions

Add update_updated_at() triggers to all tables with updated_at columns.

## Acceptance Criteria

- [ ] All tables with updated_at have trigger
