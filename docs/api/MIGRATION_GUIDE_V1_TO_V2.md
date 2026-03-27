# API Migration Guide: v1 to v2

This guide helps API consumers migrate from the deprecated Sovren API v1 to the current v2.

---

## Overview

| | v1 | v2 |
|--|----|----|
| **Base path** | `/api/v1` | `/api/v2` |
| **Status** | Deprecated | Current |
| **Deprecation headers** | `Deprecation: true`, `Link: </api/v2>; rel="successor-version"` | None |
| **Sunset date** | TBD — minimum 6 months notice will be given | N/A |
| **Response envelope** | `{ success, data }` | `{ success, data }` (structure extended — see below) |
| **Pagination** | Offset-based only | Cursor-based available (recommended) |

Every response from a v1 endpoint currently includes the following HTTP headers indicating deprecation:

```
Deprecation: true
Link: </api/v2>; rel="successor-version"
```

Plan your migration before the sunset date is announced. A minimum of **6 months notice** will be provided before v1 is decommissioned.

---

## What Changed Between v1 and v2

### 1. Response Envelope

v1 responses use a flat `{ success, data }` wrapper. v2 responses extend this with additional metadata fields for paginated collections and errors.

**v1 response (collection):**
```json
{
  "success": true,
  "data": [ ... ]
}
```

**v2 response (collection, cursor-paginated):**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "cursor": "eyJpZCI6IjEyMyJ9",
    "hasMore": true,
    "total": 500
  }
}
```

**v2 error response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [ ... ]
  }
}
```

v1 error responses use `{ success: false, error: "string" }` (flat string). Update your error handling to support the v2 structured error object.

### 2. Pagination

v1 supports only offset-based pagination via `?page=1&limit=20` query parameters.

v2 supports cursor-based pagination (recommended for feeds and large datasets) using `?cursor=<token>&limit=20`. Cursor tokens are opaque strings returned in the `meta.cursor` field of collection responses.

Offset pagination is preserved on most v2 endpoints for backwards compatibility, but cursor pagination is preferred for performance and consistency.

### 3. Endpoint Paths

v1 grouped all functionality under four route trees: `content`, `users`, `payments`, and `metrics`. v2 introduces domain-specific route trees aligned with product features:

| Domain | v1 Path | v2 Path |
|--------|---------|---------|
| Content (list, CRUD) | `/api/v1/content` | Collaboration: `/api/v2/content` |
| Content discovery | `/api/v1/content` (search/recommendations) | `/api/v2/discovery` |
| User profiles | `/api/v1/users/profile/:id` | Not yet migrated to v2 — continue using v1 or top-level `/users` routes |
| Follow/unfollow | `/api/v1/users/relationships/follow` | `/api/v2/network/users/:userId/follow` |
| Notifications | Not available in v1 | `/api/v2/notifications` |
| Payments (invoices, subscriptions, etc.) | `/api/v1/payments` | Lightning routes remain under `/lightning` at root level |
| Creator wellness | Not available in v1 | `/api/v2/wellness` |
| Content moderation | `/api/v1/content/moderate` | `/api/v2/shield` |
| Platform connections | Not available in v1 | `/api/v2/platforms` |
| Cross-platform distribution | Not available in v1 | `/api/v2/distribute` |
| Unified inbox | Not available in v1 | `/api/v2/inbox` |
| Cross-platform analytics | Not available in v1 | `/api/v2/analytics/cross-platform` |
| Comments | Not available in v1 | `/api/v2/comments` |
| Creator circles | Not available in v1 | `/api/v2/circles` |
| Mentorship | Not available in v1 | `/api/v2/mentorship` |
| Marketplace | Not available in v1 | `/api/v2/marketplace` |
| Business contracts | Not available in v1 | `/api/v2/business/contracts` |
| Business invoices | Not available in v1 | `/api/v2/business/invoices` |
| Business revenue | Not available in v1 | `/api/v2/business/revenue` |
| Business tax | Not available in v1 | `/api/v2/business/tax` |
| Metrics | `/api/v1/metrics` | Internal/admin use only — not exposed in v2 public API |

---

## Step-by-Step Migration by Endpoint Group

### Users

#### Get user profile

**v1:**
```http
GET /api/v1/users/profile/:id
```

**v2 equivalent:** User profile retrieval has not yet moved to the v2 namespace. Continue calling `/api/v1/users/profile/:id` until a v2 user profile endpoint is announced. Monitor the changelog for updates.

