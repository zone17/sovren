---
status: pending
priority: p1
issue_id: 068
tags: [code-review, security, secrets]
dependencies: []
---

# .env Files with Plaintext Secrets in Repository

## Problem Statement

Security Sentinel detected `.env` files containing plaintext secrets (API keys, database credentials, JWT secrets) present in the repository. Even if `.gitignore` lists `.env`, previously committed files or `.env.example` with real values pose a secret exposure risk.

## Findings

- **Security Sentinel P1-02**: .env files with plaintext secrets detected in repository tree.

## Proposed Solutions

### Option A: Audit and remove secrets (Recommended)

1. Verify `.gitignore` covers all `.env*` files (except `.env.example`)
2. Ensure `.env.example` contains only placeholder values
3. If real secrets were ever committed, rotate them immediately
4. Add pre-commit hook to detect secrets (e.g., `detect-secrets` or `gitleaks`)
   **Pros:** Comprehensive fix
   **Cons:** Need to audit git history for prior exposure
   **Effort:** Small
   **Risk:** Low

## Technical Details

- **Affected files:** `.env`, `.env.*` files across monorepo
- **Components:** Configuration, secrets management
- **Runtime impact:** Secret exposure if repo is public or leaked

## Acceptance Criteria

- [ ] No `.env` files with real secrets in working tree
- [ ] `.env.example` contains only placeholders
- [ ] `.gitignore` covers all `.env*` patterns
- [ ] Pre-commit secret detection hook in place

## Work Log

| Date       | Action                          | Learnings               |
| ---------- | ------------------------------- | ----------------------- |
| 2026-02-13 | Created from full PR #73 review | Security Sentinel P1-02 |

## Resources

- PR #73 full review
