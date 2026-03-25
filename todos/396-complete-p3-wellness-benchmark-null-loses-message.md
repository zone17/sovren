---
status: pending
priority: p3
issue_id: '413'
tags: [code-review, quality, api-contract, pr-87]
dependencies: []
---

# Wellness benchmark endpoint loses "insufficient participants" message

## Problem Statement

The `/wellness/benchmark` endpoint previously returned a custom message when data was null:

```json
{
  "success": true,
  "data": null,
  "message": "Insufficient participants for anonymous benchmarking (minimum: 10)"
}
```

After the `createApiResponse()` migration, it now returns:

```json
{ "success": true, "data": null, "metadata": { "requestId": "...", "timestamp": "..." } }
```

The informative `message` field is lost. Any frontend code or documentation relying on this message will silently stop receiving it.

## Findings

- `wellness.routes.ts`: The old handler had a custom `message` field alongside `data: null`
- The new handler calls `createApiResponse(req, null)` which doesn't support a `message` field
- The `createApiResponse` helper only supports `{success, data, metadata}` -- no room for a supplementary message
- This is a minor API contract change, but it removes useful context for API consumers

## Proposed Solutions

### Option 1: Accept the loss

**Approach:** The null data is self-explanatory. Remove the message.

**Effort:** 0 minutes

**Risk:** Low

---

### Option 2: Include message in data

**Approach:** Return `createApiResponse(req, { benchmark: null, message: '...' })` instead of `createApiResponse(req, null)`.

**Effort:** 5 minutes

**Risk:** Low (changes response shape slightly)

## Recommended Action

Option 2 if there are known frontend consumers of the message field. Otherwise accept the loss.

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/wellness.routes.ts` (benchmark endpoint)

## Acceptance Criteria

- [ ] Decision documented: accept loss or preserve message

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
