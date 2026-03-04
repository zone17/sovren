---
status: pending
priority: p1
issue_id: '647'
tags: [code-review, security, frontend, business-manager]
dependencies: []
---

# Export URL Bypasses apiClient Base URL

## Problem Statement

`taxApi.getExportUrl()` returns a relative path (`/api/v2/business/tax/export?...`) which is then passed to raw `fetch()` in `TaxSummary.tsx`. The `fetch()` call resolves the relative URL against `window.location.origin` (the frontend origin), not the backend API origin. In any deployment where frontend and backend are on different origins (which is the standard Sovren setup — Vercel frontend + Docker backend), the export request will hit the wrong server and fail silently or 404.

**Consensus**: 7/8 review agents flagged this independently.

## Findings

- `packages/frontend/src/features/business/services/taxApi.ts` — `getExportUrl()` builds a relative path without base URL
- `packages/frontend/src/features/business/components/TaxSummary.tsx` — `handleExport()` uses raw `fetch(url)` bypassing `apiClient` which handles base URL resolution
- The `apiClient` already handles base URL, auth headers, and error formatting — this code reimplements a subset poorly
- The auth header is manually attached via `apiClient.getToken()`, confirming the developer knew about apiClient but chose to bypass it for blob handling

## Proposed Solutions

### Solution A: Use apiClient for export (Recommended)

Add a blob/arraybuffer response method to the existing apiClient, or use apiClient's base URL + fetch:

```typescript
const handleExport = async (format: 'csv' | 'json') => {
  const response = await apiClient.getRaw(`/api/v2/business/tax/export`, {
    format,
    year: String(selectedYear),
  });
  const blob = await response.blob();
  // ... create download link
};
```

- **Pros**: Uses existing base URL resolution, auth headers, error handling
- **Cons**: May need to add a `getRaw()` method to apiClient
- **Effort**: Small
- **Risk**: Low

### Solution B: Prepend apiClient base URL to export URL

```typescript
const url = `${apiClient.baseUrl}${taxApi.getExportUrl(format, selectedYear)}`;
```

- **Pros**: Minimal change, no apiClient modification
- **Cons**: Reaches into apiClient internals, still duplicates auth header logic
- **Effort**: Small
- **Risk**: Low

## Technical Details

- **Affected files**: `packages/frontend/src/features/business/services/taxApi.ts`, `packages/frontend/src/features/business/components/TaxSummary.tsx`
- **Components**: TaxSummary export functionality
- **Related pattern**: critical-patterns.md — API client consistency

## Acceptance Criteria

- [ ] Export CSV/JSON requests hit the backend API origin, not frontend origin
- [ ] Auth headers are applied via apiClient (not manually)
- [ ] Export works in split-origin deployment (Vercel + Docker backend)
- [ ] No regression in export download behavior

## Work Log

| Date       | Action                                            | Learnings                                                 |
| ---------- | ------------------------------------------------- | --------------------------------------------------------- |
| 2026-03-04 | Created from PR #136 review (7/8 agent consensus) | Raw fetch bypassing apiClient is a recurring anti-pattern |

## Resources

- PR #136: Business Manager MVP
- `packages/frontend/src/services/apiClient.ts` — existing API client
