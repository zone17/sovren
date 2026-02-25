---
status: pending
priority: p2
issue_id: 513
tags: [code-review, architecture, typescript, monorepo]
dependencies: []
---

# Unify `@shared/*` vs `@sovren/shared/*` Import Convention

## Problem Statement

The backend uses two incompatible import conventions for the shared package:

- `@shared/*` (15 files) — resolves via tsconfig path alias to raw TypeScript source
- `@sovren/shared/*` (50+ files) — resolves via npm workspace symlink to package root

These resolve through fundamentally different mechanisms (source vs package), break in different ways at different times, and will prevent production builds from working correctly.

## Findings

**4-agent consensus:** Pattern Recognition (P1), Architecture Strategist (P1), TypeScript Reviewer (Info), Security Sentinel (mentioned). Two agents independently rated this P1.

- `@shared/*` resolves to `packages/shared/src/*.ts` — needs `tsc-alias` at build time
- `@sovren/shared/*` resolves to `node_modules/@sovren/shared/*` — needs `dist/` to exist and sub-paths to be resolvable (no `exports` field currently)
- Neither convention works correctly for production builds without additional work
- Dev mode (`tsx`) masks the divergence by compiling TS on the fly
- Stale `dist/` causes `@sovren/shared/*` to get old code while `@shared/*` gets current source

## Proposed Solutions

### Option A: Standardize on `@shared/*` with `tsc-alias` (Recommended for simpler DX)

- Migrate 50+ `@sovren/shared/*` imports to `@shared/*`
- Already works for frontend and backend
- Requires `tsc-alias` for production builds
- **Pros:** Simpler, consistent with frontend, always uses latest source
- **Cons:** Bypasses package abstraction, won't work if shared becomes published npm package
- **Effort:** Medium (50+ file changes, but mechanical)
- **Risk:** Low

### Option B: Standardize on `@sovren/shared/*` with `exports` map

- Add `exports` field to shared `package.json`
- Migrate 15 `@shared/*` imports to `@sovren/shared/*`
- **Pros:** Architecturally correct, proper package boundary
- **Cons:** Requires shared to build before backend, more complex setup
- **Effort:** Medium
- **Risk:** Medium (exports map complexity)

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected files:**

- `packages/backend/tsconfig.json` — `@shared/*` path alias
- `packages/shared/package.json` — missing `exports` field
- 15 backend files using `@shared/*`
- 50+ backend files using `@sovren/shared/*`

## Acceptance Criteria

- [ ] Single import convention used across all backend files
- [ ] Production build (`tsc && tsc-alias && node dist/server.js`) works end-to-end
- [ ] Convention documented in CLAUDE.md

## Work Log

| Date       | Action                       | Learnings                                                       |
| ---------- | ---------------------------- | --------------------------------------------------------------- |
| 2026-02-25 | Created during PR #98 review | 4-agent consensus; blocks production builds but not dev startup |

## Resources

- PR #98: fix/backend-startup
- Plan: `docs/plans/2026-02-25-fix-backend-startup-missing-modules-plan.md`
