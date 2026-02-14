---
status: pending
priority: p2
issue_id: '096'
tags: [code-review, security, webhook, timing-attack]
dependencies: []
---

# Webhook HMAC Verification Vulnerable to Timing Attacks

## Problem Statement

Webhook HMAC verification in 5 files uses `===` strict equality for string comparison instead of `crypto.timingSafeEqual()`. Strict equality comparison is vulnerable to timing side-channel attacks that allow attackers to leak HMAC values byte-by-byte by measuring response times. This affects webhook handlers in `lightning-payment-service.ts`, `lightning-service.ts`, and other webhook processing files.

## Findings

- 5+ files verify webhook HMACs using `===` string comparison
- String equality comparison short-circuits on first non-matching byte
- Timing difference reveals position of first incorrect byte
- Attacker can brute-force HMAC byte-by-byte (256 attempts per byte vs 2^256 for full key)
- Practical attack: 256 \* 32 = 8,192 requests to leak 32-byte HMAC
- Affected files include:
  - `src/services/lightning-payment-service.ts`
  - `src/services/lightning-service.ts`
  - Webhook handler routes (to be identified during implementation)

**Vulnerable Pattern:**

```typescript
const receivedHmac = req.headers['x-webhook-signature'];
const computedHmac = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (receivedHmac === computedHmac) {
  // ← VULNERABLE
  // Process webhook
}
```

## Proposed Solutions

### Option 1: Use crypto.timingSafeEqual() for All HMAC Comparisons

**Pros:**

- Constant-time comparison eliminates timing side-channel
- Node.js built-in, no dependencies
- Industry standard for cryptographic comparisons
- Simple find-replace across affected files

**Cons:**

- Requires Buffer conversion (timingSafeEqual operates on Buffers, not strings)
- Need to ensure both sides have same length (function throws if lengths differ)

**Effort:** Low (2 hours)
**Risk:** Low

### Option 2: Centralized HMAC Verification Utility

**Pros:**

- Single source of truth for HMAC verification
- Encapsulates timing-safe comparison logic
- Easier to audit and test
- Can add logging, rate limiting, replay protection

**Cons:**

- Requires creating utility function
- Need to update all callsites to use utility
- Slightly more invasive change

**Effort:** Medium (3 hours)
**Risk:** Low

### Option 3: Use Existing Security Library (e.g., `scmp`)

**Pros:**

- Battle-tested implementation
- Handles edge cases (length mismatches, etc.)
- Clear security semantics

**Cons:**

- Adds external dependency
- Node.js crypto.timingSafeEqual is sufficient
- Overkill for simple comparison

**Effort:** Low (1 hour)
**Risk:** Low

## Recommended Action

**Option 2: Centralized HMAC Verification Utility**

This provides both security (timing-safe comparison) and maintainability (single source of truth). A utility function also allows adding future enhancements like replay protection and rate limiting.

Implementation:

1. Create `src/lib/webhook-security.ts` with `verifyWebhookHmac()` function
2. Use `crypto.timingSafeEqual()` for constant-time comparison
3. Handle length mismatches gracefully (return false instead of throwing)
4. Update all webhook handlers to use the utility
5. Add unit tests with timing analysis to verify constant-time behavior
6. Document security rationale in code comments

## Technical Details

**Affected Files (minimum):**

- `src/services/lightning-payment-service.ts`
- `src/services/lightning-service.ts`
- Additional webhook handlers (identify via grep for HMAC verification patterns)

**Timing Attack Explanation:**

String comparison short-circuits:

```typescript
'abc' === 'xyz'; // Fails at first byte (fast)
'abc' === 'ayz'; // Fails at second byte (slower)
'abc' === 'abz'; // Fails at third byte (even slower)
```

Attacker measures response time to determine first incorrect byte position, then brute-forces that byte until timing increases (correct byte found), repeat for all 32 bytes.

**Proposed Utility Function:**

```typescript
// src/lib/webhook-security.ts
import crypto from 'crypto';

export function verifyWebhookHmac(
  payload: string | Buffer,
  receivedHmac: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean {
  try {
    // Compute expected HMAC
    const computedHmac = crypto.createHmac(algorithm, secret).update(payload).digest('hex');

    // Convert to Buffers for timingSafeEqual
    const receivedBuffer = Buffer.from(receivedHmac, 'hex');
    const computedBuffer = Buffer.from(computedHmac, 'hex');

    // Length mismatch: return false instead of throwing
    if (receivedBuffer.length !== computedBuffer.length) {
      return false;
    }

    // Constant-time comparison
    return crypto.timingSafeEqual(receivedBuffer, computedBuffer);
  } catch (err) {
    // Invalid hex string or other error
    return false;
  }
}
```

**Usage in Webhook Handlers:**

```typescript
// Before (VULNERABLE)
const receivedHmac = req.headers['x-webhook-signature'] as string;
const computedHmac = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (receivedHmac === computedHmac) {
  // Process webhook
}

// After (SECURE)
import { verifyWebhookHmac } from '@/lib/webhook-security';

const receivedHmac = req.headers['x-webhook-signature'] as string;
const payload = JSON.stringify(req.body);
if (verifyWebhookHmac(payload, receivedHmac, WEBHOOK_SECRET)) {
  // Process webhook
}
```

**Finding All Affected Files:**

```bash
# Search for HMAC verification patterns
grep -r "createHmac" src/ --include="*.ts" -A 5 | grep -E "===|=="
grep -r "x-webhook-signature" src/ --include="*.ts"
grep -r "webhook.*hmac" src/ --include="*.ts" -i
```

## Acceptance Criteria

- [ ] `src/lib/webhook-security.ts` created with `verifyWebhookHmac()` function
- [ ] Function uses `crypto.timingSafeEqual()` for constant-time comparison
- [ ] All webhook handlers updated to use centralized verification utility
- [ ] Length mismatch handled gracefully (no exceptions thrown)
- [ ] Unit tests verify correct HMAC acceptance
- [ ] Unit tests verify incorrect HMAC rejection
- [ ] Timing analysis test confirms constant-time behavior
- [ ] Security audit confirms no remaining `===` comparisons for HMAC verification
- [ ] Documentation updated in `docs/security/webhook-verification.md`
- [ ] Code comments explain timing attack risk and mitigation

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Found vulnerable pattern in multiple webhook handlers
- Researched timing attack feasibility (8,192 requests for 32-byte HMAC)
- Confirmed crypto.timingSafeEqual() is appropriate mitigation

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Node.js crypto.timingSafeEqual(): https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b
- Timing attack explanation: https://en.wikipedia.org/wiki/Timing_attack
- OWASP timing attack guide: https://owasp.org/www-community/attacks/Timing_attack
- GitHub webhook security: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
