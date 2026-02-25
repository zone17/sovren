---
title: 'Fix PR #98 Review Findings — Config Cleanup, Import Unification, Dependency Modernization'
type: fix
date: 2026-02-25
---

# Fix PR #98 Review Findings — Config Cleanup, Import Unification, Dependency Modernization

## Overview

The 9-agent code review of PR #98 (backend startup fix) produced 8 findings: 4 P2 and 4 P3. One P2 (#516) is already resolved (Vitest config correct). This plan addresses the remaining 7 in three phases, ordered by risk and dependency chain.

## Problem Statement

PR #98 fixed backend startup but the review surfaced:

- **P2 #513**: Dual `@shared/*` vs `@sovren/shared/*` import convention — blocks production builds
- **P2 #514**: `typeRoots: ["./node_modules"]` in tsconfig.test.json — overly broad type exposure
- **P2 #515**: Two shared services excluded from build instead of deleted (1,827 LOC dead code)
- **P2 #516**: Vitest 3 worker pool config — **ALREADY CORRECT** (`pool: 'forks'`, `maxForks: 2`)
- **P3 #517**: `speakeasy` unmaintained since 2017 — migrate to `otpauth`
- **P3 #518**: package.json housekeeping — 10 `@types/*` in deps, duplicate supertest, unsorted
- **P3 #519**: Lazy-import pdfkit (80ms) + AWS SDK (35ms) for cold start
- **P3 #520**: 54 pre-existing npm audit vulnerabilities (1 critical, 33 high)

## Proposed Solution

3-phase fix. Each phase is independently committable and testable.

### Phase 1: Config Cleanup (quick wins, zero behavioral changes)

**Todos:** #514, #515, #518. Mark #516 complete (already done).

#### 1a. Fix tsconfig.test.json typeRoots (#514)

**File:** `packages/backend/tsconfig.test.json`

Remove the `typeRoots` override entirely. The base config's `typeRoots: ["./node_modules/@types"]` is sufficient when combined with `types: ["node", "vitest/globals"]` because vitest is installed locally and its types resolve through standard paths.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"],
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*", "src/**/*.test.ts", "src/**/__tests__/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**If vitest/globals doesn't resolve without typeRoots**, fall back to the narrower option:

```json
"typeRoots": ["./node_modules/@types", "../../node_modules/@types"]
```

**Verification:** `npx vitest run --project backend` — tests must still pass.

#### 1b. Delete excluded shared services (#515)

**Files to delete:**

- `packages/shared/src/services/NostrKeyManagementService.ts` (1,123 lines)
- `packages/shared/src/services/NostrSecureKeyStorage.ts` (704 lines)

**File to update:** `packages/shared/tsconfig.json` — remove the two named exclusion lines:

```json
"exclude": [
  "node_modules",
  "dist",
  "**/*.test.ts",
  "**/__tests__/**/*"
]
```

**Pre-deletion verification:**

- `grep -r "NostrKeyManagementService\|NostrSecureKeyStorage" packages/backend/src/ packages/shared/src/ --include="*.ts" | grep -v "\.test\." | grep -v __tests__ | grep -v "NostrKeyManagement\|NostrSecureKey"` — must show zero hits outside the files themselves
- The frontend has its own `KeyManagementService.ts` — these shared copies are dead code

**Post-deletion verification:** `cd packages/shared && npm run build` — must succeed.

#### 1c. Package.json housekeeping (#518)

**File:** `packages/backend/package.json`

1. **Move 10 `@types/*` from `dependencies` to `devDependencies`:**

   - `@types/bcryptjs`, `@types/cors`, `@types/express`, `@types/jsonwebtoken`, `@types/multer`, `@types/node`, `@types/nodemailer`, `@types/puppeteer`, `@types/supertest` (^6.0.3), `@types/uuid`

2. **Move `supertest` from `dependencies` to `devDependencies`**

3. **Remove duplicate `@types/supertest`** from `dependencies` (keep `^6.0.2` in devDependencies)

