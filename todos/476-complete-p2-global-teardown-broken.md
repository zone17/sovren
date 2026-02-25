---
status: complete
priority: p2
issue_id: '476'
tags:
  - code-review
  - playwright
  - e2e-testing
  - correctness
dependencies: []
---

# Global Teardown: Wrong Directory, No Auth Cleanup, Relative Path

## Problem Statement

`global-teardown.ts` has multiple issues:

1. **Cleans wrong directory**: Removes `./e2e/test-data` (line 16) which doesn't exist, ignores `test-results/.auth/` which is the actual artifact created by setup
2. **Relative path**: Uses `'./e2e/test-data'` instead of `__dirname`-based resolution, may resolve incorrectly if Playwright runs from monorepo root
3. **No auth state cleanup**: `creator.json` persists on disk after test runs — currently contains demo credentials, but will contain real tokens when backend integration is enabled
4. **Inconsistent style**: Uses `import { FullConfig }` (not `import type`), dynamic `await import('fs/promises')`, unused `config` param without `_` prefix, emoji console logs

## Findings

**Agent consensus: 5/7** (security-sentinel, kieran-typescript, architecture, performance, pattern-recognition)

- Security: defense-in-depth — clean auth state prevents credential persistence
- Correctness: teardown cleans non-existent directory
- Consistency: file predates the rewrite (Oct 2024 vs Feb 2026)

## Proposed Solutions

### Option A: Rewrite global-teardown.ts (Recommended)

```typescript
import type { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function globalTeardown(_config: FullConfig): Promise<void> {
  const authDir = path.join(__dirname, '../test-results/.auth');
  await fs.rm(authDir, { recursive: true, force: true });
}

export default globalTeardown;
```

- Pros: Cleans actual artifact, uses \_\_dirname, consistent style
- Cons: None
- Effort: Small (5 min)
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/global-teardown.ts` (full rewrite)

## Acceptance Criteria

- [ ] Teardown cleans `test-results/.auth/` directory
- [ ] Uses `__dirname`-based path resolution
- [ ] Uses `import type` for FullConfig
- [ ] Unused config param prefixed with `_`
- [ ] No emoji console logs
- [ ] All 17 tests still pass

## Work Log

| Date       | Action                          | Outcome                                                     |
| ---------- | ------------------------------- | ----------------------------------------------------------- |
| 2026-02-24 | Identified by 5/7 review agents | Confirmed P2 - correctness + security defense-in-depth      |
| 2026-02-24 | Verified against source         | ALREADY FIXED — already uses fileURLToPath(import.meta.url) |
