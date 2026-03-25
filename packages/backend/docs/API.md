# 📡 Sovren Backend API Documentation

**Complete API Reference for Sovren Backend v1.0.0**

## 🎯 Overview

The Sovren Backend API provides a comprehensive set of endpoints for NOSTR-native authentication, user management, and platform administration. Built with TypeScript and Express.js, it follows RESTful principles and implements robust security measures.

### 🔗 Base URL

```
Development: http://localhost:3001
Production: https://api.sovren.com (when deployed)
```

### 🔑 Authentication

The API uses **NOSTR cryptographic authentication** combined with **JWT tokens** for session management:

1. **NOSTR Challenge-Response**: Cryptographic proof of identity
2. **JWT Tokens**: Stateless session management
3. **Role-Based Access**: Supporter, Creator, Admin hierarchical permissions

### 📝 Request/Response Format

- **Content-Type**: `application/json`
- **Character Encoding**: UTF-8
- **Response Format**: Consistent JSON structure with `success`, `data`, and `error` fields

### 🔒 Security Headers

All responses include comprehensive security headers:

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `Strict-Transport-Security` (Production)

---

## 🔐 Authentication Endpoints

### POST `/api/auth/challenge`

Generate a cryptographic challenge for NOSTR authentication.

#### Request

```http
POST /api/auth/challenge
Content-Type: application/json

{}
```

#### Response

```json
{
  "success": true,
  "data": {
    "challenge": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
    "timestamp": 1640995200000,
    "expires_at": 1640999800000,
    "message": "Please sign this challenge to authenticate with Sovren\n\nChallenge: a1b2c3d4e5f6...\nTimestamp: 1640995200000"
  }
}
```

#### Response Fields

| Field        | Type   | Description                               |
| ------------ | ------ | ----------------------------------------- |
| `challenge`  | string | 64-character hex challenge string         |
| `timestamp`  | number | Unix timestamp when challenge was created |
| `expires_at` | number | Unix timestamp when challenge expires     |
| `message`    | string | Human-readable message to sign            |

#### Error Responses

```json
{
  "success": false,
  "error": "Challenge generation failed",
  "code": "CHALLENGE_GENERATION_ERROR"
}
```

---

### POST `/api/auth/authenticate`

Authenticate using NOSTR signature and receive JWT token.

#### Request

```http
POST /api/auth/authenticate
Content-Type: application/json

{
  "nostr_pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "challenge": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
  "timestamp": 1640995200000,
  "signature": "3045022100a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890022033221100ffeeddccbbaa998877665544332211009988776655443322110099887766",
  "role": "creator"
}
```

#### Request Fields

| Field          | Type   | Required | Description                              |
| -------------- | ------ | -------- | ---------------------------------------- |
| `nostr_pubkey` | string | ✅       | 64-character hex NOSTR public key        |
| `challenge`    | string | ✅       | Challenge from previous step             |
| `timestamp`    | number | ✅       | Timestamp from challenge                 |
| `signature`    | string | ✅       | NOSTR signature of the challenge message |
| `role`         | string | ❌       | Requested role (supporter/creator/admin) |

#### Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "nostr_pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "role": "creator",
      "signature_verified": true,
      "username": "creator123",
      "display_name": "Creator Name"
    },
    "expires_in": "24h"
  }
}
```

#### Error Responses

```json
{
  "success": false,
  "error": "Invalid signature",
  "code": "INVALID_SIGNATURE"
}
```

---

### POST `/api/auth/refresh`

Refresh JWT token using current valid token.

#### Request

```http
POST /api/auth/refresh
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{}
```

#### Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": "24h"
  }
}
```

---

### GET `/api/auth/verify`

Verify current authentication status.

#### Request

```http
GET /api/auth/verify
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "nostr_pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "role": "creator",
      "exp": 1640999800
    }
  }
}
```

---

### POST `/api/auth/logout`

Logout and invalidate current session.

#### Request

```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

---

### GET `/api/auth/stats` 🔒 Admin Only

Get authentication service statistics.

#### Request

```http
GET /api/auth/stats
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

```json
{
  "success": true,
  "data": {
    "total_challenges": 1250,
    "successful_authentications": 980,
    "failed_authentications": 270,
    "active_sessions": 45,
    "success_rate": 78.4
  }
}
```

---

## 👥 User Management Endpoints

### POST `/api/users/profile`

Create a new user profile.

#### Request

