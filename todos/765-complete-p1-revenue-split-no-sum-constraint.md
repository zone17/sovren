---
status: pending
priority: p1
issue_id: 765
tags: [code-review, data-integrity, financial, database]
dependencies: []
---

# Revenue Split Missing Sum Constraint + Missing RPCs

## Problem Statement

`content_collaborators.revenue_split_bps` has per-row CHECK (0-10000) but no constraint ensuring SUM per content_id ≤ 10000. The code references a trigger and RPCs that don't exist in any migration. Revenue splits can exceed 100%, causing financial loss.

## Findings

- **Data Integrity Agent**: P1-6
- Missing RPCs: `update_revenue_split_atomic`, `upsert_work_pattern`, `get_wellness_benchmark`, `transition_payment_state`, `get_payment_event_history`, `get_payment_retry_history`, `get_payment_retry_metrics`, `get_creator_recommendations`

## Proposed Solutions

1. Create trigger validating SUM(revenue_split_bps) ≤ 10000 per content_id
2. Create all missing RPC functions in new migration

## Acceptance Criteria

- [ ] DB trigger prevents revenue split sum > 10000 bps
- [ ] All referenced RPC functions exist
- [ ] Tests for split constraint enforcement
