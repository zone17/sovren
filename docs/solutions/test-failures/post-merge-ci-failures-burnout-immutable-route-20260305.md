---
title: 'Post-Merge CI Failures: E2E Rendering, PostgreSQL IMMUTABLE, Missing Routes'
category: 'test-failures'
date: '2026-03-05'
severity: 'P2'
tags: [e2e, playwright, postgresql, immutable, routing, react, conditional-rendering, cardtitle]
modules: [wellness, comments, migrations, frontend-router]
symptoms:
  - 'wellness.auth.spec.ts:54 E2E fails: BurnoutRiskGauge heading not found in error/loading states'
  - 'Integration tests reject expression index: functions in index expression must be marked IMMUTABLE'
  - '11 E2E tests fail in comments.public.spec.ts navigating to /content/:id (route undefined)'
root_causes:
  - 'BurnoutRiskGauge conditional rendering omitted <CardTitle> in loading/error states; E2E expects heading in all states'
  - 'PostgreSQL expression index used timezone-dependent ::date cast; IMMUTABLE indexes require session-independent expressions'
  - 'Slice 6 added comments E2E tests expecting /content/:id route; route was never implemented in App.tsx'
related_prs: ['#139', '#140']
patterns_reinforced:
  - 'common-solutions.md #82: Loading state must not hide structural UI'
  - "NEW: Expression indexes on timestamptz require AT TIME ZONE 'UTC' to be IMMUTABLE"
  - 'NEW: E2E tests adding routes must verify route exists in frontend router'
---

# Post-Merge CI Failures: E2E Rendering, PostgreSQL IMMUTABLE, Missing Routes

## Problem Statement

After PR #139 (Slice 7: Shield + Business Advanced) merged to main, CI revealed 3 failures:

1. **1 wellness E2E failure** — `burnoutRiskHeading` locator couldn't find heading
2. **Integration test failure** — migration expression index rejected as non-IMMUTABLE
3. **11 comments E2E failures** — `/content/:id` route didn't exist

All 3 are different failure classes but share a root theme: **cross-concern gaps where implementation in one domain doesn't account for requirements in another** (component states vs E2E locators, SQL semantics vs PostgreSQL optimizer, test routes vs frontend router).

## Investigation

### Finding 1: BurnoutRiskGauge heading missing in loading/error states

The E2E POM uses `page.getByRole('heading', { name: /burnout risk/i }).first()`. Without a backend in CI, the wellness API call fails → component enters error state. The error state JSX had no `<CardTitle>` → no `<h3>` in DOM → locator fails.

Verified other wellness cards (`WorkPatternHeatmap`, `BoundarySettings`) — they all render headings in all states. `BurnoutRiskGauge` was the outlier.

### Finding 2: PostgreSQL IMMUTABLE expression index

The migration `20260305000000_slice7_wellness_schema_gaps.sql` created:

```sql
CREATE UNIQUE INDEX idx_wellness_snapshots_creator_day
  ON wellness_snapshots (creator_id, (created_at::date));
```

PostgreSQL requires expression index functions to be IMMUTABLE. The `::date` cast on `timestamptz` depends on the session's `timezone` setting (it's STABLE, not IMMUTABLE). This passes in development (no expression index validation at parse time in some configs) but fails in CI's integration test runner.

### Finding 3: Missing /content/:id route

