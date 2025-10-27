# API Architecture Documentation

## Overview

Sovren follows an API-first design approach, ensuring all functionality is accessible via well-documented, versioned REST APIs with comprehensive OpenAPI specifications.

## Core Principles

### 1. API-First Design

- APIs are designed before implementation
- Frontend and backend teams work in parallel
- Consistent interface contracts
- Mock servers for development

### 2. RESTful Architecture

- Resource-based URLs
- HTTP methods for operations
- Stateless communication
- Cacheable responses

### 3. Versioning Strategy

- URL-based versioning (`/api/v1/`)
- Backward compatibility maintenance
- Deprecation notice periods
- Migration guides for breaking changes

## API Structure

### Base URL Structure

```
Production:  https://api.sovren.dev/v1
Staging:     https://api-staging.sovren.dev/v1
Development: http://localhost:3001/api/v1
```

### Authentication

- JWT-based authentication
- NOSTR key verification support
- API key authentication for service-to-service
- Rate limiting by authentication level

## Core API Endpoints

### 1. Authentication (`/api/v1/auth`)

#### POST `/api/v1/auth/register`

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword",
  "name": "User Name",
  "nostrPubkey": "npub1...", // Optional NOSTR public key
  "inviteCode": "ABC123" // Optional invite code
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "nostrPubkey": "npub1...",
      "createdAt": "2024-05-29T14:30:00.000Z",
      "emailVerified": false
    },
    "tokens": {
      "access": "jwt-token",
      "refresh": "refresh-token"
    }
  }
}
```

#### POST `/api/v1/auth/login`

Authenticate user and get access tokens.

#### POST `/api/v1/auth/logout`

Invalidate current session tokens.

#### POST `/api/v1/auth/refresh`

Refresh access token using refresh token.

#### GET `/api/v1/auth/me`

Get current user information.

### 2. Users (`/api/v1/users`)

#### GET `/api/v1/users/{userId}`

Get user profile information.

#### PUT `/api/v1/users/{userId}`

Update user profile.

#### GET `/api/v1/users/{userId}/posts`

Get user's posts with pagination.

#### GET `/api/v1/users/{userId}/payments`

Get user's payment history.

### 3. Posts (`/api/v1/posts`)

#### GET `/api/v1/posts`

List posts with filtering and pagination.

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `authorId`: Filter by author
- `tag`: Filter by tags
- `sort`: Sort order (newest, oldest, popular)

#### POST `/api/v1/posts`

Create a new post.

#### GET `/api/v1/posts/{postId}`

Get specific post details.

#### PUT `/api/v1/posts/{postId}`

Update post (author only).

#### DELETE `/api/v1/posts/{postId}`

Delete post (author only).

### 4. Payments (`/api/v1/payments`)

#### POST `/api/v1/payments/invoice`

Create Lightning Network payment invoice.

#### GET `/api/v1/payments/{paymentId}`

Get payment status.

#### POST `/api/v1/payments/webhook`

Lightning Network payment webhook.

### 5. Feature Flags (`/api/v1/feature-flags`)

#### GET `/api/v1/feature-flags`

Get current feature flag configuration.

#### PUT `/api/v1/feature-flags/{flagName}`

Update feature flag (admin only).

### 6. Health (`/api/v1/health`)

#### GET `/api/v1/health`

System health check.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    // Optional metadata (pagination, etc.)
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "requestId": "req_123456789"
  }
}
```

## Error Codes

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity
- `429` - Rate Limited
- `500` - Internal Server Error

### Custom Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_REQUIRED` - Valid authentication required
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded
- `FEATURE_DISABLED` - Feature is disabled via feature flag

## Authentication & Authorization

### JWT Token Structure

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "user",
  "nostrPubkey": "npub1...",
  "iat": 1640995200,
  "exp": 1641081600
}
```

### Permission Levels

- `user` - Basic user permissions
- `creator` - Content creation permissions
- `moderator` - Content moderation permissions
- `admin` - Full system access

## Rate Limiting

### Rate Limits by Authentication

- **Unauthenticated**: 100 requests/hour
- **Authenticated Users**: 1000 requests/hour
- **API Keys**: 5000 requests/hour
- **Admin**: No limit

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Caching Strategy

### Cache Headers

```
Cache-Control: public, max-age=3600
ETag: "abc123"
Last-Modified: Wed, 29 May 2024 14:30:00 GMT
```

### Cacheable Endpoints

- User profiles (1 hour)
- Post content (30 minutes)
- Feature flags (5 minutes)
- Static content (24 hours)

## API Versioning

### Version Support Policy

- **Current Version (v1)**: Full support
- **Previous Version**: Security updates only
- **Deprecated Versions**: 6-month sunset period

### Breaking Change Process

1. Announce deprecation 6 months prior
2. Provide migration documentation
3. Offer developer support
4. Sunset old version

## OpenAPI Specification

### Documentation Generation

- Auto-generated from code annotations
- Interactive API explorer
- Client SDK generation
- Postman collection export

### Specification Location

- **Production**: `https://api.sovren.dev/v1/docs`
- **OpenAPI JSON**: `https://api.sovren.dev/v1/openapi.json`

## Testing Strategy

### API Testing Levels

1. **Unit Tests**: Individual endpoint logic
2. **Integration Tests**: Full request/response cycle
3. **Contract Tests**: API specification compliance
4. **Load Tests**: Performance under load

### Testing Tools

- Jest for unit/integration tests
- Supertest for HTTP testing
- Postman for manual testing
- K6 for load testing

## Security

### Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

### Input Validation

- Zod schema validation
- SQL injection prevention
- XSS protection
- Rate limiting
- Request size limits

### CORS Configuration

```json
{
  "origin": ["https://sovren.dev", "https://app.sovren.dev"],
  "methods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["Content-Type", "Authorization"],
  "credentials": true
}
```

## Monitoring & Analytics

### Metrics Collection

- Request/response times
- Error rates by endpoint
- Authentication success/failure
- Rate limit violations

### Logging

- Structured JSON logging
- Request ID tracing
- Error stack traces
- Performance metrics

### Alerting

- High error rates
- Slow response times
- Authentication failures
- Rate limit violations

## Development Workflow

### API-First Development

1. Design API specification
2. Review with stakeholders
3. Generate mock server
4. Implement frontend/backend in parallel
5. Integration testing
6. Documentation updates

### Documentation Standards

- OpenAPI 3.0+ specification
- Code examples in multiple languages
- Interactive documentation
- Changelog maintenance

---

_Last updated: 2024-05-29_
_Version: 1.0_
_Next review: When API changes are proposed_
