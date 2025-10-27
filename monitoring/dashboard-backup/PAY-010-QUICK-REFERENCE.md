# PAY-010: Idempotency System - Quick Reference

**Status**: ✅ COMPLETE | **Date**: 2025-10-25 | **Epic**: 002

---

## Quick Start

### 1. Run Migration
```bash
psql $DATABASE_URL -f backend/migrations/001_create_idempotency_cache.sql
```

### 2. Apply Middleware
```typescript
import { createIdempotencyMiddleware } from './middleware/idempotency';
import { IdempotencyRepository } from './repositories/IdempotencyRepository';

const repo = new IdempotencyRepository(dbClient);
const middleware = createIdempotencyMiddleware(repo);

app.post('/api/lightning/invoice', middleware, handler);
```

### 3. Client Request
```bash
curl -X POST https://api.sovren.app/api/lightning/invoice \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"amount_sats": 10000}'
```

---

## How It Works

1. **Client generates UUID v4** → `550e8400-e29b-41d4-a716-446655440000`
2. **Middleware validates key** → UUID format check
3. **Compute request hash** → SHA-256 of body
4. **Check cache** → PostgreSQL lookup
   - **Not found**: Process request, cache response
   - **Found + hash match**: Return cached response
   - **Found + hash mismatch**: Error (body changed)
   - **Found + expired**: Delete, reprocess

---

## API Endpoints

### Protected Endpoints
- `POST /api/lightning/invoice` - Create invoice
- `POST /api/payments/process` - Process payment

### Monitoring Endpoints
- `GET /api/idempotency/stats` - System statistics
- `POST /api/idempotency/cleanup` - Manual cleanup trigger

---

## Response Headers

### Cached Response
```
X-Idempotency-Cached: true
X-Cache-Expires: 2025-10-26T12:00:00Z
```

### Fresh Response
(No special headers)

---

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `INVALID_IDEMPOTENCY_KEY` | 400 | Invalid UUID format |
| `IDEMPOTENCY_ERROR` | 500 | Cache check failed or body changed |

---

## Configuration

```typescript
{
  ttl_ms: 24 * 60 * 60 * 1000,      // 24 hours
  header_name: 'Idempotency-Key',    // Header name
  required: true,                     // Enforce header
  endpoints: ['/api/lightning'],      // Filter paths
  enable_cleanup: true,               // Auto cleanup
  cleanup_interval_ms: 3600000        // 1 hour
}
```

---

## Tests

```bash
# Run all idempotency tests
npm test -- __tests__/idempotency

# Result: 42/42 passing ✅
```

---

## Files

**Core**: middleware, repository, service, types, routes
**Tests**: middleware, repository, cleanup service
**Docs**: 4 Mermaid diagrams, integration guide, completion summary

---

## Monitoring

### Statistics
```bash
curl https://api.sovren.app/api/idempotency/stats
```

### Manual Cleanup
```bash
curl -X POST https://api.sovren.app/api/idempotency/cleanup
```

---

## Troubleshooting

### Issue: "Invalid idempotency key format"
→ Ensure key is valid UUID v4

### Issue: "Request body has changed"
→ Don't reuse same key with different body

### Issue: Cache not working
→ Check database connection and table exists

---

**Full Documentation**: `PAY-010-IMPLEMENTATION-COMPLETE.md`
