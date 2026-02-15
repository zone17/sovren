---
title: 'R7 Round 7 Remediation: Prevention Strategies for 15 Security & Reliability Findings'
date: 2026-02-15
category: prevention
tags:
  - security
  - reliability
  - payment-systems
  - authentication
  - code-quality
  - review-methodology
---

# R7 Prevention Strategies: Why 7 Review Rounds Found New Issues Each Time

## Executive Summary

Round 7 code review on PR #73 identified **15 findings** (3 P1, 7 P2, 5 P3) across auth, payments, persistence, caching, and middleware. This was the **7th sequential review round** — previous rounds caught different issues, but these persisted.

**Critical insight**: Multiple review rounds discovering new issues indicates structural problems with the review methodology itself, not just individual bugs.

**Key learnings**:

1. **Diff-focused reviews miss pre-existing issues** — Reviewers only analyzed PR changes, not pre-existing patterns
2. **Domain knowledge silos** — Auth reviews didn't check payment code, persistence reviews didn't check caching
3. **No systematic pattern detection** — Similar anti-patterns (missing auth, missing idempotency, missing replay protection) replicated across routes
4. **Insufficient automation** — Manual review cannot catch all instances of a pattern at scale
5. **Review fatigue convergence** — By round 7, review teams were finding different issues because previous rounds had exhausted obvious problems

---

## The R7 Findings (15 Items)

### P1 Security (CRITICAL — 3 findings)

| Todo    | Title                             | Root Cause                                           | Impact                               |
| ------- | --------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| **135** | Auth Bypass on Creator Payout     | Routes have `authenticate` but no role authorization | Any user can drain creator funds     |
| **136** | Duplicate Payout (No Idempotency) | Payment requests lack idempotency keys               | Double-spend / double-charge         |
| **137** | Role Escalation via JWT Refresh   | Token refresh copies stale role from old token       | Demoted users retain high privileges |

### P2 Reliability (SHOULD FIX — 7 findings)

| Todo    | Title                                 | Root Cause                                          | Impact                                    |
| ------- | ------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| **138** | No fsync in Atomic Writes             | File writes lack durability guarantee               | Data loss on power failure                |
| **139** | Cache Stampede                        | Concurrent cache misses overwhelm persistence layer | Unavailability during cache eviction      |
| **140** | Blocking Sync I/O in Async Services   | Sync file operations block event loop               | Performance degradation, timeouts         |
| **141** | Oversized Body Limits                 | 10MB JSON body before rate limiting                 | DoS via memory exhaustion                 |
| **142** | Memory Leaks from Untracked Intervals | setInterval without cleanup handles                 | Unbounded memory growth on restart cycles |
| **143** | Signature Replay Attacks              | Same NOSTR signature accepted multiple times        | Signature reuse in 5-minute window        |
| **144** | Rollback Without Retry                | Compensating transactions fail silently             | Orphaned records in subscription failures |

### P3 Quality (ATTEMPT OR DEFER — 5 findings)

| Todo    | Title                            | Recommendation                                 |
| ------- | -------------------------------- | ---------------------------------------------- |
| **145** | God Class Decomposition          | DEFER — large refactor, not remediation-scoped |
| **146** | v1 API Route Fragmentation       | DEFER — 24 endpoints, 2-3 weeks, multi-epic    |
| **147** | Circular Dependency Chains       | ATTEMPT — scoped to verified-unsafe cycles     |
| **148** | Dead Code Removal (~1,900 lines) | ATTEMPT — incremental cleanup                  |
| **149** | z.any() in Content Validators    | ATTEMPT — high-impact validation fix           |

---

## Meta-Learning: Why Did 7 Review Rounds Still Find New Issues?

### Problem 1: Diff-Focused Reviews Miss Pre-Existing Patterns

**What happened**: Reviewers analyzed PR #73 changes but didn't scan the entire codebase for similar patterns.

**Example**:

- Round 4 found auth bypass on one route (POST `/creator/payout`)
- Round 5 found auth bypass on another route (GET `/creator/payouts`)
- Round 6 found auth bypass on a third route (GET `/creator/subscribers`)
- All three should have been caught in round 4 by scanning `routes/lightning.ts` fully

**Why this matters**: A single missing `requireCreator` middleware on one route signals that the pattern is likely broken elsewhere. The fix should include:

1. Fix the identified route
2. Grep the entire route file for similar patterns
3. Scan all other route files for the same pattern

**Prevention**: Full-file security audits for auth-sensitive files, not just diff review.

### Problem 2: Domain Silos in Review Teams

**What happened**: Auth issues, payment issues, and persistence issues were reviewed by different agents, each focusing on their domain.

**Example**:

- Auth reviewer checked role validation (found 135)
- Payment reviewer checked idempotency (found 136)
- Persistence reviewer checked fsync (found 138)
- But no one cross-domain checked: "Payment routes need BOTH auth AND idempotency"

**Why this matters**: Security is a composition of controls. A payment operation needs:

1. Authentication ✓ (auth reviewer: found 135)
2. Authorization ✓ (auth reviewer: found 135)
3. Idempotency ✓ (payment reviewer: found 136)
4. Rate limiting ✓
5. Durability ✓ (persistence reviewer: found 138)

If one domain misses their part, the entire chain breaks.

**Prevention**: Cross-domain checklists (authentication + payment + persistence + caching) that must ALL pass for a feature to be considered done.

### Problem 3: No Systematic Pattern Detection

**What happened**: Similar anti-patterns were scattered across codebase and not detected as instances of the same problem.

**Examples**:

- **Missing auth**: 3 separate routes (135)
- **Missing idempotency**: Payment operations (136)
- **Missing replay protection**: NOSTR auth (143)
- **Missing retry logic**: Subscription rollback (144)
- **Missing cleanup**: EventEmitter listeners (142)

All of these follow the pattern: **"Safety feature is missing from operation X"**

