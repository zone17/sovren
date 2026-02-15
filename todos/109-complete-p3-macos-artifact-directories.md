---
status: pending
priority: p3
issue_id: 109
tags: [code-review, cleanup, filesystem]
dependencies: []
---

# macOS Artifact Directories (" 2" Suffixes)

## Problem Statement

36 empty directories with " 2" suffixes exist throughout `packages/backend/src/` — these are **macOS Finder copy artifacts** from accidental duplicate folder creation.

**Examples**:

- `middleware/__tests__ 2/`
- `services/__tests__ 2/`
- `services/content 2/`
- `controllers/user 2/`

All confirmed empty (no files). These clutter the codebase, confuse directory navigation, and may cause issues with build tools or IDEs scanning file trees.

**Root cause**: Likely created when copying/moving folders in Finder, which appends " 2" if destination already exists.

## Findings

- **Location**: `packages/backend/src/` (various subdirectories)
- **Count**: 36 empty directories
- **Pattern**: All have " 2" suffix (some may have " 3", " 4" if repeatedly copied)
- **Impact**:
  - No functional breakage (all empty)
  - Clutter in file tree
  - Potential confusion when navigating codebase
  - May affect IDE indexing performance (scanning empty dirs)
- **Verification**: All confirmed empty via manual check or `find . -name "* 2" -type d -empty`

## Proposed Solutions

### Option 1: Delete Via Find Command

**Description**: Use `find` command to locate and delete all empty " 2" directories:

```bash
find packages/backend/src -name "* 2" -type d -empty -delete
```

**Pros**:

- One-line fix
- Fast execution (<1 second)
- Safe (only deletes empty directories matching pattern)
- Finds all instances automatically (no manual listing)

**Cons**:

- Requires command-line access
- No undo (but all empty, so low risk)
- May miss " 3", " 4" suffixes if they exist

**Effort**: Minimal (1 minute)
**Risk**: Very Low (only deletes empty dirs)

### Option 2: Manual Deletion via IDE/Finder

**Description**: Manually locate and delete each directory via IDE or Finder

**Pros**:

- Visual confirmation of each directory before deletion
- No command-line required
- Can inspect contents to be absolutely sure

**Cons**:

- Time-consuming (36 directories)
- Error-prone (may miss some)
- Tedious manual work

**Effort**: Medium (15-20 minutes)
**Risk**: Very Low

### Option 3: Git Clean + Gitignore Pattern

**Description**: Add `* 2/` pattern to `.gitignore`, run `git clean -fd`

**Pros**:

- Prevents future " 2" directories from being committed
- Git clean is reversible (with caution)

**Cons**:

- Requires git clean (potentially dangerous if not careful)
- Doesn't address root cause (user behavior in Finder)
- Gitignore pattern may be too broad

**Effort**: Low (5 minutes)
**Risk**: Medium (git clean can delete untracked work if misused)

## Recommended Action

**Option 1** - Delete via find command.

**Rationale**: Fastest, safest, most thorough solution. The `-empty` flag ensures only empty directories are deleted, and the pattern match is specific to " 2" suffix. Can easily extend to " 3", " 4" if needed. One-time cleanup with no ongoing maintenance.

**Implementation approach**:

1. **Verify empty**: Run dry-run to list directories first:
   ```bash
   find packages/backend/src -name "* 2" -type d -empty
   ```
2. **Review output**: Confirm all 36 directories are listed and expected
3. **Delete**: Run with `-delete` flag:
   ```bash
   find packages/backend/src -name "* 2" -type d -empty -delete
   ```
4. **Verify cleanup**: Run find again to confirm all removed:
   ```bash
   find packages/backend/src -name "* 2" -type d
   # Should return no results
   ```
5. **Optional**: Add to cleanup script for future runs:
   ```bash
   # scripts/cleanup.sh
   echo "Removing macOS Finder artifacts..."
   find packages/backend/src -name "* 2" -type d -empty -delete
   find packages/backend/src -name "* 3" -type d -empty -delete
   ```
6. **Optional**: Add pre-commit hook to prevent committing " 2" directories:
   ```bash
   # .husky/pre-commit
   if git diff --cached --name-only | grep -q " 2/"; then
     echo "Error: Attempting to commit macOS Finder artifact (directory with ' 2' suffix)"
     exit 1
   fi
   ```

## Technical Details

**Find all " 2" directories** (dry run):

```bash
find packages/backend/src -name "* 2" -type d -empty
```

**Expected output** (36 directories):

```
packages/backend/src/middleware/__tests__ 2/
packages/backend/src/services/__tests__ 2/
packages/backend/src/services/content 2/
packages/backend/src/controllers/user 2/
# ... 32 more
```

**Delete command**:

```bash
find packages/backend/src -name "* 2" -type d -empty -delete
```

**Explanation of flags**:

- `find packages/backend/src`: Start search in backend source
- `-name "* 2"`: Match any directory ending with " 2"
- `-type d`: Only match directories (not files)
- `-empty`: Only match empty directories (safety check)
- `-delete`: Delete matched directories

**Extended cleanup** (catch " 3", " 4", etc.):

```bash
# Remove all numbered Finder artifacts
find packages/backend/src -regex ".* [0-9]+$" -type d -empty -delete
```

**Prevention via pre-commit hook**:

```bash
#!/bin/bash
# .husky/pre-commit or .git/hooks/pre-commit

# Reject commits with macOS Finder artifacts
if git diff --cached --name-only | grep -E " [0-9]+/" > /dev/null; then
  echo "❌ Error: Attempting to commit macOS Finder artifact directory"
  echo "   Found directories with numbered suffixes (e.g., ' 2/', ' 3/')"
  echo ""
  echo "   Run this to clean up:"
  echo "   find . -name '* 2' -type d -empty -delete"
  exit 1
fi
```

**Alternative: Add to package.json scripts**:

```json
{
  "scripts": {
    "cleanup:finder": "find packages -name '* 2' -type d -empty -delete && find packages -name '* 3' -type d -empty -delete"
  }
}
```

## Acceptance Criteria

- [ ] All 36 " 2" directories removed from `packages/backend/src/`
- [ ] Verify with `find packages/backend/src -name "* 2" -type d` (returns nothing)
- [ ] No files accidentally deleted (only empty directories)
- [ ] Git status shows clean or only directory removals
- [ ] Optional: Add cleanup script to `scripts/cleanup.sh`
- [ ] Optional: Add pre-commit hook to prevent future commits of Finder artifacts
- [ ] Optional: Document pattern in CONTRIBUTING.md ("avoid copying folders in Finder")

## Work Log

### 2026-02-14

- Identified in PR #73 full code review

## Resources

- PR #73: https://github.com/zone17/sovren/pull/73
- Affected directory: `packages/backend/src/` (36 empty " 2" directories)
- Find command: `find packages/backend/src -name "* 2" -type d -empty -delete`
- Related: macOS Finder behavior when copying folders with existing name at destination