4. **Alphabetically sort** both `dependencies` and `devDependencies` sections (or run `npx sort-package-json`)

**Verification:** `npm install && npm run dev` — must start without errors.

#### 1d. Mark #516 complete

`vitest.config.ts` already uses `pool: 'forks'` with `poolOptions.forks.maxForks: 2` — correct Vitest 3 syntax. Rename todo file to complete.

### Phase 2: Import Convention Unification (#513)

**Goal:** Single import convention for the shared package across the entire backend.

**Decision:** Standardize on `@shared/*` (tsconfig path alias).

**Rationale:**

- Frontend already uses `@shared/*` exclusively (~33 files)
- Backend already has `tsc-alias` in build pipeline to rewrite paths
- Smaller cognitive load (one convention across the monorepo)
- 14 files already use `@shared/*`; the alternative (migrating 50+ `@sovren/shared/*`) is the same mechanical work either way
- The `@sovren/shared` package has no `exports` field, so sub-path imports (`@sovren/shared/types/finance`) don't work through proper package resolution anyway

**Migration scope:** Convert all `@sovren/shared/*` imports in backend source to `@shared/*`.

```bash
# Find all @sovren/shared imports in backend (non-test)
grep -rn "from '@sovren/shared/" packages/backend/src/ --include="*.ts" | grep -v "\.test\." | grep -v __tests__
```

**Mechanical transformation:**

- `from '@sovren/shared/types/distribution'` → `from '@shared/types/distribution'`
- `from '@sovren/shared/types/wellness'` → `from '@shared/types/wellness'`
- etc.

**Ensure `@shared/*` path alias covers all needed paths:**

- `@shared/types/*` → types (finance, community, nostr, distribution, wellness, provenance, payment)
- `@shared/services/*` → services (UnifiedSessionManager)
- `@shared/config/*` → config (if any)

The existing `"@shared/*": ["../../shared/src/*"]` already covers all sub-paths.

**Also update test files** that use `@sovren/shared/*`:

```bash
grep -rn "from '@sovren/shared/" packages/backend/src/ --include="*.test.ts"
grep -rn "from '@sovren/shared/" packages/backend/src/__tests__/ --include="*.ts"
```

**Post-migration cleanup:**

- Remove `@sovren/shared` from backend tsconfig root paths if it was declared there
- Document the convention in CLAUDE.md: "Backend and frontend use `@shared/*` for shared package imports"

**Verification:**

- `npm run dev` — backend starts
- `npx vitest run --project backend` — all tests pass
- `grep -r "@sovren/shared" packages/backend/src/` — zero hits

### Phase 3: Dependency Modernization (#517, #519, #520)

#### 3a. Migrate speakeasy → otpauth (#517)

**Files:**

- `packages/backend/src/services/user/UserAuthenticationService.ts` (lines 20, 256, 323)
- `packages/backend/src/services/user/__tests__/UserAuthenticationService.test.ts` (lines 9, 15, 283-356)

**API mapping:**

| speakeasy                                               | otpauth                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `speakeasy.generateSecret({ length: 20, name: '...' })` | `new OTPAuth.Secret()` + `new OTPAuth.TOTP({ secret, issuer, label })` |
| `speakeasy.totp.verify({ secret, encoding, token })`    | `totp.validate({ token })`                                             |
| `secret.otpauth_url`                                    | `totp.toString()`                                                      |
| `secret.base32`                                         | `secret.base32`                                                        |

**Steps:**

1. `npm install otpauth` in backend
2. `npm uninstall speakeasy @types/speakeasy`
3. Update `UserAuthenticationService.ts` — replace 3 speakeasy API calls
4. Update test file — replace mocks
5. **Critical:** Verify TOTP compatibility — `otpauth` must produce the same verification result for existing user secrets. Both use RFC 6238 TOTP with SHA-1/base32, so they are compatible.

**Verification:** `npx vitest run packages/backend/src/services/user/__tests__/UserAuthenticationService.test.ts`

#### 3b. Lazy-import heavy dependencies (#519)

**File 1:** `packages/backend/src/services/payment/InvoiceService.ts`