**Prevention**: Pattern templates for critical operations:

```typescript
// SECURITY_PATTERN: All payment operations MUST have:
// 1. authenticate middleware
// 2. requireCreator middleware
// 3. Idempotency-Key header validation
// 4. Service-level role check (defense in depth)
// 5. Mutation to immutable ledger
// 6. Confirmation back to client
```

Document these patterns and enforce via lint rules or CI/CD checks.

### Problem 4: Insufficient Automation in Review

**What happened**: Manual code review cannot scale to catch all instances of a pattern.

**Why**:

- Reviewer fatigue: After 5-6 rounds, reviewers start missing obvious issues
- Human bandwidth: One reviewer cannot scan 15k+ lines of code in one pass
- Context loss: Reviewing 100 files makes it hard to remember patterns from file 1 when reviewing file 50

**Prevention**: Automate pattern detection:

```bash
# Detect routes with authentication but missing authorization
grep -r "authenticate" packages/backend/src/routes/ | \
  while read file; do
    if ! grep -q "require(Creator|Admin|User)" "$file"; then
      echo "WARN: $file has authenticate but no role check"
    fi
  done
```

### Problem 5: Review Fatigue Convergence

**What happened**: By round 7, review teams were finding completely different issues than rounds 1-3.

**Hypothesis**:

- Rounds 1-3: Obvious/high-severity issues caught (security, performance)
- Rounds 4-5: Medium-severity issues found (edge cases, error handling)
- Rounds 6-7: Low-severity issues found (code quality, type safety, cleanup)

By round 7, the "easy wins" were exhausted, and reviewers were finding obscure issues rather than catching systemic problems.

**Why this indicates a process problem**: After 7 rounds, PRs should be essentially "clean" (maybe 1-2 edge cases per round). Instead, each round found 15+ issues. This suggests:

1. Initial PR quality was too low
2. Review process wasn't comprehensive
3. Code standards weren't enforced upfront

**Prevention**:

- Require `/workflows:plan` BEFORE implementing, with security checklist
- Require unit tests to reach 95% coverage on critical paths
- Run automatic pattern detectors before code review (lint, static analysis, etc.)
- Use `/workflows:review` with 13+ agents to parallelize detection
- Set PR acceptance criteria: "Zero new P1s found in review" (P2/P3 deferred is OK)

---

## Prevention Strategies by Finding

### P1-135: Auth Bypass on Creator Payout

**Root Cause**: Routes had `authenticate` middleware but no role-level authorization (`requireCreator`).

**Why it persisted**:

- Middleware chain appears to protect the route
- Actual role check is missing but code compiles (no type enforcement)
- 3 routes with the same issue weren't caught as a pattern

**Detection Method**:

1. **Manual code review** (this is what failed)
   - Action: When reviewing auth changes, grep entire file for routes and verify EVERY route with money/sensitive data has role middleware
2. **Pattern lint rule**:
   ```javascript
   // .eslintrc.cjs
   rules: {
     'no-auth-without-role-check': {
       create(context) {
         return {
           CallExpression(node) {
             if (node.callee.property?.name === 'post' ||
                 node.callee.property?.name === 'put' ||
                 node.callee.property?.name === 'delete') {
               // Check if authenticate is present but requireCreator/requireAdmin is missing
               const args = node.arguments.map(arg => arg.toString());
               if (args.some(a => a.includes('authenticate')) &&
                   !args.some(a => a.includes('require(Creator|Admin|User)'))) {
                 context.report({
                   node,
                   message: 'Mutation routes with authenticate must also have role middleware',
                 });
               }
             }
           }
         };
       }
     }
   }
   ```
3. **CI/CD grep check**:
   ```bash
   # Find routes with authenticate but no role check
   npx tsc --noEmit && \
   grep -n "authenticate" packages/backend/src/routes/*.ts | \
   while read line; do
     file=$(echo $line | cut -d: -f1)
     if ! grep -q "require(Creator|Admin|User)" "$file"; then
       echo "ERROR: $file line $linenum has authenticate without role check"
       exit 1
     fi
   done
   ```

**Best Practice Pattern**:

```typescript
// ✅ CORRECT: ALL mutation routes have role checks
router.post(
  '/creator/payout',
  authenticate, // ✅ Step 1: Is user logged in?
  requireCreator, // ✅ Step 2: Does user have creator role?
  async (req, res) => {
    // ✅ Step 3: Service layer defense-in-depth check
    await payoutService.requestPayout(req.user, req.body);
  }
);

// ✅ CORRECT: Service layer validates role independently
class PayoutManagementService {
  async requestPayout(user: AuthenticatedUser, params: PayoutParams) {
    if (!user.role || !['creator', 'admin'].includes(user.role)) {
      throw new UnauthorizedError('Only creators can request payouts');
    }
    // ... proceed with payout
  }
}
```

---

### P1-136: Duplicate Payout (No Idempotency)

**Root Cause**: Payment requests had no idempotency key, allowing duplicate processing.

**Why it persisted**:

- Industry standard pattern (Stripe, PayPal all use `Idempotency-Key` header) but not documented in this codebase
- No pre-implementation checklist for payment operations
- Prior remediation sprints focused on other concerns

**Detection Method**:

1. **Code review checklist** for payment operations:
   - [ ] Route requires `Idempotency-Key` header
   - [ ] Header validated and returned 400 if missing
   - [ ] Service deduplicates via key-result mapping
   - [ ] Keys expire after TTL (24 hours typical)
   - [ ] Test: same key returns same result without re-processing
