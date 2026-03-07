# Deprecated Code Audit - US-E5-041

**Date**: 2025-10-27
**Story**: US-E5-041 - Remove Deprecated Code
**Epic**: Epic 005 - Backend Service Refactoring (Phase 7: Documentation & Cleanup)

## Executive Summary

This audit identifies all deprecated code, unused files, and redundant implementations across the Sovren codebase for safe removal.

## 1. Old Configuration Files (SAFE TO DELETE)

### 1.1 Old Jest Configuration

- **File**: `/jest.config.old.cjs`
- **Status**: DEPRECATED
- **Replacement**: `jest.config.elite.ts` (active)
- **Action**: DELETE

### 1.2 Old Redux Store

- **File**: `/packages/frontend/src/store/index.old.ts`
- **Status**: DEPRECATED
- **Replacement**: `src/store/index.ts` (active)
- **Action**: DELETE

### 1.3 Old Backup Files

- **File**: `/monitoring/dashboard/data/tasks.json.backup`
- **Status**: BACKUP FILE
- **Action**: DELETE (after verification)

## 2. Duplicate Directory Structure (SAFE TO DELETE)

### 2.1 Nested Frontend Directory

- **Path**: `/packages/frontend/packages/frontend/`
- **Issue**: Duplicate nested structure
- **Contains**:
  - `src/features/content/components/ContentManagementTools.tsx` (DUPLICATE)
  - `src/features/content/components/__tests__/ContentManagementTools.us-071-074.test.tsx` (DUPLICATE)
  - `src/features/content/services/mockContentManagementService.ts` (DUPLICATE)
- **Action**: DELETE entire nested directory
- **Note**: Originals exist in correct location `/packages/frontend/src/features/`

## 3. Deprecated Type Definitions

### 3.1 Relay Configuration Types (KEEP with @deprecated)

- **File**: `/packages/shared/src/config/relay-config.ts`
- **Lines**: 315-321
- **Marked**: `@deprecated Use RelayConfig.getDefaultRelays() instead`
- **Action**: KEEP (for backward compatibility)
- **Note**: Properly documented with migration path

### 3.2 NOSTR Service Types (KEEP with @deprecated)

- **File**: `/packages/frontend/src/services/nostr/types.ts`
- **Line**: 17
- **Marked**: `@deprecated Use RelayState from @shared/types/nostr instead`
- **Action**: KEEP (for backward compatibility)

### 3.3 Relay Pool Manager (KEEP with @deprecated)

- **File**: `/packages/frontend/src/services/nostr/RelayPoolManager.ts`
- **Line**: 619
- **Marked**: `@deprecated Use RelayConfig.getRelayUrls() instead`
- **Action**: KEEP (for backward compatibility)

### 3.4 Shared Types Index (KEEP with @deprecated)

- **File**: `/packages/shared/src/types/nostr/index.ts`
- **Line**: 535
- **Marked**: `@deprecated Use RelayConfig.getRelayUrls() from @shared/config/relay-config instead`
- **Action**: KEEP (for backward compatibility)

## 4. TODO Comments Analysis

### 4.1 Production Code TODOs (REQUIRE REVIEW)

#### Backend Services

- **File**: `/monitoring/dashboard/backend/services/HealthCheckService.ts`
  - Line 173: `// TODO: Integrate with actual Lightning node`
  - Line 237: `// TODO: Execute actual database query`
  - Line 291: `// TODO: Integrate with actual payment service`
  - Line 344: `// TODO: Ping webhook endpoint`
  - Line 397: `// TODO: Check actual circuit breaker implementation`
  - **Action**: CONVERT TO ISSUES or IMPLEMENT

- **File**: `/monitoring/dashboard/backend/services/PaymentAlertingService.ts`
  - Line 360: `// TODO: Implement Slack webhook integration`
  - Line 372: `// TODO: Implement email integration`
  - Line 384: `// TODO: Implement PagerDuty integration`
  - Line 396: `// TODO: Implement webhook integration`
  - Line 404: `// TODO: Implement resolution notifications for each channel`
  - **Action**: CONVERT TO ISSUES (future features)

- **File**: `/monitoring/dashboard/backend/routes/payment.ts`
  - Line 54: `// TODO: Integrate with actual Lightning Network node`
  - Line 99: `// TODO: Integrate with actual Lightning Network payment processing`
  - Line 134: `// TODO: Fetch from database`
  - **Action**: CONVERT TO ISSUES or IMPLEMENT

