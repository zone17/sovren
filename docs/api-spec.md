# Sovren API Contract Specification

**Version:** 2.0.0
**Date:** 2026-02-11
**Base URL (Dev):** `http://localhost:3001`
**Base URL (Prod):** `https://api.sovren.app`

## Common Conventions

### Response Envelope

All responses follow a consistent envelope:

```json
{
  "success": true|false,
  "data": { ... },
  "error": "Error message (only on failure)",
  "code": "ERROR_CODE (only on failure)",
  "timestamp": "ISO 8601"
}
```

### Paginated Responses

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 98,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Authentication

All authenticated endpoints require:

```
Authorization: Bearer <JWT_TOKEN>
```

JWT tokens are obtained via the NOSTR challenge-response flow and expire after 24 hours.

### Rate Limiting

Rate limit headers are returned on all responses:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### Error Codes

| HTTP Status | Code                   | Description                                 |
| ----------- | ---------------------- | ------------------------------------------- |
| 400         | `VALIDATION_ERROR`     | Request body/params failed Zod validation   |
| 401         | `AUTHENTICATION_ERROR` | Missing or invalid JWT token                |
| 401         | `TOKEN_EXPIRED`        | JWT token has expired                       |
| 403         | `FORBIDDEN`            | Insufficient role/permissions               |
| 404         | `NOT_FOUND`            | Resource not found                          |
| 429         | `RATE_LIMIT_EXCEEDED`  | Too many requests                           |
| 500         | `INTERNAL_ERROR`       | Server error (details hidden in production) |

---

## 1. Authentication API (`/api/auth`)

### 1.1 Generate Challenge

**`POST /api/auth/challenge`**

Rate limit: 10 requests / 15 minutes per IP

**Request:** No body required.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "challenge": "random-hex-string-64-chars",
    "timestamp": 1707660000,
    "expires_at": 1707660900,
    "message": "Please sign this challenge with your NOSTR private key to authenticate with Sovren."
  }
}
```

### 1.2 Authenticate

**`POST /api/auth/authenticate`**

Rate limit: 10 requests / 15 minutes per IP

**Request:**

```json
{
  "nostr_pubkey": "hex-64-char-public-key",
  "challenge": "challenge-from-step-1",
  "timestamp": 1707660000,
  "signature": "schnorr-signature-of-challenge",
  "role": "creator" | "supporter" | "admin"
}
```

**Validation:**

- `nostr_pubkey`: Hex string, exactly 64 characters (`/^[0-9a-fA-F]{64}$/`)
- `challenge`: Non-empty string
- `timestamp`: Number
- `signature`: Non-empty string
- `role`: Optional, defaults to `"supporter"`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "nostr_pubkey": "hex-64-char-public-key",
      "role": "creator",
      "signature_verified": true
    },
    "expires_in": "24h"
  }
}
```

**Error Responses:**

- `400 VALIDATION_ERROR`: Invalid pubkey format, missing fields
- `401 AUTHENTICATION_ERROR`: Invalid or expired challenge/signature

### 1.3 Refresh Token

**`POST /api/auth/refresh`** (Authenticated)

**Request:** No body. JWT token in Authorization header.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token",
    "expires_in": "24h"
  }
}
```

### 1.4 Verify Token

**`GET /api/auth/verify`** (Authenticated)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "nostr_pubkey": "hex-64-char-public-key",
      "role": "creator",
      "signature_verified": true,
      "iat": 1707660000,
      "exp": 1707746400
    },
    "valid": true
  }
}
```

### 1.5 Logout

**`POST /api/auth/logout`** (Optional auth)

**Response (200):**

```json
{
  "success": true,
  "message": "Successfully logged out",
  "data": {
    "instructions": "Please delete the JWT token from your client storage"
  }
}
```

### 1.6 Auth Stats (Admin only)

**`GET /api/auth/stats`** (Authenticated, role=admin)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "activeChallenges": 5,
    "jwtExpiresIn": "24h",
    "challengeTTL": "15m",
    "timestamp": 1707660000
  }
}
```

### 1.7 Auth Health

**`GET /api/auth/health`**

**Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "nostr-auth",
    "timestamp": 1707660000,
    "challenge_generated": true
  }
}
```