```http
POST /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "username": "creator123",
  "display_name": "Amazing Creator",
  "bio": "I create amazing content for the NOSTR ecosystem",
  "avatar_url": "https://example.com/avatar.jpg",
  "email": "creator@example.com"
}
```

#### Request Fields

| Field          | Type   | Required | Description                                                  |
| -------------- | ------ | -------- | ------------------------------------------------------------ |
| `username`     | string | ❌       | Unique username (1-50 characters, alphanumeric + underscore) |
| `display_name` | string | ❌       | Display name for profile (max 100 characters)                |
| `bio`          | string | ❌       | Profile biography (max 500 characters)                       |
| `avatar_url`   | string | ❌       | URL to profile avatar image                                  |
| `email`        | string | ❌       | Email address for notifications                              |

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "nostr_pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "username": "creator123",
      "display_name": "Amazing Creator",
      "bio": "I create amazing content for the NOSTR ecosystem",
      "avatar_url": "https://example.com/avatar.jpg",
      "role": "supporter",
      "email": "creator@example.com",
      "email_verified": false,
      "is_active": true,
      "is_verified": false,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "last_login_at": null
    }
  }
}
```

---

### GET `/api/users/profile`

Get current user's profile.

#### Request

```http
GET /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "nostr_pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "username": "creator123",
      "display_name": "Amazing Creator",
      "bio": "I create amazing content for the NOSTR ecosystem",
      "avatar_url": "https://example.com/avatar.jpg",
      "role": "creator",
      "email": "creator@example.com",
      "email_verified": true,
      "is_active": true,
      "is_verified": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T14:20:00Z",
      "last_login_at": "2024-01-15T14:20:00Z"
    }
  }
}
```

---

### PUT `/api/users/profile`

Update current user's profile.

#### Request

```http
PUT /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "display_name": "Updated Creator Name",
  "bio": "Updated bio with new information",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "nostr_pubkey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "username": "creator123",
      "display_name": "Updated Creator Name",
      "bio": "Updated bio with new information",
      "avatar_url": "https://example.com/new-avatar.jpg",
      "role": "creator",
      "updated_at": "2024-01-15T15:45:00Z"
    }
  }
}
```

---

### GET `/api/users/search`

Search users by username or display name.

#### Request

```http
GET /api/users/search?q=creator&limit=10&offset=0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Query Parameters

| Parameter | Type   | Required | Description                                       |
| --------- | ------ | -------- | ------------------------------------------------- |
| `q`       | string | ✅       | Search query (username or display name)           |
| `limit`   | number | ❌       | Maximum results to return (default: 20, max: 100) |
| `offset`  | number | ❌       | Number of results to skip (default: 0)            |

#### Response

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "creator123",
        "display_name": "Amazing Creator",
        "avatar_url": "https://example.com/avatar.jpg",
        "role": "creator",
        "is_verified": true
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

---

### GET `/api/users/stats` 🔒 Admin Only

Get user statistics and analytics.

#### Request

```http
GET /api/users/stats
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

```json
{
  "success": true,
  "data": {
    "total_users": 15420,
    "active_users": 12890,
    "new_users_today": 45,
    "role_distribution": {
      "supporter": 13200,
      "creator": 2100,
      "admin": 120
    },
    "verified_users": 8960,
    "growth_rate": 12.5
  }
}
```

---

### PUT `/api/users/:id/role` 🔒 Admin Only

Update a user's role.

#### Request

```http
PUT /api/users/550e8400-e29b-41d4-a716-446655440000/role
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "role": "creator"
}
```

#### Request Fields

| Field  | Type   | Required | Description                        |
| ------ | ------ | -------- | ---------------------------------- |
| `role` | string | ✅       | New role (supporter/creator/admin) |

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "user123",
      "role": "creator",
      "updated_at": "2024-01-15T16:00:00Z"
    }
  }
}
```

---

## 🏥 Health & Monitoring Endpoints

### GET `/health`

Server health check endpoint for load balancers and monitoring.

#### Request

```http
GET /health
```

#### Response

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T16:00:00Z",
    "uptime": 3600000,
    "version": "1.0.0",
    "environment": "production",
    "database": {
      "connected": true,
      "latency": 45
    },
    "memory": {
      "used": 256789012,
      "total": 536870912
    }
  }
}
```

---

### GET `/api`

API information and available endpoints.

#### Request

```http
GET /api
```

#### Response

```json
{
  "success": true,
  "data": {
    "name": "Sovren Backend API",
    "version": "1.0.0",
    "description": "Elite NOSTR-native authentication and user management API",
    "documentation": "https://docs.sovren.com/api",
    "endpoints": {
      "authentication": "/api/auth",
      "users": "/api/users",
      "health": "/health"
    },
    "features": [
      "NOSTR Authentication",
      "JWT Session Management",
      "Role-Based Access Control",
      "User Profile Management"
    ]
  }
}
```

---

## 🚨 Error Handling

### Error Response Format

All error responses follow a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific field that caused error",
    "value": "invalid value"
  }
}
```