#### Update user profile

**v1:**
```http
PUT /api/v1/users/profile/:id
Authorization: Bearer <token>
```

Same note as above — continue using v1 for profile writes until v2 is available.

#### Follow a user

**v1:**
```http
POST /api/v1/users/relationships/follow
Authorization: Bearer <token>
Content-Type: application/json

{ "targetUserId": "npub1..." }
```

**v2:**
```http
POST /api/v2/network/users/:userId/follow
Authorization: Bearer <token>
```

The target user ID moves from the request body to the URL path parameter `:userId`. No request body is needed for a follow action.

#### Unfollow a user

**v1:**
```http
DELETE /api/v1/users/relationships/unfollow
Authorization: Bearer <token>
Content-Type: application/json

{ "targetUserId": "npub1..." }
```

**v2:**
```http
DELETE /api/v2/network/users/:userId/follow
Authorization: Bearer <token>
```

Same pattern change as follow: target user ID moves to the URL path.

#### Block / unblock / mute / unmute

**v1:**
```http
POST   /api/v1/users/:id/block
DELETE /api/v1/users/:id/block
POST   /api/v1/users/:id/mute
DELETE /api/v1/users/:id/mute
```

**v2:** These moderation actions are now handled through the Shield domain:

```http
POST   /api/v2/shield/block/:userId
DELETE /api/v2/shield/block/:userId
POST   /api/v2/shield/mute/:userId
DELETE /api/v2/shield/mute/:userId
```

#### User analytics

**v1:**
```http
GET /api/v1/users/analytics/:id
Authorization: Bearer <token>
```

**v2:** User-level analytics are available through the cross-platform analytics endpoint:

```http
GET /api/v2/analytics/cross-platform
Authorization: Bearer <token>
```

---

### Payments

v1 payment routes (`/api/v1/payments/*`) are the current canonical payment API. Lightning-native payment operations (invoice creation, payment, subscriptions) have been consolidated under the root `/lightning` routes. Business-level financial management (contracts, invoices, revenue tracking, tax) is available in v2 under `/api/v2/business/*`.

#### Create a Lightning invoice

**v1:**
```http
POST /api/v1/payments/invoices
Authorization: Bearer <token>
X-Nostr-Signature: <sig>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "amount": 1000,
  "currency": "sats",
  "description": "Subscription payment"
}
```

**v2 equivalent:**
```http
POST /lightning/invoices
Authorization: Bearer <token>
X-Nostr-Signature: <sig>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "amount": 1000,
  "currency": "sats",
  "description": "Subscription payment"
}
```

The request body and auth requirements are unchanged. Only the path prefix changes.

#### Pay an invoice

**v1:**
```http
POST /api/v1/payments/invoices/:id/pay
Authorization: Bearer <token>
X-Nostr-Signature: <sig>
```

**v2 equivalent:**
```http
POST /lightning/invoices/:id/pay
Authorization: Bearer <token>
X-Nostr-Signature: <sig>
```

#### Subscriptions

**v1:**
```http
GET    /api/v1/payments/subscriptions/tiers
GET    /api/v1/payments/subscriptions/:id
POST   /api/v1/payments/subscriptions
PUT    /api/v1/payments/subscriptions/:id
DELETE /api/v1/payments/subscriptions/:id
```

**v2 equivalent:** Continue using v1 subscription endpoints for now. v2 business financials (contracts, invoices, revenue) augment subscriptions — see `/api/v2/business/*` for creator-side financial management.

#### Transaction history and balance

**v1:**
```http
GET /api/v1/payments/transactions
GET /api/v1/payments/balance
```

**v2 equivalent:**
```http
GET /lightning/transactions
GET /lightning/balance
```

#### Webhooks

**v1:**
```http
POST   /api/v1/payments/webhooks
PUT    /api/v1/payments/webhooks/:id
DELETE /api/v1/payments/webhooks/:id
```

Webhook registration remains under the v1 path for now. No v2 equivalent is required — continue using v1.

---

### Content

#### List content (discovery feed)

**v1:**
```http
GET /api/v1/content?page=1&limit=20
```

Response: `{ "success": true, "data": [...] }`

**v2 (cursor-based, recommended):**
```http
GET /api/v2/discovery?limit=20
GET /api/v2/discovery?cursor=<token>&limit=20   # subsequent pages
```

