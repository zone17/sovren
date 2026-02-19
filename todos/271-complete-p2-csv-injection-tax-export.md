---
status: complete
priority: p2
issue_id: '271'
tags: [code-review, security, injection]
dependencies: []
---

# CSV Injection in Tax Export

## Problem Statement

TaxPreparationService exports CSV data without sanitizing cell values. User-controlled fields (description, notes) starting with =, +, -, @ can execute formulas when opened in Excel/Sheets.

## Findings

- `packages/backend/src/services/finance/TaxPreparationService.ts` — CSV generation with no cell sanitization

## Proposed Solutions

### Option 1: Prefix dangerous characters

**Approach:** Prepend a single quote (') to any cell value starting with =, +, -, @, tab, or carriage return. Standard CSV injection prevention.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Cell values starting with =, +, -, @ are sanitized
- [ ] Tab and CR characters are escaped
- [ ] Normal text values unaffected

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