2. **Payment operation template lint rule**:
   ```javascript
   // Detect payment routes that lack idempotency validation
   rules: {
     'payment-routes-must-validate-idempotency': {
       create(context) {
         return {
           CallExpression(node) {
             if (/(payout|payment|transfer|charge)/.test(node.callee.name)) {
               // Check for idempotency validation
               const routeHandler = node.parent.parent.init;
               if (!routeHandler.body.body.some(stmt =>
                   stmt.toString().includes('getHeader') &&
                   stmt.toString().includes('Idempotency-Key'))) {
                 context.report({
                   node,
                   message: 'Payment operations MUST validate Idempotency-Key header',
                 });
               }
             }
           }
         };
       }
     }
   }
   ```
3. **Integration test for idempotency**:

   ```typescript
   describe('Payment Idempotency', () => {
     it('should return same result for duplicate idempotency key', async () => {
       const key = 'idempotency-key-1';
       const payment1 = await client.post(
         '/payout',
         { amount: 100 },
         { headers: { 'Idempotency-Key': key } }
       );
       const payment2 = await client.post(
         '/payout',
         { amount: 100 },
         { headers: { 'Idempotency-Key': key } }
       );

       expect(payment1.id).toBe(payment2.id);
       expect(payment1.status).toBe(payment2.status);
     });
   });
   ```

**Best Practice Pattern**:

```typescript
// ✅ CORRECT: Payment operation with idempotency
import { TTLCache } from './cache';

class PayoutManagementService {
  private idempotencyCache = new TTLCache<string, Payout>({
    maxSize: 10_000,
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  });

  async requestPayout(
    user: AuthenticatedUser,
    params: PayoutParams,
    idempotencyKey: string
  ): Promise<Payout> {
    // ✅ Check for cached result
    const existing = this.idempotencyCache.get(idempotencyKey);
    if (existing) {
      return existing; // Return cached, not re-processed
    }

    // ✅ Process payout
    const payout = await this.createPayout(user, params);

    // ✅ Cache result for future requests
    this.idempotencyCache.set(idempotencyKey, payout);

    return payout;
  }
}

// ✅ CORRECT: Route validates and extracts idempotency key
router.post(
  '/creator/payout',
  authenticate,
  requireCreator,
  (req, res, next) => {
    // Validate idempotency key header
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(400).json({
        error: 'Idempotency-Key header required',
      });
    }
    req.idempotencyKey = idempotencyKey;
    next();
  },
  async (req, res) => {
    const payout = await payoutService.requestPayout(req.user, req.body, req.idempotencyKey);
    res.status(201).json(payout);
  }
);
```

---

### P1-137: Role Escalation via JWT Refresh

**Root Cause**: Token refresh copied the `role` claim from the old token without querying current database state.

**Why it persisted**:

- Optimization premature: Developer assumed token claims are authoritative
- No test for "demote then refresh" scenario
- Single test might verify "refresh works" but not "refresh reflects demotions"

**Detection Method**:

1. **Test-driven detection** — write test FIRST:

   ```typescript
   describe('JWT Refresh Security', () => {
     it('should reflect role changes when token refreshed', async () => {
       // User starts as creator
       let token = await authService.createJWT(user); // role: creator
       expect(parseJWT(token).role).toBe('creator');

       // Admin demotes user to regular user
       await db.users.update(user.id, { role: 'user' });

       // Refresh token
       const refreshedToken = await authService.refreshJWT(token);

       // ✅ MUST reflect new role
       expect(parseJWT(refreshedToken).role).toBe('user');
     });

     it('should reject refresh for deleted user', async () => {
       let token = await authService.createJWT(user);

       // Delete user
       await db.users.delete(user.id);

       // Refresh should fail
       const result = await authService.refreshJWT(token);
       expect(result.success).toBe(false);
       expect(result.error).toContain('user not found');
     });
   });
   ```

2. **Code review checklist** for token operations:
   - [ ] Token creation queries current role from DB
   - [ ] Token refresh queries current role from DB
   - [ ] Test: demote user, refresh token, verify new role
   - [ ] Test: delete user, refresh token, verify rejection
3. **Pattern rule for stale data**:
   ```javascript
   // Detect: token.role = verification.payload.role (copying from token)
   // Should be: token.role = db.users.role (querying DB)
   rules: {
     'no-stale-token-claims': {
       create(context) {
         return {
           AssignmentExpression(node) {
             if (node.left.property?.name === 'role' &&
                 node.right.property?.object?.name === 'payload') {
               context.report({
                 node,
                 message: 'JWT claims (role) must be queried from DB, not copied from stale token',
               });
             }
           }
         };
       }
     }
   }
   ```

**Best Practice Pattern**:

```typescript
// ✅ CORRECT: Refresh queries current role from database
async refreshJWT(oldToken: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const verification = await this.verifyJWT(oldToken);
  if (!verification.valid) {
    return { success: false, error: 'Invalid token' };
  }

  // ✅ CRITICAL: Query current role from database, not from old token
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('nostr_pubkey', verification.payload.nostr_pubkey)
    .single();

  if (!userData) {
    return { success: false, error: 'User not found' };
  }

  const currentRole = userData.role || 'supporter';

  // ✅ Create new token with fresh claims
  const newPayload: JWTPayload = {
    nostr_pubkey: verification.payload.nostr_pubkey,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + this.expirationSeconds,
    signature_verified: true,
    role: currentRole, // ✅ FROM DB, NOT FROM OLD TOKEN
  };

  const newToken = jwt.sign(newPayload, this.jwtSecret);
  return { success: true, token: newToken };
}
```

---

### P2-138: No fsync in Atomic Writes

**Root Cause**: File writes used `writeFileSync` + `renameSync` but no `fsyncSync` to ensure durability.

**Why it persisted**:

- Works fine on single tests (data actually durabile by chance)
- Failure only manifests under power loss / system crash
- Hard to test (requires simulating power failure)
- Not standard in express.js tutorials

**Detection Method**:

1. **Code review checklist** for atomic writes:
   - [ ] File writes use `open` + `write` + `fsync` + `close` + `rename` sequence
   - [ ] Test: mock fsync, verify it's called before rename
   - [ ] Document: explain durability guarantee
