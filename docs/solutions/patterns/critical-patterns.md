---
title: Critical Patterns — Canonical Reference
date: '2026-02-22'
category: patterns
purpose: Single source of truth for recurring P1 fix patterns. Include in agent briefs.
usage: Read this file BEFORE writing any service, route, or financial component.
---

# Critical Patterns

Canonical patterns extracted from 50+ P1 findings across 7 sprints. Each pattern has appeared in 3+ separate reviews or represents a systemic gap. **If you're writing code that touches any of these categories, use the pattern exactly as shown.**

---

## 1. TOCTOU Race Conditions (9 P1s across 4 sprints)

**The problem:** Read state, check condition, write — but another request slips between read and write.

**Rule:** Never read-then-write without an atomic guard. Pick one of three patterns:

### 1a. Insert-Then-Verify (capacity enforcement)

Use when enforcing an aggregate cap (member count, slot count, quota).

```typescript
// INSERT first (unique constraint prevents exact duplicates)
const { error } = await db.from('members').insert({ group_id, user_id });
if (error?.code === '23505') throw new Error('Already a member');

// COUNT after insert — true post-insert count
const { count } = await db
  .from('members')
  .select('id', { count: 'exact', head: true })
  .eq('group_id', groupId);

// Over cap? Rollback the insert
if ((count ?? 0) > maxMembers) {
  await db.from('members').delete().eq('group_id', groupId).eq('user_id', userId);
  throw new ConflictError('Group is full');
}
```

### 1b. Accept-Then-Verify-or-Revert (status transition + capacity)

Use when a status transition must also respect a concurrent aggregate cap.

```typescript
// Atomic status guard — only one concurrent caller wins
await db.from('requests').update({ status: 'active' }).eq('id', requestId).eq('status', 'pending');

// Verify capacity post-transition
const { count } = await db
  .from('requests')
  .select('id', { count: 'exact', head: true })
  .eq('owner_id', ownerId)
  .eq('status', 'active');

if ((count ?? 0) > maxCapacity) {
  // Revert
  await db
    .from('requests')
    .update({ status: 'pending' })
    .eq('id', requestId)
    .eq('status', 'active');
  throw new ConflictError('Capacity exceeded');
}
```

### 1c. Atomic Claim (scarce resource)

Use when exactly one writer must win (tickets, slots, listings).

```typescript
// UPDATE WHERE active=true — exactly one concurrent caller succeeds
const { data: claimed } = await db
  .from('listings')
  .update({ active: false })
  .eq('id', listingId)
  .eq('active', true)
  .select('id');

if (!claimed?.length) throw new ConflictError('Already claimed');

try {
  // All post-claim work in try/catch
  await createOrder(listingId);
} catch (err) {
  // Rollback: re-activate so resource isn't permanently locked
  await db.from('listings').update({ active: true }).eq('id', listingId).eq('active', false);
  throw err;
}
```

**Detection:** Grep for `.select()` followed by conditional `.insert()` or `.update()` without `.eq('status', ...)` guard on the write.

---

## 2. Authorization at Service Layer (2 P1s, recurring)

**The problem:** Route has `authenticate` middleware but service method doesn't verify caller owns/has-access-to the resource.

**Rule:** Every service method that reads or writes user data must verify the caller. Route-level auth is necessary but not sufficient.

```typescript
// WRONG — trusts route-level auth alone
async getPrivateContent(contentId: string): Promise<Content> {
  return await db.from('content').select('*').eq('id', contentId).single();
}

// RIGHT — service-layer ownership check
async getPrivateContent(contentId: string, callerId: string): Promise<Content> {
  const content = await db.from('content').select('*').eq('id', contentId).single();
  const isMember = await db.from('memberships')
    .select('id').eq('group_id', content.group_id).eq('user_id', callerId).single();
  if (!isMember && content.owner_id !== callerId) {
    throw new AuthorizationError('Not authorized to view this content');
  }
  return content;
}
```

**Detection:** Grep for service methods where `callerId`/`creatorId` parameter exists but is only used in the final write, not in an access check.

---

## 3. Unbounded Queries / Paginated Accumulation (2 P1s, recurring)

**The problem:** `SELECT *` with no limit loads entire table into memory. `.limit(1000)` silently truncates.

**Rule:** Never aggregate in application code without pagination. Use `PAGE_SIZE = 500`.

