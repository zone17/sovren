# Authentication & Authorization Guide

## Overview

The Sovren API uses JWT (JSON Web Tokens) for authentication combined with NOSTR protocol public keys for decentralized identity verification. This dual-layer approach ensures both traditional API security and NOSTR protocol compliance.

## Authentication Flow

### 1. User Registration

Create a new user account:

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password_here",
  "displayName": "Alice Creator",
  "nostrPubkey": "npub1..." // Optional: Link existing NOSTR identity
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "displayName": "Alice Creator",
    "nostrPubkey": "npub1...",
    "role": "supporter"
  }
}
```

### 2. User Login

Obtain an authentication token:

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJub3N0clB1YmtleSI6Im5wdWIxLi4uIiwicm9sZSI6ImNyZWF0b3IiLCJpYXQiOjE2OTg0MTUyMDAsImV4cCI6MTY5ODUwMTYwMH0.signature",
    "refreshToken": "refresh_token_here",
    "expiresIn": 86400,
    "user": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "nostrPubkey": "npub1...",
      "role": "creator"
    }
  }
}
```

### 3. Using the Token

Include the token in the `Authorization` header for all authenticated requests:

```bash
GET /api/v1/users/profile/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Token Refresh

Tokens expire after 24 hours. Refresh before expiration:

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 86400
  }
}
```

## JWT Token Structure

The JWT token contains three parts: Header, Payload, and Signature.

### Header
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload (Claims)
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "nostrPubkey": "npub1...",
  "role": "creator",
  "iat": 1698415200,
  "exp": 1698501600
}
```

### Signature
The signature is generated using:
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

## NOSTR Authentication

For NOSTR-native authentication, users can authenticate using their NOSTR keys:

### NOSTR Login Flow

1. **Request Challenge**
```bash
POST /api/v1/auth/nostr/challenge
Content-Type: application/json

{
  "nostrPubkey": "npub1..."
}
```

2. **Sign Challenge**
The client signs the challenge with their NOSTR private key (nsec).

3. **Verify Signature**
```bash
POST /api/v1/auth/nostr/verify
Content-Type: application/json

{
  "nostrPubkey": "npub1...",
  "challenge": "challenge_string",
  "signature": "signed_challenge"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": 86400,
    "user": {
      "userId": "user-id",
      "nostrPubkey": "npub1...",
      "role": "creator"
    }
  }
}
```

## User Roles

Sovren has three user roles with different permissions:

### Supporter (Default)
- View public content
- Search and discover creators
- Follow users
- Create payments and subscriptions
- Tip creators

### Creator
All Supporter permissions plus:
- Publish content
- Set content pricing
- Access analytics
- Manage subscriptions
- Receive payments
- Moderate their own content

### Admin
All Creator permissions plus:
- Platform-wide content moderation
- User management
- System analytics
- Webhook management
- Refund processing

## Authorization

Authorization is role-based and enforced at the API level.

### Permission Matrix

| Endpoint | Supporter | Creator | Admin |
|----------|-----------|---------|-------|
| **Content** |
| GET /content/search | ✓ | ✓ | ✓ |
| GET /content/recommendations | ✓ | ✓ | ✓ |
| POST /content/publish | ✗ | ✓ | ✓ |
| POST /content/moderate | ✗ | Own content | ✓ |
| GET /content/analytics/:id | ✗ | Own content | ✓ |
| GET /content/versions/:id | ✗ | Own content | ✓ |
| POST /content/versions/:id/revert | ✗ | Own content | ✓ |
| **Users** |
| GET /users/profile/:id | ✓ | ✓ | ✓ |
| PUT /users/profile/:id | Own profile | Own profile | ✓ |
| GET /users/preferences/:id | Own | Own | ✓ |
| PUT /users/preferences/:id | Own | Own | ✓ |
| GET /users/activity/:id | Own | Own | ✓ |
| POST /users/relationships/follow | ✓ | ✓ | ✓ |
| DELETE /users/relationships/unfollow | ✓ | ✓ | ✓ |
| GET /users/analytics/:id | ✗ | Own | ✓ |
| **Payments** |
| POST /payments/invoices | ✓ | ✓ | ✓ |
| GET /payments/invoices/:id | Own | Own | ✓ |
| POST /payments/invoices/:id/pay | ✓ | ✓ | ✓ |
| GET /payments/currency/convert | ✓ | ✓ | ✓ |
| POST /payments/subscriptions | ✓ | ✓ | ✓ |
| PUT /payments/subscriptions/:id | Own | Own | ✓ |
| DELETE /payments/subscriptions/:id | Own | Own | ✓ |
| POST /payments/refunds | ✗ | Own payments | ✓ |
| GET /payments/analytics | ✗ | Own | ✓ |
| POST /payments/webhooks | ✗ | ✓ | ✓ |

## Error Codes

### Authentication Errors

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| E401 | 401 | No authentication token provided | Include `Authorization` header |
| E402 | 401 | Invalid or expired token | Re-authenticate to get new token |
| E403 | 403 | Insufficient permissions | User role doesn't allow this action |
| E404 | 401 | Invalid credentials | Check email/password or NOSTR signature |
| E405 | 401 | NOSTR signature verification failed | Re-sign challenge with correct key |

## Security Best Practices

### Token Storage

**DO:**
- Store tokens in secure, HTTP-only cookies (server-side)
- Use environment variables for server tokens
- Implement token rotation
- Clear tokens on logout

**DON'T:**
- Store tokens in localStorage (XSS vulnerable)
- Include tokens in URLs
- Commit tokens to version control
- Share tokens between users

### Token Lifecycle

```javascript
// Good: Secure token management
class TokenManager {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  async setToken(token, refreshToken, expiresIn) {
    this.token = token;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);