2. **Pattern rule for unsafe persistence**:

   ```javascript
   rules: {
     'atomic-writes-require-fsync': {
       create(context) {
         return {
           CallExpression(node) {
             if (node.callee.property?.name === 'renameSync' ||
                 node.callee.property?.name === 'rename') {
               // Check if fsyncSync was called before this
               const parentBlock = node.parent.parent.body;
               const renameIndex = parentBlock.indexOf(node.parent);
               const hasFsyncBefore = parentBlock.slice(0, renameIndex)
                 .some(stmt => stmt.toString().includes('fsyncSync'));

               if (!hasFsyncBefore) {
                 context.report({
                   node,
                   message: 'fsyncSync() must be called before renameSync() for durability',
                 });
               }
             }
           }
         };
       }
     }
   }
   ```

3. **Mock-based unit test**:

   ```typescript
   describe('Atomic Writes with fsync', () => {
     it('should call fsyncSync before renameSync', async () => {
       const mockFsync = jest.fn();
       const mockRename = jest.fn();

       jest.doMock('fs', () => ({
         openSync: jest.fn(() => 3),
         writeSync: jest.fn(),
         fsyncSync: mockFsync,
         closeSync: jest.fn(),
         renameSync: mockRename,
       }));

       await persistence.doWrite('invoices');

       // Verify fsyncSync was called
       expect(mockFsync).toHaveBeenCalled();

       // Verify fsyncSync was called BEFORE renameSync
       expect(mockFsync.mock.invocationCallOrder[0]).toBeLessThan(
         mockRename.mock.invocationCallOrder[0]
       );
     });
   });
   ```

**Best Practice Pattern**:

```typescript
import { openSync, writeSync, fsyncSync, closeSync, renameSync } from 'fs';

class PaymentPersistence {
  private async doWrite(type: 'invoices' | 'payments'): Promise<void> {
    const filePath = path.join(this.dataDir, `${type}.json`);
    const tmpPath = `${filePath}.tmp`;

    const data =
      type === 'invoices' ? Array.from(this.invoices.values()) : Array.from(this.payments.values());

    try {
      // ✅ Step 1: Open file for writing
      const fd = openSync(tmpPath, 'w');

      try {
        // ✅ Step 2: Write data
        writeSync(fd, JSON.stringify(data, null, 2));

        // ✅ CRITICAL Step 3: fsync to ensure durability
        fsyncSync(fd);
      } finally {
        // ✅ Step 4: Close file descriptor
        closeSync(fd);
      }

      // ✅ Step 5: Atomically rename (now guaranteed to be on disk)
      renameSync(tmpPath, filePath);
    } catch (err) {
      // Clean up temp file on error
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }
}
```

---

### P2-139: Cache Stampede

**Root Cause**: Concurrent cache misses for the same key all triggered persistence lookups, overwhelming the system.

**Why it persisted**:

- Works fine with single requests
- Only appears under load (concurrent requests)
- Hard to reproduce in unit tests
- Not obvious without understanding thundering herd problem

**Detection Method**:

1. **Load test detection**:

   ```bash
   # Simulate 100 concurrent cache misses for same key
   ab -n 100 -c 100 http://localhost:3000/api/invoice/xyz

   # Monitor: should see ~1 persistence read, not 100
   grep "persistence.read" logs.txt | wc -l
   ```

2. **Code review checklist** for cache operations:
   - [ ] Cache misses are coalesced (concurrent requests share result)
   - [ ] Pending lookups tracked in map
   - [ ] Test: 10 concurrent misses = 1 persistence read
3. **Pattern rule for uncoalesced caches**:
   ```javascript
   rules: {
     'cache-must-coalesce-concurrent-misses': {
       create(context) {
         return {
           CallExpression(node) {
             if (node.callee.property?.name === 'get' &&
                 node.parent.parent.init?.callee?.property?.name === 'then') {
               // Check if there's a pending lookup deduplication
               if (!node.parent.parent.parent?.body?.toString()
                   .includes('pendingLookups')) {
                 context.report({
                   node,
                   message: 'Cache misses should coalesce concurrent requests via pendingLookups map',
                 });
               }
             }
           }
         };
       }
     }
   }
   ```

**Best Practice Pattern**:

```typescript
class LightningService {
  private invoiceCache = new TTLCache<string, LightningInvoice>();

  // ✅ CRITICAL: Track pending lookups to coalesce concurrent misses
  private pendingLookups = new Map<string, Promise<LightningInvoice | null>>();

  private async getInvoiceWithFallback(id: string): Promise<LightningInvoice | null> {
    // ✅ Step 1: Check cache
    let invoice = this.invoiceCache.get(id);
    if (invoice) return invoice;

    // ✅ Step 2: Check if lookup is pending (coalescing)
    const pending = this.pendingLookups.get(id);
    if (pending) {
      return pending; // ✅ Return shared promise, not new lookup
    }

    // ✅ Step 3: Start new lookup, track it
    const lookup = this.persistence
      .getInvoiceById(id)
      .then((result) => {
        // ✅ Clean up pending map
        this.pendingLookups.delete(id);

        // ✅ Cache result for next time
        if (result) {
          this.invoiceCache.set(result.id, result);
        }
        return result;
      })
      .catch((err) => {
        // ✅ Clean up pending map even on error
        this.pendingLookups.delete(id);
        throw err;
      });

    // ✅ Track this lookup
    this.pendingLookups.set(id, lookup);
    return lookup;
  }
}
```

---

### P2-140: Blocking Sync I/O

**Root Cause**: File operations used sync APIs (`writeFileSync`, `readFileSync`) blocking the event loop.

**Why it persisted**:

- Startup code often uses sync I/O (common pattern)
- Single-threaded Node.js doesn't prevent sync I/O, just slows down
- Performance impact only obvious under load
- Difficult to detect without profiling

**Detection Method**:

1. **Static analysis rule**:
   ```javascript
   rules: {
     'no-sync-io-except-startup': {
       create(context) {
         return {
           CallExpression(node) {
             if (/Sync$/.test(node.callee.property?.name) &&
                 !['readFileSync'].includes(node.callee.property?.name)) {
               // Allow only readFileSync (startup-only), block writeSync in async context
               context.report({
                 node,
                 message: 'Use async fs/promises API instead of sync operations in async handlers',
               });
             }
           }
         };
       }
     }
   }
   ```
2. **Code review checklist** for I/O:
   - [ ] Startup code: sync I/O OK (runs once)
   - [ ] Request handlers: async I/O required
   - [ ] Service methods: async I/O required
   - [ ] Test: measure no blocking on event loop
3. **Performance test**:

   ```typescript
   describe('I/O Performance', () => {
     it('should not block event loop during writes', async () => {
       const startTime = Date.now();

       // Schedule a microtask
       let microtaskCompleted = false;
       queueMicrotask(() => {
         microtaskCompleted = true;
       });

       // Trigger async write
       await persistence.doWrite('invoices');

       // Microtask should complete while write in progress
       expect(microtaskCompleted).toBe(true);
     });
   });
   ```

**Best Practice Pattern**:

```typescript
import { open } from 'fs/promises';
import { renameSync } from 'fs'; // Only rename stays sync (atomic guarantee)

class PaymentPersistence {
  // ✅ Async version for runtime I/O
  private async doWrite(type: 'invoices' | 'payments'): Promise<void> {
    const filePath = path.join(this.dataDir, `${type}.json`);
    const tmpPath = `${filePath}.tmp`;

    const data =
      type === 'invoices' ? Array.from(this.invoices.values()) : Array.from(this.payments.values());

    // ✅ Use async fs/promises API
    const handle = await open(tmpPath, 'w');
    try {
      await handle.writeFile(JSON.stringify(data, null, 2), 'utf-8');
      // ✅ Use datasync (async fsync equivalent)
      await handle.datasync();
    } finally {
      await handle.close();
    }

    // ✅ Only rename stays sync (atomic operation, fast)
    renameSync(tmpPath, filePath);
  }

  // ✅ Sync version ONLY for startup (loadFromDisk)
  private loadFromDisk(): void {
    try {
      const invoiceData = readFileSync(path.join(this.dataDir, 'invoices.json'), 'utf-8');
      this.invoices = new Map(JSON.parse(invoiceData));
    } catch {
      this.invoices = new Map();
    }
  }
}
```

---

### P2-141: Oversized Body Limits

**Root Cause**: 10MB JSON body limit before rate limiting, allowing memory DoS.

**Why it persisted**:

- Body parser middleware appears before rate limiter in code
- Actually: rate limiter IS before body parser (correct order, but limit is too high)
- No explicit size limit set, relying on defaults
- Not tested in security review

**Detection Method**:

1. **Code review checklist** for middleware:
   - [ ] Rate limiter runs before body parser
   - [ ] Body parser has explicit size limit (100kb default, 1mb max for content)
   - [ ] Verify no routes depend on >1mb JSON payloads
   - [ ] Test: >1mb request gets 413 Payload Too Large
2. **Integration test**:
   ```typescript
   describe('Body Size Limits', () => {
     it('should reject body larger than limit', async () => {
       const largeBody = 'x'.repeat(2 * 1024 * 1024); // 2MB
       const response = await client.post('/api/content', {
         body: largeBody,
       });
       expect(response.status).toBe(413);
     });
   });
   ```
3. **Middleware order audit**:
   ```bash
   # Verify middleware order in app.ts
   grep -n "app.use" packages/backend/src/app.ts | grep -E "(rateLimit|express.json|express.urlencoded)"
   # Should show: rateLimit BEFORE express.json
   ```

**Best Practice Pattern**:

```typescript
import express from 'express';
import { createRateLimiter } from './middleware/rate-limit-middleware';

const app = express();

// ✅ CRITICAL: Rate limiter before body parser
app.use(
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
  })
);

// ✅ Body parser WITH explicit size limit
app.use(
  express.json({
    limit: '1mb', // ✅ Reasonable limit, prevents memory DoS
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '100kb', // ✅ Form data has tighter limit
  })
);

// ✅ Route-specific overrides for special cases (if any)
app.post('/api/upload', (req, res, next) => {
  // For media uploads, handle separately with multer
  // Don't raise global body parser limit
  next();
});
```

---

### P2-142: Memory Leaks from Untracked Intervals

**Root Cause**: Services registered setInterval callbacks without storing timers for cleanup.

**Why it persisted**:

- Works fine initially (timers run, perform their job)
- Memory leak only appears after restart cycles
- Tests don't restart services 100+ times
- No automated memory monitoring in CI

**Detection Method**:

1. **Code review checklist** for setInterval usage:
   - [ ] Every setInterval has a variable assignment
   - [ ] Variable stored as service field
   - [ ] shutdown/dispose method calls clearInterval on all timers
   - [ ] Test: verify listener count bounded after init + shutdown
2. **Lint rule**:
   ```javascript
   rules: {
     'setinterval-must-be-tracked': {
       create(context) {
         return {
           CallExpression(node) {
             if (node.callee.name === 'setInterval') {
               // Check if result is assigned to a field
               if (!node.parent.init ||
                   !node.parent.init.object?.name?.endsWith('Service')) {
                 context.report({
                   node,
                   message: 'setInterval result must be assigned to service field for cleanup',
                 });
               }
             }
           }
         };
       }
     }
   }
   ```
3. **Memory test**:

   ```typescript
   describe('EventEmitter Cleanup', () => {
     it('should not leak listeners after shutdown', async () => {
       const initialListeners = process.listenerCount('uncaughtException');

       // Init and shutdown 10 times
       for (let i = 0; i < 10; i++) {
         const service = new SubscriptionManagementService();
         await service.initialize();
         await service.shutdown();
       }

       const finalListeners = process.listenerCount('uncaughtException');
       // Should not grow unbounded
       expect(finalListeners - initialListeners).toBeLessThan(5);
     });
   });
   ```

