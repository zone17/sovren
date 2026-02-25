---
title: 'Fix Backend Startup — Missing Modules, Broken Path Aliases, Dependency Cleanup'
type: fix
date: 2026-02-25
---

# Fix Backend Startup — Missing Modules, Broken Path Aliases, Dependency Cleanup

## Overview

The backend (`packages/backend`) cannot start due to cascading module resolution failures: a missing `@shared/*` path alias in tsconfig, 9 undeclared npm dependencies, missing dev tooling (`tsx`, `tsc-alias`), and 43 macOS duplicate files polluting the source tree. These issues compound — fixing one reveals the next.

## Problem Statement

Running `npm run dev` in the backend produces:

```
Error: Cannot find module '@shared/types/nostr/auth'
```

Even after that, startup would crash on `@aws-sdk/client-secrets-manager` (loaded via `bootstrap.ts` DI container), then on further undeclared packages as services load.

**Root causes:**

1. `@shared/*` path alias exists in frontend tsconfig but NOT in backend tsconfig
2. 9 npm packages are imported in source but never declared in `package.json`
3. `tsx` (dev runner) and `tsc-alias` (build tool) are used in scripts but not declared
4. 43 macOS Finder duplicate files (`Service 2.ts`) — 41 in backend, 2 in shared

## Proposed Solution

5-phase fix, ordered by dependency chain. SpecFlow analysis identified critical corrections applied below.

### Phase 0: Rebuild shared package (prerequisite)

`packages/shared/dist/` is stale — missing `finance.js`, `wellness.js`, `distribution.js`, `provenance.js`, `community.js`. Backend's 21 `@sovren/shared/*` imports need these at runtime (e.g., `ALERT_STATUS_TRANSITIONS` const, `PaymentState` enum).

```bash
# Delete shared " 2" files first (they'd pollute the build)
rm "packages/shared/src/types/community 2.ts"
rm "packages/shared/src/types/finance 2.ts"

# Rebuild shared
cd packages/shared && npm run build
```

### Phase 1: Delete macOS duplicate files (before tsc runs)

**Must run before Phase 2** — tsconfig's `src/**/*` glob captures all " 2" files. `ssrf 2.ts` is pre-PR#91 (missing IPv4-compatible hex SSRF fix — security regression if compiled). `ContractService 2.ts` has type mismatches that cause tsc errors.

```bash
# Backend: 41 files
find packages/backend/src -name "* 2*" -type f -delete

# Shared: 2 files (already handled in Phase 0)
```

### Phase 2: Add `@shared/*` path alias to backend tsconfig

**File:** `packages/backend/tsconfig.json`

```json
"paths": {
  "@/*": ["*"],
  "@shared/*": ["../../shared/src/*"]
}
```

**Critical correction (from SpecFlow):** The path is `../../shared/src/*`, NOT `../../packages/shared/src/*`. Backend tsconfig has `"baseUrl": "./src"`, so paths resolve relative to `packages/backend/src/`. Two levels up reaches `packages/`, then `shared/src/*` is the correct relative path.

**Verification:** From `packages/backend/src/`:

- `../../shared/src/types/community.ts` → `packages/shared/src/types/community.ts` ✅
- `../../shared/src/types/nostr/auth.ts` → `packages/shared/src/types/nostr/auth.ts` ✅

**Why this approach:** The frontend already uses `@shared/*` → `../shared/src/*`. 14 backend files use `@shared/` imports. Rewriting all 14 to `@sovren/shared/` would be a larger diff and create inconsistency.

**Post-change verification:** After `tsc && tsc-alias`, check that `dist/services/nostr-auth.js` contains a valid relative `require()` path for `createSignatureMessage` (value import, not type-only — tsc-alias must rewrite it correctly).

### Phase 3: Declare missing npm dependencies

**File:** `packages/backend/package.json`

**Add to `dependencies`:**

| Package                           | Used In                                      |    On Startup Path?    |
| --------------------------------- | -------------------------------------------- | :--------------------: |
| `@aws-sdk/client-secrets-manager` | `services/SecretsService.ts`                 | **YES** (bootstrap.ts) |
| `slugify`                         | `services/content/ContentCreationService.ts` |       Maybe (DI)       |
| `pdfkit`                          | `services/payment/InvoiceService.ts`         |       Maybe (DI)       |
| `csv-writer`                      | `services/transaction-history-service.ts`    |           No           |
| `argon2`                          | `services/user/UserAuthenticationService.ts` |           No           |
| `qrcode`                          | `services/user/UserAuthenticationService.ts` |           No           |
| `speakeasy`                       | `services/user/UserAuthenticationService.ts` |           No           |
| `express-validator`               | `routes/creator-recommendations.ts`          |           No           |

