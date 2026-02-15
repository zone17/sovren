# P3 Sprint 1: Code Quality + Dead Code + Architecture Cleanup — Definition of Done

**Branch**: feature/US-007-error-boundaries-rebased
**Sprint Scope**: 15 P3 findings from PR #73 code review
**Created**: 2026-02-15
**Author**: Product Owner (agent)
**Format**: PASS / PARTIAL / FAIL per criterion per todo

---

## Categorization

| Category | Todos | Est. Lines Removed |
|----------|-------|--------------------|
| Dead Code Removal | 014, 057, 148 | ~226K+ |
| Duplication Consolidation | 034, 056, 110 | ~5K |
| Code Quality | 015, 036 | ~200 |
| Naming & Consistency | 058 | ~50 |
| Architecture Cleanup | 016, 017, 107, 108, 145, 147 | ~1K |

---

## DEFERRED Items

The following todos are too large or too risky for this sprint and should be deferred:

### TODO-145: God Classes Decomposition
**Reason**: Decomposing 5 god classes (4,600+ lines total) is a Large effort with Medium risk. Splitting `subscription-management-service.ts` (1,114 lines) into 3 services requires extensive DI re-wiring, test rewrites, and import chain updates. This is a standalone sprint-sized effort.
**Recommendation**: Create a dedicated P3 Sprint 2 for god class decomposition.

### TODO-015: Any Type + Console Log Cleanup (Full Scope)
**Reason**: 779 `any` types and 624 `console.log` calls is a massive effort. However, a **scoped subset** is achievable: configure ESLint rules to prevent new violations and fix the highest-impact `any` types (DI tokens are handled by TODO-108).
**Recommendation**: In-sprint: add ESLint rules only. Full cleanup deferred to future sprint.

---

## Acceptance Criteria by Todo

---

### TODO-014: Duplicate Finder Files Cleanup

**Description**: Remove 32 macOS Finder "space N" duplicate files and 50+ root-level AI status markdown files.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Zero files with " 2", " 3", " 4" in filename | `find /Users/fp/Desktop/Sovren -name "* [0-9]*" -not -path "*/node_modules/*" -not -path "*/.git/*" \| wc -l` returns 0 | 0 files found | 1-5 files remain | >5 files remain |
| 2 | Root directory contains only standard project files | `ls /Users/fp/Desktop/Sovren/*.md \| wc -l` <= 3 (README, CHANGELOG, CONTRIBUTING) | <=3 md files in root | 4-10 md files | >10 md files |
| 3 | Status/AI markdown files relocated or deleted | `ls /Users/fp/Desktop/Sovren/ \| grep -iE "legendary\|status\|confirmed\|elite\|achievement"` returns empty | No status files in root | 1-3 remain | >3 remain |
| 4 | No broken imports from deleted files | `npm run type-check` passes OR `tsc --noEmit` has no new errors | Passes | N/A | New type errors |

---

### TODO-015: Any Type + Console Log Cleanup (Scoped: ESLint Rules Only)

**Description**: Add ESLint rules to prevent new `any` and `console.log` violations. Full remediation deferred.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | ESLint rule for `@typescript-eslint/no-explicit-any` configured (warn or error for new code) | `grep -r "no-explicit-any" /Users/fp/Desktop/Sovren/.eslintrc*` or eslint config files | Rule present | Rule present but disabled | Rule absent |
| 2 | ESLint rule for `no-console` configured (warn or error for production code) | `grep -r "no-console" /Users/fp/Desktop/Sovren/.eslintrc*` or eslint config files | Rule present | Rule present but disabled | Rule absent |
| 3 | Existing violations suppressed (not blocking CI) | ESLint runs without failing on pre-existing violations (inline disable comments or config-level allowlist) | `npm run lint` passes | Lint passes with warnings | Lint fails |

---

### TODO-036: Minor Code Quality Improvements