```typescript
// BEFORE (line ~25)
import * as PDFDocument from 'pdfkit';

// AFTER — move import inside the method that uses it
async generatePdf(invoice: Invoice): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  // ... rest unchanged
}
```

**File 2:** `packages/backend/src/services/SecretsService.ts`

```typescript
// BEFORE (line ~16)
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// AFTER — move import inside initialize()
async initialize(): Promise<void> {
  if (!this.config.useAwsSecrets) return;
  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
  // ... rest unchanged
}
```

**Verification:** `npm run dev` — backend starts. Invoice generation and secrets loading still work.

#### 3c. npm audit remediation (#520)

**High-priority upgrades:**

| Package          | Current   | Target    | CVE/Advisory               |
| ---------------- | --------- | --------- | -------------------------- |
| `express`        | `^4.18.2` | `^4.22.0` | body-parser DoS, qs DoS    |
| `ws`             | `^8.14.2` | `^8.17.1` | DoS with many HTTP headers |
| `path-to-regexp` | `0.1.7`   | `0.1.12`  | ReDoS                      |

**Steps:**

1. Update versions in `packages/backend/package.json`
2. Run `npm install` to update lockfile
3. Run `npm audit` to verify reduction
4. Run full test suite to catch breaking changes

**Note:** `path-to-regexp 0.1.7` is pinned (not `^0.1.7`). Check if Express 4.22 bundles a fixed version internally before manually updating.

**Lower-priority:** Run `npm audit fix` for remaining moderate/low vulnerabilities.

**Verification:** `npm audit` — 0 critical, 0 high. All tests pass.

## Phase Execution Order

```
Phase 1: Config cleanup (#514, #515, #518, mark #516 complete)
    ↓
Verify: npm run dev, npm run build (shared), tests
    ↓
Phase 2: Import convention unification (#513)
    ↓
Verify: npm run dev, grep for @sovren/shared = 0 hits, tests
    ↓
Phase 3a: speakeasy → otpauth (#517)
Phase 3b: Lazy imports (#519)
Phase 3c: npm audit (#520)
    ↓
Verify: npm run dev, npm audit, full test suite
```

Each phase gets its own commit. Phase 3 sub-items can be parallel commits.

## Acceptance Criteria

- [ ] #514: No `"./node_modules"` in typeRoots (or documented justification)
- [ ] #515: NostrKeyManagement\*.ts deleted, no named exclusions in shared tsconfig
- [ ] #516: ~~Verify Vitest 3 config~~ Already correct — mark complete
- [ ] #518: Zero `@types/*` in dependencies, no duplicate entries, sorted
- [ ] #513: Zero `@sovren/shared` imports in backend, single `@shared/*` convention
- [ ] #517: `speakeasy` removed, `otpauth` working, TOTP verification compatible
- [ ] #519: pdfkit and AWS SDK loaded lazily (not in startup import chain)
- [ ] #520: `npm audit` shows 0 critical, 0 high vulnerabilities
- [ ] All backend tests pass
- [ ] `npm run dev` starts without errors
- [ ] Convention documented in CLAUDE.md

## Risk Analysis

**Low risk:** Phases 1 and 3b are purely config/mechanical changes with no behavioral impact.

**Medium risk:** Phase 2 (import convention) is a large-scope find-and-replace. Risk is mitigated by the fact that both conventions resolve to the same source files — this is a path alias change, not a logic change.

**Medium risk:** Phase 3a (speakeasy migration) changes authentication code. Mitigated by TOTP RFC compatibility and existing test coverage.

**Medium risk:** Phase 3c (npm audit) upgrades may have breaking API changes. Express 4.18→4.22 is a minor bump and should be backwards-compatible.

## References

- PR #98: fix/backend-startup (commit `a1a818f`)
- Review findings: todos #513-520
- Plan: `docs/plans/2026-02-25-fix-backend-startup-missing-modules-plan.md`
- Pattern files: `docs/solutions/patterns/critical-patterns.md`, `common-solutions.md`
