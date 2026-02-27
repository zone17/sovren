---
status: pending
priority: p3
issue_id: '577'
tags: [code-review, pr-108, performance, frontend]
---

# Add lazy loading and dimensions to avatar images

## Problem Statement

Creator card avatar images load eagerly. On a grid of 20 cards, all 20 avatars load immediately. Adding `loading="lazy"` and explicit dimensions prevents layout shift (CLS) and improves perceived load time. The project mandates CLS < 0.1.

Also missing: React Query `gcTime` configuration (defaults may differ from project standard).

## Findings

- `CreatorCard.tsx`, lines 22-26: `<img>` lacks `loading="lazy"` and `width`/`height`
- Class `w-14 h-14` = 56x56px but no explicit HTML attributes

## Proposed Solutions

```tsx
<img
  src={creator.avatarUrl}
  alt=""
  loading="lazy"
  width={56}
  height={56}
  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
/>
```

## Acceptance Criteria

- [ ] Avatar img has loading="lazy" and width/height attributes
