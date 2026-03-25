---
status: pending
priority: p3
issue_id: 687
tags: [code-review, e2e, playwright, conventions]
dependencies: []
---

# Inconsistent goto() waitFor pattern across POMs

## Problem Statement

4 POMs include `await this.heading.waitFor({ state: 'visible' })` in `goto()`, while 5 do not. The inconsistency is partly intentional (auth-gated pages may redirect), but undocumented.

**Consensus: 4/8 agents noted.**

## Findings

- **With waitFor:** creator-network, onboarding, nostr-onboarding, lightning-onboarding
- **Without waitFor:** analytics, revenue, subscriptions, profile-dashboard, post

## Recommended Action

Document the convention in CLAUDE.md POM template: public pages that always render should waitFor in `goto()`. Auth-gated pages that may redirect should NOT waitFor (let the spec handle redirect).

## Work Log

| Date       | Action                                    | Learnings                                    |
| ---------- | ----------------------------------------- | -------------------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Document convention, don't enforce uniformly |
