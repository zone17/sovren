---
status: pending
priority: p1
issue_id: '112'
tags:
  - code-review
  - data-integrity
  - payment
  - lightning
dependencies: []
---

# 112: Payment Persistence Non-Atomic Writes — Crash Causes Complete Data Loss

## Problem Statement

`writeFileSync` in `/packages/backend/src/services/payment-persistence.ts` (lines 110-120) is non-atomic. If process crashes mid-write, JSON file is truncated. On restart, `loadFromDisk` catches parse error and silently initializes with EMPTY Maps — destroying all payment records. Also no write serialization for concurrent access. No file-level locking for multi-instance safety.

## Findings

- **Lines 110-120** (writeToDisk): Non-atomic write operation directly to target file
- **Lines 84-108** (loadFromDisk catch block): Catches parse errors and initializes with empty Maps, destroying all data
- **Lines 38-46** (saveInvoice/savePayment): Multiple entry points that can trigger non-atomic writes
- The `console.error` on failure means production doesn't know data was lost

## Proposed Solutions

**Option A: Atomic write via write-to-temp-then-rename pattern (Recommended)**

- Use `writeFileSync` to temp file, then `renameSync` to target (atomic on POSIX)
- Add write mutex for serialization
- Effort: Small, Risk: Low

**Option B: Replace with SQLite or Supabase persistence**

- Switch to real database with ACID guarantees
- Effort: Medium, Risk: Medium

**Option C: Add file locking + corruption backup**

- Implement file-level locking for multi-instance safety
- Back up corrupted files before overwrite
- Effort: Small, Risk: Low

## Acceptance Criteria

- [ ] Non-atomic write replaced with temp+rename pattern
- [ ] Write serialization mutex added
- [ ] Corrupted files backed up before overwrite
- [ ] No silent data loss on crash
- [ ] Multi-instance safety ensured

## Work Log

| Date       | Action                                      | Learnings                                                                |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Non-atomic writes are a critical data integrity risk for payment systems |
