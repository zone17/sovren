---
status: pending
priority: p1
issue_id: '041'
tags: [code-review, agent-native, cors, rate-limiting]
dependencies: []
---

# CORS Wrong Rate Limit Headers

## Problem Statement

The CORS `exposedHeaders` configuration lists legacy `X-RateLimit-*` headers, but the rate-limit middleware uses `standardHeaders: true` + `legacyHeaders: false`, which emits IETF standard headers WITHOUT the `X-` prefix. Cross-origin agents cannot read their rate-limit status.

## Findings

**Location**: `/Users/fp/Desktop/Sovren/packages/backend/src/app.ts:87`

**Found by**: Agent-Native Reviewer

**Mismatch**:

CORS configuration exposes:

```typescript
exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'];
```

Rate limiter actually sends (verified in smoke tests at lines 132-134):

```typescript
{
  standardHeaders: true,   // Emits IETF standard format
  legacyHeaders: false      // Does NOT emit X- prefix
}

// Actual headers sent:
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1234567890
RateLimit-Policy: 100;w=60
```

**Impact for agent consumers**:

```javascript
// Agent tries to check rate limit
const response = await fetch('https://api.sovren.com/v1/endpoint');
const remaining = response.headers.get('X-RateLimit-Remaining');
// returns null - header is blocked by CORS

const actual = response.headers.get('RateLimit-Remaining');
// also returns null - not in exposedHeaders list

// Agent has no visibility into rate limits
// Cannot implement backoff strategies
// Cannot predict 429 errors
```

**Evidence**: Smoke tests in rate-limit-middleware.ts confirm IETF format is sent:

```typescript
// Line 132-134
expect(res.headers).toHaveProperty('ratelimit-limit');
expect(res.headers).toHaveProperty('ratelimit-remaining');
expect(res.headers).toHaveProperty('ratelimit-reset');
```

## Proposed Solutions

### Option 1: Update CORS to Match IETF Standard (Recommended)

Replace `X-RateLimit-*` with `RateLimit-*` in `exposedHeaders`. Keep both formats for the advanced limiter which may still send legacy headers.

**Pros**:

- Matches actual header format sent
- Aligns with IETF standard (RFC 6585)
- Minimal code change
- No breaking change to header emission

**Cons**:

- Clients currently reading `X-RateLimit-*` will break (but these reads already fail due to CORS)

**Implementation**:

```typescript
app.use(
  cors({
    // ... other config
    exposedHeaders: [
      // IETF standard headers (primary)
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'RateLimit-Policy',
      // Legacy headers (for advanced limiter)
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
  })
);
```

### Option 2: Enable Legacy Headers in Middleware

Change rate limiter to `legacyHeaders: true` to match CORS config.

**Pros**:

- Matches current CORS configuration
- No CORS changes needed

**Cons**:

- Goes against IETF standard recommendation
- Sends duplicate headers (standard + legacy)
- Increases response size
- Perpetuates deprecated format

### Option 3: Send Both, Expose Both

Enable both header formats in middleware and CORS.

**Pros**:

- Maximum compatibility
- Supports old and new clients

**Cons**:

- Wasteful (duplicate headers)
- Confusing (which to use?)
- Technical debt

## Technical Details

**Root cause**: Configuration drift. The rate limiter was updated to IETF standard format but CORS configuration was not updated to match.

**IETF standard (RFC 6585)**: Recommends header names WITHOUT `X-` prefix:

- `RateLimit-Limit`: Total requests allowed in window
- `RateLimit-Remaining`: Requests remaining in window
- `RateLimit-Reset`: Unix timestamp when window resets
- `RateLimit-Policy`: Describes the rate limit policy

**CORS behavior**:
By default, only simple response headers are exposed to cross-origin JavaScript:

- Cache-Control
- Content-Language
- Content-Type
- Expires
- Last-Modified
- Pragma

All other headers (including rate limit headers) are hidden unless explicitly listed in `exposedHeaders`.

**Current state**:

- Backend sends: `RateLimit-*` (without X)
- CORS exposes: `X-RateLimit-*` (with X)
- Result: Rate limit headers hidden from cross-origin agents

## Acceptance Criteria

- [ ] `exposedHeaders` includes all IETF standard rate limit headers
- [ ] `exposedHeaders` includes legacy `X-RateLimit-*` for advanced limiter
- [ ] Cross-origin fetch can read `RateLimit-Remaining`
- [ ] Cross-origin fetch can read `RateLimit-Reset`
- [ ] Cross-origin fetch can read `RateLimit-Policy`
- [ ] Documentation updated to reference IETF standard format
- [ ] Test verifies CORS exposure of rate limit headers
- [ ] Agent integration example updated with correct header names

## Work Log

_No work logged yet_

## Resources

- IETF RateLimit Header Fields: https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
- CORS exposedHeaders: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
- Express rate limit standard headers: https://express-rate-limit.mintlify.app/reference/configuration#standardheaders
- Related files:
  - `/Users/fp/Desktop/Sovren/packages/backend/src/app.ts`
  - `/Users/fp/Desktop/Sovren/packages/backend/src/middleware/rate-limit-middleware.ts`
