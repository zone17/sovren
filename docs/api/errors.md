# Error Code Reference

## Overview

The Sovren API uses a consistent error response format across all endpoints. All error responses include:
- HTTP status code
- Error code (E001-E999)
- Human-readable message
- Additional context in `details` object
- Request metadata for debugging

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "E001",
    "message": "Human-readable error message",
    "details": {
      "field": "fieldName",
      "reason": "Specific reason for failure"
    },
    "validationErrors": [
      {
        "field": "title",
        "message": "Title is required",
        "value": null
      }
    ]
  },
  "metadata": {
    "requestId": "req-abc123",
    "timestamp": "2025-10-27T10:30:00Z"
  }
}
```

## HTTP Status Codes

| Status | Description | When Used |
|--------|-------------|-----------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Resource deleted successfully |
| 400 | Bad Request | Validation error or invalid parameters |
| 401 | Unauthorized | Authentication required or token invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or state conflict |
| 422 | Unprocessable Entity | Semantic errors in request |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Temporary outage or maintenance |

## Error Code Categories

### Authentication Errors (E401-E420)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E401 | 401 | Authentication required | No bearer token provided | Include `Authorization: Bearer <token>` header |
| E402 | 401 | Invalid or expired token | Token is invalid or expired | Re-authenticate to get new token |
| E403 | 403 | Insufficient permissions | User role lacks required permissions | Check permission matrix, upgrade role if needed |
| E404 | 401 | Invalid credentials | Email/password incorrect | Verify credentials, reset password if forgotten |
| E405 | 401 | NOSTR signature verification failed | NOSTR signature invalid | Re-sign challenge with correct private key |
| E406 | 401 | Email not verified | User email not verified | Check email for verification link |
| E407 | 403 | Account suspended | User account suspended | Contact support@sovren.app |
| E408 | 403 | Account deleted | User account was deleted | Create new account if needed |
| E409 | 429 | Too many login attempts | Rate limit on login attempts | Wait 15 minutes before retrying |
| E410 | 401 | Refresh token expired | Refresh token no longer valid | Re-authenticate with credentials |
| E411 | 401 | NOSTR pubkey not linked | NOSTR public key not linked to account | Link NOSTR identity in settings |
| E412 | 401 | Invalid NOSTR pubkey format | Public key format incorrect | Use npub1... format |

### Validation Errors (E001-E100)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E001 | 400 | Validation failed | Request contains invalid data | Check `validationErrors` array in response |
| E002 | 400 | Required field missing | Required field not provided | Include all required fields |
| E003 | 400 | Invalid field type | Field has wrong data type | Verify data types match API spec |
| E004 | 400 | Invalid field format | Field format invalid (email, UUID, etc.) | Use correct format for field |
| E005 | 400 | Field value too short | String/array below minimum length | Increase field value length |
| E006 | 400 | Field value too long | String/array exceeds maximum length | Reduce field value length |
| E007 | 400 | Invalid enum value | Value not in allowed enum values | Use one of the allowed values |
| E008 | 400 | Invalid number range | Number outside min/max range | Use value within specified range |
| E009 | 400 | Invalid date format | Date not in ISO 8601 format | Use ISO 8601: YYYY-MM-DDTHH:mm:ssZ |
| E010 | 400 | Invalid URL format | URL format incorrect | Use valid URL format with protocol |
| E011 | 400 | Invalid UUID format | UUID format incorrect | Use valid UUID v4 format |
| E012 | 400 | Invalid email format | Email address format invalid | Use valid email format |
| E013 | 400 | Array too large | Array exceeds maximum items | Reduce number of array items |
| E014 | 400 | Object too large | Object exceeds size limit | Reduce object size |
| E015 | 400 | Invalid content type | Content-Type header invalid | Use application/json |

### Resource Errors (E101-E200)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E101 | 404 | Resource not found | Requested resource doesn't exist | Verify resource ID is correct |
| E102 | 404 | User not found | User ID doesn't exist | Check user ID spelling |
| E103 | 404 | Content not found | Content ID doesn't exist | Verify content was published |
| E104 | 404 | Payment not found | Invoice/payment ID doesn't exist | Check payment ID |
| E105 | 404 | Subscription not found | Subscription ID doesn't exist | Verify subscription is active |
| E106 | 409 | Resource already exists | Resource with identifier exists | Use different identifier |
| E107 | 409 | Email already registered | Email in use by another account | Use different email or login |
| E108 | 409 | Username taken | Display name/username in use | Choose different username |
| E109 | 410 | Resource deleted | Resource was permanently deleted | Cannot recover, create new |
| E110 | 422 | Resource state conflict | Resource in wrong state for action | Check resource status field |
| E111 | 403 | Resource access denied | User doesn't own resource | Only owner can perform action |
| E112 | 403 | Content is private | Content not publicly accessible | Subscribe or purchase access |

### Content Errors (E201-E250)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E201 | 400 | Invalid content type | Content type not supported | Use: article, video, audio, image, nostr-event |
| E202 | 413 | Content too large | Content exceeds size limit | Reduce content size (max 1MB) |
| E203 | 400 | Too many tags | Tag count exceeds maximum | Use max 20 tags |
| E204 | 400 | Invalid tag format | Tag contains invalid characters | Use alphanumeric tags |
| E205 | 422 | Content failed moderation | AI moderation flagged content | Review content against guidelines |
| E206 | 422 | NOSTR publish failed | Failed to publish to NOSTR relays | Check relay connectivity |
| E207 | 404 | Version not found | Content version doesn't exist | Check version ID |
| E208 | 422 | Cannot revert to version | Version revert not allowed | Use more recent version |
| E209 | 403 | Content is monetized | Payment required to access | Purchase or subscribe |
| E210 | 422 | Invalid price | Price format or value invalid | Use positive integer in sats |

### Payment Errors (E251-E350)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E251 | 400 | Invalid currency code | Currency not supported | Use: SAT, BTC, USD, EUR, GBP |
| E252 | 400 | Amount too small | Amount below minimum | Increase amount (min 1 sat) |
| E253 | 400 | Amount too large | Amount exceeds maximum | Reduce amount or split payment |
| E254 | 422 | Invoice expired | Invoice past expiration time | Create new invoice |
| E255 | 422 | Invoice already paid | Invoice already settled | Check payment status |
| E256 | 422 | Invoice cancelled | Invoice was cancelled | Create new invoice |
| E257 | 422 | Payment failed | Lightning payment failed | Retry or use different method |
| E258 | 422 | Insufficient balance | Wallet balance too low | Add funds to wallet |
| E259 | 422 | Invalid payment method | Payment method not accepted | Use supported method |
| E260 | 422 | Currency conversion failed | Exchange rate unavailable | Retry in a few moments |
| E261 | 422 | Subscription inactive | Subscription not active | Reactivate or create new |
| E262 | 422 | Subscription cancelled | Subscription was cancelled | Cannot reactivate cancelled subscription |
| E263 | 422 | Refund not allowed | Payment cannot be refunded | Check refund eligibility period |
| E264 | 422 | Refund amount invalid | Refund exceeds original payment | Use amount ≤ original payment |
| E265 | 422 | Refund already processed | Payment already refunded | Cannot refund twice |
| E266 | 422 | Lightning node unavailable | Lightning service temporarily down | Retry in a few minutes |

### Rate Limit Errors (E351-E370)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E351 | 429 | Rate limit exceeded | Too many requests | Wait for rate limit reset |
| E352 | 429 | Content rate limit exceeded | Too many content operations | Reduce publishing frequency |
| E353 | 429 | Payment rate limit exceeded | Too many payment operations | Space out payment requests |
| E354 | 429 | Search rate limit exceeded | Too many search requests | Reduce search frequency |
| E355 | 429 | Login rate limit exceeded | Too many login attempts | Wait 15 minutes |

### Integration Errors (E401-E450)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E401 | 400 | Invalid webhook URL | Webhook URL format invalid | Use valid HTTPS URL |
| E402 | 422 | Webhook delivery failed | Could not deliver to endpoint | Check endpoint availability |
| E403 | 400 | Invalid webhook signature | HMAC signature verification failed | Verify secret and signature algorithm |
| E404 | 400 | Invalid webhook event type | Event type not supported | Use supported event types |
| E405 | 422 | NOSTR relay unreachable | Cannot connect to relay | Check relay URL |
| E406 | 422 | NOSTR event invalid | NOSTR event format incorrect | Verify event structure |

### Server Errors (E500-E599)

| Code | HTTP | Message | Description | Resolution |
|------|------|---------|-------------|------------|
| E500 | 500 | Internal server error | Unexpected server error | Retry, contact support if persists |
| E501 | 500 | Database error | Database operation failed | Retry, may be temporary issue |
| E502 | 503 | Service unavailable | Service temporarily down | Check status.sovren.app |
| E503 | 503 | Maintenance mode | System under maintenance | Wait for maintenance window to complete |
| E504 | 504 | Gateway timeout | Upstream service timeout | Retry with backoff |
| E505 | 500 | External service error | Third-party service failed | Retry, may be external issue |

## Handling Errors

### Client-Side Error Handling

```javascript
async function makeApiRequest(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!data.success) {
      // Handle API error
      throw new ApiError(
        data.error.code,
        data.error.message,
        data.error.details,
        data.metadata.requestId
      );
    }

    return data.data;
  } catch (error) {
    if (error instanceof ApiError) {
      // Handle specific error codes
      switch (error.code) {
        case 'E402':
          // Token expired, refresh and retry
          await refreshToken();
          return makeApiRequest(endpoint, options);

        case 'E351':
          // Rate limited, retry with backoff
          await exponentialBackoff(error);
          return makeApiRequest(endpoint, options);

        case 'E001':
          // Validation error, show to user
          showValidationErrors(error.details.validationErrors);
          break;

        default:
          // Generic error handling
          showError(error.message);
      }
    } else {
      // Network error or other issue
      console.error('Request failed:', error);
      showError('Network error. Please try again.');
    }

    throw error;
  }
}