**Best Practice Pattern**:

```typescript
class SubscriptionManagementService extends EventEmitter {
  // ✅ Track all intervals as service fields
  private recurringPaymentInterval?: NodeJS.Timeout;
  private subscriptionMonitorInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    await this.setupRecurringPaymentScheduler();
    await this.setupSubscriptionMonitoring();
  }

  private async setupRecurringPaymentScheduler(): Promise<void> {
    // ✅ Store the timeout ID
    this.recurringPaymentInterval = setInterval(async () => {
      await this.processRecurringPayments();
    }, 3600000); // 1 hour

    await this.processRecurringPayments(); // Run once immediately
  }

  private async setupSubscriptionMonitoring(): Promise<void> {
    // ✅ Store the timeout ID
    this.subscriptionMonitorInterval = setInterval(async () => {
      await this.monitorSubscriptionHealth();
    }, 300000); // 5 minutes
  }

  async shutdown(): Promise<void> {
    // ✅ Clear all intervals
    if (this.recurringPaymentInterval) {
      clearInterval(this.recurringPaymentInterval);
    }
    if (this.subscriptionMonitorInterval) {
      clearInterval(this.subscriptionMonitorInterval);
    }

    // ✅ Remove all event listeners
    this.removeAllListeners();
  }
}
```

---

### P2-143: Signature Replay Attacks

**Root Cause**: NOSTR signatures without TTL-based tracking allowed replay within 5-minute window.

**Why it persisted**:

- Challenge-based auth appears to protect against replay (one-time use)
- But the 5-minute timestamp validation is independent
- Defense in depth needed: challenge + signature tracking
- Not obvious without understanding NOSTR protocol details

**Detection Method**:

1. **Code review checklist** for signature operations:
   - [ ] Challenges are one-time-use
   - [ ] Used signatures tracked in TTL cache
   - [ ] Test: same signature within 5 min returns error
   - [ ] TTL matches timestamp window
2. **Integration test**:

   ```typescript
   describe('NOSTR Signature Replay Protection', () => {
     it('should reject replayed signature within 5 minutes', async () => {
       const challenge = await service.createChallenge(pubkey);
       const signature = await client.sign(challenge, privkey);

       // First use: succeeds
       const auth1 = await service.verifySignature({
         challenge,
         signature,
         created_at: Math.floor(Date.now() / 1000),
       });
       expect(auth1.valid).toBe(true);

       // Replay within 5 min: should fail
       const auth2 = await service.verifySignature({
         challenge: challenge, // Same challenge (deleted after use)
         signature, // Same signature
         created_at: Math.floor(Date.now() / 1000),
       });
       expect(auth2.valid).toBe(false);
       expect(auth2.error).toContain('replay');
     });
   });
   ```

**Best Practice Pattern**:

```typescript
class NostrAuthService {
  // ✅ Track used signatures to prevent replay
  private usedSignatures = new TTLCache<string, true>({
    maxSize: 50_000,
    ttlMs: 5 * 60 * 1000, // Match timestamp window
  });

  async verifySignature(verification: NostrVerification): Promise<VerificationResult> {
    const { signature, challenge, created_at } = verification;

    // ✅ Step 1: Verify timestamp is within window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - created_at) > 300) {
      // 5 minutes
      return { valid: false, error: 'Timestamp outside 5-minute window' };
    }

    // ✅ Step 2: Check if signature already used (replay protection)
    const sigHash = createHash('sha256').update(signature).digest('hex');
    if (this.usedSignatures.has(sigHash)) {
      return { valid: false, error: 'Signature already used (replay attack)' };
    }

    // ✅ Step 3: Verify challenge exists and is one-time-use
    const storedChallenge = this.challenges.get(challenge);
    if (!storedChallenge) {
      return { valid: false, error: 'Challenge not found or already used' };
    }

    // ✅ Step 4: Verify signature is valid
    const isValid = await this.isValidSignature(signature, storedChallenge);
    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // ✅ Step 5: Mark signature as used and delete challenge
    this.usedSignatures.set(sigHash, true);
    this.challenges.delete(challenge);

    return { valid: true, pubkey: extractPubkey(signature) };
  }
}
```

---

### P2-144: Compensating Transaction Rollback Without Retry

**Root Cause**: Subscription creation rollback steps failed silently without retrying or alerting.

**Why it persisted**:

- Happy path works (no rollback needed)
- Failure path only triggered when creation fails mid-operation
- Rare in testing, but catastrophic in production
- No alerting mechanism to notify ops

**Detection Method**:

1. **Code review checklist** for compensating transactions:
   - [ ] All rollback steps have retry logic (3 attempts typical)
   - [ ] Failed rollback after retries emits alert event
   - [ ] Orphaned record IDs logged at error level
   - [ ] Test: simulate rollback failure at each step
2. **Chaos test**:

   ```typescript
   describe('Subscription Rollback Resilience', () => {
     it('should retry rollback steps and emit alert on final failure', async () => {
       // Simulate tier count increment succeeding
       // but rollback failing
       let rollbackAttempts = 0;
       jest.spyOn(db.subscriptionTiers, 'update').mockImplementationOnce(async () => {
         rollbackAttempts++;
         if (rollbackAttempts < 3) {
           throw new Error('Transient failure');
         }
         // Third attempt succeeds
         return { id: 'tier-1', count: 5 };
       });

       const alertedSpy = jest.fn();
       service.on('rollback:failed', alertedSpy);

       await expect(service.createSubscription(params)).rejects.toThrow();

       // Verify 3 retry attempts
       expect(rollbackAttempts).toBe(3);

       // Verify alert was emitted
       expect(alertedSpy).toHaveBeenCalled();
     });
   });
   ```