---

## 2. Content API (`/api/v1/content`)

### 2.1 Publish Content

**`POST /api/v1/content/publish`** (Authenticated, Creator only)

Rate limit: Content publish rate

**Request:**

```json
{
  "title": "My Premium Article",
  "content_type": "article" | "video" | "audio" | "image" | "livestream" | "course",
  "description": "Article description for discovery",
  "content_url": "https://...",
  "thumbnail_url": "https://...",
  "visibility": "public" | "private" | "supporters_only" | "paid",
  "is_monetized": true,
  "price_sats": 1000,
  "tags": ["nostr", "lightning", "bitcoin"],
  "category": "technology",
  "language": "en",
  "publish_to_nostr": true
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "creator_id": "uuid",
    "title": "My Premium Article",
    "content_type": "article",
    "status": "published",
    "visibility": "paid",
    "is_monetized": true,
    "price_sats": 1000,
    "nostr_event_id": "hex-event-id",
    "created_at": "2026-02-11T00:00:00Z",
    "published_at": "2026-02-11T00:00:00Z"
  }
}
```

### 2.2 Moderate Content

**`POST /api/v1/content/moderate`** (Authenticated, Creator only)

**Request:**

```json
{
  "content_id": "uuid",
  "action": "approve" | "reject" | "flag",
  "reason": "Policy violation description"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "content_id": "uuid",
    "moderation_status": "approved",
    "moderated_at": "2026-02-11T00:00:00Z"
  }
}
```

### 2.3 Search Content

**`GET /api/v1/content/search`** (Optional auth)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `content_type` | string | No | - | Filter by type |
| `category` | string | No | - | Filter by category |
| `visibility` | string | No | - | Filter by visibility |
| `tags` | string[] | No | - | Filter by tags |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page (max 100) |
| `sort` | string | No | "relevance" | Sort field |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "...",
      "description": "...",
      "content_type": "article",
      "creator": { "id": "uuid", "display_name": "...", "avatar_url": "..." },
      "visibility": "public",
      "view_count": 150,
      "like_count": 42,
      "published_at": "2026-02-10T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 2.4 Get Content Recommendations

**`GET /api/v1/content/recommendations`** (Optional auth)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 10 | Number of recommendations |
| `category` | string | No | - | Category filter |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "...",
      "score": 0.95,
      "reason": "Based on your interests"
    }
  ]
}
```

### 2.5 Get Content Analytics

**`GET /api/v1/content/analytics/:id`** (Authenticated)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "content_id": "uuid",
    "views": 1500,
    "unique_viewers": 1200,
    "likes": 340,
    "comments": 28,
    "shares": 15,
    "earnings_sats": 50000,
    "engagement_rate": 0.23,
    "view_history": [
      { "date": "2026-02-10", "views": 200 },
      { "date": "2026-02-11", "views": 350 }
    ]
  }
}
```

### 2.6 Get Version History