**Description**: Fix deprecated `substr`, inline `require()`, default exports, `collectDefaultMetrics` side effect, swallowed errors.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | No deprecated `substr` usage | `grep -rn "\.substr(" /Users/fp/Desktop/Sovren/packages/ --include="*.ts" --include="*.tsx" \| grep -v node_modules` returns empty | 0 occurrences | N/A | Any occurrence |
| 2 | No inline `require()` in TypeScript files | `grep -rn "require(" /Users/fp/Desktop/Sovren/packages/backend/src/ --include="*.ts" \| grep -v "// eslint" \| grep -v node_modules` returns empty | 0 inline requires | 1-2 remain | >2 remain |
| 3 | No default exports in touched files (csrf.ts, rate-limit-middleware.ts, sentry.ts) | `grep -n "export default" /Users/fp/Desktop/Sovren/packages/backend/src/middleware/csrf.ts /Users/fp/Desktop/Sovren/packages/backend/src/middleware/rate-limit-middleware.ts /Users/fp/Desktop/Sovren/packages/frontend/src/**/sentry.ts 2>/dev/null` returns empty | 0 default exports in listed files | N/A | Any default export |
| 4 | `collectDefaultMetrics` not called at import time | Grep for `collectDefaultMetrics()` at top-level scope in deployment-monitoring.ts; must be inside a function | Inside init function | N/A | At top level |
| 5 | No silently swallowed errors in deployment-monitoring.ts | `grep -A2 "catch" /Users/fp/Desktop/Sovren/packages/backend/src/**/deployment-monitoring.ts` shows logging in every catch block | All catch blocks log | N/A | Any empty catch |

---

### TODO-058: Naming Inconsistencies

**Description**: Standardize requestId vs correlationId, middleware file naming, header type safety, export style, unnecessary `as const`.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Error responses use `correlationId` not `requestId` | `grep -rn "requestId" /Users/fp/Desktop/Sovren/packages/backend/src/middleware/error-handler*.ts` returns 0 matches for metadata key | 0 occurrences | N/A | Any `requestId` as metadata key |
| 2 | Middleware files use kebab-case naming | `ls /Users/fp/Desktop/Sovren/packages/backend/src/middleware/*.ts \| grep -E "[A-Z]"` returns empty (no camelCase files) | All kebab-case | 1 file not renamed | >1 file not renamed |
| 3 | No unsafe `as string` casts on Express headers | `grep -n "as string" /Users/fp/Desktop/Sovren/packages/backend/src/middleware/correlation-id.ts /Users/fp/Desktop/Sovren/packages/backend/src/middleware/csrf.ts` returns empty | 0 unsafe casts | N/A | Any remain |
| 4 | All import paths updated after file renames | `npm run type-check` passes with no import errors | Passes | N/A | Import errors |

---

### TODO-107: AppError 7 Positional Params to Options Object

**Description**: Refactor `AppError` constructor from 7 positional params to an options object pattern.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | `AppErrorOptions` interface defined | `grep -n "AppErrorOptions" /Users/fp/Desktop/Sovren/packages/backend/src/middleware/error-handler*.ts` returns match | Interface exists | N/A | Not defined |
| 2 | Constructor accepts `AppErrorOptions \| string` | `grep -A3 "constructor" /Users/fp/Desktop/Sovren/packages/backend/src/middleware/error-handler*.ts` shows options object pattern | Options pattern implemented | N/A | Still positional |
| 3 | All callsites migrated | `grep -rn "new AppError(" /Users/fp/Desktop/Sovren/packages/backend/src/ \| grep -v "new AppError({" \| grep -v "new AppError('" \| grep -v "new AppError(\`"` — only string literals allowed, not positional multi-arg | 0 positional multi-arg calls | 1-5 remain | >5 remain |
| 4 | Backward compat: `new AppError('message')` works | Test exists verifying string-only construction defaults to statusCode 500, isOperational true | Test passes | N/A | No test or fails |
| 5 | TypeScript compiles cleanly | `tsc --noEmit` on backend package has no new errors | No new errors | N/A | New errors |

---

### TODO-108: ServiceToken<any> to Typed Tokens

