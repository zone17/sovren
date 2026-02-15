---
status: pending
priority: p2
issue_id: '098'
tags: [code-review, dead-code, scripts, duplication]
dependencies: []
---

# Triple Implementation of Credential Rotation Scripts

## Problem Statement

Supabase credential rotation is implemented 3 times in 3 different languages: TypeScript (`automated-supabase-rotation.ts`, 818 lines), Python (`supabase-credential-rotation.py`, 471 lines), and Bash (`complete-immed-004-supabase-rotation.sh`, 396 lines). GitHub token rotation is duplicated in TypeScript (693 lines) and Bash (315 lines). Total redundancy: ~2,693 lines across 5 files. The project is a TypeScript monorepo, rendering Python and Bash implementations obsolete.

## Findings

**Supabase Credential Rotation (3 implementations):**

1. `scripts/automated-supabase-rotation.ts` - 818 lines

   - Full TypeScript implementation
   - Integrated with app logger, Sentry, metrics
   - Encrypted backups, rollback support

2. `scripts/supabase-credential-rotation.py` - 471 lines

   - Python port of same logic
   - Separate error handling, no app integration

3. `scripts/complete-immed-004-supabase-rotation.sh` - 396 lines
   - Bash version for emergency manual rotation
   - Limited error handling, no encryption

**GitHub Token Rotation (2 implementations):**

1. `scripts/automated-github-token-rotation.ts` - 693 lines

   - TypeScript implementation
   - App-integrated

2. `scripts/github-token-rotation.sh` - 315 lines
   - Bash version
   - Manual fallback

**Total Duplication: 2,693 lines**

**Problems:**

- Bug fixes must be applied to 3-5 copies (high risk of divergence)
- Security patches (e.g., timing-safe HMAC, static salt issue) must be replicated
- Different error handling approaches across implementations
- Confusing for operators: which script to run?
- Maintenance burden: update dependencies in 3 languages
- Testing burden: need test suites for Python, Bash, TypeScript

**Current Usage:**

- Only TypeScript versions are referenced in documentation
- Python/Bash scripts appear to be legacy or "just in case" fallbacks
- No evidence of production use for Python/Bash versions

## Proposed Solutions

### Option 1: Delete Python and Bash Scripts, Keep TypeScript Only

**Pros:**

- Single source of truth
- Leverages existing app infrastructure (logger, Sentry, metrics)
- TypeScript is project's primary language
- Reduces maintenance burden by 2,000+ LOC
- Future fixes only need one implementation

**Cons:**

- Loses standalone script option (requires Node.js runtime)
- No fallback if TypeScript runtime unavailable
- Operators must use `ts-node` or compiled JS

**Effort:** Low (1 hour to delete + update docs)
**Risk:** Low

### Option 2: Keep TypeScript + Minimal Bash Fallback

**Pros:**

- TypeScript for normal operations
- Bash script for emergency/minimal environment
- Removes Python (middle ground, no clear value)
- Reduces LOC by ~1,300

**Cons:**

- Still maintain 2 implementations (Bash + TypeScript)
- Bash version needs updates for security issues
- Continued testing burden for Bash

**Effort:** Low (2 hours to delete Python + slim down Bash)
**Risk:** Low

### Option 3: Unified CLI with Compiled Binary

**Pros:**

- TypeScript source compiled to standalone binary (e.g., via `pkg` or `esbuild`)
- No runtime dependency (can run in minimal container)
- Single implementation, portable executable
- Best of both worlds: TypeScript DX + standalone deployment

**Cons:**

- Requires build step
- Binary must be versioned and distributed
- More complex CI/CD pipeline

**Effort:** Medium (4 hours to set up build + test)
**Risk:** Medium

## Recommended Action

**Option 1: Delete Python and Bash Scripts, Keep TypeScript Only**

The TypeScript implementations are canonical, well-integrated, and actively maintained. Python and Bash versions are legacy artifacts. The project is a Node.js monorepo—requiring Node.js for credential rotation is not a constraint.

Implementation:

