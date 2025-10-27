# Sovren API Documentation

Complete API documentation for the Sovren decentralized creator monetization platform.

## Overview

The Sovren API provides programmatic access to all platform features including content management, user profiles, Lightning Network payments, and NOSTR protocol integration. Built with RESTful principles and comprehensive error handling.

**Current Version**: v1.0.0
**Base URL**: `https://api.sovren.app/v1`
**Protocol**: HTTPS only
**Format**: JSON
**Authentication**: JWT Bearer tokens

## Epic 005 Implementation

This documentation reflects the complete **Phase 1-7 implementation of Epic 005: Backend Service Refactoring**, including:

- 25 fully documented API endpoints
- 61 Data Transfer Objects (DTOs)
- Unified API architecture (Content, User, Payment domains)
- Complete OpenAPI 3.0 specification
- Comprehensive request/response examples
- Authentication & authorization framework
- Rate limiting and error handling
- Webhook event system

## Documentation Structure

### Getting Started

1. **[Quick Start Guide](./quick-start.md)** - Make your first API call in 5 minutes
   - Authentication flow
   - First API requests (profile, content, payments)
   - Code examples (JavaScript, Python, cURL)
   - Common use cases

2. **[Authentication & Authorization](./authentication.md)** - Secure API access
   - JWT token management
   - NOSTR authentication
   - User roles and permissions
   - Security best practices
   - Token refresh and session management

3. **[OpenAPI Specification](./openapi.yaml)** - Machine-readable API definition
   - Complete endpoint specifications
   - Request/response schemas
   - Interactive API explorer (Swagger UI)
   - Import into API clients (Postman, Insomnia)

### API Reference

Detailed documentation for all 25 endpoints organized by domain:

4. **[Content API Reference](./reference/content-api.md)** - 7 endpoints
   - `POST /content/publish` - Publish new content
   - `POST /content/moderate` - Moderate content
   - `GET /content/search` - Search content
   - `GET /content/recommendations` - Get recommendations
   - `GET /content/analytics/{id}` - Get content analytics
   - `GET /content/versions/{id}` - Get version history
   - `POST /content/versions/{id}/revert` - Revert to version

5. **[User API Reference](./reference/user-api.md)** - 8 endpoints
   - `GET /users/profile/{id}` - Get user profile
   - `PUT /users/profile/{id}` - Update user profile
   - `GET /users/preferences/{id}` - Get user preferences
   - `PUT /users/preferences/{id}` - Update user preferences
   - `GET /users/activity/{id}` - Get user activity
   - `POST /users/relationships/follow` - Follow a user
   - `DELETE /users/relationships/unfollow` - Unfollow a user
   - `GET /users/analytics/{id}` - Get user analytics

6. **[Payment API Reference](./reference/payment-api.md)** - 10 endpoints
   - `POST /payments/invoices` - Create invoice
   - `GET /payments/invoices/{id}` - Get invoice details
   - `POST /payments/invoices/{id}/pay` - Pay invoice
   - `GET /payments/currency/convert` - Convert currency
   - `POST /payments/subscriptions` - Create subscription
   - `PUT /payments/subscriptions/{id}` - Update subscription
   - `DELETE /payments/subscriptions/{id}` - Cancel subscription
   - `POST /payments/refunds` - Create refund
   - `GET /payments/analytics` - Get payment analytics
   - `POST /payments/webhooks` - Register webhook

### Examples & Guides

7. **[Request/Response Examples](./examples/)** - Complete examples for all endpoints
   - [Content Examples](./examples/content-examples.md)
   - [User Examples](./examples/user-examples.md)
   - [Payment Examples](./examples/payment-examples.md)

8. **[Error Code Reference](./errors.md)** - Complete error catalog
   - HTTP status codes
   - Error code ranges (E001-E999)
   - Error handling strategies
   - Client-side error handling examples

9. **[Rate Limiting](./rate-limiting.md)** - Rate limit guidelines
   - Rate limits by endpoint category
   - Rate limit headers
   - Handling rate limits
   - Best practices

10. **[Webhooks](./webhooks.md)** - Real-time event notifications
    - Webhook event types
    - Payload structure
    - HMAC signature verification
    - Retry logic and dead letter queue
    - Testing webhooks

### Tools & Resources

11. **[Postman Collection](./postman/sovren-api.postman_collection.json)** - Ready-to-use API client
    - All 25 endpoints pre-configured
    - Environment variables
    - Auto-refresh authentication
    - Request examples

## API Endpoints Summary

### Content API (7 endpoints)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/content/publish` | Publish new content to platform and NOSTR | Required |
| POST | `/content/moderate` | Perform moderation actions on content | Required |
| GET | `/content/search` | Full-text search with filters and sorting | Optional |
| GET | `/content/recommendations` | AI-powered personalized recommendations | Optional |
| GET | `/content/analytics/{id}` | Get comprehensive content analytics | Required |
| GET | `/content/versions/{id}` | Get complete version history | Required |
| POST | `/content/versions/{id}/revert` | Revert to previous version | Required |

### User API (8 endpoints)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/profile/{id}` | Retrieve public user profile | Optional |
| PUT | `/users/profile/{id}` | Update user profile | Required |
| GET | `/users/preferences/{id}` | Get user preferences and settings | Required |
| PUT | `/users/preferences/{id}` | Update user preferences | Required |
| GET | `/users/activity/{id}` | Get recent user activity feed | Required |
| POST | `/users/relationships/follow` | Follow a user | Required |
| DELETE | `/users/relationships/unfollow` | Unfollow a user | Required |
| GET | `/users/analytics/{id}` | Get user analytics and metrics | Required |