**`GET /api/v1/content/versions/:id`** (Authenticated)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "content_id": "uuid",
    "versions": [
      { "version": 3, "created_at": "2026-02-11T00:00:00Z", "summary": "Updated conclusion" },
      { "version": 2, "created_at": "2026-02-10T00:00:00Z", "summary": "Added images" },
      { "version": 1, "created_at": "2026-02-09T00:00:00Z", "summary": "Initial publish" }
    ]
  }
}
```

### 2.7 Revert Content Version

**`POST /api/v1/content/versions/:id/revert`** (Authenticated, Creator only)

**Request:**

```json
{
  "target_version": 2
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "content_id": "uuid",
    "reverted_to_version": 2,
    "new_version": 4
  }
}
```

---

## 3. User API (`/api/v1/users`)

### 3.1 Get User Profile

**`GET /api/v1/users/profile/:id`** (Optional auth)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nostr_pubkey": "hex-64-chars",
    "username": "sophia_art",
    "display_name": "Sophia",
    "bio": "Digital illustrator...",
    "avatar_url": "https://...",
    "role": "creator",
    "nip05_verified": true,
    "lightning_address": "sophia@sovren.com",
    "stats": {
      "follower_count": 1500,
      "post_count": 45,
      "total_supporters": 200
    },
    "subscription_tiers": [
      { "id": "uuid", "name": "Basic", "price_sats": 1000, "features": ["..."] },
      { "id": "uuid", "name": "Premium", "price_sats": 5000, "features": ["..."] }
    ],
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

### 3.2 Update User Profile

**`PUT /api/v1/users/profile/:id`** (Authenticated, own profile only)

**Request:**

```json
{
  "display_name": "Sophia Creates",
  "bio": "Updated bio text",
  "website": "https://sophia.art",
  "lightning_address": "sophia@getalby.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "display_name": "Sophia Creates",
    "bio": "Updated bio text",
    "updated_at": "2026-02-11T00:00:00Z"
  }
}
```

### 3.3 Get User Preferences

**`GET /api/v1/users/preferences/:id`** (Authenticated)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "language": "en",
    "timezone": "UTC",
    "currency": "USD",
    "emailNotifications": {
      "newFollowers": true,
      "newSupport": true,
      "contentUpdates": true
    },
    "pushNotifications": {
      "enabled": true,
      "directMessages": true
    },
    "accessibility": {
      "reducedMotion": false,
      "highContrast": false
    }
  }
}
```

### 3.4 Update User Preferences

**`PUT /api/v1/users/preferences/:id`** (Authenticated)

**Request:** Partial update of any preference fields.

### 3.5 Get User Activity

**`GET /api/v1/users/activity/:id`** (Authenticated)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "type": "new_post",
      "metadata": { "content_id": "uuid" },
      "created_at": "2026-02-11T00:00:00Z"
    },
    {
      "type": "support_received",
      "metadata": { "amount_sats": 5000 },
      "created_at": "2026-02-10T00:00:00Z"
    }
  ]
}
```

### 3.6 Follow User

**`POST /api/v1/users/relationships/follow`** (Authenticated)

**Request:**

```json
{
  "target_user_id": "uuid"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "follower_id": "uuid",
    "following_id": "uuid",
    "created_at": "2026-02-11T00:00:00Z"
  }
}
```

### 3.7 Unfollow User

**`DELETE /api/v1/users/relationships/unfollow`** (Authenticated)

**Request:**

```json
{
  "target_user_id": "uuid"
}
```

### 3.8 Get User Analytics

**`GET /api/v1/users/analytics/:id`** (Authenticated)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "timeframe": "month",
    "metrics": {
      "profileViews": 5000,
      "followersGained": 120,
      "supportReceived": 250000,
      "contentEngagement": 0.23,
      "earningsGrowth": 0.15
    }
  }
}
```

---

## 4. Payment API (`/api/v1/payments`)

### 4.1 Create Invoice

**`POST /api/v1/payments/invoices`** (Authenticated)

**Request:**

```json
{
  "amount_sats": 5000,
  "recipient_id": "uuid",
  "content_id": "uuid",
  "payment_type": "subscription" | "tip" | "one_time" | "commission",
  "description": "Subscription to Premium tier",
  "memo": "Monthly subscription"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "payment_request": "lnbc50u1p3...",
    "payment_hash": "hex-64-chars",
    "amount_sats": 5000,
    "status": "pending",
    "expires_at": "2026-02-11T01:00:00Z",
    "created_at": "2026-02-11T00:00:00Z"
  }
}
```

### 4.2 Get Invoice