Response:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "cursor": "eyJpZCI6IjEyMyJ9",
    "hasMore": true
  }
}
```

#### Search content

**v1:**
```http
GET /api/v1/content/search?q=bitcoin&page=1&limit=20
```

**v2:**
```http
GET /api/v2/discovery/search?q=bitcoin&limit=20
GET /api/v2/discovery/search?q=bitcoin&cursor=<token>&limit=20
```

#### Content recommendations

**v1:**
```http
GET /api/v1/content/recommendations
```

**v2:**
```http
GET /api/v2/discovery/recommendations
```

Authentication is optional on both versions. Authenticated requests receive personalized recommendations.

#### Get a single content item

**v1:**
```http
GET /api/v1/content/:id
```

**v2:**
```http
GET /api/v2/content/:id
```

The response shape is the same. Authentication remains optional.

#### Publish content

**v1:**
```http
POST /api/v1/content/publish
Authorization: Bearer <token>
Content-Type: application/json

{ "title": "...", "body": "...", "type": "article" }
```

**v2:**
```http
POST /api/v2/content
Authorization: Bearer <token>
Content-Type: application/json

{ "title": "...", "body": "...", "type": "article" }
```

The path changes from `/content/publish` to `/content` (POST). The request body schema is unchanged.

#### Update and delete content

**v1:**
```http
PUT    /api/v1/content/:id
DELETE /api/v1/content/:id
```

**v2:**
```http
PUT    /api/v2/content/:id
DELETE /api/v2/content/:id
```

No request body changes.

#### Content moderation

**v1:**
```http
POST /api/v1/content/moderate
Authorization: Bearer <token>
Content-Type: application/json

{ "contentId": "...", "action": "hide" }
```

**v2 (Shield domain):**
```http
POST /api/v2/shield/moderate
Authorization: Bearer <token>
Content-Type: application/json

{ "contentId": "...", "action": "hide" }
```

The Shield domain (`/api/v2/shield`) consolidates all creator safety and moderation tooling including block lists, mute lists, filtered keywords, and content reports.

---

### Comments

Comments are a v2-only feature. There is no v1 equivalent.

```http
GET    /api/v2/comments?contentId=<id>
POST   /api/v2/comments
PUT    /api/v2/comments/:id
DELETE /api/v2/comments/:id
```

---

### Discovery

The `/api/v2/discovery` domain replaces the search and recommendation sub-routes of `/api/v1/content`. See the Content section above for mapping details.

---

## Authentication Changes

Authentication headers and token formats are unchanged between v1 and v2. All existing Bearer tokens are valid on v2 endpoints.

Payment-mutating endpoints continue to require the `X-Nostr-Signature` header and `Idempotency-Key` header. These requirements are not relaxed in v2.

---

## Migration Checklist

- [ ] Audit all v1 endpoint calls in your codebase
- [ ] Update the base path from `/api/v1` to `/api/v2` for each migrated endpoint group
- [ ] Update response parsing to handle the v2 `meta` field on paginated collection responses
- [ ] Update error handling to parse the v2 structured error object (`error.code`, `error.message`, `error.details`) instead of the v1 flat error string
- [ ] Switch paginated requests to cursor-based pagination where possible
- [ ] Update follow/unfollow calls to use the new path: `/api/v2/network/users/:userId/follow`
- [ ] Update content moderation calls to use `/api/v2/shield`
- [ ] Update content discovery (search, recommendations) to use `/api/v2/discovery`
- [ ] Update payment routes to use `/lightning/*` where applicable
- [ ] Remove any logic that suppresses or ignores `Deprecation` response headers
- [ ] Test all migrated calls in staging before promoting to production

---

## Timeline

- **Now:** v1 is deprecated. All v1 responses include `Deprecation: true` headers.
- **TBD:** v1 sunset date will be announced with a minimum of **6 months advance notice** via the status page, email (for paid subscribers), and the CHANGELOG.
- **After sunset:** v1 endpoints will return HTTP 410 Gone.

Subscribe to [status.sovren.dev](https://status.sovren.dev) and watch the [CHANGELOG](../../CHANGELOG.md) to receive the sunset announcement as soon as it is made.

---

## Getting Help

- API reference: [docs/api/README.md](README.md)
- OpenAPI spec: [docs/api/openapi.yaml](openapi.yaml)
- Architecture overview: [docs/api/api-architecture.md](api-architecture.md)
- Authentication guide: [docs/api/authentication.md](authentication.md)
- Error reference: [docs/api/errors.md](errors.md)
- Support: support@sovren.dev