#### Frontend Services

- **File**: `/packages/frontend/src/services/nostr/NIP05Service.ts`
  - Line 227: `// TODO: Implement IndexedDB cache layer`
  - Line 511: `// TODO: Implement IndexedDB persistence`
  - **Action**: CONVERT TO ISSUES (performance optimization)

#### Supabase Edge Functions

- **File**: `/supabase/functions/auth-nostr-validate/index.ts`
  - Line 165: `// TODO: Implement proper NOSTR signature verification`
  - **Action**: CRITICAL - IMPLEMENT or CONVERT TO HIGH-PRIORITY ISSUE

### 4.2 Training/Documentation TODOs (KEEP)

- **Location**: `/docs/training/**/*.md`
- **Count**: 40+ TODO comments
- **Action**: KEEP (intentional learning placeholders)

### 4.3 Migration Scripts TODOs (KEEP)

- **File**: `/scripts/state-migration/migrate-to-react-query.ts`
  - Line 338: `// TODO: Add proper type definitions`
  - **Action**: KEEP (migration guidance)

## 5. Unused Dependencies Analysis

### 5.1 Root package.json

- All dependencies appear actively used
- `enzyme-to-json`: Potentially unused (no Enzyme usage found)
- **Action**: VERIFY and remove if unused

### 5.2 Frontend package.json

- `@sentry/tracing`: Deprecated in favor of `@sentry/react`
- `react-beautiful-dnd`: Not found in source (search needed)
- `qrcode.react`: Not found in source (search needed)
- **Action**: VERIFY usage and remove if unused

### 5.3 Backend package.json

- `puppeteer`: Heavy dependency, verify usage
- `sharp`: Image processing, verify usage
- `path-to-regexp@0.1.7`: Old version pinned, check if still needed
- **Action**: VERIFY usage

## 6. Commented-Out Code

### 6.1 No Significant Commented Code Found

- Search for multi-line comments with "old", "legacy", "unused" found no results
- **Action**: NONE REQUIRED

## 7. Duplicate Code Opportunities

### 7.1 Test Utilities

- Multiple test utility files with similar mock setups
- **Files**:
  - `/packages/frontend/src/test-utils/mocks.ts`
  - `/packages/frontend/src/test-utils/test-providers.tsx`
  - `/packages/frontend/src/test-utils/react-query-test-utils.tsx`
- **Action**: CONSOLIDATE (future refactoring, not critical)

## 8. Database Migration Comments

### 8.1 Content Management Migration

- **File**: `/packages/backend/src/scripts/content-management-migration.ts`
- **Lines**: 567-569
- **Content**: Deprecation comments on old tables
- **Action**: KEEP (migration metadata)

## 9. Import Path Analysis

### 9.1 Relative Imports

- Most imports use proper path aliases (`@/`, `@shared/`)
- Some relative imports in App.tsx and test files
- **Action**: NO CHANGE NEEDED (current pattern is acceptable)

## 10. .gitignore Coverage

### 10.1 Current .gitignore Review Required

- Need to verify coverage of:
  - Build artifacts
  - Test coverage
  - Logs
  - Environment files
  - IDE files
- **Action**: REVIEW and UPDATE if needed

## Summary Statistics

| Category              | Count   | Action             |
| --------------------- | ------- | ------------------ |
| Old config files      | 3       | DELETE             |
| Duplicate directories | 1       | DELETE             |
| Deprecated types      | 4       | KEEP (@deprecated) |
| Production TODOs      | 15      | CONVERT TO ISSUES  |
| Training TODOs        | 40+     | KEEP               |
| Unused dependencies   | 5-8     | VERIFY & REMOVE    |
| Commented code        | 0       | NONE               |
| Duplicate code        | 3 files | FUTURE REFACTOR    |

## Safety Verification Commands

```bash
# Before any deletion
npm run type-check
npm run lint
npm run test
npm run build

# Verify no imports of old files
grep -r "jest.config.old" .
grep -r "index.old" .
grep -r "packages/frontend/packages" .
```

## Next Steps

1. Delete safe files (old configs, nested directory)
2. Verify test suite passes
3. Review and convert production TODOs to issues
4. Audit and remove unused dependencies
5. Update .gitignore
6. Document all removals
