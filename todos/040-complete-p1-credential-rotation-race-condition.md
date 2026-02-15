---
status: pending
priority: p1
issue_id: '040'
tags: [code-review, security, data-integrity, credential-rotation]
dependencies: []
---

# Credential Rotation Race Condition

## Problem Statement

The rotation script changes the database password THEN updates AWS Secrets Manager. A crash between these steps leaves the system in an inconsistent state where all services fail. Additionally, the "zero-downtime" dual password support is not implemented (just a no-op placeholder), and the AWS secrets update function has a shell injection vulnerability.

## Findings

**Location**: `/Users/fp/Desktop/Sovren/packages/backend/scripts/automated-supabase-rotation.ts:74-98, 280, 312`

**Found by**: Data Integrity Guardian

**Issue 1 - Race Condition**:
Current order of operations:

1. Generate new password
2. **Change password in Supabase** ← Point of no return
3. Update AWS Secrets Manager ← Crash here = all services fail
4. Verify connectivity

If the process crashes or is killed between steps 2 and 3:

- Database has new password
- AWS Secrets Manager has old password
- All services read old password from Secrets Manager
- All database connections fail
- Manual intervention required to recover

**Issue 2 - Fake Dual Password Support**:

```typescript
async prepareDualPasswordSupport(oldPassword: string, newPassword: string) {
  // TODO: Implement actual dual password support
  // This is a no-op placeholder
  logger.info('Dual password support not yet implemented');
}
```

The script claims "zero-downtime rotation" but the mechanism doesn't exist. Services cannot authenticate during the rotation window.

**Issue 3 - Shell Injection**:

```typescript
async updateAWSSecretsAtomically(secrets: Record<string, string>) {
  const json = JSON.stringify(secrets);
  // secrets contains password - passed to shell
  execSync(`aws secretsmanager update-secret --secret-string '${json}'`);
}
```

If a password contains single quotes or other shell metacharacters, this can break or allow command injection.

## Proposed Solutions

### Option 1: AWS-First with Dual Password (Recommended)

1. Update AWS Secrets Manager with BOTH old and new passwords
2. Wait for services to reload config (or send SIGHUP)
3. Change Supabase password to new value
4. Verify connectivity with new password
5. Remove old password from AWS Secrets Manager

**Pros**:

- No inconsistent state possible
- Services can authenticate during entire process
- Crash at any point is recoverable
- True zero-downtime

**Cons**:

- Requires implementing dual password support in services
- More complex state machine
- Longer rotation process

**Implementation**:

```typescript
// Phase 1: Prepare
await updateAWS({ old: currentPassword, new: generatedPassword });
await notifyServicesToReload();
await waitForReloadConfirmation();

// Phase 2: Switch
await changeSupabasePassword(generatedPassword);
await verifyConnectivity(generatedPassword);

// Phase 3: Cleanup
await updateAWS({ current: generatedPassword });
```

### Option 2: Transaction-Style with Rollback

Wrap rotation in a transaction abstraction that can roll back on failure.

**Pros**:

- Clear failure semantics
- Automated recovery

**Cons**:

- Can't actually make AWS + Supabase atomic
- Rollback still has race conditions
- Doesn't solve shell injection

### Option 3: Pre-Stage Secrets Then Activate

Write new secret to a different key, then atomically rename.

**Pros**:

- Atomic from service perspective

**Cons**:

- Requires services to know about rotation keys
- More complex configuration
- Still has dual password timing issue

## Technical Details

**Root cause - Race Condition**:
No atomic transaction boundary across two systems (Supabase and AWS). Current implementation optimizes for code simplicity over correctness.

**Root cause - Dual Password**:
Feature was planned but never implemented. Script was merged with TODO comments.

**Root cause - Shell Injection**:
Using `execSync` with string interpolation instead of AWS SDK.

**Failure scenario timeline**:

```
T+0s:  Generate new password: "n3wP@ss"
T+1s:  Change Supabase password to "n3wP@ss" ✓
T+2s:  [SIGTERM received - Kubernetes pod eviction]
T+3s:  Process killed

State:
  Supabase password: "n3wP@ss"
  AWS Secrets Manager: "oldP@ss"
  All services: Cannot connect to database
  Recovery: Manual password reset or AWS secret update
```

**Impact**:

- Production database inaccessible during rotation failure
- Requires manual intervention
- Can't be safely automated in CI/CD
- Mean time to recovery: 15-30 minutes (human escalation + AWS console access)

## Acceptance Criteria

- [ ] AWS Secrets Manager updated BEFORE database password change
- [ ] Dual password support actually implemented (services accept both passwords)
- [ ] Verification step uses new password only
- [ ] Crash at any point leaves system in recoverable state
- [ ] Remove shell command execution - use AWS SDK directly
- [ ] Rollback procedure documented for each phase
- [ ] Integration test simulates crash between each step
- [ ] Load test verifies zero-downtime (no 500s during rotation)
- [ ] Remove or implement TODOs in `prepareDualPasswordSupport`

## Work Log

_No work logged yet_

## Resources

- AWS Secrets Manager rotation best practices: https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html
- Postgres password authentication: https://www.postgresql.org/docs/current/auth-password.html
- AWS SDK for JavaScript: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-secrets-manager/
- Related file: `/Users/fp/Desktop/Sovren/scripts/automated-supabase-rotation.ts`
