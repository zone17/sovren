# Hotfix Procedure

Emergency fix path for production-critical issues.

## When to Use

Use the hotfix lane when ALL of these are true:

- Production is impacted (users affected, data at risk, security vulnerability)
- The fix cannot wait for merge queue serialization (typically <1 hour)
- A standard PR + merge queue would take too long

## Steps

### 1. Create the Branch

```bash
git checkout main
git pull origin main
git checkout -b hotfix/SOV-999-critical-auth-bypass
```

### 2. Implement the Fix

- Minimal change — fix only the production issue
- Include a test that reproduces the bug
- Do not refactor surrounding code

### 3. Open PR

```bash
git push -u origin hotfix/SOV-999-critical-auth-bypass
gh pr create --title "hotfix: Fix critical auth bypass" --label hotfix
```

### 4. Review

- Requires 1 approving review (CODEOWNERS-compliant)
- CI must pass (lint, typecheck, test-gate)
- Reviewer should be available within minutes for hotfixes

### 5. Admin Merge (Bypass Queue)

A repository admin merges the PR using the bypass lane:

- This skips the merge queue but still requires review + passing CI
- The merge queue handles rebase — all queued PRs update against new `main` HEAD

### 6. Post-Mortem

Within 24 hours of the hotfix:

- Document root cause
- Identify how it was missed by existing tests/reviews
- Add preventive test if not already done
- File follow-up ticket for proper fix if hotfix was a band-aid

## What the Hotfix Lane Does NOT Bypass

| Still Required      | Reason                        |
| ------------------- | ----------------------------- |
| PR (no direct push) | Audit trail                   |
| 1 CODEOWNERS review | Human verification            |
| CI passing          | Prevents shipping broken code |
| Squash merge        | Linear history preserved      |

## What It Bypasses

| Bypassed                  | Reason                              |
| ------------------------- | ----------------------------------- |
| Merge queue serialization | Speed — production is down          |
| Queue position waiting    | Hotfix goes ahead of all queued PRs |
