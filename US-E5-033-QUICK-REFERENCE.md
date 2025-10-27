# US-E5-033: API Routes - Quick Reference Guide

**Status**: COMPLETE ✅
**Date**: 2025-10-27

## Quick Stats

- **25 API Endpoints** (7 Content + 8 User + 10 Payment)
- **3 Controllers** (DI-integrated)
- **54 DTOs** (TypeScript interfaces)
- **34 Validation Schemas** (Zod)
- **4 Mermaid Diagrams** (Architecture documentation)

## API Endpoints at a Glance

### Content API (`/api/v1/content`)
```
POST   /publish                    - Publish content (10/min, auth required)
POST   /moderate                   - Moderate content (50/min, auth required)
GET    /search?query=...           - Search content (20/min, optional auth)
GET    /recommendations?userId=... - Get recommendations (20/min, optional auth)
GET    /analytics/:id              - Content analytics (20/min, auth required)
GET    /versions/:id               - Version history (100/min, auth required)
POST   /versions/:id/revert        - Revert version (10/min, auth required)
```

### User API (`/api/v1/users`)
```
GET    /profile/:id                - Get profile (100/min, optional auth)
PUT    /profile/:id                - Update profile (5/min, auth required)
GET    /preferences/:id            - Get preferences (100/min, auth required)
PUT    /preferences/:id            - Update preferences (10/min, auth required)
GET    /activity/:id               - User activity (100/min, auth required)
POST   /relationships/follow       - Follow user (30/min, auth required)
DELETE /relationships/unfollow     - Unfollow user (30/min, auth required)
GET    /analytics/:id              - User analytics (20/min, auth required)
```

### Payment API (`/api/v1/payments`)
```
POST   /invoices                   - Create invoice (20/min, auth required)
GET    /invoices/:id               - Get invoice (100/min, auth required)
POST   /invoices/:id/pay           - Pay invoice (20/min, auth required)
GET    /currency/convert?...       - Convert currency (100/min, auth required)
POST   /subscriptions              - Create subscription (5/min, auth required)
PUT    /subscriptions/:id          - Update subscription (100/min, auth required)
DELETE /subscriptions/:id          - Cancel subscription (100/min, auth required)
POST   /refunds                    - Create refund (10/min, auth required)
GET    /analytics                  - Payment analytics (20/min, auth required)
POST   /webhooks                   - Register webhook (5/15min, auth required)
```

## Testing with cURL

### Publish Content
```bash
curl -X POST http://localhost:3001/api/v1/content/publish \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Article",
    "content": "This is the content body...",
    "contentType": "article",
    "tags": ["tech", "nostr"],
    "monetization": {
      "priceInSats": 1000,
      "allowTipping": true
    }
  }'
```

### Search Content
```bash
curl -X GET "http://localhost:3001/api/v1/content/search?query=bitcoin&limit=10&page=1"
```

### Get User Profile
```bash
curl -X GET http://localhost:3001/api/v1/users/profile/USER_UUID_HERE
```

### Create Invoice
```bash
curl -X POST http://localhost:3001/api/v1/payments/invoices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "SAT",
    "description": "Payment for article access"
  }'
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "metadata": {
    "requestId": "req_1234567890_abc123",
    "timestamp": "2025-10-27T12:00:00.000Z",
    "processingTime": 45
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "body.title",
      "message": "String must contain at least 1 character(s)",
      "code": "too_small"
    }
  ],
  "metadata": {
    "requestId": "req_1234567890_abc123",
    "timestamp": "2025-10-27T12:00:00.000Z"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `AUTHENTICATION_ERROR` | 401 | Missing or invalid token |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVICE_ERROR` | 500 | Service error |
| `EXTERNAL_SERVICE_ERROR` | 503 | External service unavailable |

## Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10 | 15 minutes |
| Content Creation | 10 | 1 minute |
| Content Moderation | 50 | 1 minute |
| Search/Recommendations | 20 | 1 minute |
| Read Operations | 100 | 1 minute |
| Profile Updates | 5 | 1 minute |
| Follow/Unfollow | 30 | 1 minute |
| Payment Operations | 20 | 1 minute |
| Subscription Creation | 5 | 1 minute |
| Webhook Registration | 5 | 15 minutes |

## Authentication

### JWT Token Format
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Contents
```json
{
  "nostr_pubkey": "64_char_hex_string",
  "role": "creator",
  "signature_verified": true,
  "iat": 1698765432,
  "exp": 1698851832
}
```

### Roles
- `supporter`: Basic user (read access)
- `creator`: Content creator (publish access)
- `admin`: Administrator (full access)

## File Locations

```
packages/backend/src/
├── controllers/
│   ├── content/ContentController.ts
│   ├── user/UserController.ts
│   └── payment/PaymentController.ts
├── routes/
│   └── v1/
│       ├── content.routes.ts
│       ├── user.routes.ts
│       ├── payment.routes.ts
│       └── index.ts
├── dtos/
│   ├── content/index.ts
│   ├── user/index.ts
│   └── payment/index.ts
├── validators/
│   ├── content/index.ts
│   ├── user/index.ts
│   └── payment/index.ts
└── middleware/
    ├── auth.ts
    ├── validation-middleware.ts
    ├── error-handler-middleware.ts
    └── rate-limit-middleware.ts
```

## Documentation Links

- **OpenAPI Spec**: `/docs/api/openapi.yaml`
- **Mermaid Diagrams**: `/docs/architecture/diagrams/us-e5-033-*.mmd`
- **Implementation Summary**: `/US-E5-033-IMPLEMENTATION-COMPLETE.md`
- **CHANGELOG**: `/CHANGELOG.md`

## Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

## Next Steps

1. **US-E5-034**: Integration & Unit Testing (95%+ coverage)
2. **Phase 7**: Deployment & Production Configuration
3. **Enhancement**: GraphQL layer (future)
4. **Enhancement**: WebSocket support (future)

## Support

- **Issues**: Create GitHub issue with `us-e5-033` tag
- **Questions**: Contact backend team
- **Documentation**: See implementation summary for detailed architecture

---

**Last Updated**: 2025-10-27
**Maintainer**: Backend Engineering Team