**Description**: Replace 32 `ServiceToken<any>` with proper typed tokens in DI container.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Zero `ServiceToken<any>` in types.ts | `grep -c "ServiceToken<any>" /Users/fp/Desktop/Sovren/packages/backend/src/container/types.ts` returns 0 | 0 instances | 1-10 remain | >10 remain |
| 2 | No new circular imports introduced | `npx madge --circular /Users/fp/Desktop/Sovren/packages/backend/src/container/types.ts 2>/dev/null` OR manual import check passes | No new cycles | N/A | New cycles |
| 3 | Lazy controller `as any` replaced in routes | `grep -n "as any" /Users/fp/Desktop/Sovren/packages/backend/src/routes/content.routes.ts /Users/fp/Desktop/Sovren/packages/backend/src/routes/user.routes.ts` returns 0 | 0 `as any` casts | N/A | Any remain |
| 4 | TypeScript compiles cleanly | `tsc --noEmit` on backend package has no new errors | No new errors | N/A | New errors |

---

### TODO-110: Duplicate Utility Patterns Consolidation

**Description**: Consolidate 5 duplicate patterns (asyncHandler x2, RateLimitConfig x3, getClientIP x4, pagination x2, XSS sanitization x3) into central utils.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Single `asyncHandler` implementation | `grep -rn "const asyncHandler\|function asyncHandler" /Users/fp/Desktop/Sovren/packages/backend/src/ \| wc -l` returns 1 | 1 definition | 2 definitions | >2 definitions |
| 2 | Single `RateLimitConfig` interface | `grep -rn "interface RateLimitConfig" /Users/fp/Desktop/Sovren/packages/backend/src/ \| wc -l` returns 1 | 1 definition | 2 definitions | 3 definitions |
| 3 | Single `getClientIP` implementation | `grep -rn "getClientIP\|get_client_ip\|getClientIp" /Users/fp/Desktop/Sovren/packages/backend/src/ \| grep -E "const\|function\|export" \| wc -l` returns 1 | 1 definition | 2-3 definitions | 4 definitions |
| 4 | Single pagination schema | `grep -rn "paginationSchema" /Users/fp/Desktop/Sovren/packages/backend/src/ \| grep -E "const\|export" \| wc -l` returns 1 | 1 definition | N/A | 2 definitions |
| 5 | All imports updated to central location | `npm run type-check` passes and no local copies exist | Passes | N/A | Import errors |

---

### TODO-056: Rotation Script Consolidation

**Description**: Consolidate 9 rotation scripts (4,148 lines) to 2 canonical scripts (1 Supabase, 1 GitHub).

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Only 1 Supabase rotation script | `find /Users/fp/Desktop/Sovren/scripts -name "*supabase*rotation*" -o -name "*rotate*database*" -o -name "*credential*rotation*" \| wc -l` returns 1 | 1 script | 2-3 scripts | >3 scripts |
| 2 | Only 1 GitHub rotation script | `find /Users/fp/Desktop/Sovren/scripts -name "*github*rotation*" -o -name "*token*rotation*" \| wc -l` returns 1 | 1 script | 2 scripts | 3 scripts |
| 3 | Deleted scripts not referenced in CI/CD | `grep -rn "supabase.*rotation\|rotate.*database\|github.*rotation\|token.*rotation" /Users/fp/Desktop/Sovren/.github/workflows/ 2>/dev/null` references only retained scripts | Only valid refs | N/A | Broken refs |
| 4 | No duplicate methods in retained scripts | `grep -c "updateAWSSecrets\|verifyConnection" <retained-script>` each pattern appears once | No duplicates | N/A | Duplicate methods |
| 5 | Net line reduction of 3,000+ lines from scripts/ | Compare `wc -l` of rotation scripts before/after | 3,000+ lines removed | 1,500-3,000 removed | <1,500 removed |

---

### TODO-057: Monitoring Directory Dead Code

**Description**: Delete entire `monitoring/` directory (~11,398 files, ~223K lines) confirmed as unused dead code.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | `monitoring/` directory deleted | `test -d /Users/fp/Desktop/Sovren/monitoring && echo EXISTS \|\| echo DELETED` returns DELETED | Deleted | N/A | Still exists |
| 2 | `monitoring/dashboard-backup/` deleted | Same as above for backup dir | Deleted | N/A | Still exists |
| 3 | No stale jest config references | `grep -n "monitoring" /Users/fp/Desktop/Sovren/jest.config*.ts /Users/fp/Desktop/Sovren/jest.config*.js 2>/dev/null` returns empty | No refs | N/A | Stale refs |
| 4 | Stale backend dist artifacts cleaned | `packages/backend/dist/` either absent or freshly built | Clean | N/A | Stale artifacts |
| 5 | All tests pass after deletion | `npm test` passes | Passes | N/A | Test failures |

