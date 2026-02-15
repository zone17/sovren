# P1 Remediation Plan: 7 Critical Findings from Post-Remediation Review

**Date**: 2026-02-12
**Context**: Post-remediation review of PR #73 found 7 new P1 critical issues
**Scope**: Backend middleware, health checks, Redis clients, credential rotation scripts, CORS config, type safety
**Prior art**: [PR #73 Remediation](../solutions/security-issues/pr73-code-review-remediation.md)

---

## Implementation Order

Fixes are ordered by dependency and risk. Lower numbers should be implemented first.

| Order | Finding | Risk if Deferred                          | Dependency                                       |
| ----- | ------- | ----------------------------------------- | ------------------------------------------------ |
| 1     | P1-043  | Low (dead code + type erosion)            | None                                             |
| 2     | P1-041  | Medium (clients can't read rate limits)   | None                                             |
| 3     | P1-037  | High (all metrics useless)                | None                                             |
| 4     | P1-038  | High (health probe hangs, WS leak)        | None                                             |
| 5     | P1-039  | High (5 Redis clients, inconsistent auth) | P1-038 must land first (health.ts Redis changes) |
| 6     | P1-040  | Medium (race on credential rotation)      | None                                             |
| 7     | P1-042  | High (fake encryption shipped)            | None                                             |

---

## Fix 1: P1-043 — Unsafe Type Casts

### File 1: `packages/backend/src/config/database-pool.config.ts`

**Current state (line 247):**

```typescript
const validated = PoolConfigSchema.parse(mergedConfig);
return validated as DatabasePoolConfig;
```

Zod validates against `PoolConfigSchema` (producing `ValidatedPoolConfig`) but the return type is cast to `DatabasePoolConfig` (which extends `pg.PoolConfig`). These are structurally different type hierarchies.

**Investigation result**: This file is **dead code** -- no module in the codebase imports from `database-pool.config.ts`. The only grep match is its own internal import of `DatabasePoolConfig` from `../database/pool`. The actual pool creation is handled directly in `packages/backend/src/database/pool.ts:434` (`createDatabasePool`).

**Fix**: Delete the entire file `packages/backend/src/config/database-pool.config.ts` (350 lines). It is unused dead code. Verify with `grep -r "database-pool.config" packages/backend/src/` that nothing imports it.

**Risk**: Extremely low. No consumers exist.

### File 2: `packages/backend/src/types/express.d.ts` (line 5)

**Current state:**

```typescript
user?: { nostr_pubkey: string; [key: string]: unknown };
```

The `[key: string]: unknown` index signature allows arbitrary property access on `req.user` without type errors across all middleware, effectively disabling TypeScript's type checking for this critical auth object.

**Fix**: Define a named `AuthenticatedUser` interface with explicit properties and remove the index signature.

```typescript
declare global {
  namespace Express {
    interface AuthenticatedUser {
      nostr_pubkey: string;
    }

    interface Request {
      rawBody?: Buffer;
      user?: AuthenticatedUser;
    }
  }
}

export {};
```

**Risk**: Low. If any middleware accesses `req.user.someProperty` that is not `nostr_pubkey`, TypeScript will flag it -- which is the desired behavior. The implementer should grep for `req.user` usages and add any legitimately needed properties to `AuthenticatedUser`.

**Pre-implementation check**: Run `grep -rn "req\.user\." packages/backend/src/ --include="*.ts"` to find all property accesses on `req.user` and ensure they are covered.

---

## Fix 2: P1-041 — CORS Wrong Rate-Limit Headers

### File: `packages/backend/src/app.ts` (line 87)

**Current state:**

```typescript
exposedHeaders: ['X-CSRF-Token', 'X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
```

**Bug**: The rate limiter at `packages/backend/src/middleware/rate-limit-middleware.ts` uses:

```typescript
standardHeaders: true,   // line 32 — sends IETF RateLimit-* headers
legacyHeaders: false,    // line 33 — disables X-RateLimit-* headers
```

So the actual response headers are `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (IETF standard, no `X-` prefix) but CORS `exposedHeaders` lists the `X-` prefixed versions. Browsers cannot read the actual rate-limit headers.

**Fix**: Replace the `X-RateLimit-*` entries with IETF standard names and add `RateLimit-Policy`.

```typescript
exposedHeaders: [
  'X-CSRF-Token',
  'X-Correlation-ID',
  'RateLimit-Limit',
  'RateLimit-Remaining',
  'RateLimit-Reset',
  'RateLimit-Policy',
  'Retry-After',
],
```

**Risk**: Extremely low. This is a config-only change. No frontend code can currently read these headers (the bug), so switching to correct names is purely additive.

---

## Fix 3: P1-037 — Route Metrics Always `/unmatched`

### File: `packages/backend/src/middleware/deployment-monitoring.ts` (lines 134-160)

**Current state:**

```typescript
export function deploymentMonitoring(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/metrics') {
    next();
    return;
  }

  const route = req.route?.path ? normalizeRoute(req.route.path) : '/unmatched'; // line 141
  const end = httpRequestDuration.startTimer({ method: req.method, route }); // line 142

  // ...
  res.on('finish', () => {
    const labels = { method: req.method, route, status_code: statusCode }; // line 148 — uses captured `route`
    // ...
  });
  next();
}
```

**Bug**: `req.route` is populated by Express **after** route matching. This middleware runs before route handlers (via `app.use(deploymentMonitoring)` at line 145 of `app.ts`), so `req.route` is always `undefined` when line 141 executes. Every single metric gets labeled `/unmatched`, making the entire Prometheus dashboard useless.

**Fix**: Move the route label resolution into the `res.on('finish')` callback, where `req.route` is populated. The timer must still start immediately (for accurate duration), but labels can be added at observation time.

```typescript
export function deploymentMonitoring(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/metrics') {
    next();
    return;
  }

  const end = httpRequestDuration.startTimer();

  httpActiveConnections.inc();

  res.on('finish', () => {
    const route = req.route?.path
      ? normalizeRoute(req.route.path)
      : normalizeRoute(req.originalUrl);
    const statusCode = res.statusCode.toString();
    const labels = { method: req.method, route, status_code: statusCode };

    end(labels);
    httpRequestsTotal.inc(labels);
    httpActiveConnections.dec();

    if (res.statusCode >= 400) {
      httpRequestErrors.inc(labels);
    }
  });

  next();
}
```

Key changes:

1. `startTimer()` called with no labels (labels applied at `end(labels)`)
2. Route resolved inside `res.on('finish')` where `req.route` exists
3. Fallback uses `normalizeRoute(req.originalUrl)` instead of hard-coded `/unmatched` -- this still normalizes UUIDs/IDs but preserves the route shape

**Risk**: Low. `prom-client`'s `startTimer()` returns a function that accepts labels at observation time -- this is the documented pattern. The `normalizeRoute` function already handles high-cardinality prevention.

---

## Fix 4: P1-038 — Health Check DB Timeout + Nostr WebSocket Leak

### File: `packages/backend/src/routes/health.ts`

#### Bug 1: No timeout on `checkDatabase()` (lines 183-219)

**Current state**: The Supabase query at line 189 has no timeout. If the database hangs, the health probe never responds, Kubernetes marks the pod as unhealthy, and cascading restarts begin.

**Fix**: Wrap the Supabase query in `Promise.race` with a 5-second timeout.

```typescript
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();
  const TIMEOUT_MS = 5000;

  try {
    const supabase = getSupabaseClient();

    const queryPromise = supabase.from('health_check').select('id').limit(1);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database health check timed out')), TIMEOUT_MS)
    );

    const { error } = await Promise.race([queryPromise, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }

    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: {
        connectionCount: 1,
        responseTime: `${responseTime}ms`,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}
```

#### Bug 2: WebSocket leak in `checkNostr()` (lines 297-353)

**Current state**: Line 314 creates `const ws = new WebSocket(relay)`. The `ws.onopen` handler at line 323 calls `ws.close()` before resolving. However, if the promise resolves via the timeout path (line 318), `ws.close()` is called, but if the `onerror` handler fires (line 328), the WebSocket is never explicitly closed -- the `reject` fires but `ws` may still be in CONNECTING state.

Actually, looking more carefully: the timeout handler does call `ws.close()`. And `ws.onopen` does call `ws.close()`. But `ws.onerror` does NOT call `ws.close()`. If the error fires after the timeout already closed it, that's fine. But if the error fires before timeout, the socket is left open.

**Fix**: Ensure `ws.close()` is called in all paths. Add a `finally`-style cleanup.

```typescript
async function checkNostr(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const relays = (process.env.NOSTR_RELAYS || '').split(',').filter(Boolean);

    if (relays.length === 0) {
      return {
        status: 'degraded',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
        error: 'No NOSTR relays configured',
      };
    }

    const relay = relays[0];
    const ws = new WebSocket(relay);

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          resolve(void 0);
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    } finally {
      ws.close();
    }

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 3000 ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: {
        relaysConfigured: relays.length,
        responseTime: `${responseTime}ms`,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'NOSTR relay connection failed',
    };
  }
}
```

Key change: The WebSocket promise is wrapped in `try/finally` so `ws.close()` always runs regardless of resolve/reject path. Removed the redundant `ws.close()` from `onopen` and timeout since `finally` handles it.

**Risk**: Low. The existing `checkNostr` already has a 5s timeout; we're just ensuring cleanup. The DB timeout is a new constraint but 5s is generous for a health-check query.

---

## Fix 5: P1-039 — Redis Client Sprawl (5 Independent Singletons)

### Current State

5 separate Redis instantiations with inconsistent configuration:

| Location                       | Config                                | Auth              | Error Handler          | Retry                           |
| ------------------------------ | ------------------------------------- | ----------------- | ---------------------- | ------------------------------- |
| `health.ts:15`                 | `REDIS_URL` env                       | Via URL only      | None                   | None                            |
| `rate-limit-middleware.ts:150` | `REDIS_URL` env                       | Via URL only      | Yes (console.error)    | `times * 200, max 3000`         |
| `bootstrap.ts:260`             | `REDIS_HOST/PORT/PASSWORD`            | Explicit password | None                   | `times * 50, max 2000`          |
| `RedisAdapter.ts:174`          | `REDIS_HOST/PORT/PASSWORD/DB`         | Explicit password | Yes (activateFallback) | `times * retryDelay, max 10000` |
| `CacheService.ts:48`           | Passed via `CacheConfiguration.redis` | Depends on config | None                   | None                            |

Additionally, several services import from `../config/redis` (`RedisClient`) but **this file does not exist** -- meaning those services cannot compile as-is.

### Fix: Create `packages/backend/src/lib/redis.ts`

Create a shared Redis factory module that all consumers import from.

```typescript
/**
 * Shared Redis client factory
 * Single source of truth for Redis connection configuration.
 */
