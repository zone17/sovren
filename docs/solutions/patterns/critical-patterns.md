---
title: Critical Patterns — Canonical Reference
date: '2026-02-19'
category: patterns
purpose: Single source of truth for recurring P1 fix patterns. Include in agent briefs.
usage: Read this file BEFORE writing any service, route, or financial component.
---

# Critical Patterns

Canonical patterns extracted from 50 P1 findings across 6 sprints. Each pattern has appeared in 3+ separate reviews. **If you're writing code that touches any of these categories, use the pattern exactly as shown.**

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
const { count } = await db.from('members')
  .select('id', { count: 'exact', head: true })
  .eq('group_id', groupId);

// Over cap? Rollback the insert
if ((count ?? 0) > maxMembers) {
  await db.from('members').delete()
    .eq('group_id', groupId).eq('user_id', userId);
  throw new ConflictError('Group is full');
}
```

### 1b. Accept-Then-Verify-or-Revert (status transition + capacity)

Use when a status transition must also respect a concurrent aggregate cap.

```typescript
// Atomic status guard — only one concurrent caller wins
await db.from('requests').update({ status: 'active' })
  .eq('id', requestId).eq('status', 'pending');

// Verify capacity post-transition
const { count } = await db.from('requests')
  .select('id', { count: 'exact', head: true })
  .eq('owner_id', ownerId).eq('status', 'active');

if ((count ?? 0) > maxCapacity) {
  // Revert
  await db.from('requests').update({ status: 'pending' })
    .eq('id', requestId).eq('status', 'active');
  throw new ConflictError('Capacity exceeded');
}
```

### 1c. Atomic Claim (scarce resource)

Use when exactly one writer must win (tickets, slots, listings).

```typescript
// UPDATE WHERE active=true — exactly one concurrent caller succeeds
const { data: claimed } = await db.from('listings')
  .update({ active: false })
  .eq('id', listingId).eq('active', true)
  .select('id');

if (!claimed?.length) throw new ConflictError('Already claimed');

try {
  // All post-claim work in try/catch
  await createOrder(listingId);
} catch (err) {
  // Rollback: re-activate so resource isn't permanently locked
  await db.from('listings').update({ active: true })
    .eq('id', listingId).eq('active', false);
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
let total = 0, offset = 0, hasMore = true;

while (hasMore) {
  const { data } = await db.from('entries')
    .select('amount')
    .eq('owner_id', ownerId)
    .gte('created_at', startDate).lte('created_at', endDate)
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
  p_name: name, p_creator_id: creatorId
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
try { await atomicWrite(path, data); }
finally { this.writeLock = false; }
```

### 5c. Persist-Then-Mutate (never lose state)
```typescript
await persistToStorage(data);   // Step 1: durable write
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

## 6. SSRF Validation (4 P1s in security sprints)

**The problem:** User-supplied URLs fetched server-side without validating the resolved IP.

**Rule:** Always resolve DNS and check the IP, not just the hostname string.

```typescript
import { isIP } from 'net';
import dns from 'dns/promises';

async function validateUrl(url: string): Promise<URL> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('HTTPS required');

  // Resolve DNS to catch rebinding attacks
  const { address } = await dns.lookup(parsed.hostname);

  // Block private/loopback ranges
  const blocked = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|::1|fc|fd)/;
  if (blocked.test(address)) throw new Error('Private IP blocked');

  // Block decimal-encoded IPs (2130706433 = 127.0.0.1)
  if (/^\d+$/.test(parsed.hostname)) throw new Error('Numeric IP blocked');

  return parsed;
}
```

**Detection:** Grep for `fetch(`, `axios(`, `http.get(` where the URL comes from user input without passing through `validateUrl` or `validateSsrfUrl`.

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

**Detection:** Grep for `.delete()` without a preceding status check in the same function.

---

## Quick Reference Table

| Pattern | When to Use | Key Guard | HTTP Error |
|---------|-------------|-----------|------------|
| Insert-then-verify | Aggregate caps | Count after insert | 409 |
| Accept-then-revert | Status + capacity | Count after transition | 409 |
| Atomic claim | Scarce resources | `UPDATE WHERE active=true` | 409 |
| Service-layer auth | All data access | Membership/ownership query | 403 |
| Paginated accumulation | Any unbounded SELECT | `PAGE_SIZE=500` + while loop | N/A |
| Atomic multi-table | 2+ table writes | RPC or compensating tx | 500 |
| SSRF validation | User-supplied URLs | DNS resolve + IP check | 400 |
| Status guard | DELETE/void/cancel | Assert status before write | 409 |

---

## How to Use This File

1. **In agent briefs:** Add `"Read docs/solutions/patterns/critical-patterns.md before writing code"` to the CONTEXT TO LOAD section.
2. **In code review:** Check each finding against this file. If the fix doesn't match the canonical pattern, flag it.
3. **In pre-commit:** The patterns here inform what automated checks should catch.