```typescript
const PAGE_SIZE = 500;
let total = 0,
  offset = 0,
  hasMore = true;

while (hasMore) {
  const { data } = await db
    .from('entries')
    .select('amount')
    .eq('owner_id', ownerId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  const rows = data ?? [];
  for (const r of rows) total += r.amount;
  hasMore = rows.length === PAGE_SIZE;
  offset += PAGE_SIZE;
}
```

**Detection:** Grep for `.select()` without `.range()` or `.limit()`. Flag any `.limit(N)` used for aggregation (it silently drops records).

---

## 4. Non-Atomic Multi-Table Writes (5 P1s across 3 sprints)

**The problem:** Two inserts to different tables. First succeeds, second fails. Data is now inconsistent.

**Rule:** Multi-table writes must be atomic. Use Supabase RPC or compensating transactions.

### 4a. Supabase RPC (preferred)

```sql
-- Migration: create atomic function
CREATE OR REPLACE FUNCTION create_group_with_admin(
  p_name TEXT, p_creator_id UUID
) RETURNS UUID AS $$
DECLARE v_group_id UUID;
BEGIN
  INSERT INTO groups (name, creator_id) VALUES (p_name, p_creator_id)
    RETURNING id INTO v_group_id;
  INSERT INTO group_members (group_id, user_id, role)
    VALUES (v_group_id, p_creator_id, 'admin');
  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

```typescript
// Service call
const { data } = await db.rpc('create_group_with_admin', {
  p_name: name,
  p_creator_id: creatorId,
});
```

### 4b. Compensating Transaction (when RPC isn't feasible)

```typescript
const { data: group } = await db.from('groups').insert({ name }).select().single();
try {
  await db.from('members').insert({ group_id: group.id, user_id: creatorId, role: 'admin' });
} catch (err) {
  // Compensate: delete the group
  await db.from('groups').delete().eq('id', group.id);
  throw err;
}
```

**Detection:** Grep for two or more `.insert()` or `.update()` calls on different tables within the same function without RPC or try/catch.

### 4c. DB + Queue Compensation with Error Checking (PR #96)

When a DB write succeeds but subsequent queue enqueue fails mid-loop, mark un-enqueued rows as terminal. **The compensation itself can fail** — destructure its error, log with recovery context, and always rethrow the original.

```typescript
const enqueuedIds: string[] = [];
try {
  for (const row of inserted || []) {
    await queueService.addJob(QUEUE_NAME, `publish-${row.platform}`, jobData, { delay });
    enqueuedIds.push(row.id);
  }
} catch (err) {
  const failedIds = (inserted || []).map((r) => r.id).filter((id) => !enqueuedIds.includes(id));

  logger.error('[Service] Enqueue failed mid-loop; compensating', {
    enqueuedCount: enqueuedIds.length,
    totalCount: (inserted || []).length,
    err,
  });

  if (failedIds.length > 0) {
    const { error: compensateError } = await db
      .from('table')
      .update({
        status: 'failed',
        error_message: 'Queue enqueue failed',
        updated_at: new Date().toISOString(),
      })
      .in('id', failedIds);

    if (compensateError) {
      logger.error('[Service] Compensating update failed — rows may be stuck', {
        failedIds,
        compensateError,
      });
    }
  }

  throw err; // Always rethrow — compensation is cleanup, not recovery
}
```

**Key rules:**

- Track successes per-iteration (`enqueuedIds.push`) so the failed set is exact.
- Log **before** compensating — if compensation crashes, at least one log exists.
- Rename destructured error (`compensateError`) to avoid shadowing the catch binding.
- Add `updated_at` for audit trail consistency.
- `throw err` is unconditional — caller must see the real failure.

**Detection:** Grep for `addJob` or `enqueue` inside a `for` loop that also has a preceding `.insert()`. If there's no try/catch with compensation, it's a P1.

---

## 5. Payment & Financial Persistence (4 patterns from PR #73 R6)

### 5a. Atomic Write (temp file + rename)

```typescript
const tmpPath = `${filePath}.${Date.now()}.tmp`;
await fs.writeFile(tmpPath, JSON.stringify(data));
await fs.rename(tmpPath, filePath); // Atomic on same filesystem
```

### 5b. Write Mutex (prevent concurrent file corruption)

```typescript
if (this.writeLock) return; // Already writing
this.writeLock = true;
try {
  await atomicWrite(path, data);
} finally {
  this.writeLock = false;
}
```

### 5c. Persist-Then-Mutate (never lose state)

```typescript
await persistToStorage(data); // Step 1: durable write
this.memoryCache.set(key, data); // Step 2: in-memory update
// If step 2 fails, data is still persisted for recovery
```

### 5d. Compensating Transaction (multi-step with rollback)

```typescript
const invoice = await createInvoice(amount);
try {
  await processPayment(invoice.id);
  await updateStatus(invoice.id, 'paid');
} catch (err) {
  await voidInvoice(invoice.id); // Compensate
  throw err;
}
```

---

## 6. SSRF Validation (6 P1s across 4 security sprints)

**The problem:** User-supplied URLs fetched server-side without validating the resolved IP. Additional vectors: IPv6 encodings of private IPs, URL parser normalization hiding bypass forms, DNS TOCTOU between validation and fetch.

**Rule:** Always resolve DNS, check the IP, return resolved IPs for DNS pinning, and test with the **normalized** hostname (not raw input).

### 6a. Validation with DNS Pinning (prevents TOCTOU rebinding)

```typescript
import { lookup } from 'dns/promises';
import https from 'https';