import Redis from 'ioredis';

let sharedClient: Redis | null = null;

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

function getConfig(): RedisConfig {
  return {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };
}

/**
 * Get the shared Redis client singleton.
 * Creates client on first call with unified config.
 */
export function getRedisClient(): Redis {
  if (sharedClient) return sharedClient;

  const config = getConfig();

  if (config.url) {
    sharedClient = new Redis(config.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    });
  } else {
    sharedClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    });
  }

  sharedClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  return sharedClient;
}

/**
 * Disconnect the shared Redis client. Call during graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (sharedClient) {
    await sharedClient.quit();
    sharedClient = null;
  }
}
```

### Migration for each consumer

1. **`health.ts` (line 13-18)**: Delete `getRedisClient()` function and the `singletonRedis` variable. Import from `../../lib/redis` instead.

   ```typescript
   import { getRedisClient } from '../lib/redis';
   // Delete lines 10, 11, 13-18 (the local getRedisClient and singletonRedis)
   ```

2. **`rate-limit-middleware.ts` (lines 145-163)**: Delete local `redisClient` variable and `getRedisClient()` function. Import from shared module.

   ```typescript
   import { getRedisClient as getSharedRedisClient } from '../lib/redis';
   // In createRedisRateLimiter:
   const client = getSharedRedisClient();
   ```

3. **`bootstrap.ts` (lines 256-269)**: Replace inline Redis construction with import.

   ```typescript
   import { getRedisClient } from '../lib/redis';
   // In registerInfrastructureServices, TYPES.Redis factory:
   registry.registerSingletonFactory(TYPES.Redis, () => getRedisClient());
   ```

4. **`RedisAdapter.ts`**: This is a specialized cache adapter with cluster support and memory fallback. It should keep its own client management but use the shared config. For now, leave `RedisAdapter` as-is since it serves a different purpose (NOSTR caching with fallback). Flag for future unification.

5. **`CacheService.ts`**: The `RedisCacheProvider` creates its own client from passed config. Since `CacheService` is DI-managed and gets its config from the container, this is acceptable. No change needed here.

### Dependency: P1-038 must land first

The `health.ts` changes from P1-038 (adding timeout + fixing WebSocket) modify the same file. P1-039's health.ts changes (removing local Redis client) should be applied after P1-038.

**Risk**: Medium. Multiple consumers need updating simultaneously. Test each consumer after migration. The `lazyConnect: true` option prevents connection at import time, which is safer for tests.

---

## Fix 6: P1-040 — Credential Rotation Race Condition

### File: `scripts/automated-supabase-rotation.ts`

**Current state (lines 73-89, the critical sequence):**

```
Step 5: updateSupabasePasswordWithRetry(newPassword)  — DB password changes
Step 6: updateAWSSecretsAtomically(newPassword)        — AWS gets new password
Step 7: verifyConnectionComprehensive(newPassword)     — Test connection
Step 8: refreshConnectionPools(newPassword)            — Refresh app pools
```

**Bug**: If the process crashes between Step 5 (DB password changed) and Step 6 (AWS updated), all services using the AWS-sourced password will fail. The `updateAWSSecretsAtomically` method name is misleading -- it's not atomic with Step 5.

**Existing mitigation**: The `catch` block (lines 119-146) does attempt rollback via `rollbackCredentials(currentPassword)`, which reverses the DB password. This is a reasonable safety net, but it doesn't protect against:

- Process killed (SIGKILL) between steps
- Network partition where AWS is unreachable but DB change succeeded
- Concurrent runs of the rotation script

### Fix: Three changes

#### Change 1: Lockfile guard (prevent concurrent runs)

Add at the beginning of `rotateCredentials()`:

```typescript
private readonly lockFilePath = path.join(__dirname, '../.credentials-backup/rotation.lock');

async rotateCredentials(): Promise<RotationResult> {
  // Prevent concurrent rotation runs
  if (fs.existsSync(this.lockFilePath)) {
    const lockContent = fs.readFileSync(this.lockFilePath, 'utf8');
    const lockTime = new Date(lockContent).getTime();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    if (Date.now() - lockTime < staleThreshold) {
      throw new Error(`Rotation already in progress (locked at ${lockContent}). Remove ${this.lockFilePath} if stale.`);
    }
    console.warn('Stale lock detected, overriding...');
  }

  fs.writeFileSync(this.lockFilePath, new Date().toISOString(), { mode: 0o600 });

  try {
    // ... existing rotation logic ...
  } finally {
    // Always remove lock
    try { fs.unlinkSync(this.lockFilePath); } catch {}
  }
}
```

#### Change 2: Write-ahead to AWS before DB change

Reorder steps 5-6 to a safer sequence:

```
Step 5a: Write new password to AWS as AWSPENDING stage
Step 5b: Update Supabase DB password
Step 5c: Promote AWSPENDING to AWSCURRENT in AWS
```

If crash happens after 5a but before 5b: DB still has old password, AWS AWSCURRENT still has old password. No harm.
If crash happens after 5b but before 5c: DB has new password, AWS AWSCURRENT has old password BUT AWSPENDING has new password. Recovery: promote AWSPENDING.

New method:

```typescript
private async rotatePasswordSafely(newPassword: string): Promise<void> {
  // Step 5a: Stage new password in AWS (AWSPENDING)
  await this.stageAWSSecret(newPassword);
  console.log('  AWS AWSPENDING staged');

  // Step 5b: Update Supabase DB password
  await this.updateSupabasePasswordWithRetry(newPassword);
  console.log('  Supabase password updated');

  // Step 5c: Promote AWSPENDING to AWSCURRENT
  await this.promoteAWSSecret();
  console.log('  AWS AWSCURRENT promoted');
}

private async stageAWSSecret(newPassword: string): Promise<void> {
  const currentSecret = await this.getAWSSecret();
  const stagedSecret = {
    ...currentSecret,
    password: newPassword,
    lastRotated: new Date().toISOString(),
    version: (currentSecret.version || 0) + 1,
  };

  execSync(
    `aws secretsmanager put-secret-value --secret-id ${this.secretName} --secret-string '${JSON.stringify(stagedSecret)}' --version-stage AWSPENDING --region ${this.awsRegion}`,
    { encoding: 'utf8', stdio: 'pipe' }
  );
}

private async promoteAWSSecret(): Promise<void> {
  // Get the version ID of AWSPENDING and promote it
  const result = execSync(
    `aws secretsmanager describe-secret --secret-id ${this.secretName} --region ${this.awsRegion}`,
    { encoding: 'utf8', stdio: 'pipe' }
  );
  const secret = JSON.parse(result);
  const versions = secret.VersionIdsToStages || {};

  let pendingVersionId: string | null = null;
  for (const [versionId, stages] of Object.entries(versions)) {
    if ((stages as string[]).includes('AWSPENDING')) {
      pendingVersionId = versionId;
      break;
    }
  }

  if (!pendingVersionId) {
    throw new Error('No AWSPENDING version found to promote');
  }

  execSync(
    `aws secretsmanager update-secret-version-stage --secret-id ${this.secretName} --version-stage AWSCURRENT --move-to-version-id ${pendingVersionId} --remove-from-version-id AWSPREVIOUS --region ${this.awsRegion}`,
    { stdio: 'pipe' }
  );
}
```

#### Change 3: Enhanced rollback

Update `rollbackCredentials` to handle the case where AWSPENDING exists:

```typescript
private async rollbackCredentials(previousPassword: string): Promise<void> {
  try {
    // Rollback Supabase password first (most critical)
    await this.updateSupabasePassword(previousPassword);
    console.log('  DB password rolled back');

    // Clean up any AWSPENDING stage
    try {
      const result = execSync(
        `aws secretsmanager describe-secret --secret-id ${this.secretName} --region ${this.awsRegion}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      const secret = JSON.parse(result);
      // Remove AWSPENDING if it exists
      // (AWS automatically handles this when we don't promote)
    } catch {
      // AWS cleanup is best-effort
    }

    await this.refreshConnectionPools(previousPassword);
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}
```

**Risk**: Medium. The reordering changes the rotation sequence, which needs thorough testing. The lockfile prevents the most common race (cron overlap). The write-ahead pattern is the AWS Secrets Manager recommended approach.

---

## Fix 7: P1-042 — Broken `encryptSecret` (base64 != encryption)

### File: `scripts/automated-github-token-rotation.ts` (lines 303-313)

**Current state:**

```typescript
private encryptSecret(secret: string, publicKey: string): string {
  // Use libsodium for encryption (GitHub's requirement)
  // For Node.js, we'll use a simpler approach with base64
  // In production, use @octokit/core or sodium-native
  const messageBytes = Buffer.from(secret);
  const keyBytes = Buffer.from(publicKey, 'base64');

  // This is a simplified version - use proper sodium encryption in production
  // For now, return base64 encoded secret (GitHub will handle actual encryption)
  return Buffer.from(secret).toString('base64');
}
```

**Bug**: This sends a base64-encoded (not encrypted) secret to the GitHub API. GitHub's API requires sealed-box encryption using the repository's public key. The comment says "simplified version" but this is production code that will fail because GitHub rejects unencrypted values.

### Fix Option A: Use `gh secret set` CLI (simpler, recommended)

Replace the manual API approach entirely. The `gh secret set` command handles encryption internally. The class already has a method `updateGitHubSecrets` (line 536) that uses `gh secret set` but it's not called -- `updateGitHubSecretsAtomically` (line 276) uses the broken manual path instead.

**Fix**: Replace `updateGitHubSecretsAtomically` to use `gh secret set`:

```typescript
private async updateGitHubSecretsAtomically(newToken: string): Promise<void> {
  const secretNames = ['GITHUB_TOKEN'];

  for (const secretName of secretNames) {
    try {
      execFileSync('gh', [
        'secret', 'set', secretName,
        '--repo', `${this.repoOwner}/${this.repoName}`,
        '--body', newToken,
      ], {
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Failed to update GitHub Actions secret ${secretName}: ${error}`);
    }
  }
}
```

Also delete the `encryptSecret` method entirely since it's no longer needed.

Note: Use `execFileSync` (not `execSync`) per the P1-021 fix from the previous remediation to prevent shell injection. Pass the token via `--body` flag rather than stdin to avoid pipe complexity.

### Fix Option B: Use `libsodium-wrappers` (if `gh` CLI is not available in CI)

If the rotation runs in an environment without `gh` CLI, implement proper sealed-box encryption:

```typescript
import sodium from 'libsodium-wrappers';

private async encryptSecret(secret: string, publicKey: string): Promise<string> {
  await sodium.ready;

  const messageBytes = sodium.from_string(secret);
  const keyBytes = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);

  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}
```

This requires adding `libsodium-wrappers` as a dependency: `npm install libsodium-wrappers` and `npm install -D @types/libsodium-wrappers`.

**Recommendation**: Use Option A (`gh secret set`). It's simpler, has zero new dependencies, and matches the existing `updateGitHubSecrets` method pattern already in the file. Only use Option B if `gh` CLI is confirmed unavailable in the CI environment.

**Risk**: Medium for Option A (behavioral change in how secrets are set), Low for Option B (correct crypto implementation). Either way, the current code is completely broken, so any fix is strictly better.

---

## Summary Table

| Finding | File(s)                                      | Change Type               | Lines Changed (est.) | New Dependencies |
| ------- | -------------------------------------------- | ------------------------- | -------------------- | ---------------- |
| P1-043a | `config/database-pool.config.ts`             | Delete file               | -350                 | None             |
| P1-043b | `types/express.d.ts`                         | Edit interface            | ~5                   | None             |
| P1-041  | `app.ts`                                     | Edit CORS config          | ~3                   | None             |
| P1-037  | `middleware/deployment-monitoring.ts`        | Refactor middleware       | ~15                  | None             |
| P1-038  | `routes/health.ts`                           | Add timeout + fix cleanup | ~20                  | None             |
| P1-039  | New `lib/redis.ts` + 3 consumers             | Create + edit             | ~80 new, ~30 deleted | None             |
| P1-040  | `scripts/automated-supabase-rotation.ts`     | Add lockfile + reorder    | ~80                  | None             |
| P1-042  | `scripts/automated-github-token-rotation.ts` | Replace encryption        | ~15                  | None (Option A)  |

**Total estimated changes**: ~250 lines changed, 350 lines deleted (dead code)

---

## Pre-Implementation Checklist

- [ ] `grep -rn "req\.user\." packages/backend/src/ --include="*.ts"` — catalog all `req.user` property accesses for P1-043b
- [ ] `grep -r "database-pool.config" packages/backend/` — confirm zero imports for P1-043a deletion
- [ ] `grep -r "from.*config/redis" packages/backend/src/` — catalog all consumers of missing `config/redis` module for P1-039
- [ ] Verify `gh` CLI is available in the CI environment for P1-042 Option A
- [ ] Check if `prom-client` `startTimer()` supports deferred labels (it does per docs, but verify version)

## Post-Implementation Verification

- [ ] `npm run type-check` passes (catches P1-043 regressions)
- [ ] `npm test` passes
- [ ] Start dev server and hit an API endpoint; verify Prometheus `/metrics` shows actual route paths (not `/unmatched`)
- [ ] Hit an API endpoint past rate limit; verify browser can read `RateLimit-*` headers via CORS
- [ ] `/health/detailed` endpoint responds within 6s even if DB is unreachable
- [ ] Run `scripts/automated-github-token-rotation.ts` in dry-run mode to verify `gh secret set` works
