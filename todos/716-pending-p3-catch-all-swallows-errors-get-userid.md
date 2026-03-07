---
status: pending
priority: p3
issue_id: '716'
tags: [code-review, backend, error-handling, slice-8]
dependencies: []
---

# catch-all swallows errors in getUserIdByPubkey

## Problem Statement

In FollowService.ts, the `getUserIdByPubkey` method has `.catch(() => userIdOrPubkey)` which silently returns the raw pubkey if the database lookup fails. This masks real errors (connection issues, permission problems, etc.) making debugging difficult.

**Agent consensus: 2/9** (Security, Pattern)

## Fix

In `FollowService.ts`, update the `.catch()` handler to log the error before falling back to returning the raw pubkey. For example: `.catch((err) => { logger.warn('getUserIdByPubkey lookup failed', { error: err, pubkey: userIdOrPubkey }); return userIdOrPubkey; })`.