    // Store refresh token in secure HTTP-only cookie
    await this.storeRefreshToken(refreshToken);
  }

  async getToken() {
    // Refresh if token expires in next 5 minutes
    if (this.tokenExpiry - Date.now() < 300000) {
      await this.refreshAccessToken();
    }
    return this.token;
  }

  async refreshAccessToken() {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    const data = await response.json();
    await this.setToken(data.token, data.refreshToken, data.expiresIn);
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.clearRefreshToken();
  }
}
```

### Password Requirements

Passwords must meet these requirements:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot contain email or display name

### NOSTR Key Security

**DO:**
- Use NOSTR browser extensions (Alby, nos2x) for key management
- Implement NIP-07 for secure key access
- Never prompt users to paste private keys (nsec) directly

**DON'T:**
- Store NOSTR private keys (nsec) in application
- Transmit private keys over network
- Prompt users for nsec in forms

```javascript
// Good: Use NIP-07 compatible extension
async function signNostrEvent(event) {
  if (window.nostr) {
    return await window.nostr.signEvent(event);
  }
  throw new Error('NOSTR extension not found');
}

// Bad: Never do this
function getPrivateKey() {
  return prompt('Enter your nsec...'); // NEVER DO THIS
}
```

### Rate Limiting

Authentication endpoints have strict rate limits:

- **Login**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP
- **Token Refresh**: 20 attempts per hour per user
- **Password Reset**: 3 attempts per hour per email

## API Key Authentication (Coming Soon)

For server-to-server integrations, API keys will be supported:

```bash
GET /api/v1/users/profile/user-id
X-API-Key: your_api_key_here
```

API keys:
- Never expire (until revoked)
- Have specific permission scopes
- Can be restricted by IP address
- Should be rotated regularly

## Logout

Invalidate tokens on logout:

```bash
POST /api/v1/auth/logout
Authorization: Bearer token_here
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

This invalidates both access and refresh tokens.

## Multi-Device Sessions

Users can have multiple active sessions across devices. View and manage sessions:

```bash
GET /api/v1/auth/sessions
Authorization: Bearer token_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "session-1",
        "device": "Chrome on MacOS",
        "ipAddress": "192.168.1.1",
        "location": "San Francisco, CA",
        "createdAt": "2025-10-27T08:00:00Z",
        "lastActiveAt": "2025-10-27T10:30:00Z",
        "current": true
      },
      {
        "sessionId": "session-2",
        "device": "Safari on iPhone",
        "ipAddress": "192.168.1.2",
        "location": "San Francisco, CA",
        "createdAt": "2025-10-26T15:00:00Z",
        "lastActiveAt": "2025-10-27T09:00:00Z",
        "current": false
      }
    ]
  }
}
```

Revoke a specific session:

```bash
DELETE /api/v1/auth/sessions/session-2
Authorization: Bearer token_here
```

## Testing Authentication

### Development Mode

For local development, you can use test credentials:

```json
{
  "email": "test@sovren.local",
  "password": "test_password_dev_only"
}
```

**Warning**: Test credentials only work in development environment.

### Postman Authentication

1. Set up collection-level authorization:
   - Type: Bearer Token
   - Token: `{{auth_token}}`

2. Add pre-request script to auto-refresh:
```javascript
const tokenExpiry = pm.environment.get('token_expiry');
const now = Date.now();

if (!tokenExpiry || now >= tokenExpiry - 300000) {
  // Refresh token
  pm.sendRequest({
    url: pm.environment.get('base_url') + '/auth/refresh',
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        refreshToken: pm.environment.get('refresh_token')
      })
    }
  }, (err, response) => {
    const data = response.json();
    pm.environment.set('auth_token', data.data.token);
    pm.environment.set('refresh_token', data.data.refreshToken);
    pm.environment.set('token_expiry', now + (data.data.expiresIn * 1000));
  });
}
```

## Troubleshooting

### Common Authentication Issues

**"Token expired" errors**
- Token lifetime is 24 hours
- Implement automatic token refresh
- Check token expiry before requests

**"Invalid signature" errors**
- Verify NOSTR key format (npub1... for public keys)
- Ensure challenge is signed correctly
- Check that public key matches the signing private key

**"Insufficient permissions" errors**
- Verify user role has required permissions
- Check resource ownership (e.g., can only edit own content)
- Contact admin if role upgrade needed

**CORS errors in browser**
- API includes proper CORS headers
- Ensure credentials are included in requests
- Check browser console for specific CORS error

## Support

For authentication-related issues:
- Email: security@sovren.app
- Emergency: Report token leaks immediately to security@sovren.app

---

**Next Steps:**
- [Quick Start Guide](/docs/api/quick-start.md): Make your first authenticated request
- [API Reference](/docs/api/reference/): Explore all endpoints
- [Error Codes](/docs/api/errors.md): Complete error code reference
