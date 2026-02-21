---
status: pending
priority: p2
issue_id: 331
tags: [code-review, frontend, ux]
---

# Shared replyText state across all inbox messages

## Problem Statement

The UnifiedInbox component uses a single `replyText` state variable shared across all messages. When a user starts typing a reply to one message and then switches to reply to a different message, the typed text is lost. This creates a poor user experience, especially when composing longer replies.

## Findings

- `packages/frontend/src/features/multi-platform/components/UnifiedInbox.tsx:12` — single `replyText` state variable via `useState<string>('')`
- Switching reply target resets or carries over text incorrectly

## Proposed Solutions

1. Replace single `replyText` string with a `Map<messageId, string>` to store reply text per message
2. Alternative: Store reply text in a `Record<string, string>` keyed by message ID
3. Preserve draft text when switching between messages

## Technical Details

- **Affected Files**: packages/frontend/src/features/multi-platform/components/UnifiedInbox.tsx

## Acceptance Criteria

- [ ] Each message has its own independent reply text state
- [ ] Switching reply target preserves previously typed text
- [ ] Reply text cleared only after successful send
- [ ] No memory leak from accumulating draft entries (clean up on send or discard)
