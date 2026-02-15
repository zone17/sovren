---
status: pending
priority: p1
issue_id: 003
tags: [code-review, security]
dependencies: []
---

# Shell Injection in Credential Rotation Script

## Problem Statement

Shell injection in credential rotation script via execSync with string interpolation of secretValue (which contains passwords) at lines 275-279.

## Findings

Security-sentinel found execSync with template literal string building. Passwords from generateSecurePassword() include single-quote chars in charset. A password with ' breaks shell quoting and enables arbitrary command execution. OWASP A03:2021 Injection.

## Proposed Solutions

### Option A: AWS SDK Integration

Replace execSync shell commands with AWS SDK (@aws-sdk/client-secrets-manager).

**Pros:** Eliminates shell injection surface, type-safe API, better error handling, no shell dependency
**Cons:** Requires new dependency, more code changes
**Effort:** Medium
**Risk:** Low

### Option B: execFile with Argument Array

Use execFile() with argument array instead of execSync with string concatenation.

**Pros:** Quick fix, minimal dependencies, still uses AWS CLI
**Cons:** Shell still in execution path, harder to validate all edge cases
**Effort:** Small
**Risk:** Medium

## Technical Details

**Affected Files:** scripts/rotate-database-credentials.ts (lines 275-279)

## Acceptance Criteria

- [ ] No shell command construction with user/secret data
- [ ] All AWS operations use SDK or execFile with arg arrays
- [ ] Password characters including quotes and special chars are handled safely
- [ ] Security testing confirms command injection payloads are blocked

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