**Best Practice Pattern**:

```typescript
class SubscriptionManagementService {
  // ✅ Helper: retry operation with exponential backoff
  private async retryOperation(
    operation: () => Promise<void>,
    label: string,
    maxRetries = 3
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await operation();
        return true; // Success
      } catch (err) {
        logger.warn(`${label} attempt ${attempt}/${maxRetries} failed`, err);

        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const delayMs = 100 * attempt;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    return false; // All retries exhausted
  }

  async createSubscription(params: SubscriptionParams): Promise<Subscription> {
    const subscription = await db.subscriptions.create(params);
    let tierCountIncremented = false;

    try {
      // ✅ Increment tier count
      const tier = await db.subscriptionTiers.findOne(params.tierId);
      await db.subscriptionTiers.update(tier.id, {
        subscriber_count: tier.subscriber_count + 1,
      });
      tierCountIncremented = true;

      // ... other operations
      return subscription;
    } catch (error) {
      logger.error('Subscription creation failed, rolling back', error);

      // ✅ Rollback with retry and alerting
      if (tierCountIncremented) {
        const ok = await this.retryOperation(
          () =>
            db.subscriptionTiers.update(tier.id, {
              subscriber_count: tier.subscriber_count - 1,
            }),
          'Rollback tier count'
        );

        if (!ok) {
          // ✅ ALERT: Orphaned record
          logger.error('ALERT: Failed to rollback tier count increment', {
            subscription_id: subscription.id,
            tier_id: params.tierId,
            action: 'Manual reconciliation required',
          });

          // ✅ Emit alert event for monitoring
          this.emit('rollback:failed', {
            step: 'tier_count',
            subscription_id: subscription.id,
            tier_id: params.tierId,
          });
        }
      }

      throw error;
    }
  }
}
```

---

### P3-149: z.any() in Content Validators

**Root Cause**: Metadata fields used `z.record(z.any())` accepting arbitrary data.

**Why it persisted**:

- Early implementation used z.any() as placeholder
- Never updated to proper schema
- Not caught by type checking (z.any() is intentional but unsafe)
- No validation test for oversized/nested metadata

**Detection Method**:

1. **Lint rule to ban z.any()**:
   ```javascript
   rules: {
     'no-zod-any': {
       create(context) {
         return {
           CallExpression(node) {
             if (node.callee.property?.name === 'any' &&
                 node.callee.object?.name === 'z') {
               context.report({
                 node,
                 message: 'z.any() bypasses validation. Use specific schema (z.string(), z.union(), etc.)',
               });
             }
           }
         };
       }
     }
   }
   ```
2. **Code review checklist** for validators:
   - [ ] Zero z.any() usages
   - [ ] Record types have value type constraint
   - [ ] Max keys limit to prevent DoS
   - [ ] Test: oversized metadata rejected
   - [ ] Test: deeply nested metadata rejected
3. **Security test**:

   ```typescript
   describe('Content Validator Security', () => {
     it('should reject oversized metadata', async () => {
       const largeMetadata = {};
       for (let i = 0; i < 200; i++) {
         largeMetadata[`key${i}`] = 'x'.repeat(10000);
       }

       const result = PublishContentSchema.safeParse({
         title: 'Test',
         content_type: 'note',
         metadata: largeMetadata,
       });

       expect(result.success).toBe(false);
     });

     it('should reject deeply nested metadata', async () => {
       const deeplyNested = { level1: { level2: { level3: 'value' } } };

       const result = PublishContentSchema.safeParse({
         title: 'Test',
         content_type: 'note',
         metadata: deeplyNested,
       });

       expect(result.success).toBe(false);
     });
   });
   ```

**Best Practice Pattern**:

```typescript
import { z } from 'zod';

// ✅ Define metadata value schema (bounded types, no nesting)
const MetadataValueSchema = z.union([
  z.string().max(10000), // Max string length
  z.number().min(-1e9).max(1e9), // Bounded numbers
  z.boolean(),
  z.null(),
]);

// ✅ No z.any(), no nesting, max keys
const ContentMetadataSchema = z
  .record(z.string(), MetadataValueSchema)
  .refine((obj) => Object.keys(obj).length <= 50, { message: 'Metadata cannot exceed 50 keys' });

export const PublishContentSchema = z.object({
  title: z.string().min(1).max(500),
  content_type: z.enum(['note', 'article', 'image', 'video']),
  body: z.string().max(1_000_000), // ~1MB
  metadata: ContentMetadataSchema.optional(), // ✅ Typed, bounded, safe
});

export const UpdateContentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().max(1_000_000).optional(),
  metadata: ContentMetadataSchema.optional(), // ✅ Same schema
});
```

---

## Implementation Roadmap: Preventing R7 Issues

### Phase 1: Immediate Detection (Week 1)

**Goal**: Catch R7-type issues automatically before next review round.

- [ ] Create lint rules for all 11 patterns (auth, idempotency, replay, etc.)
- [ ] Add ESLint rules to `.eslintrc.cjs` (1 hour)
- [ ] Create pattern templates in `docs/architecture/canonical-patterns.md` (2 hours)
- [ ] Deploy pre-commit hooks to validate patterns (1 hour)
- [ ] Verify: `npm run lint` catches all R7-type issues

**Commands**:

```bash
npm run lint -- --fix
npm run test:architecture # Run canonical pattern tests
```

### Phase 2: Test Coverage (Week 2)

**Goal**: Test scenarios that cause R7 issues.

- [ ] Write integration tests for all 15 findings
- [ ] Add chaos tests (role changes, restart cycles, concurrent requests)
- [ ] Load tests for cache stampede
- [ ] Security tests (replay, auth bypass, escalation)

**Commands**:

```bash
npm run test:integration -- r7
npm run test:security
npm run test:load
```

