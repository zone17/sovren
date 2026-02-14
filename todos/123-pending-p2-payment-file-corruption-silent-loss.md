---
status: pending
priority: p2
issue_id: '123'
tags:
  - code-review
  - data-integrity
  - payment
dependencies: []
---

# 123: Payment File Corruption — Silent Data Loss Without Backup or Alert

## Problem Statement

When `loadFromDisk` in `payment-persistence.ts` (lines 84-107) encounters corrupted JSON, it logs `console.error` and starts with empty Maps. Subsequent writes overwrite the corrupted file, permanently destroying old data. No backup, no alerting, no recovery mechanism.

## Findings

Silent data loss on corruption. No backup strategy, no health check failure, no operator alerting. Corrupted payment data is irrecoverably lost.

## Proposed Solutions

1. **Option A**: Rename corrupted file to `.corrupted.{timestamp}` before overwriting. Effort: Small, Risk: Low.
2. **Option B**: Emit health check failure / throw during initialization. Effort: Small, Risk: Low.
3. **Option C**: Both A and B. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] Corrupted files backed up before overwrite
- [ ] Health check reports data corruption
- [ ] No silent data loss
- [ ] Operator alerting on corruption detection

## Work Log

| Date       | Action                                      | Learnings                                                                    |
| ---------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Silent failure modes in data persistence destroy user trust and payment data |
