# ADR-016: CSRF Double-Submit Cookie Pattern

**Date**: 2026-02-12
**Status**: Accepted
**Epic**: Infrastructure Sprint - US-E0-011 Security Pipeline Hardening
**Related ADRs**: [ADR-006 (TypeScript Strict Mode)](./ADR-006-typescript-strict-mode.md)

## Context

Sovren is a creator monetization platform where state-changing API requests (content publishing, payment triggers, account settings changes) must be protected against Cross-Site Request Forgery (CSRF) attacks. Without CSRF protection, an attacker could trick an authenticated user's browser into making unintended requests (e.g., triggering a Lightning payment or changing account settings).

The existing codebase had no CSRF middleware. We needed to choose a CSRF protection pattern that:

- Works with our SPA (React) frontend that communicates via JSON APIs
- Is **stateless** -- no server-side token storage is required, since we run multiple backend instances behind a load balancer
- Is compatible with our existing cookie-based session management and SameSite cookie policies
- Does not require server-side sessions or a shared session store
- Is simple to implement and maintain

### Options Evaluated

| Pattern                            | Server-Side State      | SPA-Compatible | Multi-Instance Safe   | Complexity                  |
| ---------------------------------- | ---------------------- | -------------- | --------------------- | --------------------------- |
| **Double-Submit Cookie**           | None                   | Yes            | Yes                   | Low                         |
| Synchronizer Token (session-bound) | Session store required | Partial        | Requires shared store | Medium                      |
| Encrypted Token                    | None                   | Yes            | Yes                   | High (crypto overhead)      |
| Origin/Referer Header Check        | None                   | Yes            | Yes                   | Low (but bypassable)        |
| SameSite Cookie Only               | None                   | Yes            | Yes                   | Low (incomplete protection) |

## Decision

We adopted the **Double-Submit Cookie** pattern for CSRF protection, implemented in `packages/backend/src/middleware/csrf.ts`.

### How It Works

1. **Token Issuance (GET/HEAD/OPTIONS)**: The middleware generates a cryptographically random 32-byte hex token, sets it in a `_csrf` cookie (readable by JavaScript, `httpOnly: false`), and returns it in the `X-CSRF-Token` response header.

2. **Token Validation (POST/PUT/DELETE/PATCH)**: The middleware reads the `_csrf` cookie and the `x-csrf-token` request header (or `_csrf` body field). It performs a **timing-safe comparison** using `crypto.timingSafeEqual`. If the tokens do not match, the request is rejected with HTTP 403.

3. **Token Rotation**: After each successful validation, a new token is generated and set, providing one-time-use semantics that limit token replay.

### Key Implementation Details

- **Timing-safe comparison**: Prevents timing side-channel attacks via `crypto.timingSafeEqual`
- **Token rotation on use**: Each successful state-changing request issues a new token
- **Excluded paths**: Webhook endpoints (`/api/v1/payments/webhooks`), health probes (`/health`, `/ready`, `/live`, `/metrics`), and CSP reporting (`/api/security/csp-report`) are excluded because they use HMAC verification or are not user-facing
- **SameSite=Lax cookie**: Provides additional defense-in-depth against cross-origin attacks
- **Secure flag in production**: Cookie only sent over HTTPS in production

## Consequences

### Positive

- **Stateless**: No server-side token storage means zero coordination between backend instances, which aligns with our horizontal scaling strategy
- **Simple integration**: The React frontend reads the `_csrf` cookie and includes the token in request headers via an Axios interceptor -- minimal client-side code
- **Defense-in-depth**: Combined with SameSite=Lax cookies, this provides layered CSRF protection
- **Token rotation**: One-time-use tokens limit the window for replay attacks

### Negative

- **Requires JavaScript-readable cookie**: `httpOnly: false` on the CSRF cookie means the token value is accessible to client-side JavaScript. If an XSS vulnerability exists, an attacker could read the CSRF token. However, XSS already compromises CSRF protection regardless of pattern, and our CSP mitigates this risk.
- **Cookie dependency**: Clients that do not support cookies (CLI tools, mobile apps using bearer tokens only) need a separate authentication flow. This is acceptable since our API also supports bearer token auth, which is inherently CSRF-immune.

### Neutral

- The double-submit cookie pattern is OWASP-recommended and widely adopted by frameworks like Django, Laravel, and Spring Security
- Webhook endpoints bypass CSRF intentionally and rely on HMAC verification instead

## Alternatives Considered

### Synchronizer Token Pattern

Rejected because it requires a shared server-side session store. Our backend runs across multiple instances without sticky sessions, and introducing a centralized session store (Redis) solely for CSRF tokens adds unnecessary infrastructure complexity and latency. The double-submit cookie provides equivalent security without server state.

### SameSite Cookie Only

Rejected as sole protection because SameSite=Lax still permits top-level navigations (form submissions from external sites), and older browsers may not support SameSite. SameSite is used as defense-in-depth alongside double-submit.

### Origin/Referer Header Validation

Rejected as sole protection because the Referer header can be suppressed by browser extensions or privacy settings, and the Origin header is not sent on all request types. Used as an additional signal, not primary defense.
