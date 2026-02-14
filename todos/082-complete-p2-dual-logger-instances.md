---
status: pending
priority: p2
issue_id: 082
tags: [code-review, patterns, duplication, observability]
dependencies: []
---

# Dual Logger Instances (bootstrap vs lib/logger)

## Problem Statement

`bootstrap.ts` creates a separate Winston logger for the DI container that lacks the correlation IDs, sensitive-field sanitization, and structured format of the canonical `lib/logger.ts` logger. Two logger instances means inconsistent log output and missed security sanitization in DI-related logs.

## Findings

- **Architecture Strategist P2**: Dual logger instances with different capabilities.
- **Pattern Recognition P2**: Four competing logger patterns across codebase (lib/logger, bootstrap logger, console.error in auth, console.warn in optionalAuth).

## Proposed Solutions

### Option A: Use canonical lib/logger everywhere (Recommended)

Replace bootstrap logger with import from `lib/logger`. Replace `console.error`/`console.warn` calls with logger.
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Single logger instance used across all backend code
- [ ] No `console.error`/`console.warn` in production middleware
- [ ] All logs have correlation IDs and sanitization