interface SsrfValidationResult {
  resolvedIps: Array<{ address: string; family: 4 | 6 }>;
}

async function validateSsrfUrl(url: string): Promise<SsrfValidationResult> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
  if (parsed.username || parsed.password) throw new Error('Credentials blocked');

  const hostname = parsed.hostname.toLowerCase();

  // Block literal private IPs (IPv4, IPv6, octal, hex, decimal-integer)
  if (isPrivateIPv4(hostname)) throw new Error('Private IP blocked');
  if (hostname.startsWith('[') || hostname.includes(':')) {
    if (isPrivateIPv6(hostname)) throw new Error('Private IPv6 blocked');
  }

  // Resolve DNS and check ALL returned IPs
  const results = await lookup(hostname, { all: true });
  const resolvedIps: SsrfValidationResult['resolvedIps'] = [];
  for (const r of results) {
    if (r.family === 4 && isPrivateIPv4(r.address)) throw new Error('Resolves to private IP');
    if (r.family === 6 && isPrivateIPv6(r.address)) throw new Error('Resolves to private IPv6');
    resolvedIps.push({ address: r.address, family: r.family as 4 | 6 });
  }
  // MUST return resolved IPs — callers pin DNS to prevent TOCTOU rebinding
  return { resolvedIps };
}
```

### 6b. DNS-Pinning Agent (closes TOCTOU gap)

```typescript
function createSsrfSafeAgent(resolvedIps: SsrfValidationResult['resolvedIps']): https.Agent {
  let i = 0;
  return new https.Agent({
    lookup: (_hostname, _opts, cb) => {
      const ip = resolvedIps[i++ % resolvedIps.length];
      cb(null, ip.address, ip.family);
    },
  });
}

// Usage — DNS is pinned to pre-validated IPs
const { resolvedIps } = await validateSsrfUrl(url);
const agent = createSsrfSafeAgent(resolvedIps);
const response = await fetch(url, { agent });
```

### 6c. IPv6 Private IP Checks (must handle URL parser normalization)

```typescript
function isPrivateIPv6(ip: string): boolean {
  const n = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (n === '::1' || n === '::') return true;
  if (n.startsWith('fc') || n.startsWith('fd')) return true; // ULA
  if (n.startsWith('fe80')) return true; // Link-local

  // IPv4-mapped: ::ffff:x.x.x.x (dotted) and ::ffff:HHHH:HHHH (hex)
  const mapped = n.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const hexMapped = n.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) return isPrivateIPv4(hexToIPv4(hexMapped[1], hexMapped[2]));

  // IPv4-compatible: ::x.x.x.x (dotted) and ::HHHH:HHHH (hex)
  // CRITICAL: URL parser normalizes ::127.0.0.1 → ::7f00:1 (hex, no ffff prefix)
  const compat = n.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (compat) return isPrivateIPv4(compat[1]);
  const hexCompat = n.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexCompat) return isPrivateIPv4(hexToIPv4(hexCompat[1], hexCompat[2]));

  return false;
}

