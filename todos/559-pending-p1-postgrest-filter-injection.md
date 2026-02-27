---
status: pending
priority: p1
issue_id: '559'
tags: [code-review, pr-108, security]
---

# Sanitize PostgREST filter injection in discovery route `q` parameter

## Problem Statement

The `q` query parameter is interpolated directly into a Supabase `.or()` filter string without any sanitization. PostgREST uses commas and periods as filter delimiters. A malicious input like `x%,id.eq.secret-uuid` can inject arbitrary filter conditions on a **public, unauthenticated endpoint**. This is the same vulnerability class as MentorshipService finding #260.

**Consensus: 9/9 agents flagged this independently** (strongest consensus in the review).

## Findings

- **File**: `packages/backend/src/routes/v2/discovery.routes.ts`, lines 63-65
- **Code**: `query = query.or(\`bio.ilike.%${q}%,...\`)`
- **Zod schema**: `q: z.string().optional()` — no length limit, no character restrictions
- **OWASP**: A03:2021 Injection
- **Existing pattern**: MentorshipService (line 264) validates with `/^[a-zA-Z0-9_-]+$/`
- **Codebase-wide**: Same pattern exists in `content-management-service.ts:183`, `content-discovery-service.ts:337`, `recommendation-service.ts:216`, `InboxPollingService.ts:236`

## Proposed Solutions

**Option A: Zod-level allowlist (Recommended)**
Add regex constraint + length limits to the Zod schema:

```typescript
q: z.string().min(2).max(100).regex(/^[a-zA-Z0-9\s\-']+$/).optional(),
```

Pros: Rejects bad input early, zero runtime overhead. Cons: May be too restrictive for non-English characters.

**Option B: Escape function**
Create `escapePostgrestFilter()` utility:

```typescript
function escapePostgrestFilter(input: string): string {
  return input.replace(/[\\%_.,()]/g, (char) => `\\${char}`);
}
```

Pros: Allows broader character set. Cons: Must be applied everywhere.

**Option C: Use Supabase textSearch or RPC**
Replace string-based `.or()` with parameterized query method.
Pros: Eliminates injection class entirely. Cons: Larger refactor.

## Acceptance Criteria

- [ ] `q` parameter is sanitized before interpolation into `.or()` filter
- [ ] PostgREST metacharacters (`,`, `.`, `(`, `)`) cannot break out of `ilike` clause
- [ ] SQL wildcards (`%`, `_`) in search terms don't match unintended rows
- [ ] Length constraint added (max 100 characters)
- [ ] Existing tests updated to cover injection attempt
