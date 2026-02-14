---
status: pending
priority: p2
issue_id: '046'
tags: [code-review, security, shell-injection]
dependencies: []
---

# Shell Injection Remaining execSync Calls

## Problem Statement

While the main Supabase CLI call was fixed to use `execFileSync`, multiple other `execSync` calls remain in the codebase that use shell interpolation with user-controlled or external data. These calls are vulnerable to command injection attacks. Four or more instances exist in automated rotation scripts handling AWS secrets manager calls, pool script execution, and GitHub issue creation.

## Findings

**Location**:

- `scripts/automated-supabase-rotation.ts:312,377,494,635`
- `scripts/automated-github-token-rotation.ts`

**Vulnerable Patterns**:

1. **AWS Secrets Manager calls** (lines 312, 494-495):

   - Shell interpolation of secret names and values
   - Potential command injection via secret metadata

2. **Pool script execution** (line 377):

   - User-controlled data in shell command
   - No argument escaping

3. **GitHub issue creation** (lines 635-636):

   - Issue title/body interpolated into shell command
   - Markdown content not escaped for shell

4. **GitHub token rotation script**:
   - Similar patterns to Supabase rotation
   - Token metadata in shell commands

## Proposed Solutions

1. **Replace execSync with execFileSync** (Recommended):

   - Convert all `execSync` calls to `execFileSync`
   - Pass arguments as array instead of shell string
   - Remove shell interpolation entirely

2. **Use SDK/API calls instead of CLI**:

   - AWS SDK for secrets manager operations
   - Octokit for GitHub API calls
   - Eliminate shell execution where possible

3. **Shell escaping** (Not recommended - last resort):
   - Use shellEscape library for argument escaping
   - Still vulnerable to escaping bugs
   - Harder to maintain and audit

## Technical Details

**Example Vulnerable Code**:

```typescript
// UNSAFE - shell injection
execSync(`aws secretsmanager get-secret-value --secret-id ${secretName}`);

// SAFE - no shell
execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', secretName]);
```

**Affected Operations**:

- AWS Secrets Manager: get-secret-value, put-secret-value, update-secret
- Pool script execution: custom pool management scripts
- GitHub API: issue creation via gh CLI
- Token rotation workflows

**Files Requiring Changes**:

- `scripts/automated-supabase-rotation.ts`
- `scripts/automated-github-token-rotation.ts`
- Any other scripts using `execSync`

## Acceptance Criteria

- [ ] All `execSync` calls replaced with `execFileSync` or SDK calls
- [ ] Arguments passed as arrays, not shell strings
- [ ] No shell interpolation of external/user data
- [ ] AWS operations use AWS SDK instead of CLI where possible
- [ ] GitHub operations use Octokit instead of gh CLI where possible
- [ ] Security audit confirms no remaining shell injection vectors
- [ ] Unit tests verify safe command execution
- [ ] Integration tests confirm functionality unchanged
- [ ] Code review by security team

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- Node.js child_process documentation
- OWASP Command Injection guidelines
- AWS SDK for JavaScript documentation
- Octokit documentation