1. **Archive before deletion:**

   - Move Python/Bash scripts to `scripts/archive/` for 1 sprint
   - Update README to note archival

2. **Delete after bake period:**

   - Delete `scripts/supabase-credential-rotation.py` (471 LOC)
   - Delete `scripts/complete-immed-004-supabase-rotation.sh` (396 LOC)
   - Delete `scripts/github-token-rotation.sh` (315 LOC)
   - Total removal: 1,182 LOC

3. **Update documentation:**

   - Document TypeScript script usage
   - Add examples for running via `ts-node` or compiled JS
   - Note that Node.js runtime is required

4. **Enhance TypeScript scripts:**
   - Ensure TypeScript scripts have clear --help output
   - Add dry-run mode for safety
   - Document dependencies (Node.js version, packages)

**Emergency Fallback Plan:**
If Node.js is unavailable, operators can:

1. Use Supabase/GitHub web UI for manual rotation
2. Restore archived Bash script from git history
3. Use compiled JS bundle (pre-built in CI)

## Technical Details

**Files to Archive (Then Delete):**

- `scripts/supabase-credential-rotation.py` (471 lines)
- `scripts/complete-immed-004-supabase-rotation.sh` (396 lines)
- `scripts/github-token-rotation.sh` (315 lines)

**Files to Keep:**

- `scripts/automated-supabase-rotation.ts` (818 lines) - canonical
- `scripts/automated-github-token-rotation.ts` (693 lines) - canonical

**Documentation Updates:**

- `docs/operations/credential-rotation.md` (or similar)
  - Remove references to Python/Bash scripts
  - Add TypeScript usage examples
  - Document Node.js requirement

**TypeScript Script Enhancement:**

```typescript
// Add to automated-supabase-rotation.ts
if (process.argv.includes('--help')) {
  console.log(`
Usage: ts-node scripts/automated-supabase-rotation.ts [options]

Options:
  --dry-run        Show what would be rotated without making changes
  --force          Skip confirmation prompts
  --backup-only    Create backup without rotating credentials
  --help           Show this help message

Requirements:
  - Node.js 18+
  - Environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY
  - Write access to .env.backup directory
  `);
  process.exit(0);
}
```

**LOC Savings:**

- Current: 2,693 lines (5 files)
- After cleanup: 1,511 lines (2 files)
- **Reduction: 1,182 lines (44%)**

## Acceptance Criteria

**Phase 1: Archive (Week 1)**

- [ ] Python and Bash scripts moved to `scripts/archive/`
- [ ] README updated noting archival and 1-sprint retention
- [ ] Team notified of archival (Slack/email)
- [ ] No production issues reported with TypeScript-only approach

**Phase 2: Deletion (Week 2)**

- [ ] Archived scripts deleted from repository
- [ ] Git history preserves scripts (can be restored if needed)
- [ ] Documentation updated to remove Python/Bash references
- [ ] TypeScript scripts enhanced with --help, --dry-run flags

**Phase 3: Verification**

- [ ] Credential rotation successfully run using TypeScript scripts
- [ ] Dry-run mode tested and validated
- [ ] Emergency fallback plan documented
- [ ] Team trained on TypeScript script usage
- [ ] No requests to restore archived scripts for 1 month

**Overall:**

- [ ] Total LOC reduction: 1,182 lines
- [ ] Single source of truth established (TypeScript)
- [ ] Maintenance burden reduced (1 language instead of 3)
- [ ] Security fixes only need one implementation

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Catalogued 5 rotation scripts across 3 languages
- Confirmed TypeScript versions are canonical and actively used
- Proposed deletion of Python/Bash duplicates

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- TypeScript script locations:
  - `scripts/automated-supabase-rotation.ts`
  - `scripts/automated-github-token-rotation.ts`
- Python/Bash script locations:
  - `scripts/supabase-credential-rotation.py`
  - `scripts/complete-immed-004-supabase-rotation.sh`
  - `scripts/github-token-rotation.sh`
- Related: Issue #102 (hardcoded salt in rotation scripts)
