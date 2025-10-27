# NOSTR Cleanup Migration Checklist
**EPIC 003 WAVE 5 - STORY 7: Cleanup Duplicate NOSTR Code**

**Date**: 2025-10-26
**Status**: READY FOR EXECUTION

---

## PRE-CLEANUP CHECKLIST

### 1. Backup Current State ✅

- [ ] Create git branch for cleanup work
  ```bash
  git checkout -b cleanup/nostr-duplicates
  ```

- [ ] Verify working directory is clean
  ```bash
  git status
  ```

- [ ] Run full test suite to establish baseline
  ```bash
  npm test
  npm run test:coverage
  ```
  - Expected: All tests passing
  - Document any existing failures

- [ ] Run type check
  ```bash
  npm run type-check
  ```
  - Expected: No TypeScript errors

- [ ] Build project to verify current state
  ```bash
  npm run build
  ```
  - Expected: Build succeeds

### 2. Review Audit Report

- [ ] Read `/docs/refactoring/nostr-duplication-audit.md` in full
- [ ] Understand the current architecture (feature-based modular design)
- [ ] Review the 1 item requiring cleanup (unused import)
- [ ] Understand that 0 duplicates were found (excellent architecture!)

---

## AUTOMATED CLEANUP EXECUTION

### Option 1: Run Automated Script (Recommended)

```bash
# From project root
ts-node scripts/cleanup-nostr-duplicates.ts
```

**What the script does**:
1. Creates backups in `.cleanup-backups/` directory
2. Removes unused `getEventHash` import from NotificationService.ts
3. Verifies the cleanup was successful
4. Generates a cleanup report

**Expected Output**:
```
🧹 NOSTR Duplication Cleanup Script
ℹ EPIC 003 WAVE 5 - STORY 7: Cleanup Duplicate NOSTR Code

🔧 Executing Cleanup Tasks
[M1] Remove unused getEventHash import from NotificationService
✓ Completed successfully

🔍 Verifying Cleanup
✓ NotificationService has correct nip19 import
✓ NotificationService no longer imports unused getEventHash

📊 Cleanup Report
Total tasks: 1
Successful: 1
Failed: 0

✅ Cleanup Completed Successfully
```

### Option 2: Manual Cleanup

If you prefer manual cleanup:

#### Task M1: Remove Unused Import

**File**: `/packages/frontend/src/features/nostr/notifications/services/NotificationService.ts`

**Line**: 7

**Change**:
```diff
- import { getEventHash, nip19 } from 'nostr-tools';
+ import { nip19 } from 'nostr-tools';
```

**Steps**:
1. Open the file in your editor
2. Navigate to line 7
3. Remove `getEventHash, ` from the import statement
4. Save the file

---

## POST-CLEANUP VERIFICATION

### 1. Immediate Verification

- [ ] Check git diff to review changes
  ```bash
  git diff
  ```
  - Expected: Only 1 line changed in NotificationService.ts

- [ ] Verify file syntax is correct
  ```bash
  npm run type-check
  ```
  - Expected: No new TypeScript errors

### 2. Test Suite Verification

- [ ] Run unit tests
  ```bash
  npm test
  ```
  - Expected: All tests pass (same as baseline)

- [ ] Run coverage report
  ```bash
  npm run test:coverage
  ```
  - Expected: Coverage remains at 85%+ globally

- [ ] Run frontend-specific tests
  ```bash
  npm run test:frontend
  ```
  - Expected: All frontend tests pass

### 3. Build Verification

- [ ] Build the project
  ```bash
  npm run build
  ```
  - Expected: Build succeeds with no errors

- [ ] Check bundle size (optional)
  ```bash
  npm run build:analyze
  ```
  - Expected: Minimal or no change in bundle size

### 4. Code Quality Checks

- [ ] Run linter
  ```bash
  npm run lint
  ```
  - Expected: No new lint errors

- [ ] Run formatter check
  ```bash
  npm run format:check
  ```
  - Expected: All files properly formatted

### 5. Manual Code Review

- [ ] Verify NotificationService.ts has no `getEventHash` references
  ```bash
  grep -n "getEventHash" packages/frontend/src/features/nostr/notifications/services/NotificationService.ts
  ```
  - Expected: No matches found

- [ ] Verify `nip19` import still exists and is used
  ```bash
  grep -n "nip19" packages/frontend/src/features/nostr/notifications/services/NotificationService.ts
  ```
  - Expected: 1 import line, plus usage in the file

---

## COMMIT AND DOCUMENT

### 1. Stage Changes

```bash
git add packages/frontend/src/features/nostr/notifications/services/NotificationService.ts
git add docs/refactoring/nostr-duplication-audit.md
git add docs/refactoring/nostr-cleanup-checklist.md
git add scripts/cleanup-nostr-duplicates.ts
```

### 2. Create Commit

```bash
git commit -m "$(cat <<'EOF'
refactor(nostr): remove unused getEventHash import from NotificationService

EPIC 003 WAVE 5 - STORY 7: Cleanup Duplicate NOSTR Code

Changes:
- Removed unused getEventHash import from NotificationService.ts
- Retained nip19 import which is actively used for notification URLs

Audit Results:
- Total duplicates found: 0 (ZERO - excellent architecture!)
- Files cleaned: 1 (unused import removal)
- Lines of code removed: 1
- Architecture health score: 9.5/10

Documentation:
- Added comprehensive NOSTR duplication audit report
- Created automated cleanup script
- Documented migration checklist

Testing:
- All tests passing ✅
- Type check passing ✅
- Build successful ✅
- Bundle size unchanged ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 3. Update CHANGELOG.md

Add the following entry:

```markdown
## [Unreleased]

### Refactoring