### Phase 3: Code Review Process (Week 2-3)

**Goal**: Prevent multi-round issues through comprehensive first review.

- [ ] Create domain-specific code review checklists (auth, payments, persistence, cache, middleware)
- [ ] Require cross-domain review (not just domain-owner review)
- [ ] Use `/workflows:review` with 13+ agents instead of ad-hoc manual review
- [ ] Acceptance criteria: "Zero new P1s per review round"

### Phase 4: Automation Gates (Week 3-4)

**Goal**: Fail PR if R7-type patterns detected.

- [ ] CI/CD workflow to detect:
  - Routes with `authenticate` but no role check
  - Payment operations without idempotency
  - Sync I/O in async handlers
  - Token operations not querying DB
  - setInterval without cleanup
  - Signature operations without TTL cache
  - Rollback without retry
- [ ] Fail PR if any pattern detected
- [ ] Document: "Why this check matters" with R7 reference

**CI/CD template** (`.github/workflows/security-patterns.yml`):

```yaml
name: R7 Security Patterns

on: [pull_request]

jobs:
  r7-patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check auth pattern (135)
        run: |
          for file in packages/backend/src/routes/*.ts; do
            if grep -q "authenticate" "$file" && ! grep -q "require(Creator|Admin|User)" "$file"; then
              echo "ERROR: $file has authenticate without role check (R7-135)"
              exit 1
            fi
          done

      - name: Check idempotency pattern (136)
        run: |
          if grep -r "payout\|payment\|charge" packages/backend/src/routes/ | \
             ! grep -q "Idempotency-Key"; then
            echo "ERROR: Payment operations lack idempotency header (R7-136)"
            exit 1
          fi

      - name: Check JWT refresh pattern (137)
        run: |
          if grep -A 20 "refreshJWT" packages/backend/src/services/nostr-auth.ts | \
             grep -q "payload.role"; then
            echo "ERROR: JWT refresh uses stale token role (R7-137)"
            exit 1
          fi

      - name: Check fsync pattern (138)
        run: |
          if grep -B 2 "renameSync" packages/backend/src/services/payment-persistence.ts | \
             ! grep -q "fsyncSync"; then
            echo "ERROR: File writes lack fsync before rename (R7-138)"
            exit 1
          fi

      - name: Check sync I/O pattern (140)
        run: |
          if grep -r "writeFileSync\|readFileSync" packages/backend/src/services/ | \
             ! grep -q "loadFromDisk\|startup"; then
            echo "WARN: Possible sync I/O in async handler (R7-140)"
          fi

      - name: Check setInterval tracking (142)
        run: |
          if grep -r "setInterval" packages/backend/src/services/ | \
             ! grep -q "this\\..*Interval ="; then
            echo "ERROR: setInterval not tracked for cleanup (R7-142)"
            exit 1
          fi

      - name: Check z.any usage (149)
        run: |
          if grep -r "z\\.any()" packages/backend/src/validators/; then
            echo "ERROR: z.any() found in validators (R7-149)"
            exit 1
          fi
```

---

## Success Metrics: How to Know R7 Prevention Works

| Metric                                       | Target           | How to Measure                                  |
| -------------------------------------------- | ---------------- | ----------------------------------------------- |
| **New reviews find no auth bypass patterns** | 100%             | Lint rule passes + code review confirms         |
| **New reviews find no idempotency issues**   | 100%             | Integration test: idempotency header required   |
| **New reviews find no token staleness**      | 100%             | Unit test: demote → refresh → verify new role   |
| **New reviews find no fsync issues**         | 100%             | Mock test: fsync called before rename           |
| **Cache stampede prevented**                 | 100%             | Load test: 100 concurrent misses = 1 read       |
| **No blocking I/O**                          | 100%             | Profiling: no sync calls in handlers            |
| **No memory leaks**                          | 100%             | Listener count test: bounded after restarts     |
| **No replay attacks**                        | 100%             | Unit test: replayed sig within 5 min rejected   |
| **Rollback resilience**                      | 100%             | Chaos test: failure + 3 retries + alert         |
| **z.any() usage**                            | 0%               | Lint rule: `no-zod-any` passes                  |
| **Review efficiency**                        | <3 rounds per PR | Use `/workflows:review` (13 agents in parallel) |

---

## Key Insight: The Real Problem Was Review Methodology

After 7 rounds, this wasn't about finding more bugs. It was about:

1. **Insufficient automation** — Manual review cannot scale to catch patterns across 15k+ LOC
2. **Lack of domain composition** — Auth review ≠ Payment review ≠ Persistence review, but they're interdependent
3. **No up-front standards** — "This is how payment operations should look" (checklist) would prevent 90% of issues
4. **Review fatigue** — By round 7, reviewers were tired and missing obvious problems

**Solution**: Don't do 7 review rounds. Do 1 thorough review with:

- 13+ agents in parallel (divide-and-conquer)
- Automated pattern detection (catch whole classes at once)
- Domain composition checks (e.g., "payment ops need auth + idempotency + rate limit + durability")
- Pre-implementation standards (document "canonical patterns" before coding)

Use `/workflows:review` to parallelize and `/workflows:plan` to enforce standards upfront.

---

## Related Documents

- [R7 Remediation Plan](../plans/r7-remediation-plan.md) — Detailed fixes for all 15 findings
- [R7 Remediation DoD](../plans/r7-remediation-dod.md) — Acceptance criteria for each fix
- [P2 Prevention Strategies](./p2-remediation-sprint-25-findings.md) — Anti-patterns from earlier sprint
- [P1-037-043 Prevention](./P1-037-043-prevention-strategies.md) — Framework from infrastructure sprint
- [CLAUDE.md](../../../CLAUDE.md) — Compound Engineering workflow for preventing issues

---

**Status**: Ready for implementation
**Last Updated**: 2026-02-15
**Maintainer**: Sovren Engineering Team
