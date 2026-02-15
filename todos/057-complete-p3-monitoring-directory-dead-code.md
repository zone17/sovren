---
status: pending
priority: p3
issue_id: '057'
tags: [code-review, dead-code, yagni]
dependencies: []
---

# Monitoring Directory Dead Code Removal

## Problem Statement

The `monitoring/` directory contains 11,398 files totaling approximately 223,696 lines of code. This includes:

- `monitoring/dashboard/` directory
- `monitoring/dashboard-backup/` directory (exact copy of dashboard)

**Critical findings**:

- Not part of monorepo workspaces
- Not imported by any backend or frontend code
- Only reference is a test path in `jest.config.elite.ts` line 170
- No evidence of deployment as a separate service

Additionally, stale build artifacts remain in `packages/backend/dist/` for deleted source files (e.g., `security-headers.js`).

This represents significant dead code that increases repository size, slows cloning/indexing, and creates confusion about what code is actually in use.

## Findings

**Location**:

- `monitoring/` directory (11,398 files, ~223,696 lines)
- `packages/backend/dist/` (stale artifacts)

**Impact**:

- ~224K lines of unmaintained, unused code
- Repository bloat (git clone/pull overhead)
- IDE indexing slowdown
- Developer confusion about system architecture
- Potential security vulnerabilities in unmaintained code

**Evidence of Non-Use**:

1. Not listed in workspace configuration
2. No imports from backend or frontend packages
3. Only reference is a stale jest config path
4. No deployment configuration in docker-compose or CI/CD

## Proposed Solutions

### Recommended: Delete After Verification

1. **Verify no external deployment**: Confirm monitoring directory is not deployed as a standalone service
2. **Archive if uncertain**: Move to a separate git branch or archive repository before deletion
3. **Delete `monitoring/` directory entirely**
4. **Remove jest.config.elite.ts reference** at line 170
5. **Run clean build**: `rm -rf packages/backend/dist && npm run build`
6. **Update `.gitignore`** to prevent future dist artifact commits

### Alternative: Archive to Separate Repository

If there's historical value:

- Create `sovren-monitoring-archive` repository
- Move monitoring directory there with full git history
- Add README explaining why it was archived
- Remove from main repository

## Technical Details

**Files Affected**:

- `monitoring/` (entire directory)
- `monitoring/dashboard/`
- `monitoring/dashboard-backup/`
- `jest.config.elite.ts` (line 170)
- `packages/backend/dist/` (stale artifacts)

**Commands**:

```bash
# Verify no imports
rg --type ts --type tsx "from.*monitoring/" packages/

# Verify no deployment references
rg "monitoring/" docker-compose*.yml .github/workflows/

# Delete (after verification)
rm -rf monitoring/
rm -rf packages/backend/dist/

# Update jest config
# (manual edit to remove line 170 reference)

# Clean build
npm run build
```

**Complexity**: Low (deletion after verification)

## Acceptance Criteria

- [ ] Confirmed monitoring directory is not deployed separately
- [ ] `monitoring/` directory deleted
- [ ] `monitoring/dashboard-backup/` directory deleted
- [ ] `jest.config.elite.ts` no longer references monitoring paths
- [ ] `packages/backend/dist/` cleaned and rebuilt
- [ ] `.gitignore` updated to exclude `dist/` directories
- [ ] All tests pass after deletion
- [ ] CI/CD pipelines complete successfully
- [ ] Repository size reduced by ~224K lines

## Work Log

_No work logged yet_

## Resources

- PR #73: Post-Remediation Review
- Jest config: `jest.config.elite.ts:170`
- Related: Dead code cleanup initiative
