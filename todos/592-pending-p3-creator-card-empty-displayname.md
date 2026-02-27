---
status: pending
priority: p3
issue_id: '592'
tags: [code-review, pr-108, frontend, defensive]
---

# CreatorCard empty displayName crash risk

## Problem Statement

`CreatorCard.tsx:32` does `creator.displayName.charAt(0).toUpperCase()`. If displayName is empty string, renders an empty avatar placeholder with no visual content.

**Flagged by: Kieran TS**

## Proposed Solutions

```typescript
{
  (creator.displayName.charAt(0) || '?').toUpperCase();
}
```

## Acceptance Criteria

- [ ] Empty displayName renders fallback character in avatar
