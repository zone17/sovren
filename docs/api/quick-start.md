# Sovren API Quick Start Guide

Welcome to the Sovren API! This guide will help you make your first API call in minutes.

## Overview

The Sovren API is a RESTful API that enables decentralized creator monetization through NOSTR protocol and Bitcoin Lightning Network. All responses are JSON-formatted with consistent structure across all endpoints.

## Base URLs

- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://api.sovren.app/v1`

## Prerequisites

Before you begin, you'll need:

1. A Sovren account (creator or supporter)
2. API authentication credentials
3. A tool for making HTTP requests (curl, Postman, or code)

## Step 1: Authentication

All authenticated endpoints require a JWT bearer token. Obtain your token through the authentication flow:

### Request

```bash
curl -X POST https://api.sovren.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "your_password"
  }'
```

### Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "your@email.com",
      "nostrPubkey": "npub1...",
      "role": "creator"
    }
  }
}
```

Save the `token` value - you'll need it for all authenticated requests.

## Step 2: Make Your First API Call

Let's retrieve your user profile:

### Request

```bash
curl -X GET https://api.sovren.app/v1/users/profile/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Response

```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "nostrPubkey": "npub1...",
    "profile": {
      "displayName": "Alice Creator",
      "bio": "Bitcoin educator and content creator",
      "avatarUrl": "https://cdn.sovren.app/avatars/alice.jpg"
    },
    "stats": {
      "followersCount": 1523,
      "contentCount": 87,
      "totalEarnings": 250000
    }
  },
  "metadata": {
    "requestId": "req-abc123",
    "timestamp": "2025-10-27T10:30:00Z",
    "processingTime": 12.5
  }
}
```

## Step 3: Publish Content

Create and publish your first piece of content:

### Request

```bash
curl -X POST https://api.sovren.app/v1/content/publish \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Getting Started with Bitcoin Lightning",
    "content": "In this comprehensive guide...",
    "contentType": "article",
    "tags": ["bitcoin", "lightning", "tutorial"],
    "publishToNostr": true,
    "monetization": {
      "priceInSats": 1000,
      "allowTipping": true
    }
  }'
```

### Response

```json
{
  "success": true,
  "data": {
    "contentId": "content-abc123",
    "status": "published",
    "nostrEventId": "7f9e8d7c6b...",
    "publishedAt": "2025-10-27T10:35:00Z",
    "url": "https://sovren.app/content/content-abc123",
    "relayPublishResults": [
      {
        "relayUrl": "wss://relay.damus.io",
        "success": true
      },
      {
        "relayUrl": "wss://relay.nostr.band",
        "success": true
      }
    ]
  }
}
```

## Step 4: Create a Lightning Invoice

Generate a Lightning Network invoice to receive payments:

### Request

```bash
curl -X POST https://api.sovren.app/v1/payments/invoices \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "currency": "SAT",
    "description": "Payment for premium content access",
    "expiresIn": 3600
  }'
```

### Response

```json
{
  "success": true,
  "data": {
    "invoiceId": "inv-xyz789",
    "paymentRequest": "lnbc100n1...",
    "amount": {
      "requested": 10000,
      "currency": "SAT",
      "sats": 10000
    },
    "status": "pending",
    "description": "Payment for premium content access",
    "createdAt": "2025-10-27T10:40:00Z",
    "expiresAt": "2025-10-27T11:40:00Z",
    "paymentHash": "7c9e8d..."
  }
}
```

## Common Use Cases

### Search for Content

```bash
curl -X GET "https://api.sovren.app/v1/content/search?query=bitcoin&contentType=article&sort=relevance&limit=10"
```

### Follow a User

```bash
curl -X POST https://api.sovren.app/v1/users/relationships/follow \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "followerId": "your-user-id",
    "followingId": "creator-user-id",
    "notifyFollowing": true
  }'
```

### Get Content Analytics

```bash
curl -X GET https://api.sovren.app/v1/content/analytics/content-abc123 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Convert Currency

```bash
curl -X GET "https://api.sovren.app/v1/payments/currency/convert?amount=5&fromCurrency=USD&toCurrency=SAT" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Response Structure

All Sovren API responses follow a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  },
  "metadata": {
    "requestId": "unique-request-id",
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
    "details": {
      // Additional error context
    }
  },
  "metadata": {
    "requestId": "unique-request-id",
    "timestamp": "2025-10-27T10:30:00Z"
  }
}
```

## HTTP Status Codes

The API uses standard HTTP status codes:

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

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

When rate limited, you'll receive a 429 response with `Retry-After` header indicating when you can retry.

## Pagination

List endpoints support pagination with query parameters:

```bash
curl -X GET "https://api.sovren.app/v1/content/search?query=bitcoin&page=2&limit=20"
```

Pagination metadata is included in responses:

```json
{
  "results": [...],
  "totalResults": 142,
  "currentPage": 2,
  "totalPages": 8
}
```

## Code Examples

### JavaScript/Node.js

```javascript
const API_BASE_URL = 'https://api.sovren.app/v1';
const AUTH_TOKEN = 'your-jwt-token';

