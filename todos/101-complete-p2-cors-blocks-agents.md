---
status: pending
priority: p2
issue_id: '101'
tags: [code-review, agent-native, cors, metrics]
dependencies: []
---

# CORS Configuration Blocks Non-Browser Agents and API Clients

## Problem Statement

CORS configuration uses a hardcoded origin allowlist that blocks non-browser agents and API clients. The `X-Correlation-ID` header is not listed in `Access-Control-Expose-Headers`, preventing agents/clients from reading correlation IDs from responses for distributed tracing. Additionally, the `/metrics` endpoint is unauthenticated, exposing internal application metrics (error rates, request counts, DB query times) to any caller.

## Findings

**CORS Issues:**

1. **Hardcoded Origin Allowlist:**

   - CORS middleware only allows specific browser origins
   - Non-browser HTTP clients (CLI tools, agents, SDKs) send no `Origin` header
   - CORS middleware rejects requests without `Origin` or with unlisted origins
   - Blocks legitimate API usage from:
     - Mobile apps
     - Desktop applications
     - CLI tools
     - Server-to-server integrations
     - AI agents calling the API

2. **X-Correlation-ID Not Exposed:**

   - Correlation ID set in response headers by middleware
   - Not listed in `Access-Control-Expose-Headers`
   - Browser clients and agents can't read it via JavaScript
   - Breaks distributed tracing for frontend/agents
   - Can't include correlation ID in error reports

3. **Missing Preflight Cache:**
   - No `Access-Control-Max-Age` configured
   - Browsers send OPTIONS request for every API call
   - 2x request overhead for all CORS requests

**Metrics Endpoint Security:**

4. **/metrics Endpoint Unauthenticated:**
   - Prometheus/app metrics exposed at `/metrics` (or similar)
   - No authentication required
   - Reveals internal application details:
     - Error rates by endpoint
     - Request latency percentiles
     - Database query counts
     - Active user counts
     - Cache hit rates
   - Information leakage for attackers (reconnaissance)

**Current CORS Config (approximate):**

```typescript
// app.ts
app.use(
  cors({
    origin: ['https://app.sovren.com', 'https://admin.sovren.com', 'http://localhost:3000'],
    credentials: true,
    // Missing: exposedHeaders, maxAge
  })
);
```

## Proposed Solutions

### Option 1: Allow All Origins + Expose Correlation ID + Secure Metrics

**Pros:**

- Works for all clients (browsers, agents, mobile, CLI)
- Simple CORS config: `origin: true` or `origin: '*'`
- Expose `X-Correlation-ID` for tracing
- Add authentication to `/metrics` endpoint
- Best for public API

**Cons:**

- Loses CSRF protection (must use tokens, not cookies)
- Credentials (cookies) can't be used with `origin: '*'`
- May not be appropriate if API relies on cookie-based auth

**Effort:** Low (1 hour)
**Risk:** Medium (requires token-based auth verification)

### Option 2: Dynamic Origin Validation + Expose Headers + Secure Metrics

**Pros:**

- Accept requests from any origin (including no origin)
- Validate origin if provided (allowlist for cookie-based requests)
- Allow non-browser clients (no origin header)
- Expose `X-Correlation-ID`
- Authenticate `/metrics` endpoint
- Maintains CSRF protection for cookie-based auth

**Cons:**

- More complex CORS logic
- Need to distinguish cookie auth (strict CORS) from token auth (relaxed CORS)

**Effort:** Medium (3 hours)
**Risk:** Low

### Option 3: Separate CORS Policies by Route

**Pros:**

- Strict CORS for cookie-authenticated routes (`/auth`, `/user`)
- Relaxed CORS for token-authenticated routes (`/api/v1/*`)
- Best of both worlds: security + flexibility
- Expose correlation ID globally
- Authenticate `/metrics`

**Cons:**

- Most complex implementation
- Requires per-route middleware
- Need clear documentation of which routes use which policy

**Effort:** Medium (4 hours)
**Risk:** Low

## Recommended Action

**Option 2: Dynamic Origin Validation + Expose Headers + Secure Metrics**

This balances security and usability. Token-authenticated API routes accept all origins (including agents), while cookie-authenticated routes enforce allowlist. Correlation IDs are exposed for distributed tracing, and metrics require authentication.

Implementation:

1. **Update CORS Middleware:**

   ```typescript
   // app.ts
   app.use(
     cors({
       origin: (origin, callback) => {
         // Allow requests with no origin (non-browser clients)
         if (!origin) return callback(null, true);

         // Allow allowlisted origins (for cookie auth)
         const allowlist = [
           'https://app.sovren.com',
           'https://admin.sovren.com',
           'http://localhost:3000',
         ];

         if (allowlist.includes(origin)) {
           return callback(null, true);
         }

         // Allow any origin for token-based auth (agents, APIs)
         // (Auth middleware will verify token regardless of origin)
         return callback(null, true);
       },
       credentials: true,
       exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Remaining'],
       maxAge: 86400, // 24 hours preflight cache
     })
   );
   ```