**`GET /api/v1/payments/invoices/:id`** (Authenticated)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "amount_sats": 5000,
    "status": "paid",
    "payment_hash": "hex-64-chars",
    "paid_at": "2026-02-11T00:05:00Z",
    "payer_id": "uuid",
    "recipient_id": "uuid"
  }
}
```

### 4.3 Pay Invoice

**`POST /api/v1/payments/invoices/:id/pay`** (Authenticated)

**Request:**

```json
{
  "payment_request": "lnbc50u1p3..."
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "paid",
    "preimage": "hex-64-chars",
    "fee_sats": 1,
    "paid_at": "2026-02-11T00:05:00Z"
  }
}
```

### 4.4 Currency Conversion

**`GET /api/v1/payments/currency/convert`** (Authenticated)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Amount to convert |
| `from` | string | Yes | Source currency (e.g., "BTC", "USD") |
| `to` | string | Yes | Target currency |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "BTC",
    "amount": 10.0,
    "converted": 0.00015,
    "sats": 15000,
    "rate": 66666.67,
    "timestamp": "2026-02-11T00:00:00Z"
  }
}
```

### 4.5 Create Subscription

**`POST /api/v1/payments/subscriptions`** (Authenticated)

**Request:**

```json
{
  "creator_id": "uuid",
  "tier_id": "uuid",
  "billing_interval": "monthly"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "creator_id": "uuid",
    "tier_id": "uuid",
    "status": "active",
    "start_date": "2026-02-11T00:00:00Z",
    "next_billing_date": "2026-03-11T00:00:00Z",
    "amount_sats": 5000,
    "initial_invoice": {
      "payment_request": "lnbc50u1p3...",
      "payment_hash": "hex-64-chars"
    }
  }
}
```

### 4.6 Update Subscription

**`PUT /api/v1/payments/subscriptions/:id`** (Authenticated)

**Request:**

```json
{
  "tier_id": "new-tier-uuid"
}
```

### 4.7 Cancel Subscription

**`DELETE /api/v1/payments/subscriptions/:id`** (Authenticated)

**Request:**

```json
{
  "reason": "No longer needed",
  "cancel_at_period_end": true
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "cancelled",
    "cancelled_at": "2026-02-11T00:00:00Z",
    "access_until": "2026-03-11T00:00:00Z"
  }
}
```

### 4.8 Create Refund

**`POST /api/v1/payments/refunds`** (Authenticated)

**Request:**

```json
{
  "payment_id": "uuid",
  "amount_sats": 5000,
  "reason": "Service not delivered"
}
```

### 4.9 Payment Analytics

**`GET /api/v1/payments/analytics`** (Authenticated)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeframe` | string | No | "month" | day, week, month, year |
| `type` | string | No | - | Filter by payment type |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "total_revenue_sats": 500000,
    "total_transactions": 150,
    "average_payment_sats": 3333,
    "mrr_sats": 250000,
    "subscriber_count": 50,
    "revenue_by_day": [{ "date": "2026-02-10", "revenue_sats": 25000, "count": 8 }]
  }
}
```

### 4.10 Register Webhook

**`POST /api/v1/payments/webhooks`** (Authenticated)

**Request:**

```json
{
  "url": "https://example.com/webhook",
  "events": ["payment.confirmed", "subscription.created", "subscription.cancelled"],
  "secret": "webhook-signing-secret"
}
```

---

## 5. Lightning API (`/api/lightning`)

### 5.1 Get Node Info

**`GET /api/lightning/node-info`** (Authenticated)

**Response (200):**

```json
{
  "alias": "sovren-ln",
  "pubkey": "hex-pubkey",
  "num_channels": 15,
  "capacity_sats": 10000000,
  "synced_to_chain": true
}
```

### 5.2 Create Lightning Invoice

**`POST /api/lightning/invoice`** (Authenticated)

**Request:**

```json
{
  "amount_msats": 5000000,
  "description": "Payment for content",
  "expiry_seconds": 3600
}
```

### 5.3 Check Invoice Status

**`GET /api/lightning/invoice/:paymentHash`** (Authenticated)

### 5.4 Make Lightning Payment

**`POST /api/lightning/payment`** (Authenticated)

**Request:**

```json
{
  "paymentRequest": "lnbc50u1p3..."
}
```

---

## 6. Health API

### 6.1 System Health

**`GET /health`**

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-11T00:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "lightning": "connected",
    "nostr": "connected"
  },
  "uptime": 86400
}
```

### 6.2 Prometheus Metrics

**`GET /metrics`**

Returns Prometheus-format metrics for scraping.
