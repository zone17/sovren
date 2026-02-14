---
status: pending
priority: p1
issue_id: '021'
tags: [code-review, security, injection]
dependencies: []
---

# Command Injection in Supabase Password Rotation

## Problem Statement

`automated-supabase-rotation-vault.ts:503-508` interpolates a generated password directly into a shell command via `execSync`. The password charset includes shell metacharacters (`$`, `()`, `;`, `|`, backticks) that will be interpreted by the shell.

```typescript
execSync(`supabase db password update --password "${newPassword}"`, { stdio: 'pipe' });
```

Double-quote escaping does NOT protect against `$()` or backtick expansion.

## Findings

- **security-sentinel**: HIGH-06
- **data-integrity-guardian**: HIGH - shell injection in rotation scripts

## Proposed Solutions

### Option A: Use execFileSync (Recommended)

Replace `execSync` with `execFileSync` to avoid shell interpretation:

```typescript
import { execFileSync } from 'child_process';
execFileSync('supabase', ['db', 'password', 'update', '--password', newPassword], {
  stdio: 'pipe',
});
```

- **Effort**: Small | **Risk**: Low

### Option B: Escape the password

Use `shell-escape` or similar library. Less safe than Option A.

## Acceptance Criteria

- [ ] No `execSync` calls with string interpolation of secrets
- [ ] Password with `$(whoami)` does NOT execute the command