---

### TODO-148: ~1,900 Lines Removable Dead Code

**Description**: Remove unused error classes, dead NOSTR auth services, stub analytics, dead utility functions. Skip BrowserPool and PaymentPersistence (in-use).

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Unused error classes removed from error-handler-middleware | `grep -c "class.*Error extends" /Users/fp/Desktop/Sovren/packages/backend/src/middleware/error-handler*.ts` reduced (only actively-used classes remain) | Unused classes removed | N/A | No change |
| 2 | Duplicate NOSTR auth services consolidated | `find /Users/fp/Desktop/Sovren/packages/backend/src -name "*nostr*auth*" \| wc -l` returns 1 | 1 service | 2 services | 3 services |
| 3 | Stub analytics service removed or marked | `find /Users/fp/Desktop/Sovren/packages/backend/src -name "*analytics*" -path "*/services/*"` — stub service deleted or has TODO comment | Removed or marked | N/A | Unmarked stub |
| 4 | Net code reduction of 500+ lines | `git diff --stat` shows net deletion of 500+ lines from targeted files | 500+ lines removed | 200-500 removed | <200 removed |
| 5 | All tests pass | `npm test` passes | Passes | N/A | Failures |

---

### TODO-016: .resolve() vs .get() Standardization

**Description**: Standardize DI container to use `.resolve()` everywhere, remove `.get()` proxy trap, delete dead `ServiceTokens` class.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | No `.get()` calls on DI container | `grep -rn "container\.get(" /Users/fp/Desktop/Sovren/packages/backend/src/ \| grep -v node_modules \| grep -v "\.d\.ts"` returns empty | 0 occurrences | 1-3 remain | >3 remain |
| 2 | `.get()` proxy trap removed | `grep -n "\.get\b" /Users/fp/Desktop/Sovren/packages/backend/src/container/index.ts` shows no proxy get handler | Removed | N/A | Still present |
| 3 | `ServiceTokens` class deleted | `grep -rn "class ServiceTokens" /Users/fp/Desktop/Sovren/packages/backend/src/` returns empty | Deleted | N/A | Still exists |
| 4 | All route files use `.resolve()` | `grep -rn "container\." /Users/fp/Desktop/Sovren/packages/backend/src/routes/ \| grep -v "resolve\|register\|create"` no unexpected methods | Only `.resolve()` | N/A | `.get()` found |

---

### TODO-017: Scoped Services to Singletons or Proper Scoping

**Description**: Either implement per-request scoping middleware or reclassify "scoped" services as singletons to match actual behavior.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Lifetime annotations match actual behavior | Either (A) `createScope()` middleware exists in app.ts/middleware AND route handlers resolve from scoped container, OR (B) all "scoped" registrations changed to "singleton" | A or B implemented | N/A | Mismatched annotations |
| 2 | No services registered as "scoped" without scoping middleware | `grep -rn "registerScoped\|Lifecycle.Scoped\|scoped:" /Users/fp/Desktop/Sovren/packages/backend/src/` — if matches exist, verify middleware creates scopes | Consistent | N/A | Scoped without middleware |
| 3 | TypeScript compiles cleanly | `tsc --noEmit` no new errors | Passes | N/A | New errors |

---

### TODO-034: Consolidate Sanitization, Logger, and Rotation Scripts

**Description**: Single source of truth for sensitive fields, deprecate `utils/logger.ts`, consolidate rotation scripts.

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | Single `SENSITIVE_FIELDS` constant | `grep -rn "SENSITIVE_FIELDS\|sensitiveFields\|sensitive_fields" /Users/fp/Desktop/Sovren/packages/backend/src/ \| grep -E "const\|export" \| wc -l` returns 1 | 1 definition | 2 definitions | 3+ definitions |
| 2 | No imports from `utils/logger` | `grep -rn "from.*utils/logger\|require.*utils/logger" /Users/fp/Desktop/Sovren/packages/backend/src/ \| grep -v node_modules` returns empty | 0 imports | 1-5 imports | >5 imports |
| 3 | `utils/logger.ts` deleted or marked deprecated | File deleted OR has prominent deprecation JSDoc at top | Deleted/deprecated | N/A | Active and unmarked |
| 4 | All sanitization uses shared constant | `sentry.ts`, `logger.ts`, and `error-handler-middleware.ts` import from same source | All 3 share source | 2 of 3 share | Each has own list |

