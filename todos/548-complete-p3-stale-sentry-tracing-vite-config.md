---
status: pending
priority: p3
issue_id: '548'
tags: [code-review, cleanup, pr-103]
dependencies: []
---

# Remove stale @sentry/tracing reference from vite.config.ts chunk config

## Problem Statement

PR #103 removed `@sentry/tracing` from `package.json` but left a reference in `vite.config.ts` line 241 in the manual chunk splitting config: `monitoring: ['@sentry/tracing', 'web-vitals']`. The stale reference is harmless (Vite ignores uninstalled modules) but misleading.

## Findings

- `packages/frontend/vite.config.ts:241` — `monitoring: ['@sentry/tracing', 'web-vitals']`
- Package no longer installed as of this PR
- Vite silently ignores the entry (no runtime impact)

## Proposed Solutions

### Option 1: Remove the stale entry (Recommended)

Change to: `monitoring: ['web-vitals']`

**Effort:** Small (1 min) | **Risk:** None

## Acceptance Criteria

- [ ] No references to `@sentry/tracing` remain in any config file
