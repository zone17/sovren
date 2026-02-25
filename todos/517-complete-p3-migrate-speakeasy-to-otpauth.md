---
status: pending
priority: p3
issue_id: 517
tags: [code-review, security, dependencies]
dependencies: []
---

# Migrate from Unmaintained `speakeasy` to `otpauth`

## Problem Statement

`speakeasy` (v2.0.0) has not been maintained since 2017. It is used for TOTP/2FA in `UserAuthenticationService.ts`. No known CVEs exist, but no patches will be issued if a vulnerability is discovered.

## Findings

**2 security agents flagged (P2 pre-existing).** Downgraded to P3 for this PR since the code was already using speakeasy — PR #98 only declares it in package.json.

## Proposed Solutions

Replace with `otpauth` (actively maintained, ESM-native, zero dependencies) or `@simplewebauthn/server`.

**Affected file:** `packages/backend/src/services/user/UserAuthenticationService.ts`

## Acceptance Criteria

- [ ] `speakeasy` removed from package.json
- [ ] TOTP generation/verification works with replacement library
- [ ] Existing 2FA tokens remain compatible (same algorithm/encoding)

## Work Log

| Date       | Action                       | Learnings                               |
| ---------- | ---------------------------- | --------------------------------------- |
| 2026-02-25 | Created during PR #98 review | Pre-existing; 2 security agents flagged |