**Note**: Rotation script consolidation overlaps with TODO-056. If 056 is implemented, criterion for rotation scripts here is automatically satisfied.

---

### TODO-147: Circular Dependency Chains

**Description**: Break unsafe circular dependency chains (DI container, barrel exports). Skip error-handler cycle (verified safe per MEMORY.md).

| # | Criterion | Verification | PASS | PARTIAL | FAIL |
|---|-----------|-------------|------|---------|------|
| 1 | DI container circular imports broken | `npx madge --circular /Users/fp/Desktop/Sovren/packages/backend/src/container/ 2>/dev/null \| wc -l` returns 0 (or only the known-safe error-handler cycle) | 0 new cycles | N/A | New cycles |
| 2 | Error-handler cycle documented | Comment in `error-handler-middleware.ts` or `utils/errors.ts` explaining why the cycle is safe (function-level refs) | Comment exists | N/A | No documentation |
| 3 | All services import independently without errors | `node -e "require('./packages/backend/src/container')"` or `tsc --noEmit` passes | Passes | N/A | Import errors |
| 4 | No barrel export cycles | `grep -rn "export.*from" /Users/fp/Desktop/Sovren/packages/backend/src/container/index.ts` does not create cycles back to importer | No barrel cycles | N/A | Barrel cycles exist |

---

## Sprint-Level Definition of Done

| # | Gate | Verification | PASS | FAIL |
|---|------|-------------|------|------|
| 1 | All non-deferred todos have at least PARTIAL across all criteria | Review this document against implementation | All PARTIAL+ | Any FAIL |
| 2 | TypeScript compiles | `npm run type-check` or `tsc --noEmit` passes on both frontend and backend | Passes | Fails |
| 3 | All tests pass | `npm test` passes (frontend + backend) | Passes | Failures |
| 4 | No new ESLint errors | `npm run lint` passes | Passes | New errors |
| 5 | Net code reduction | `git diff --stat` shows net negative lines changed | Net deletion | Net addition |
| 6 | No regressions in existing functionality | Health check endpoints, auth flow, payment flow still operational | Verified | Broken |
| 7 | Branch builds cleanly | `npm run build` succeeds for all packages | Passes | Build errors |

---

## Summary Table

| Todo | Title | In Sprint? | Risk | Notes |
|------|-------|-----------|------|-------|
| 014 | Duplicate Finder Files | YES | Low | Deletion only |
| 015 | Any Type + Console Log | SCOPED | Low | ESLint rules only, full cleanup deferred |
| 036 | Minor Code Quality | YES | Low | Small isolated fixes |
| 058 | Naming Inconsistencies | YES | Low | Renames + import updates |
| 107 | AppError Options Object | YES | Low | ~40 callsite migration |
| 108 | ServiceToken<any> Typing | YES | Low-Med | 32 tokens + import cycle risk |
| 110 | Duplicate Utilities | YES | Low-Med | 5 patterns, reconcile differences |
| 056 | Rotation Script Consolidation | YES | Low | Deletion + retain best |
| 057 | Monitoring Dead Code | YES | Low | Delete 223K lines |
| 148 | Dead Code 1,900 Lines | YES | Low | Conservative 500-line target |
| 016 | .resolve() Standardization | YES | Low | Small rename |
| 017 | Scoped Services | YES | Low | Reclassify as singletons (Option B) |
| 034 | Sanitization/Logger Consolidation | YES | Low | Overlaps with 056 and 110 |
| 145 | God Classes Decomposition | **DEFERRED** | Medium | Too large, needs own sprint |
| 147 | Circular Dependencies | YES | Low | Focus on DI container cycles |
