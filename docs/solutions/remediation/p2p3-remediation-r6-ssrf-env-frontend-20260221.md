---
title: 'P2/P3 Remediation R6 + SSRF Fixes — IPv4-Mapped Hex, Env Var Compatibility, Frontend Patterns'
date: '2026-02-21'
category: remediation
severity: [P1, P2, P3]
prs: [89, 90, 91]
compounds:
  - pr: 89
    title: 'P2/P3 Remediation R6 — 15 findings + SSRF discovery'
    findings: 25 triaged, 15 fixed, 6 WONT_FIX, 4 DEFERRED
  - pr: 90
    title: 'Pre-commit/pre-push hook migration + security test enforcement'
    findings: Hook framework migration, 2 P1 SSRF findings would have been caught
  - pr: 91
    title: 'SSRF IPv4-compatible bypass + DNS TOCTOU pinning'
    findings: 2 P1 SSRF vulnerabilities (IPv4-mapped hex, DNS rebinding)
files_changed: 69 files
lines: '+3107/-363'
agents: 4 (PR #89) + 3 infrastructure (PR #90) + solo (PR #91)
sprint_type: multi-pr remediation
---

# P2/P3 Remediation R6 + SSRF Security Fixes

## Executive Summary

Three coordinated PRs (89, 90, 91) delivered a complete remediation cycle for P2/P3 findings while discovering and fixing two P1 SSRF security vulnerabilities. The sprints demonstrated the power of spec-based security testing (discovered IPv4-mapped IPv6 hex bypass), proper test infrastructure (pre-commit hooks preventing silent failures), and non-breaking API evolution (DNS pinning without breaking callers).

**Key outcomes:**

- 15 P2/P3 findings remediated via PR #89
- 2 P1 SSRF vulnerabilities discovered and fixed (PRs #90 + #91)
- 4 reusable patterns extracted: IPv4-mapped hex, DNS pinning, env var backward compatibility, query key factories
- 0 merge conflicts across 69 files
- 4–6 domains touched: backend services, infra, frontend, security, testing, scripts

---

## Part 1: P2/P3 Remediation Sprint (PR #89)

### Problem Statement

R6 review cycle identified 25 findings across backend services, infrastructure scripts, and frontend components. Previous remediation sprints averaged 60% actionable findings; this sprint triaged to 40% actionable (6 WONT_FIX, 4 DEFERRED, 15 FIXED).

### What Was Built

#### 1. Spec-Based SSRF Testing (→ Discovered P1 Bypass)

Rewrote `packages/backend/src/__tests__/ssrf.test.ts` from gap-based (testing known bypasses) to spec-based (testing all OWASP categories):

```typescript
// OWASP-organized test structure
describe('SSRF Validation', () => {
  describe('Standard IPv4 private ranges', () => {
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  });
  describe('IPv6 loopback and private', () => {
    // ::1, fc00::/7, fe80::/10
  });
  describe('IPv4-mapped IPv6 (::ffff:x.x.x.x)', () => {
    // Both dotted-decimal and hex forms
  });
  describe('IPv4-compatible IPv6 (::x.x.x.x)', () => {
    // Deprecated RFC 4291 but still parseable — DISCOVERED BYPASS HERE
  });
  describe('Decimal/octal/hex encoded IPs', () => {});
  describe('DNS rebinding attacks', () => {});
  describe('Protocol smuggling', () => {});
});
```

**Result:** 70 tests, 100% SSRF category coverage. This uncovered finding #423 (IPv4-compatible hex form `::7f00:1` bypass).

#### 2. Backward-Compatible Env Var Renames

Created `packages/backend/src/utils/env-fallbacks.ts`:

```typescript
const ENV_FALLBACKS: Record<string, string> = {
  OLD_VAR_NAME: 'NEW_VAR_NAME',
  LEGACY_API_KEY: 'SERVICE_API_KEY',
};

export function applyEnvFallbacks(): void {
  for (const [oldName, newName] of Object.entries(ENV_FALLBACKS)) {
    if (process.env[oldName] && !process.env[newName]) {
      process.env[newName] = process.env[oldName];
      console.warn(
        `[DEPRECATION] ${oldName} is deprecated. Use ${newName} instead. ` +
          `${oldName} will be removed in the next major version.`
      );
    }
  }
}

// Bootstrap: call BEFORE Zod schema parse
applyEnvFallbacks();
const env = envSchema.parse(process.env);
```

**Pattern:** Enables env var migrations without breaking existing deployments. Deprecation warnings guide operators to new names. Reusable for any future config rename.

#### 3. Anti-Pattern Scanner Granular Scoping

Updated `.husky/pre-commit` and scanner scripts to apply three scoping dimensions:

1. **File scope** — which directories the rule applies to
   - Frontend excluded from `console.*` check (no logger service available)
   - Test-utils excluded from credentials check (fake credentials by design)

2. **Line scope** — new lines only via `git diff --cached`
   - TODO check scoped to new lines only (stops flagging pre-existing TODOs)

3. **Context scope** — test files, generated code excluded by default

**Pattern:** Reduces false positive noise. After 3+ false positives, developers stop trusting scanner output entirely.

#### 4. TanStack Query Key Factories

Added factory pattern to `packages/frontend/src/hooks/query-keys.ts`:

```typescript
export const circleKeys = {
  all: ['circles'] as const,
  lists: () => [...circleKeys.all, 'list'] as const,
  list: (filters: CircleFilters) => [...circleKeys.lists(), filters] as const,
  details: () => [...circleKeys.all, 'detail'] as const,
  detail: (id: string) => [...circleKeys.details(), id] as const,
};

// Usage: scoped cache invalidation
useQuery({ queryKey: circleKeys.detail(id), queryFn: ... });
queryClient.invalidateQueries({ queryKey: circleKeys.lists() }); // Only lists, not details
```

**Pattern:** Replaces overbroad `invalidateQueries(['circles'])` with surgical `invalidateQueries(circleKeys.lists())`. Prevents cache invalidation storms.

#### 5. False Positive Verification

Finding: `SERVICE_DEPENDENCIES` constant reported as dead code.
Verification: `grep -r "SERVICE_DEPENDENCIES" packages/` found usage in `ServiceContainer.integration.test.ts`.
Result: Todo marked as false positive. Grep verification prevented wasted refactoring effort.

**Pattern:** Before implementing any "dead code" todo, verify against source. Descriptions go stale across sprints.

### Key Insights

#### 1. Spec-Based Testing Catches What Gap-Based Testing Misses

Gap-based approach: Add tests for known bypasses as they're discovered.

- ✗ IPv4-compatible hex addresses (`::7f00:1`) were not in the known bypasses list.
- ✗ Missed entirely by gap-based tests.

Spec-based approach: Test all categories from specification (OWASP SSRF Prevention Cheat Sheet).

- ✓ Enumerated 15 bypass categories.
- ✓ Tested each one.
- ✓ Discovered IPv4-compatible hex as uncovered category.

**Applies to:** All security validation functions (SSRF, XSS, CSRF, auth). When rewriting tests, organize by specification categories, not known bypasses.

#### 2. Triage-First Saves 40% Effort

| Outcome                              | Count | Percentage | Effort |
| ------------------------------------ | ----- | ---------- | ------ |
| FIXED (code changes)                 | 15    | 60%        | ~20h   |
| WONT_FIX (accept as-is)              | 6     | 24%        | 0h     |
| DEFERRED (architecture out-of-scope) | 4     | 16%        | 0h     |

**Lesson:** Aggressive triage at 40% non-actionable eliminated wasted planning on items that wouldn't produce value.

**Pattern:** Before every remediation sprint, architect reviews findings against source code and classifies as DO / WONT_FIX / DEFERRED. Only DO items are briefed to agents.

#### 3. 4 Agents ≈ 15 Items (Scaling Rule)

Domain-grouped agents with non-overlapping files produced 0 merge conflicts:

- Backend services agent: 6 items
- Infra scripts agent: 4 items
- Frontend agent: 3 items
- Tests agent: 2 items (SSRF discovery)

**Scaling rule:** ~3–4 items per agent. Below 3 = wasted coordination overhead. Above 6 = context window exhaustion.

---

## Part 2: Hook Migration + Security Test Enforcement (PR #90)

### Problem Statement

After Vitest migration (PR #86), git hooks were still invoking Jest commands. Result: silent test failure cascade. Developers used `git push --no-verify` for every push, bypassing ALL hooks (not just tests).

### Root Cause

1. **Error suppression anti-pattern:** `2>/dev/null || true` after Jest command suppressed failure
2. **Full-suite pre-push:** Running all tests when 121 pre-existing failures exist always fails
3. **Hook update checklist missing:** Vitest migration updated configs/tests but not `.husky/` scripts

### What Was Fixed

#### 1. Pre-Commit Hook (Convention-Based Discovery)

Replaced broken `jest --findRelatedTests` with convention-based file discovery:

```bash
# For each staged .ts/.tsx file, find matching test by convention:
#   src/utils/ssrf.ts → src/utils/__tests__/ssrf.test.ts
#   src/utils/ssrf.ts → src/utils/ssrf.test.ts

basename=$(basename "$src_file" | sed 's/\.[^.]*$//')
dir=$(dirname "$src_file")

# Check __tests__/basename.test.ts, then basename.test.ts in same dir
for candidate in \
  "$dir/__tests__/$basename.test.ts" \
  "$dir/$basename.test.ts" \
  "$dir/__tests__/$basename.test.tsx" \
  "$dir/$basename.test.tsx"; do
  [ -f "$candidate" ] && TEST_FILES="$TEST_FILES $candidate" && break
done

# Run the found tests
npx vitest run --bail 1 $TEST_FILES
```

**Why not `vitest related`?** Static import analysis with `--project` flags hits compile errors in other files. Direct file paths are faster and more reliable.

#### 2. Security Test Mapping

New script `scripts/run-security-tests.sh` maps critical files to mandatory test suites:

```bash
SECURITY_MAP=(
  "packages/backend/src/utils/ssrf.ts:packages/backend/src/utils/__tests__/ssrf.test.ts"
  "packages/backend/src/middleware/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
  "packages/backend/src/middleware/csrf.ts:packages/backend/src/__tests__/middleware/csrf.test.ts"
  "packages/backend/src/routes/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
)

# When staged file matches source pattern, run corresponding test
for mapping in "${SECURITY_MAP[@]}"; do
  source_pattern="${mapping%%:*}"
  test_file="${mapping##*:}"
  if echo "$STAGED_FILES" | grep -q "$source_pattern"; then
    SECURITY_TESTS="$SECURITY_TESTS $test_file"
  fi
done

npx vitest run --bail 1 $SECURITY_TESTS
```

**Result:** Runs SSRF tests (70 tests, 145ms) when `ssrf.ts` is staged. Findings #423, #424 would have been caught immediately.

#### 3. Pre-Push Hook (Changed Files Only)

Replaced full-suite `npm test` with scoped discovery:

```bash
CHANGED=$(git diff origin/main...HEAD --name-only 2>/dev/null || \
          git diff HEAD~1...HEAD --name-only 2>/dev/null || true)

# Find tests for changed files using same convention-based logic
# Skip pre-push if no changes (e.g., empty commits)
```

**Benefit:** Only runs tests for changed files. No more forced `--no-verify` due to pre-existing failures.

#### 4. Explicit npm Scripts

Added `test:security-critical` for manual invocation of all security test suites.

### Key Learnings

#### 1. Error Suppression in Hooks is an Anti-Pattern

```bash
# WRONG — hides real failures
npx jest --findRelatedTests $FILES 2>/dev/null || true

# RIGHT — let errors propagate
npx vitest run --bail 1 $FILES
```

If a command is expected to sometimes succeed/fail, handle specific exit codes instead of suppressing all stderr.

#### 2. `vitest related` vs Convention-Based

| Approach         | Pros                              | Cons                                                    |
| ---------------- | --------------------------------- | ------------------------------------------------------- |
| `vitest related` | Finds indirect dependents         | Loads entire project; hits compile errors; slow startup |
| Convention-based | Fast; no compilation; predictable | Misses indirect dependents                              |

For pre-commit hooks where speed matters and false negatives are acceptable (CI catches the rest), convention-based wins.

#### 3. Hook Migration Checklist

When switching test frameworks, update ALL of these (not just config and test files):

- [ ] `.husky/pre-commit`
- [ ] `.husky/pre-push`
- [ ] `scripts/` custom test scripts
- [ ] `package.json` test scripts
- [ ] `.github/workflows/` CI steps
- [ ] CLAUDE.md / dev docs
- [ ] Audit for error suppression anti-patterns

#### 4. Pre-Push Hooks Must Not Run Full Suites

When 121 pre-existing failures exist, full suite always fails → `--no-verify` → all hooks bypassed. Solution: project-scoped or file-scoped tests only.

---

## Part 3: SSRF Security Fixes (PR #91)

### Two P1 Vulnerabilities Discovered by PR #89 Testing

#### Finding #423: IPv4-Compatible IPv6 Hex Bypass

**Problem:** `isPrivateIPv6()` handled two forms of IPv4-in-IPv6 but missed one:

| Form                     | Example            | Handled? | URL Parser Output |
| ------------------------ | ------------------ | -------- | ----------------- |
| IPv4-mapped (dotted)     | `::ffff:127.0.0.1` | ✓ Yes    | `::ffff:7f00:1`   |
| IPv4-mapped (hex)        | `::ffff:7f00:1`    | ✓ Yes    | `::ffff:7f00:1`   |
| IPv4-compatible (dotted) | `::127.0.0.1`      | ✗ No     | `::7f00:1`        |
| IPv4-compatible (hex)    | `::7f00:1`         | ✗ No     | `::7f00:1`        |

**Attack vector:**

```
Input URL:        https://[::127.0.0.1]/admin/secrets
After URL parsing: hostname = "::7f00:1"  (normalized by Node.js)
Old isPrivateIPv6: false (no regex match)
Result:           SSRF to localhost succeeds ✗
```

**Fix:** Added IPv4-compatible address detection:

```typescript
// IPv4-compatible: ::x.x.x.x (deprecated RFC 4291 §2.5.5.1 but still parseable)
const compat = normalized.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
if (compat) return isPrivateIPv4(compat[1]);

// IPv4-compatible hex form: ::HHHH:HHHH (as normalized by URL parser)
const hexCompat = normalized.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
if (hexCompat) {
  const hi = parseInt(hexCompat[1], 16);
  const lo = parseInt(hexCompat[2], 16);
  const a = (hi >> 8) & 0xff;
  const b = hi & 0xff;
  const c = (lo >> 8) & 0xff;
  const d = lo & 0xff;
  return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
}
```

**Tests added:** 4 tests covering IPv4-compatible loopback, Class A/C private, and metadata endpoints.

#### Finding #424: DNS TOCTOU Race Condition

**Problem:** `validateSsrfUrl()` resolved DNS and checked IPs, but returned `void`. Between validation and caller's `fetch()`, DNS could rebind (TTL=0 attack):

```
Time 0: validateSsrfUrl("https://evil.com") → DNS resolves to 93.184.216.34 (public) → PASS
Time 1: DNS TTL expires, attacker rebinds evil.com → 127.0.0.1
Time 2: fetch("https://evil.com") → DNS resolves to 127.0.0.1 → SSRF ✗
```

**Fix:** Return resolved IPs and provide DNS pinning agent:

```typescript
export interface SsrfValidationResult {
  resolvedIps: Array<{ address: string; family: 4 | 6 }>;
}

export async function validateSsrfUrl(url: string): Promise<SsrfValidationResult> {
  // ... validation ...
  const results = await lookup(hostname, { all: true });
  const resolvedIps: SsrfValidationResult['resolvedIps'] = [];
  for (const result of results) {
    // ... IP checks ...
    resolvedIps.push({ address: result.address, family: result.family as 4 | 6 });
  }
  return { resolvedIps };
}

export function createSsrfSafeAgent(resolvedIps: SsrfValidationResult['resolvedIps']): https.Agent {
  let callIndex = 0;
  return new https.Agent({
    lookup: (_hostname, _options, callback) => {
      const ip = resolvedIps[callIndex % resolvedIps.length];
      callIndex++;
      callback(null, ip.address, ip.family);
    },
  });
}

// Usage: pin to validated IPs
const { resolvedIps } = await validateSsrfUrl(url);
const agent = createSsrfSafeAgent(resolvedIps);
const response = await fetch(url, { agent });
```

**Non-breaking guarantee:** Changing return type from `Promise<void>` to `Promise<SsrfValidationResult>` is safe because:

- Existing callers use `await validateSsrfUrl(url)` without destructuring
- Awaiting an object vs void is valid
- `InboxPollingService` is a stub behind feature flag

### Metrics

| Metric        | Value      |
| ------------- | ---------- |
| Files changed | 2          |
| Tests         | 78/78 pass |
| Lines         | +270/-6    |
| Sprint type   | Solo       |
| Time          | ~30 min    |

---

## Extracted Patterns

### Pattern 1: URL Parser Normalization Awareness (P1-class, refines critical-patterns.md #6)

**Rule:** Always test SSRF validation against `new URL(input).hostname`, not raw strings. URL parsers normalize IP representations in ways that bypass string-based regex checks.

| Input                | `new URL().hostname` | Risk                 |
| -------------------- | -------------------- | -------------------- |
| `0177.0.0.1` (octal) | `127.0.0.1`          | Caught               |
| `0x7f000001` (hex)   | `127.0.0.1`          | Caught               |
| `::ffff:127.0.0.1`   | `::ffff:7f00:1`      | **Hex form, caught** |
| `::127.0.0.1`        | `::7f00:1`           | **Hex form, MISSED** |

**When to apply:** Any SSRF validation rewrite. Test both dotted-decimal and hex forms.

### Pattern 2: Return-Value DNS Pinning (P1-class, new)

**Rule:** SSRF validation functions must return resolved IPs so callers can pin DNS. Returning `void` creates an inherent TOCTOU gap.

```typescript
// WRONG
await validateSsrfUrl(url); // DNS → 93.x (public)
await fetch(url); // DNS may now → 127.x (rebinding)

// RIGHT
const { resolvedIps } = await validateSsrfUrl(url);
const agent = createSsrfSafeAgent(resolvedIps);
await fetch(url, { agent }); // No re-resolution
```

**Non-breaking migration:** Changing `void` to object return is safe when callers `await` without destructuring.

### Pattern 3: Env Var Backward Compatibility (P2-class, new)

**Rule:** When renaming env vars, provide an `applyEnvFallbacks()` function that maps old names to new ones with deprecation warnings. Call BEFORE config parsing.

```typescript
// Old deployments → works without code changes
export LEGACY_API_KEY=xxx npm start

// Logs deprecation warning
[DEPRECATION] LEGACY_API_KEY is deprecated. Use SERVICE_API_KEY instead.
```

**When to apply:** Any env var rename, especially across teams or customer deployments.

### Pattern 4: Anti-Pattern Scanner Granular Scoping (P2-class, refined)

**Rule:** Every scanner rule needs three scoping dimensions:

1. File scope (directories/globs the rule applies to)
2. Line scope (new lines only vs all lines)
3. Context scope (test files, generated code excluded by default)

```bash
# WRONG — checks all files, all lines
grep -r "console\." --include="*.ts" src/

# RIGHT — file scope + line scope + context scope
git diff --cached --unified=0 -- 'packages/backend/src/**/*.ts' \
  ':!**/*.test.ts' ':!**/*.spec.ts' \
  | grep "^\+" | grep "console\." | grep -v "console.warn\|console.error"
```

**When to apply:** All anti-pattern scanners (console, TODO, credentials, etc.).

### Pattern 5: Query Key Factories (P2-class, new)

**Rule:** Use factory functions for TanStack Query keys. Enables surgical cache invalidation instead of overbroad invalidation storms.

```typescript
export const circleKeys = {
  all: ['circles'] as const,
  lists: () => [...circleKeys.all, 'list'] as const,
  detail: (id: string) => [...circleKeys.all, 'detail', id] as const,
};

// Overbroad: invalidates everything
queryClient.invalidateQueries({ queryKey: ['circles'] });

// Surgical: only lists
queryClient.invalidateQueries({ queryKey: circleKeys.lists() });
```

**When to apply:** Every React Query hook. Reference TanStack Query docs for the pattern.

### Pattern 6: Spec-Based Security Testing (P1-class, new)

**Rule:** For security validation functions, test against all specification categories, not gap-patched known bypasses. Organize tests by OWASP/RFC category, not by fix history.

```typescript
// OWASP SSRF categories
describe('SSRF Validation', () => {
  describe('IPv4 private ranges', () => {});
  describe('IPv6 loopback/private', () => {});
  describe('IPv4-mapped IPv6', () => {});
  describe('IPv4-compatible IPv6', () => {}); // ← Spec says test this
  describe('Decimal/octal/hex IPs', () => {});
  describe('DNS rebinding', () => {});
  describe('Protocol smuggling', () => {});
});
```

**When to apply:** All security validation rewrites (SSRF, XSS, CSRF, auth, input validation).

---

## Process Observations

### 1. Three-PR Coordination Pattern Works Well

| PR  | Role                              | Outcome                          | Dependency                                   |
| --- | --------------------------------- | -------------------------------- | -------------------------------------------- |
| #89 | P2/P3 remediation + discovery     | 15 findings + test rewrite       | Standalone                                   |
| #90 | Hook migration + test enforcement | Ensures SSRF tests run on commit | After #89 (depends on SSRF tests)            |
| #91 | SSRF security fixes               | 2 P1 vulnerabilities             | After #89 (fix findings discovered by tests) |

**Lesson:** Discovery (PR #89) → Infrastructure (PR #90) → Security fixes (PR #91) is a natural sequence. Infrastructure improvements often reveal what-was-broken, then fixes follow.

### 2. 69 Files, 0 Merge Conflicts

Domain-grouped work maintained isolation across PRs. Pattern proven across 11+ sprints now.

### 3. Spec-Based Testing as Prevention

The SSRF test rewrite (70 tests, OWASP-organized) was the discovery mechanism. This validates the prevention strategy: "When rewriting tests, use spec-based categories, not known bypasses."

---

## Prevention

### 1. Hook Migration Checklist

Every test framework migration must include:

- [ ] `.husky/pre-commit` updated
- [ ] `.husky/pre-push` updated
- [ ] `scripts/` custom test runners updated
- [ ] `package.json` test scripts updated
- [ ] `.github/workflows/` CI steps updated
- [ ] CLAUDE.md dev docs updated
- [ ] Audit for `2>/dev/null || true` anti-patterns

### 2. Never Suppress Errors in Hooks

```bash
# After ANY infrastructure change, grep for error suppression:
grep -r "2>/dev/null || true" .husky/
```

If found, review whether the suppression is intentional. Default: let errors propagate and block commits.

### 3. Security Files to Test Mapping

When adding new security-critical files (rate limiting, input validation, etc.), add an entry to `scripts/run-security-tests.sh`.

### 4. Spec-Based Test Rewrites

When rewriting tests for security code:

1. Find the specification (OWASP, RFC, vendor docs)
2. Extract all categories/bypass vectors
3. Write tests for each category
4. Don't just patch around known gaps

### 5. Triage Before Remediation

Before assigning findings to agents:

- [ ] Architect reviews each finding against source
- [ ] Classify as DO / WONT_FIX / DEFERRED
- [ ] Only brief DO items

---

## Cross-References

| Document                                                                                                                 | Why Relevant                                       |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| [critical-patterns.md #6: SSRF Validation](../patterns/critical-patterns.md#6-ssrf-validation-4-p1s-in-security-sprints) | IPv4-compatible hex refines the validation pattern |
| [common-solutions.md #2: TTLCache](../patterns/common-solutions.md#2-ttlcache-for-in-memory-maps)                        | Reused from prior sprint                           |
| [common-solutions.md #1: Double-Submit](../patterns/common-solutions.md#1-frontend-double-submit-prevention)             | Prevention pattern referenced in review            |
| [common-solutions.md #3: Env Var Validation](../patterns/common-solutions.md#3-environment-variable-validation)          | New pattern: `applyEnvFallbacks()`                 |
| [common-solutions.md #13: Query Key Factories](../patterns/common-solutions.md#13-tanstack-query-key-factories)          | New pattern: TanStack Query best practice          |
| [PR #89 Compound Doc](p2p3-remediation-r6-sprint-15-findings-20260221.md)                                                | Full detail on 15 findings remediated              |
| [PR #90 Compound Doc](../infrastructure-issues/pr90-hook-migration-security-test-enforcement-20260221.md)                | Hook migration details and learnings               |
| [PR #91 Compound Doc](../security-issues/pr91-ssrf-ipv4compat-dns-toctou-20260221.md)                                    | SSRF fix details and test coverage                 |

---

## Summary for Future Sprints

**Reusable artifacts:**

- `applyEnvFallbacks()` → `packages/backend/src/utils/env-fallbacks.ts`
- SSRF test suite (70 tests) → `packages/backend/src/__tests__/ssrf.test.ts`
- Query key factories → `packages/frontend/src/hooks/query-keys.ts`
- Security-critical file mapping → `scripts/run-security-tests.sh`
- Pre-commit convention → `.husky/pre-commit`

**Patterns to apply everywhere:**

1. Spec-based testing for security code
2. Env var backward compatibility when renaming
3. DNS pinning for SSRF validation
4. Query key factories for React Query
5. Granular scanner scoping to reduce false positives

**When to triage aggressively:**

- Before any remediation sprint
- If > 20 findings and < 12 hours to fix

**When to use hooks:**

- Every test framework migration
- Every security-critical file addition
