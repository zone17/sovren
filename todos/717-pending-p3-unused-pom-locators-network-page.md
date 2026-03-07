---
status: pending
priority: p3
issue_id: '717'
tags: [code-review, testing, dead-code, slice-8]
dependencies: []
---

# Unused POM locators and helpers in E2E page objects

## Problem Statement

`packages/frontend/e2e/pages/network.page.ts` defines 6+ locators and helpers that are never used in any spec file: `circleNameInput`, `circleNicheInput`, `memberCountFor`, `mentorshipStatusFor`, `switchToNostr`, `notificationContaining`.

**Agent consensus: 1/9** (Simplicity)

## Fix

In `packages/frontend/e2e/pages/network.page.ts`, remove the unused locators and helper methods: `circleNameInput`, `circleNicheInput`, `memberCountFor`, `mentorshipStatusFor`, `switchToNostr`, and `notificationContaining`. Verify with a grep across `e2e/` specs that none are referenced before deleting.