### Payment API (10 endpoints)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/invoices` | Create Lightning Network BOLT11 invoice | Required |
| GET | `/payments/invoices/{id}` | Get invoice details and status | Required |
| POST | `/payments/invoices/{id}/pay` | Process Lightning payment | Required |
| GET | `/payments/currency/convert` | Convert between currencies (SAT/BTC/USD/EUR/GBP) | Required |
| POST | `/payments/subscriptions` | Create recurring subscription | Required |
| PUT | `/payments/subscriptions/{id}` | Update existing subscription | Required |
| DELETE | `/payments/subscriptions/{id}` | Cancel subscription | Required |
| POST | `/payments/refunds` | Initiate payment refund | Required |
| GET | `/payments/analytics` | Get comprehensive payment analytics | Required |
| POST | `/payments/webhooks` | Register webhook endpoint | Required |

## Response Format

All API responses follow a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": {
    // Endpoint-specific response data
  },
  "metadata": {
    "requestId": "req-unique-id",
    "timestamp": "2025-10-27T10:30:00Z",
    "processingTime": 12.5
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "E001",
    "message": "Human-readable error message",
    "details": {},
    "validationErrors": []
  },
  "metadata": {
    "requestId": "req-unique-id",
    "timestamp": "2025-10-27T10:30:00Z"
  }
}
```

## Authentication

All authenticated endpoints require a JWT bearer token:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get your token through authentication:

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

See [Authentication Guide](./authentication.md) for complete details.

## Rate Limiting

API requests are rate-limited by endpoint category:

- **Content operations**: 100 requests/hour
- **User operations**: 200 requests/hour
- **Payment operations**: 50 requests/hour

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1698415200
```

See [Rate Limiting Guide](./rate-limiting.md) for handling strategies.

## Pagination

List endpoints support pagination:

```bash
GET /api/v1/content/search?query=bitcoin&page=2&limit=20
```

**Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response includes:**
```json
{
  "results": [...],
  "totalResults": 142,
  "currentPage": 2,
  "totalPages": 8
}
```

## NOSTR Integration

Sovren is built on the NOSTR protocol for decentralized identity and content distribution:

- **Content Publishing**: Automatically published to NOSTR relays
- **Identity**: NOSTR public keys (npub1...) for user identification
- **NIP-05 Verification**: Username@domain.com verification
- **Lightning Addresses**: NOSTR-native payment addresses
- **Encrypted DMs**: NOSTR protocol for private messaging

Content published via API is automatically formatted as NOSTR events and distributed to configured relays.

## Lightning Network

All payments are processed via Bitcoin Lightning Network:

- **BOLT11 Invoices**: Standard Lightning invoice format
- **Instant Settlement**: Near-instant payment confirmation
- **Low Fees**: Minimal network fees (typically <1 sat)
- **WebLN Support**: Browser extension integration
- **Multi-Currency**: Automatic conversion from USD/EUR to SAT

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Resource deleted |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Auth required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

See [Error Code Reference](./errors.md) for complete catalog.

## SDK & Libraries

### Official SDKs (Coming Soon)

- **JavaScript/TypeScript**: `@sovren/sdk-js`
- **Python**: `sovren-sdk`
- **Go**: `github.com/sovren/sdk-go`

### Community Libraries

- Use the [OpenAPI Specification](./openapi.yaml) to generate client libraries in any language
- Compatible with OpenAPI Generator, Swagger Codegen

## Interactive API Explorer

Explore the API interactively using Swagger UI:

1. Navigate to: `https://api.sovren.app/docs`
2. Or use local OpenAPI spec with Swagger UI:
   ```bash
   npx serve docs/api
   # Open http://localhost:3000/openapi.yaml in Swagger UI
   ```

## Changelog

API changes are documented in:
- **[Project CHANGELOG](/CHANGELOG.md)**: All changes
- **[API-specific changes](/docs/api/changelog.md)**: API updates only

## Versioning

Current version: **v1.0.0**

Version is included in URL path:
```
https://api.sovren.app/v1/...
```

Breaking changes will result in new major version (v2, v3, etc.). Non-breaking changes are added to current version.

## Support

### Documentation
- **Quick Start**: Get started in 5 minutes
- **API Reference**: Complete endpoint documentation
- **Examples**: Copy-paste code examples
- **Error Reference**: Troubleshoot errors

### Contact
- **Email**: api@sovren.app
- **Support Portal**: support.sovren.app
- **Status Page**: status.sovren.app
- **GitHub Issues**: github.com/sovren/api/issues

### Response Times
- **Critical Issues**: <1 hour (security, payments, data loss)
- **High Priority**: <4 hours (API downtime, major bugs)
- **Normal**: <24 hours (questions, minor bugs)

## Contribution

Found an error in the documentation?

1. Open issue: [github.com/sovren/api/issues](https://github.com/sovren/api/issues)
2. Submit PR with fixes
3. Email: docs@sovren.app

## License

API documentation is licensed under MIT License.

---

**Ready to build?** Start with the [Quick Start Guide](./quick-start.md) or dive into the [API Reference](./reference/).

**Last Updated**: 2025-10-27
**Documentation Version**: 1.0.0
**API Version**: v1.0.0