function hexToIPv4(hi: string, lo: string): string {
  const h = parseInt(hi, 16),
    l = parseInt(lo, 16);
  return `${(h >> 8) & 0xff}.${h & 0xff}.${(l >> 8) & 0xff}.${l & 0xff}`;
}
```

**URL parser normalization table (must-know for SSRF testing):**

| Input hostname     | `new URL().hostname` | Which check catches it                 |
| ------------------ | -------------------- | -------------------------------------- |
| `0177.0.0.1`       | `127.0.0.1`          | isPrivateIPv4                          |
| `0x7f000001`       | `127.0.0.1`          | isPrivateIPv4                          |
| `2130706433`       | `127.0.0.1`          | isPrivateIPv4                          |
| `::ffff:127.0.0.1` | `::ffff:7f00:1`      | IPv4-mapped hex check                  |
| `::127.0.0.1`      | `::7f00:1`           | **IPv4-compatible hex check** (PR #91) |
| `::192.168.1.1`    | `::c0a8:101`         | **IPv4-compatible hex check** (PR #91) |

**Detection:** Grep for `fetch(`, `axios(`, `http.get(` where the URL comes from user input without passing through `validateSsrfUrl`. Also grep for calls to `validateSsrfUrl` that ignore the return value (TOCTOU risk).

---

## 7. Status Guards on Destructive Operations (3 P1s)

**The problem:** DELETE or state-changing operation runs on any status, even when the entity is in a protected state (paid, active, released).

**Rule:** Every destructive operation starts with a status assertion.

```typescript
async deleteEntity(id: string, callerId: string): Promise<void> {
  const entity = await this.getEntity(id, callerId);
  if (entity.status !== 'draft') {
    throw new ConflictError(
      `Cannot delete with status '${entity.status}'. Only draft entities can be deleted.`
    );
  }
  await db.from('entities').delete().eq('id', id).eq('owner_id', callerId);
}
```

**Valid delete states:** `draft`, `cancelled`. **Protected states:** `sent`, `paid`, `active`, `released`, `completed`.

**Additional rule (PR #94):** Every Supabase mutation (`.update()`, `.delete()`) that targets a specific row MUST check the returned `count`. A `count === 0` result means the WHERE clause matched nothing -- the entity either doesn't exist or is in an unexpected state. Without this check, the operation silently succeeds as a no-op.

```typescript
// WRONG -- silent no-op when row doesn't match
const { error } = await db
  .from('cross_posts')
  .update({ status: 'cancelled' })
  .eq('id', crossPostId)
  .eq('status', 'pending');

// RIGHT -- explicit count guard
const { error, count } = await db
  .from('cross_posts')
  .update({ status: 'cancelled' })
  .eq('id', crossPostId)
  .eq('status', 'pending');

if (error) throw new DatabaseError(error.message);
if (count === 0) throw new NotFoundError('Not found or not in cancellable state');
```

**Detection:** Grep for `.delete()` without a preceding status check in the same function. Also grep for `.update()` or `.delete()` without destructuring `count` from the result.

---

## 8. Test Infrastructure Must Wire Into CI + Agent Briefs (1 P1 + systemic gap)

**The problem:** New test types (E2E, a11y, perf) are created locally but never added to CI pipeline or agent brief deliverables. Tests exist but don't protect anything — deploys proceed without them, and agents never write them during implementation.

**Rule:** Every test type requires three integration points. Missing any one makes the tests a dead artifact.

### 8a. CI Pipeline Gate

Tests must block deploys, not just exist locally.

```yaml
# ❌ WRONG: E2E exists locally but CI only runs unit tests
jobs:
  test:
    run: npm run test:ci    # Vitest only
  deploy-staging:
    needs: [test]           # No E2E gate

# ✅ RIGHT: E2E gates staging deploys against production build
jobs:
  e2e:
    needs: [build]
    steps:
      - run: npx vite preview --port 4173 &
      - run: npm run test:e2e
        env:
          E2E_BASE_URL: http://localhost:4173
  deploy-staging:
    needs: [build, docker, e2e]  # E2E must pass
```

### 8b. Agent Brief Deliverables

Implementation agents must create test coverage alongside features — not defer entirely to QA.

```markdown
# ❌ WRONG: Frontend brief defers all E2E to QA

**You DO NOT OWN:**

- E2E tests (QA agent in Phase 3)

# ✅ RIGHT: Frontend creates E2E alongside UI, QA hardens

**Deliverables:**

- [ ] UI components for the feature
- [ ] Component unit tests
- [ ] E2E Page Object + spec for the new page/feature

**E2E Testing:**

1. Create Page Object in e2e/pages/{page}.page.ts
2. Add spec covering happy path user journey
3. Register spec in correct Playwright project in config
4. Run npm run test:e2e before marking complete
```

### 8c. Project Documentation

The project CLAUDE.md must document structure, conventions, and commands so every agent knows how to write tests correctly.

**Detection:** For any test type, check all three:

1. `grep -r "test-type" .github/workflows/ci.yml` — in CI?
2. `grep -r "test-type" briefs/` — in agent deliverables?
3. `grep -r "test-type" CLAUDE.md` — documented?

If any returns empty, the test type is partially integrated and will atrophy.

---

## 9. NOSTR `verifyEvent()` Requires Computed Event ID (1 P1 — 9/10 agent consensus)

**The problem:** `verifyEvent()` from `nostr-tools/pure` does NOT auto-compute the event ID. It validates that `event.id` matches `SHA256([0, pubkey, created_at, kind, tags, content])`. Passing `id: ''` or any incorrect value means verification always fails silently — returns `false` with no error.

**Rule:** Always build an `UnsignedEvent` first, compute the ID with `getEventHash()`, then spread into a full `NostrEvent`.

### 9a. Correct Event Construction for Verification

```typescript
import {
  getEventHash,
  verifyEvent,
  type Event as NostrEvent,
  type UnsignedEvent,
} from 'nostr-tools/pure';

// ❌ WRONG: verifyEvent checks id against computed hash — empty string always mismatches
const event: NostrEvent = {
  kind: 1,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: messageHash,
  id: '', // Will be computed by verifyEvent — WRONG, it validates, not computes
  sig: signature,
};

// ✅ RIGHT: Compute id explicitly from UnsignedEvent
const eventData: UnsignedEvent = {
  kind: 1,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: messageHash,
};
const event: NostrEvent = {
  ...eventData,
  id: getEventHash(eventData),
  sig: signature,
};

const isValid = verifyEvent(event);
```

### 9b. Incomplete Fix Detection

When fixing a bug pattern in a class method, **grep the entire file** for the same pattern in standalone exports:

```bash
# After fixing verifySignature() class method, check for other instances
grep -n "id: ''" packages/backend/src/services/nostr-auth.ts
```

This bug survived 7 sprints and 139 findings because:

1. The class method `verifySignature()` was fixed but the standalone `isValidSignature()` utility was missed
2. Diff-based reviews only saw the fixed method, not the still-broken utility
3. Full-file reviews (not diff reviews) are required to catch duplicate patterns

**Detection:** `grep -rn "id: ''" --include="*.ts" src/` — any `NostrEvent` with `id: ''` is broken.

---

## 10. Cross-Package String Duplication Causes Silent Auth Breakage (1 P2 — 5 locations)

**Pattern:** When the same string literal or function is copy-pasted across multiple packages, a format change in one location silently breaks the others. For authentication strings, this means the backend verifies against one format while the frontend signs with another — **auth fails with no error explaining why**.

### 10a. Single Source in `@shared/` for Cross-Package Utilities

```typescript
// ❌ WRONG — duplicated in 5 locations across 3 packages
const message = `Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}`;

// ✅ CORRECT — single source of truth in shared package
// packages/shared/src/types/nostr/auth.ts
export function createSignatureMessage(challenge: string, timestamp: number): string {
  return `Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}`;
}

// All consumers import from shared:
import { createSignatureMessage } from '@shared/types/nostr/auth';
```

**Detection rule:** `grep -rn "string literal" packages/ | wc -l` — if count > 2 across different packages, extract to `@shared/`.

**When to use:** Any string, template, or function that appears in 3+ locations OR in 2+ packages. The `@shared/` path alias is already configured for both frontend and backend — adding a function there is immediately available everywhere.

### 10b. Silent Fallback / Lazy Init Must Log

```typescript
// ❌ WRONG — silent fallback, operationally invisible
export function getClient(): Client {
  if (!sharedClient) {
    sharedClient = createClient(); // No one knows this happened
  }
  return sharedClient;
}

// ✅ CORRECT — warning makes the fallback visible
export function getClient(): Client {
  if (!sharedClient) {
    logger.warn('[Service] Lazy-creating client — init() was not called. Health check skipped.');
    sharedClient = createClient();
  }
  return sharedClient;
}
```

**Detection rule:** Any `if (!x) { x = create...() }` without a `logger.warn` on the lazy path.

**When to use:** Every lazy-init, fallback, or default-value path in service initialization. If it's supposed to be temporary, also add `// TODO: remove lazy init after bootstrap ordering is fixed`.

---

## Quick Reference Table

| Pattern                 | When to Use          | Key Guard                          | HTTP Error   |
| ----------------------- | -------------------- | ---------------------------------- | ------------ |
| Insert-then-verify      | Aggregate caps       | Count after insert                 | 409          |
| Accept-then-revert      | Status + capacity    | Count after transition             | 409          |
| Atomic claim            | Scarce resources     | `UPDATE WHERE active=true`         | 409          |
| Service-layer auth      | All data access      | Membership/ownership query         | 403          |
| Paginated accumulation  | Any unbounded SELECT | `PAGE_SIZE=500` + while loop       | N/A          |
| Atomic multi-table      | 2+ table writes      | RPC or compensating tx             | 500          |
| SSRF validation         | User-supplied URLs   | DNS resolve + IP check + pin IPs   | 400          |
| Status guard            | DELETE/void/cancel   | Assert status before write         | 409          |
| Test infra integration  | New test type added  | CI stage + brief + CLAUDE.md       | N/A          |
| NOSTR event ID          | Any verifyEvent call | `getEventHash(UnsignedEvent)`      | N/A          |
| Cross-pkg dedup         | String in 3+ files   | Extract to `@shared/`              | N/A          |
| Silent fallback log     | Any lazy-init path   | `logger.warn()` on fallback        | N/A          |
| PostgREST filter escape | User text → `.or()`  | Escape `\` first, then metachar    | 400          |
| VIEW security barrier   | Public-facing VIEW   | `security_barrier` + status filter | 200 (hidden) |
| RLS on CREATE TABLE     | Every new table      | RLS + policies in same migration   | N/A          |
| Crypto timing-safe      | HMAC/signature check | `timingSafeEqual`, no empty secret | 401          |

---

## 11. PostgREST Filter Escape — Complete Metacharacter Coverage (1 P1)

**The problem:** User-supplied text passed to PostgREST `.or()` / `.filter()` without escaping all metacharacters allows filter injection — broadening searches (`%`), injecting operators (`:`, `"`), or triggering LIKE wildcards (`_`).

**Rule:** Escape backslash FIRST (to avoid double-escaping), then escape all PostgREST/SQL metacharacters in a single pass.

```typescript
export function escapePostgrestFilter(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // backslash FIRST
    .replace(/[,.*():%"_]/g, '\\$&'); // all metacharacters
}

// Usage — always escape before passing to PostgREST filters:
const safe = escapePostgrestFilter(userQuery);
query = query.or(`display_name.ilike.%${safe}%,username.ilike.%${safe}%`);
```

**Full metacharacter set:** `\` `,` `.` `*` `(` `)` `:` `%` `"` `_`

**Why backslash first?** If you escape `,` to `\,` first, then escape `\` to `\\`, you get `\\,` — the comma is no longer escaped. Escaping `\` first means `\` → `\\`, then `,` → `\,`, giving the correct `\\` and `\,` separately.

**Test payloads:** `100%`, `a_b`, `a\b`, `a:b`, `a"b`, `bio.ilike.%test%,other`

**Detection:** `grep -rn "\.or(\|\.filter(" packages/backend/` — verify all user-supplied strings pass through `escapePostgrestFilter()` before interpolation.

---

## 12. PostgreSQL VIEW Security Barrier (1 P1)

**The problem:** PostgreSQL VIEWs bypass RLS. Without `security_barrier = true`, the query planner can push user-supplied predicates past the VIEW's WHERE clause, disclosing rows that should be hidden (admin accounts, inactive users, banned content).

**Rule:** Every public-facing VIEW must have `security_barrier = true`, a status filter, and a role filter.

```sql
CREATE OR REPLACE VIEW discovery_creators WITH (security_barrier = true) AS
SELECT
  cp.id,
  COALESCE(cp.bio, '') AS bio,
  COALESCE(u.display_name, u.username, 'Anonymous') AS display_name,
  -- ... other columns with COALESCE for nullable fields
FROM creator_profiles cp
INNER JOIN users u ON cp.creator_id = u.id
LEFT JOIN creators c ON c.user_id = u.id
WHERE u.status = 'active'
  AND u.role != 'admin';

-- Only SELECT, never INSERT/UPDATE/DELETE
GRANT SELECT ON discovery_creators TO anon, authenticated;
```

**Checklist for every VIEW:**

- [ ] `WITH (security_barrier = true)`
- [ ] `WHERE status = 'active'` or equivalent
- [ ] `AND role != 'admin'` for public-facing views
- [ ] COALESCE all nullable columns (prevents TS runtime crashes)
- [ ] GRANT only SELECT to appropriate roles
- [ ] Security comment in migration

**Detection:** `grep -rn "CREATE.*VIEW" supabase/migrations/` — verify every VIEW has `security_barrier`. `grep -L "security_barrier" supabase/migrations/*view*.sql` finds violations.

---

## 13. Route Boundary UUID Validation (1 P1 — Comments Slice 6)

**The problem:** Route params (`:contentId`, `:commentId`) passed directly to the service without format validation. Non-UUID strings like `'../admin'` or `'; DROP TABLE'` reach the DB query, produce misleading Supabase errors, and leak internal error details.

**Rule:** Every route handler that receives an ID path parameter must validate UUID format with Zod `safeParse` before calling the service. Use `safeParse` (not `parse`) to avoid unhandled throw.

```typescript
import { z } from 'zod';

const UuidParamSchema = z.string().uuid();

// In every route handler:
const idResult = UuidParamSchema.safeParse(req.params.contentId);
if (!idResult.success) {
  throw new ValidationError('Invalid content ID format');
}
// Only pass idResult.data (guaranteed UUID) to the service
await service.doThing(idResult.data, ...);
```

**Checklist for every v2 route:**

- [ ] Every `:id`, `:contentId`, `:commentId` param has a `safeParse` call
- [ ] `ValidationError` thrown with descriptive message (not raw Zod error)
- [ ] Only `result.data` (validated string) reaches the service
- [ ] Tests include a "non-UUID param → ValidationError" assertion

**Detection:** `grep -rn "req\.params\." packages/backend/src/routes/ | grep -v "safeParse\|schema"` — any match is a P1 finding.

---

## 14. Avatar/Image URL Protocol Whitelist (1 P1 — Comments Slice 6)

**The problem:** User-supplied URLs stored as `avatar_url` rendered directly in `<img src>`. `javascript:alert(1)` and `data:text/html,...` URIs are valid URL strings that browsers execute on render.

**Rule:** Any user-supplied URL rendered as an HTML `src` or `href` attribute must be validated against an `http(s)` allowlist. Fallback to a safe default.

```tsx
// Frontend render-time guard (defense in depth):
{
  avatarUrl && /^https?:\/\//i.test(avatarUrl) ? (
    <img src={avatarUrl} alt={displayName} className="..." />
  ) : (
    <div aria-hidden="true">{/* initials fallback */}</div>
  );
}
```

**Backend validation (Zod schema — apply before DB write):**

```typescript
const avatarUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        return ['https:', 'http:'].includes(new URL(url).protocol);
      } catch {
        return false;
      }
    },
    { message: 'Avatar URL must use http or https protocol' }
  )
  .optional();
```

**Detection:** `grep -rn "src={.*[Uu]rl\|src={.*avatar" packages/frontend/src/ | grep -v "test("` — any match without a preceding protocol check is a P1.

**Distinction from #6 (SSRF):** SSRF validation (#6) is for server-side fetches. This pattern is for client-side render safety. Different attack surface, same principle: user-supplied URLs need protocol allowlisting.

---

## 15. Cross-Content Parent Reference Guard (1 P1 — Comments Slice 6)

**The problem:** When creating a reply, the parent comment lookup used only `.eq('id', parentId)` without scoping to the current content. An attacker could supply a valid `parentCommentId` from a different content item, creating a cross-content reference and leaking that the comment exists.

**Rule:** Every parent lookup in threaded data must include the content scope constraint. Never look up a parent by ID alone.

```typescript
// CORRECT — scope to the same content:
const { data: parent } = await db
  .from('comments')
  .select('parent_comment_id, status, content_id')
  .eq('id', parentCommentId)
  .eq('content_id', contentId) // CRITICAL: scope guard
  .single();

if (!parent) throw new NotFoundError('Parent comment');
// If parent exists but belongs to different content → null → NotFoundError
// Attacker never learns whether the UUID is valid in another context

// WRONG — allows cross-content reference:
const { data: parent } = await db
  .from('comments')
  .select('id')
  .eq('id', parentCommentId) // only checks existence, not scope
  .single();
```

**Applies to:** Comments, nested posts, nested tasks, any self-referential table with a scope boundary (content_id, workspace_id, team_id, etc.).

**Detection:** Any parent lookup in a threaded insert that uses only `.eq('id', parentId)` without a scope constraint is a P1 finding.

---

## 16. RLS INSERT Policies Must Restrict to Service Role (1 P1 — Slice 8)

**Recurrence:** 1 P1. `WITH CHECK (TRUE)` on INSERT allows any authenticated user to create rows that should only be created by the backend service.

```sql
-- WRONG: Any authenticated user can insert
CREATE POLICY insert_policy ON notifications
  FOR INSERT WITH CHECK (TRUE);

-- CORRECT: Only backend service role
CREATE POLICY insert_policy ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

**When to use:** Every table where rows are created by backend services on behalf of users (notifications, audit logs, system events). User-created rows (posts, comments) use `auth.uid()` check instead.

**Detection:** `grep -rn "WITH CHECK (TRUE)" supabase/migrations/` — any hit without an explicit exemption comment is a P1.

---

## 17. PostgreSQL Trigger Atomic Increments (1 P1 — Slice 8)

**Recurrence:** 1 P1. `COALESCE(count, 0) + 1` is a read-modify-write pattern that loses increments under concurrent load.

```sql
-- WRONG: Read-modify-write race under concurrency
UPDATE creators SET follower_count = COALESCE(follower_count, 0) + 1;

-- CORRECT: Atomic (PostgreSQL handles row-level locking)
UPDATE creators SET follower_count = follower_count + 1;

-- For decrements, floor at 0:
UPDATE creators SET follower_count = GREATEST(follower_count - 1, 0);
```

**Also required:** `SECURITY DEFINER SET search_path = public` on trigger functions that UPDATE tables the invoking user may not have direct permission on.

**Detection:** `grep -rn "COALESCE.*+ 1\|COALESCE.*- 1" supabase/migrations/` in trigger functions.

---

## 18. RLS Must Accompany Every CREATE TABLE Migration (40+ tables — Audit #757)

**Recurrence:** 1 P1 audit finding affecting 40+ financial tables. Highest-count single finding in the production readiness audit.

**The problem:** Tables created before RLS conventions were established had zero Row Level Security. The fix required a phased remediation migration after the fact.

**Rule:** Every `CREATE TABLE` in a migration must be immediately followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at minimum one policy — in the same migration file.

```sql
-- MANDATORY pattern for every user-data table migration
CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount_sats BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS immediately after CREATE TABLE — same migration file
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_records_service_role" ON payment_records
  USING (auth.role() = 'service_role');

CREATE POLICY "payment_records_select_own" ON payment_records
  FOR SELECT USING (user_id = auth.uid());
```

**Access model decision tree:**

- Backend-only INSERT → `WITH CHECK (auth.role() = 'service_role')` (pattern #16)
- User self-INSERT → `WITH CHECK (auth.uid() = user_id)`
- Financial credit tables → payer-only INSERT, never `recipient_id = auth.uid()` on INSERT
- Never use `WITH CHECK (TRUE)` on user-data tables

**Detection:**

```sql
-- Tables missing RLS entirely
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;
-- Tables with RLS enabled but zero policies (silently denies all access)
SELECT t.tablename FROM pg_tables t
WHERE t.rowsecurity AND NOT EXISTS (
  SELECT 1 FROM pg_policies p WHERE p.tablename = t.tablename
);
```

---

## 19. Cryptographic Comparison Must Use `crypto.timingSafeEqual()` (Audit #759)

**Recurrence:** 1 P1. HMAC verification used `===` (timing attack) and accepted empty secrets.

**The problem:** `===` on cryptographic values leaks length information through timing side channels. One file (`csrf.ts`) used `timingSafeEqual` correctly while another (`webhooks.ts`) used `===` — copy/drift between files.

**Rule:** Every HMAC, token, or signature comparison uses `crypto.timingSafeEqual()`. The `===` operator on cryptographic values is a P1 regardless of context.

```typescript
import { timingSafeEqual, createHmac } from 'crypto';

function verifyHmacSignature(
  payload: string | Buffer,
  receivedSig: string,
  secret: string
): boolean {
  if (!secret) {
    throw new Error('HMAC secret must be configured — refusing to verify with empty secret');
  }
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(receivedSig.replace(/^sha256=/, ''), 'hex');

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
```

**Additional rule:** If the secret is empty or missing, the function must throw — never silently verify. Empty-string HMAC is forgeable by anyone who knows the payload.

**Detection:** `grep -rn '=== .*sig\|sig.*===\|=== .*hash\|hash.*===' packages/backend/src/` — any match is P1. Also: `grep -rn "SECRET.*||.*''" packages/backend/src/` for empty secret fallbacks.

---

## How to Use This File

1. **In agent briefs:** Add `"Read docs/solutions/patterns/critical-patterns.md before writing code"` to the CONTEXT TO LOAD section.
2. **In code review:** Check each finding against this file. If the fix doesn't match the canonical pattern, flag it.
3. **In pre-commit:** The patterns here inform what automated checks should catch.