2. **Expose Correlation ID:**

   - Add `X-Correlation-ID` to `exposedHeaders`
   - Agents can read correlation ID from response headers
   - Include in error reports for tracing

3. **Secure /metrics Endpoint:**

   ```typescript
   // routes/metrics.ts
   app.get('/metrics', authenticate, async (req, res) => {
     // Require authentication (API token or admin role)
     if (!req.user || req.user.role !== 'admin') {
       throw new UnauthorizedError('Metrics access requires admin role');
     }

     const metrics = await prometheusRegister.metrics();
     res.set('Content-Type', prometheusRegister.contentType);
     res.end(metrics);
   });
   ```

4. **Add Preflight Cache:**
   - Set `maxAge: 86400` (24 hours)
   - Reduces OPTIONS requests by 1000x for repeated API calls

## Technical Details

**Affected Files:**

- `src/app.ts` (CORS middleware configuration)
- `src/routes/metrics.ts` or `/metrics` endpoint handler
- `src/middleware/cors-middleware.ts` (if separate file)

**CORS Headers to Set:**

```
Access-Control-Allow-Origin: <origin> or *
Access-Control-Allow-Credentials: true
Access-Control-Expose-Headers: X-Correlation-ID, X-RateLimit-Remaining
Access-Control-Max-Age: 86400
```

**Correlation ID Usage by Clients:**

```typescript
// Frontend or agent
const response = await fetch('/api/v1/content', {
  headers: { Authorization: 'Bearer TOKEN' },
});

const correlationId = response.headers.get('X-Correlation-ID');

if (!response.ok) {
  // Include correlation ID in error report
  reportError({
    message: 'API request failed',
    correlationId,
    status: response.status,
  });
}
```

**Metrics Endpoint Security:**

```typescript
// Before (VULNERABLE)
app.get('/metrics', async (req, res) => {
  const metrics = await prometheusRegister.metrics();
  res.set('Content-Type', prometheusRegister.contentType);
  res.end(metrics);
});

// After (SECURE)
app.get('/metrics', authenticate, authorize(['admin']), async (req, res) => {
  const metrics = await prometheusRegister.metrics();
  res.set('Content-Type', prometheusRegister.contentType);
  res.end(metrics);
});
```

**Alternative: IP Allowlist for Metrics:**

```typescript
// If metrics consumed by internal monitoring only
const METRICS_ALLOWED_IPS = ['10.0.0.0/8', '172.16.0.0/12'];

app.get(
  '/metrics',
  (req, res, next) => {
    const clientIp = req.ip;
    if (!METRICS_ALLOWED_IPS.some((range) => ipInRange(clientIp, range))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  },
  async (req, res) => {
    // Serve metrics
  }
);
```

## Acceptance Criteria

**CORS Updates:**

- [ ] CORS middleware accepts requests without `Origin` header (non-browser clients)
- [ ] CORS middleware validates `Origin` against allowlist for cookie-based requests
- [ ] `X-Correlation-ID` added to `Access-Control-Expose-Headers`
- [ ] `Access-Control-Max-Age` set to 86400 (24 hours)
- [ ] Preflight OPTIONS requests cached by browsers
- [ ] Integration test: API call from non-browser client succeeds
- [ ] Integration test: Browser can read `X-Correlation-ID` from response
- [ ] Integration test: Preflight cache verified (no OPTIONS on second request)

**Metrics Security:**

- [ ] `/metrics` endpoint requires authentication
- [ ] Unauthenticated requests to `/metrics` return 401
- [ ] Non-admin requests to `/metrics` return 403
- [ ] Integration test: Metrics accessible with admin token
- [ ] Integration test: Metrics blocked for unauthenticated/non-admin requests
- [ ] Documentation updated for metrics endpoint access

**Overall:**

- [ ] API accessible from CLI tools, mobile apps, agents
- [ ] Correlation IDs readable by all clients for distributed tracing
- [ ] Metrics endpoint secured against unauthorized access
- [ ] No increase in OPTIONS request volume (preflight cached)
- [ ] CORS policy documented in API docs

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Confirmed CORS allowlist blocks non-browser agents
- Discovered `X-Correlation-ID` not exposed to clients
- Found `/metrics` endpoint is unauthenticated

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- CORS for API clients: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- Access-Control-Expose-Headers: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
- Preflight cache: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
- Securing Prometheus metrics: https://prometheus.io/docs/guides/basic-auth/
