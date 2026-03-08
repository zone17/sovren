---
status: pending
priority: p2
issue_id: 780
tags: [code-review, data-integrity, database, payments]
dependencies: []
---

# Payments Table Has Dual status/state Columns

## Problem Statement

The payments table has both `status` (pending/paid/failed/refunded/expired) and `state` (pending/processing/completed/failed/expired/refunded) with different CHECK constraints. Services may update one but not the other, creating inconsistent records.

## Findings

- **Data Integrity Agent**: P2-2 — baseline_schema.sql line 112 + additional_tables.sql line 27

## Proposed Solutions

Consolidate to a single status column, or add a trigger keeping them synchronized.

## Acceptance Criteria

- [ ] Single source of truth for payment status
- [ ] No inconsistent status/state combinations possible
