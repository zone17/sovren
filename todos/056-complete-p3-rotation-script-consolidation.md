---
status: pending
priority: p3
issue_id: '056'
tags: [code-review, dead-code, yagni, credential-rotation]
dependencies: []
---

# Rotation Script Consolidation

## Problem Statement

The project contains excessive duplication in credential rotation scripts:

- **6 Supabase rotation files (2,901 lines total)**:

  - `automated-supabase-rotation.ts` (663 lines)
  - `rotate-database-credentials.ts` (511 lines)
  - `supabase-credential-rotation.py` (470 lines)
  - `verify-credential-rotation.ts` (569 lines)
  - `verify-rotation-setup.ts` (292 lines)
  - `complete-immed-004-supabase-rotation.sh` (396 lines)

- **3 GitHub rotation files (1,247 lines)**:
  - `automated-github-token-rotation.ts` (695 lines)
  - `verify-token-rotation.sh` (237 lines)
  - `complete-immed-003-github-token-rotation.sh` (315 lines)

Within the retained scripts, duplicate methods exist:

- `updateAWSSecrets` vs `updateAWSSecretsAtomically`
- `verifyConnection` vs `verifyConnectionComprehensive`
- Other redundant method pairs

This creates maintenance burden, increases risk of inconsistent behavior, and violates YAGNI principles.

## Findings

**Location**: `scripts/` directory

**Impact**:

- 4,148 lines of duplicate code across 9 rotation scripts
- Multiple implementations of the same functionality increase likelihood of bugs
- Unclear which script is the "source of truth" for rotation operations
- Higher cognitive load for developers maintaining rotation logic

**Root Cause**: Iterative development without cleanup led to script proliferation rather than consolidation.

## Proposed Solutions

### Recommended: Consolidate to 2 Scripts

1. **Keep one Supabase rotation script** (select the most complete/recent)
2. **Keep one GitHub token rotation script** (select the most complete/recent)
3. **Delete all other rotation scripts**
4. **Refactor retained scripts** to remove duplicate methods:
   - Choose one implementation pattern (e.g., `updateAWSSecretsAtomically`)
   - Remove redundant verification methods
   - Consolidate shared utilities into a common module if needed

### Alternative: Create Unified Rotation Framework

If rotation logic is truly shared:

- Extract common rotation patterns into `scripts/lib/credential-rotation.ts`
- Implement thin wrappers for Supabase and GitHub that use the shared framework
- Reduces total line count further and ensures consistency

## Technical Details

**Files Affected**:

- `scripts/automated-supabase-rotation.ts`
- `scripts/rotate-database-credentials.ts`
- `scripts/supabase-credential-rotation.py`
- `scripts/verify-credential-rotation.ts`
- `scripts/verify-rotation-setup.ts`
- `scripts/complete-immed-004-supabase-rotation.sh`
- `scripts/automated-github-token-rotation.ts`
- `scripts/verify-token-rotation.sh`
- `scripts/complete-immed-003-github-token-rotation.sh`

**Analysis Required**:

1. Compare all 6 Supabase scripts to identify the most feature-complete
2. Compare all 3 GitHub scripts to identify the most feature-complete
3. Audit method duplication within retained scripts
4. Verify no external CI/CD references to scripts being deleted

**Complexity**: Low (deletion + refactoring)

## Acceptance Criteria

- [ ] Only 1 Supabase rotation script remains
- [ ] Only 1 GitHub token rotation script remains
- [ ] No duplicate methods exist in retained scripts (e.g., only one version of `updateAWSSecrets`)
- [ ] Retained scripts have clear, descriptive names indicating they are the canonical implementations
- [ ] All CI/CD workflows reference the correct retained scripts
- [ ] Documentation updated to reference only the retained scripts
- [ ] Verification run confirms rotation scripts still function correctly

## Work Log

_No work logged yet_

## Resources

- PR #73: Post-Remediation Review
- Related: Dead code cleanup initiative
