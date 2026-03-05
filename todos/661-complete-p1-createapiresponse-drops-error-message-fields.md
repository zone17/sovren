---
status: complete
priority: p1
issue_id: 661
tags: [code-review, agent-native, p1]
dependencies: []
---

## Problem Statement

Error responses in wellness and business-tax routes pass `{ error: 'CODE', message: 'text' }` as the third argument to `createApiResponse()`, but `createApiResponse()` may silently ignore or strip these fields. If the error code and message are dropped, the HTTP 409 or 400 response body contains no useful error information — just a null data field and a generic structure. API consumers (including frontend code and automated agents) cannot distinguish between different error types or extract actionable error messages.

## Findings

**Consensus**: 1/8 agents (agent-native-reviewer)

**Files**:

- `packages/backend/src/routes/v2/wellness.routes.ts:199-203`
- `packages/backend/src/routes/v2/business-tax.routes.ts:215-221`

1. **createApiResponse third argument behavior unknown** — The routes pass error details as a third argument: `createApiResponse(null, false, { error: 'CONFLICT', message: 'Already exists' })`. The actual signature and behavior of `createApiResponse()` needs verification — does it include these fields in the output, or does it only use the first two arguments?

2. **Wellness 409 response** — When a ConflictError is caught and handled manually in the wellness route (instead of via the global error handler), the route constructs a manual error response. If `createApiResponse` strips the error details, the 409 body is `{ success: false, data: null }` with no error code or message.

3. **Business-tax 400 response** — Similar issue on validation error responses. The `{ error: 'VALIDATION_ERROR', message: '...' }` payload may not reach the client.

4. **Agent-native concern** — Automated systems (bots, agents, CI/CD) parse error responses to make retry/fallback decisions. A 409 with no error code is indistinguishable from a 409 with a different error code. This breaks automated error handling.

## Proposed Solutions

### Option A: Verify and Fix createApiResponse (Recommended)

Read the `createApiResponse` implementation. If it doesn't support error fields, either update it to pass through error details, or stop using it for error responses and send the error directly.

```typescript
// Option A1: Update createApiResponse to support error fields
function createApiResponse<T>(
  data: T | null,
  success: boolean = true,
  meta?: { error?: string; message?: string; [key: string]: unknown }
): ApiResponse<T> {
  return {
    success,
    data,
    ...(meta?.error && { error: meta.error }),
    ...(meta?.message && { message: meta.message }),
  };
}

// Option A2: Don't use createApiResponse for errors — send directly
catch (error) {
  if (error instanceof ConflictError) {
    return res.status(409).json({
      success: false,
      data: null,
      error: 'CONFLICT',
      message: error.message,
    });
  }
  next(error);
}
```

- **Pros**: Fixes the root cause. All error responses include actionable information. Consistent error format.
- **Cons**: Changing `createApiResponse` signature may affect other callers. Need to audit all usages.
- **Effort**: Small (1-2 hours) — read implementation, decide approach, fix.
- **Risk**: Low — but audit all callers if changing the function signature.

### Option B: Use Global Error Handler Instead of Manual Error Responses

Remove manual error response construction from routes. Let errors propagate to the global error handler, which should already format error responses consistently.

```typescript
// Route just throws, global handler formats the response
router.post('/pulse', requireCreator, async (req, res, next) => {
  try {
    const pulse = await wellnessService.recordPulse(req.user.id, req.body);
    res.status(201).json(createApiResponse(pulse));
  } catch (error) {
    next(error); // Global handler maps ConflictError -> 409 with error details
  }
});
```

- **Pros**: Centralized error formatting. Consistent across all routes. Less code in routes.
- **Cons**: Requires the global error handler to include error codes and messages in responses. If it doesn't, this just moves the problem.
- **Effort**: Small (1 hour)
- **Risk**: Low — depends on global error handler quality.

### Option C: Add Error Response Helper Function

Create a separate `createErrorResponse()` function specifically for error responses, keeping `createApiResponse()` for success responses.

```typescript
function createErrorResponse(error: string, message: string, details?: unknown) {
  return { success: false, data: null, error, message, ...(details && { details }) };
}

// Usage
res.status(409).json(createErrorResponse('CONFLICT', 'Pulse already recorded today'));
```

- **Pros**: Clear separation of success and error response helpers. No risk of breaking existing success responses.
- **Cons**: Adds another utility function. Routes need to decide which helper to use.
- **Effort**: Small (1 hour)
- **Risk**: Very low

## Recommended Action

<!-- To be filled by tech lead -->

## Technical Details

- **createApiResponse location**: Likely in `packages/backend/src/utils/api-response.ts` or `packages/backend/src/helpers/`. Read the implementation to understand current signature and behavior.
- **Current signature hypothesis**: Based on usage patterns, the signature is likely `createApiResponse(data, success?, meta?)` where `meta` may be typed as `Record<string, unknown>` but the function only spreads `data` and `success` into the output, ignoring `meta` entirely.
- **Global error handler**: Check `packages/backend/src/middleware/error-handler.ts`. It should map error classes to HTTP status codes AND include error details in the response body. Verify it includes `error` and `message` fields.
- **Related todo #372** (complete): "Inconsistent error response format" — this may have partially addressed the issue but the `createApiResponse` behavior for errors wasn't fixed.
- **API contract**: The frontend likely expects `{ success: boolean, data: T | null, error?: string, message?: string }`. Verify by checking frontend API client error handling.

## Acceptance Criteria

- [ ] Read `createApiResponse` implementation and document current behavior
- [ ] Error responses (409, 400, etc.) include `error` code and `message` in the response body
- [ ] Verify by testing: `curl -X POST /api/v2/wellness/pulse` (duplicate) returns 409 with `{ error: 'CONFLICT', message: '...' }`
- [ ] Verify by testing: invalid input returns 400 with `{ error: 'VALIDATION_ERROR', message: '...' }`
- [ ] Frontend error handling works with the updated response shape (no breaking changes)
- [ ] All routes using `createApiResponse` for errors are audited and fixed
- [ ] Tests verify error response body includes error and message fields

## Work Log

<!-- Append entries as work progresses -->

## Resources

- todo #372 (complete) — inconsistent error response format
- common-solutions.md #24 (error class selection matrix)
- [HTTP API error response best practices](https://www.rfc-editor.org/rfc/rfc7807) (Problem Details for HTTP APIs)
