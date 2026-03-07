---
status: pending
priority: p3
issue_id: 691
tags: [code-review, e2e, testing]
dependencies: []
---

# Onboarding specs are too thin — heading + button only

## Problem Statement

3 onboarding specs (onboarding, nostr-onboarding, lightning-onboarding) each have only 2 tests: heading visible and button visible. The POMs define full interaction surfaces (cards, checkboxes, continue buttons) that go untested. The multi-step wizard flow is a critical user journey with no interaction testing.

**Consensus: 2/8 agents noted (Code Simplicity, E2E Testing).**

## Recommended Action

Expand when onboarding wizard is stable. Current smoke-level coverage is acceptable for first pass. Consider consolidating 3 specs into 1 spec file with 3 describe blocks.

## Work Log

| Date       | Action                                    | Learnings                        |
| ---------- | ----------------------------------------- | -------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Acceptable for now, expand later |