async function publishContent(title, content) {
  const response = await fetch(`${API_BASE_URL}/content/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      content,
      contentType: 'article',
      publishToNostr: true
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return data.data;
}

// Usage
publishContent('My Article', 'Article content...')
  .then(result => console.log('Published:', result.contentId))
  .catch(error => console.error('Error:', error));
```

### Python

```python
import requests

API_BASE_URL = 'https://api.sovren.app/v1'
AUTH_TOKEN = 'your-jwt-token'

def publish_content(title, content):
    response = requests.post(
        f'{API_BASE_URL}/content/publish',
        headers={
            'Authorization': f'Bearer {AUTH_TOKEN}',
            'Content-Type': 'application/json'
        },
        json={
            'title': title,
            'content': content,
            'contentType': 'article',
            'publishToNostr': True
        }
    )

    data = response.json()

    if not data['success']:
        raise Exception(data['error']['message'])

    return data['data']

# Usage
try:
    result = publish_content('My Article', 'Article content...')
    print(f'Published: {result["contentId"]}')
except Exception as error:
    print(f'Error: {error}')
```

### cURL

```bash
# Set your token as environment variable
export SOVREN_TOKEN="your-jwt-token"

# Publish content
curl -X POST https://api.sovren.app/v1/content/publish \
  -H "Authorization: Bearer $SOVREN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Article",
    "content": "Article content...",
    "contentType": "article",
    "publishToNostr": true
  }'
```

## Testing with Postman

Import the Sovren API Postman collection:

1. Download: `/docs/api/postman/sovren-api.postman_collection.json`
2. Import into Postman (File > Import)
3. Set up environment variables:
   - `base_url`: API base URL
   - `auth_token`: Your JWT token
4. Explore all 25 endpoints with pre-filled examples

## Next Steps

Now that you've made your first API calls, explore:

- **[API Reference](/docs/api/reference/)**: Detailed documentation for all endpoints
- **[Authentication Guide](/docs/api/authentication.md)**: Deep dive into auth & security
- **[Error Codes](/docs/api/errors.md)**: Complete error code reference
- **[Rate Limiting](/docs/api/rate-limiting.md)**: Rate limit best practices
- **[Webhooks](/docs/api/webhooks.md)**: Set up real-time event notifications
- **[OpenAPI Spec](/docs/api/openapi.yaml)**: Machine-readable API specification

## Getting Help

- **Documentation**: [https://docs.sovren.app](https://docs.sovren.app)
- **Support Email**: api@sovren.app
- **GitHub Issues**: [https://github.com/sovren/api/issues](https://github.com/sovren/api/issues)

## API Versioning

The current API version is v1. The version is included in the URL path:

```
https://api.sovren.app/v1/...
```

Breaking changes will result in a new API version (v2, v3, etc.). Non-breaking changes (new fields, new endpoints) are added to the current version.

## Best Practices

1. **Store tokens securely**: Never commit tokens to version control
2. **Handle rate limits**: Implement exponential backoff for retries
3. **Check response status**: Always verify `success` field in responses
4. **Use HTTPS**: Never use HTTP for production requests
5. **Validate webhooks**: Verify HMAC signatures on webhook payloads
6. **Cache exchange rates**: Currency conversion rates are cached for 5 minutes
7. **Set timeouts**: Configure appropriate request timeouts (10-30s recommended)
8. **Log request IDs**: Include `requestId` from metadata when reporting issues

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check that your token is valid and not expired
- Ensure the `Authorization` header is correctly formatted
- Re-authenticate if token has expired

**429 Rate Limit Exceeded**
- Check `X-RateLimit-Reset` header for reset time
- Implement exponential backoff
- Consider upgrading your API plan for higher limits

**400 Validation Error**
- Review the `validationErrors` array in error response
- Check that all required fields are provided
- Verify data types match API specification

**500 Internal Server Error**
- Retry the request after a brief delay
- If error persists, contact support with `requestId`
- Check [status page](https://status.sovren.app) for incidents

## Changelog

API changes are documented in:
- **[CHANGELOG.md](/CHANGELOG.md)**: All project changes
- **[API Changelog](/docs/api/changelog.md)**: API-specific changes

---

**Ready to build?** Head to the [API Reference](/docs/api/reference/) for complete endpoint documentation.