class ApiError extends Error {
  constructor(code, message, details, requestId) {
    super(message);
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}
```

### Retry Logic with Exponential Backoff

```javascript
async function exponentialBackoff(error, attempt = 0) {
  const maxAttempts = 5;
  const baseDelay = 1000; // 1 second

  if (attempt >= maxAttempts) {
    throw new Error('Max retry attempts reached');
  }

  // Extract retry-after header if available
  const retryAfter = error.response?.headers?.get('Retry-After');
  const delay = retryAfter
    ? parseInt(retryAfter) * 1000
    : baseDelay * Math.pow(2, attempt);

  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### Validation Error Display

```javascript
function showValidationErrors(validationErrors) {
  const errorMap = new Map();

  validationErrors.forEach(error => {
    errorMap.set(error.field, error.message);
  });

  // Display errors next to form fields
  errorMap.forEach((message, field) => {
    const fieldElement = document.getElementById(field);
    if (fieldElement) {
      fieldElement.classList.add('error');
      fieldElement.setAttribute('aria-invalid', 'true');

      const errorElement = document.createElement('span');
      errorElement.className = 'error-message';
      errorElement.textContent = message;
      fieldElement.parentNode.appendChild(errorElement);
    }
  });
}
```

## Error Prevention

### Pre-Request Validation

```javascript
// Validate before sending request
function validatePublishRequest(data) {
  const errors = [];

  if (!data.title || data.title.length < 1) {
    errors.push({ field: 'title', message: 'Title is required' });
  }

  if (data.title && data.title.length > 500) {
    errors.push({ field: 'title', message: 'Title must be ≤ 500 characters' });
  }

  if (!data.content || data.content.length < 1) {
    errors.push({ field: 'content', message: 'Content is required' });
  }

  if (data.tags && data.tags.length > 20) {
    errors.push({ field: 'tags', message: 'Maximum 20 tags allowed' });
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}
```

### Rate Limit Tracking

```javascript
class RateLimitTracker {
  constructor() {
    this.limits = new Map();
  }

  updateFromHeaders(headers) {
    const limit = parseInt(headers.get('X-RateLimit-Limit'));
    const remaining = parseInt(headers.get('X-RateLimit-Remaining'));
    const reset = parseInt(headers.get('X-RateLimit-Reset'));

    this.limits.set('current', {
      limit,
      remaining,
      reset: new Date(reset * 1000)
    });
  }

  canMakeRequest() {
    const current = this.limits.get('current');
    if (!current) return true;

    if (current.remaining <= 0) {
      const now = new Date();
      if (now < current.reset) {
        return false; // Still rate limited
      }
    }

    return true;
  }

  getTimeUntilReset() {
    const current = this.limits.get('current');
    if (!current) return 0;

    const now = new Date();
    return Math.max(0, current.reset - now);
  }
}
```

## Error Monitoring

### Logging Errors for Support

When reporting errors to support, include:

```javascript
function reportError(error, context) {
  const errorReport = {
    // From API response
    code: error.code,
    message: error.message,
    requestId: error.requestId,
    timestamp: new Date().toISOString(),

    // Context
    endpoint: context.endpoint,
    method: context.method,
    userId: context.userId,

    // Client info
    userAgent: navigator.userAgent,
    url: window.location.href,

    // Additional details
    details: error.details
  };

  // Send to error tracking service
  console.error('API Error:', errorReport);

  // Optionally send to backend logging
  fetch('/api/v1/errors/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorReport)
  });
}
```

## Support

For persistent errors:

1. **Check Documentation**: Review endpoint documentation and requirements
2. **Search Error Code**: Use this reference to understand the error
3. **Check Status**: Visit [status.sovren.app](https://status.sovren.app) for service status
4. **Contact Support**:
   - Email: api@sovren.app
   - Include `requestId` from error response
   - Describe steps to reproduce

---

**Related Documentation:**
- [Quick Start Guide](/docs/api/quick-start.md)
- [Authentication Guide](/docs/api/authentication.md)
- [Rate Limiting](/docs/api/rate-limiting.md)
- [API Reference](/docs/api/reference/)