### HTTP Status Codes

| Status Code | Description           | When Used                 |
| ----------- | --------------------- | ------------------------- |
| `200`       | OK                    | Successful requests       |
| `201`       | Created               | Resource creation success |
| `400`       | Bad Request           | Invalid request data      |
| `401`       | Unauthorized          | Authentication required   |
| `403`       | Forbidden             | Insufficient permissions  |
| `404`       | Not Found             | Resource not found        |
| `409`       | Conflict              | Resource already exists   |
| `422`       | Unprocessable Entity  | Validation errors         |
| `429`       | Too Many Requests     | Rate limit exceeded       |
| `500`       | Internal Server Error | Server-side errors        |

### Common Error Codes

| Error Code                 | Description                         |
| -------------------------- | ----------------------------------- |
| `INVALID_NOSTR_PUBKEY`     | NOSTR public key format invalid     |
| `INVALID_SIGNATURE`        | NOSTR signature verification failed |
| `CHALLENGE_EXPIRED`        | Authentication challenge expired    |
| `USER_NOT_FOUND`           | User profile not found              |
| `USERNAME_TAKEN`           | Username already in use             |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions     |
| `RATE_LIMIT_EXCEEDED`      | Too many requests from client       |
| `DATABASE_ERROR`           | Database operation failed           |

### Example Error Responses

#### Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "username": "Username must be 1-50 characters and contain only letters, numbers, and underscores"
  }
}
```

#### Authentication Error

```json
{
  "success": false,
  "error": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}
```

#### Permission Error

```json
{
  "success": false,
  "error": "Admin role required for this operation",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

---

## 🔒 Security Considerations

### Rate Limiting

| Endpoint Category | Limit         | Window     |
| ----------------- | ------------- | ---------- |
| Authentication    | 10 requests   | 15 minutes |
| User Operations   | 100 requests  | 15 minutes |
| General API       | 1000 requests | 15 minutes |

### Request Validation

- All input is validated using Zod schemas
- NOSTR public keys must be valid 64-character hex strings
- Usernames must match pattern: `^[a-zA-Z0-9_]{1,50}$`
- Email addresses must be valid email format
- URLs must be valid HTTP/HTTPS URLs

### NOSTR Signature Verification

1. Challenge must be valid and not expired
2. Signature must be valid secp256k1 signature
3. Public key must match the signer
4. Message format must be exactly as specified

---

## 📊 Performance

### Response Time Targets

- Authentication endpoints: <200ms
- User profile operations: <150ms
- Search operations: <300ms
- Health checks: <50ms

### Caching Strategy

- User profiles: In-memory cache with 5-minute TTL
- Authentication challenges: 15-minute TTL
- Statistics: 1-minute cache TTL

---

## 🔧 Development

### Testing API Endpoints

#### Using curl

```bash
# Generate challenge
curl -X POST http://localhost:3001/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{}'

# Authenticate (replace with actual values)
curl -X POST http://localhost:3001/api/auth/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "nostr_pubkey": "1234...",
    "challenge": "abc123...",
    "timestamp": 1640995200000,
    "signature": "3045..."
  }'

# Get profile (replace token)
curl -X GET http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Using JavaScript/Fetch

```javascript
// Generate challenge
const challengeResponse = await fetch('/api/auth/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});

// Authenticate
const authResponse = await fetch('/api/auth/authenticate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nostr_pubkey: 'your-pubkey',
    challenge: 'challenge-from-previous-step',
    timestamp: Date.now(),
    signature: 'nostr-signature',
  }),
});

// Use token for authenticated requests
const token = (await authResponse.json()).data.token;
const profileResponse = await fetch('/api/users/profile', {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## 📝 Changelog

For API version history and breaking changes, see [CHANGELOG.md](../CHANGELOG.md).

---

## 🆘 Support

- **Documentation Issues**: Create an issue in the project repository
- **API Questions**: Check existing documentation or create a support ticket
- **Security Issues**: Report privately to the security team

---

_API Documentation v1.0.0 - Last Updated: Phase 1 Completion_