**EPIC 003 WAVE 5 - STORY 7: Cleanup Duplicate NOSTR Code** (US-324)

- **AUDIT COMPLETE**: Comprehensive NOSTR code duplication audit reveals ZERO duplicates
- **CLEANUP**: Removed unused `getEventHash` import from NotificationService
- **ARCHITECTURE**: Feature-based modular design verified as exemplary (9.5/10 health score)
- **DOCUMENTATION**: Added comprehensive audit report and migration checklist
- **SCRIPT**: Created automated cleanup script for future use

**Audit Findings**:
- Total NOSTR files analyzed: 27
- Duplicate implementations found: 0 (ZERO)
- Legacy code to remove: 0 (ZERO)
- Minor cleanup items: 1 (unused import)
- Architecture quality: Elite (9.5/10)

**Files**:
- Modified: `packages/frontend/src/features/nostr/notifications/services/NotificationService.ts`
- Added: `docs/refactoring/nostr-duplication-audit.md`
- Added: `docs/refactoring/nostr-cleanup-checklist.md`
- Added: `scripts/cleanup-nostr-duplicates.ts`

**Impact**: Zero breaking changes, improved code hygiene, validated elite architecture
```

### 4. Stage and Commit CHANGELOG

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for NOSTR cleanup (US-324)"
```

---

## QUALITY GATES

### All Quality Gates Must Pass ✅

- [ ] TypeScript compilation: NO ERRORS
- [ ] Unit tests: ALL PASSING
- [ ] Integration tests: ALL PASSING
- [ ] Test coverage: >= 85% globally
- [ ] Linting: NO ERRORS
- [ ] Formatting: ALL FILES FORMATTED
- [ ] Build: SUCCESSFUL
- [ ] Bundle size: NO SIGNIFICANT INCREASE

---

## ROLLBACK PROCEDURE (IF NEEDED)

If any issues are discovered after cleanup:

### Option 1: Restore from Script Backup

```bash
# Backups are in .cleanup-backups/ directory
ls -la .cleanup-backups/

# Restore specific file
cp .cleanup-backups/NotificationService.ts.<timestamp>.bak \
   packages/frontend/src/features/nostr/notifications/services/NotificationService.ts
```

### Option 2: Git Revert

```bash
# Revert the cleanup commit
git log --oneline -5  # Find the commit hash
git revert <commit-hash>
```

### Option 3: Reset Branch

```bash
# If on cleanup branch, reset to main
git checkout main
git branch -D cleanup/nostr-duplicates
```

---

## POST-MERGE TASKS

### After Merging to Main

- [ ] Delete cleanup branch locally
  ```bash
  git branch -d cleanup/nostr-duplicates
  ```

- [ ] Delete remote branch (if pushed)
  ```bash
  git push origin --delete cleanup/nostr-duplicates
  ```

- [ ] Update project documentation index
  - Add link to audit report in main README (optional)

- [ ] Archive cleanup backups
  ```bash
  tar -czf nostr-cleanup-backups-$(date +%Y%m%d).tar.gz .cleanup-backups/
  rm -rf .cleanup-backups/
  ```

---

## FUTURE WORK (NOT PART OF THIS CLEANUP)

The audit identified these services as **documented but not yet implemented**. These should be tackled in separate user stories:

### Planned Service Implementations

1. **US-303**: EventPublisherService
   - Centralized event publishing to relays
   - Status: Documented, not implemented

2. **US-304**: SubscriptionManagerService
   - Centralized subscription management
   - Deduplication of subscriptions
   - Status: Documented, not implemented

3. **US-315**: KeyManagementService
   - NIP-07 browser extension support (Alby, nos2x)
   - Secure manual key input
   - Status: Documented, not implemented

4. **US-312**: EventCacheService
   - LRU cache for NOSTR events
   - Reduce relay queries by 70%
   - Status: Documented, not implemented

5. **US-306**: NIP05Service
   - NIP-05 identifier verification
   - Status: Documented, not implemented

6. **US-300**: RelayPoolManager
   - Relay connection pooling
   - Health monitoring and failover
   - Status: Documented, not implemented

**Note**: These are **not duplicates**. Do not implement as part of this cleanup.

---

## SUCCESS CRITERIA

This cleanup is considered successful when:

- [x] Audit report shows 0 duplicates (ACHIEVED ✅)
- [ ] Automated cleanup script executes without errors
- [ ] All tests pass after cleanup
- [ ] Build succeeds after cleanup
- [ ] Git commit created with proper documentation
- [ ] CHANGELOG.md updated
- [ ] No regressions in functionality
- [ ] Code review approved (if required)

---

## NOTES

### Why So Few Cleanup Items?

This codebase demonstrates **elite engineering discipline**:

1. **Feature-based modular architecture** prevents duplication by design
2. **Service layer abstraction planning** documented before implementation
3. **Mock implementations** clearly labeled with TODO comments
4. **Type-only imports** minimize runtime dependencies
5. **Comprehensive testing** ensures quality

### Recommendations for Future Development

To maintain this exemplary architecture:

1. ✅ Continue feature-based modular design
2. ✅ Keep types separate from implementation
3. ✅ Use service layer for all NOSTR operations
4. ✅ Document planned services before implementation
5. ✅ Use mocks with clear TODO comments
6. ✅ Type-only imports for nostr-tools types
7. ✅ Comprehensive test coverage (85%+)

---

**Checklist Status**: READY FOR EXECUTION ✅
**Estimated Time**: 15 minutes (automated) or 10 minutes (manual)
**Risk Level**: MINIMAL (1 line change, comprehensive backups)
**Breaking Changes**: NONE

---

**Created**: 2025-10-26
**Last Updated**: 2025-10-26
**Version**: 1.0