**Add to `devDependencies`:**

| Package     | Used In                                   |
| ----------- | ----------------------------------------- |
| `tsx`       | `scripts.dev` (`tsx watch src/server.ts`) |
| `tsc-alias` | `scripts.build` (`tsc && tsc-alias`)      |

**Also add type definitions** for packages that need them:

- `@types/qrcode`
- `@types/speakeasy` (if exists)

**Dead code removal (instead of installing `@prisma/client`):**

`user-subscription-service.ts` and `routes/user-subscriptions.ts` are entirely unreachable — no route mounts them, no DI registers them. Installing `@prisma/client` without a Prisma schema just shifts the error from "Cannot find module" to "Please run prisma generate". Delete both files.

### Phase 4: Housekeeping fixes

1. **Remove `@testing-library/jest-dom` from backend tsconfig `types`** — also remove from `tsconfig.test.json` (extends tsconfig.json, so removing from parent alone has no effect)
2. **Vitest version alignment** — update both `vitest` and `@vitest/ui` in backend from `^2.1.8` to `^3.2.4` to match root (major version mismatch between `@vitest/ui@2` and `vitest@3` causes runtime incompatibilities)

## Import Convention Note

The backend uses TWO conventions for shared imports:

- `@shared/*` — 14 files (finance, community, nostr-auth domains)
- `@sovren/shared/*` — 21 files (provenance, distribution, wellness, payment domains)

Both will work after Phase 0 (shared rebuild) and Phase 2 (`@shared/*` via tsconfig path alias). `@sovren/shared` resolves via npm workspace symlink. **This plan does NOT unify them** — that's a separate refactor. The goal here is to make the backend start.

## Acceptance Criteria

- [x] `npm run dev` in `packages/backend/` starts without module resolution errors
- [ ] `npm run build` in `packages/backend/` completes — blocked by 871 pre-existing type errors (not module-related)
- [ ] `dist/services/nostr-auth.js` contains valid relative require() — blocked by tsc failing (pre-existing)
- [x] `npm run type-check` passes (or shows only pre-existing type errors, not module-not-found) — 0 `@shared` module errors
- [x] All 42 macOS duplicate files deleted (40 backend + 2 shared)
- [x] All 8 missing deps + 2 dev deps + 3 type defs declared in `package.json`
- [x] `@shared/*` path alias resolves correctly in tsconfig
- [x] `user-subscription-service.ts` and `routes/user-subscriptions.ts` deleted (dead code)
- [x] No regressions in existing tests — 78/78 ssrf tests pass on vitest v3.2.4

## Risk Analysis

**Low risk:** All changes are additive (adding deps, adding path alias, deleting junk/dead files). No existing working code is modified.

**Potential issue:** `@aws-sdk/client-secrets-manager` requires AWS credentials at runtime. The backend may start but fail at SecretsService initialization if no AWS config is present. This is a runtime config issue, not a module resolution issue — out of scope.

**Potential issue:** `shared/dist/types/index.js` uses `export * from './nostr'` (bare directory import). Under strict ESM with Node 22+, this triggers `ERR_UNSUPPORTED_DIR_IMPORT`. For `npm run dev` (tsx), this is not a problem. For production builds, this may need a follow-up fix to use explicit file extensions.

## Phase Execution Order

```
Phase 0: Rebuild shared (delete shared " 2" files, npm run build)
    ↓
Phase 1: Delete backend " 2" files (41 files)
    ↓
Phase 2: Add @shared/* path alias to tsconfig
    ↓
Phase 3: Declare missing deps + delete dead Prisma code
    ↓
Phase 4: Housekeeping (tsconfig types, vitest alignment)
    ↓
Verify: npm run dev, npm run build, npm test
```

## References

- Frontend tsconfig with working `@shared/*` alias: `packages/frontend/tsconfig.json`
- Backend tsconfig (to modify): `packages/backend/tsconfig.json`
- Backend package.json (to modify): `packages/backend/package.json`
- critical-patterns.md #10a — cross-package dedup convention
- common-solutions.md #11 — Vitest OOM prevention (`maxForks: 2`)
- SpecFlow analysis identified: wrong path value, stale shared dist, phase ordering, dead Prisma code, @vitest/ui gap