Slice 6 (PR #137) added `comments.public.spec.ts` with 11 tests navigating to `/content/${TEST_CONTENT_ID}`. The `CommentList` component existed, but no page component or route was created. The comments POM's `goto()` method navigates to `/content/:id` and waits for `commentsSection` — but the page was blank (no matching route).

## Solution

### Fix 1: BurnoutRiskGauge — heading in all states

Added `<CardTitle>` to both loading and error states:

```tsx
// BEFORE — loading state (no heading)
if (isLoading) {
  return (
    <Card>
      <CardContent>
        <Skeleton className="h-32 w-32 rounded-full" />
      </CardContent>
    </Card>
  );
}

// AFTER — heading always present
if (isLoading) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Burnout Risk</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Skeleton className="h-32 w-32 rounded-full" />
      </CardContent>
    </Card>
  );
}
```

Same pattern applied to error state. Unit tests updated to assert heading presence in all states.

### Fix 2: IMMUTABLE expression index — AT TIME ZONE 'UTC'

Pinned timezone to UTC in both the dedup CTE and the index creation:

```sql
-- BEFORE (session-dependent, STABLE — rejected)
PARTITION BY creator_id, (created_at::date)
CREATE UNIQUE INDEX ... ON wellness_snapshots (creator_id, (created_at::date));

-- AFTER (timezone-pinned, IMMUTABLE — accepted)
PARTITION BY creator_id, (created_at AT TIME ZONE 'UTC')::date
CREATE UNIQUE INDEX ... ON wellness_snapshots (creator_id, ((created_at AT TIME ZONE 'UTC')::date));
```

**Why it works**: `AT TIME ZONE 'UTC'` converts `timestamptz` to `timestamp` (no timezone dependency), then `::date` on `timestamp` is IMMUTABLE.

### Fix 3: /content/:id route + ContentDetail page

Created `packages/frontend/src/pages/ContentDetail.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { CommentList } from '../features/comments/components/CommentList';
import { useAuth } from '../features/auth/services/AuthContext';

export default function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  if (!id) return <div>Content Not Found</div>;
  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <CommentList contentId={id} currentUserId={user?.id} />
    </div>
  );
}
```

Added lazy import and route in `App.tsx`:

```tsx
const ContentDetail = React.lazy(() =>
  import('./pages/ContentDetail').then((module) => ({ default: module.default }))
);

// Public route (no auth required — comments section)
<Route
  path="/content/:id"
  element={
    <Layout>
      <ContentErrorBoundary>
        <ContentDetail />
      </ContentErrorBoundary>
    </Layout>
  }
/>;
```

The `CommentList` component's `<section>` wrapper renders in all states (loading, error, empty), so the POM's `commentsSection.waitFor()` succeeds even without a backend.

## Prevention

### 1. Component heading in all render states

**Rule**: All dashboard card components MUST render `<CardTitle>` (or equivalent heading) in ALL states — loading, error, empty, and data. Headings are locator anchors for E2E tests.

**Better pattern** — render the heading outside conditional states:

```tsx
// ✅ Structural elements always render; only content is conditional
return (
  <Card>
    <CardHeader>
      <CardTitle>Burnout Risk</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading && <Skeleton />}
      {error && <ErrorMessage />}
      {data && <Chart data={data} />}
    </CardContent>
  </Card>
);
```

**Detection**: Review component for multiple `return` statements in early-exit patterns. Each return path must include the heading. Or refactor to single-return with conditional content (preferred).

**Reinforces**: common-solutions.md #82 (loading state must not hide structural UI).

### 2. PostgreSQL expression index timezone rule

**Rule**: NEVER use bare `::date` cast on `timestamptz` in expression indexes. Always use `(col AT TIME ZONE 'UTC')::date`.

**Applies to**: `CREATE INDEX`, `CREATE UNIQUE INDEX`, `PARTITION BY`, and any CTE that feeds dedup logic before index creation.

**Detection**: Grep migration files:

```bash
grep -E "::date" supabase/migrations/*.sql | grep -v "AT TIME ZONE"
```

### 3. Cross-slice route verification

**Rule**: When E2E tests navigate to a URL path, verify the route exists in the frontend router (`App.tsx`). If the route comes from another slice/PR, either include it or skip the test with a `TODO` comment.

**Detection**: Extract all `page.goto()` URLs from E2E specs and verify each has a matching `<Route path="...">` in App.tsx.

## Related Documentation

- `docs/solutions/testing/playwright-e2e-anti-patterns.md` — Anti-Pattern #3 (hardcoded locators)
- `docs/solutions/feature-implementation/business-manager-mvp-review-remediation-20260304.md` — Loading state hiding structural UI (P2)
- `docs/solutions/patterns/common-solutions.md` — #82 (loading state), #30 (convention-based spec naming), #26 (E2E must not mock API)

## Files Changed

| File                                             | Change                                        |
| ------------------------------------------------ | --------------------------------------------- |
| `BurnoutRiskGauge.tsx`                           | Added `<CardTitle>` to loading + error states |
| `BurnoutRiskGauge.test.tsx`                      | Updated tests with heading assertions         |
| `20260305000000_slice7_wellness_schema_gaps.sql` | `AT TIME ZONE 'UTC'` for IMMUTABLE expression |
| `ContentDetail.tsx`                              | **NEW** — page component for `/content/:id`   |
| `App.tsx`                                        | Added lazy import + route for ContentDetail   |
