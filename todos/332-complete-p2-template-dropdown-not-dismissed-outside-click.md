---
status: pending
priority: p2
issue_id: 332
tags: [code-review, frontend, ux]
---

# Template dropdown not dismissed on outside click

## Problem Statement

The template dropdown menus in BatchActionToolbar and ReplyComposer stay open when the user clicks outside the menu. There is no click-outside handler to dismiss the dropdown, which violates standard UI behavior and can obscure other content.

## Findings

- `packages/frontend/src/features/multi-platform/components/BatchActionToolbar.tsx` — template menu has no click-outside handler
- `packages/frontend/src/features/multi-platform/components/ReplyComposer.tsx` — template menu has no click-outside handler

## Proposed Solutions

1. Add a click-outside handler using a `useClickOutside` hook or `useRef` with document event listener
2. Alternative: Replace custom dropdown with Headless UI `Popover` or `Menu` component which handles dismissal automatically
3. Also dismiss on Escape key press for keyboard accessibility

## Technical Details

- **Affected Files**: packages/frontend/src/features/multi-platform/components/BatchActionToolbar.tsx, packages/frontend/src/features/multi-platform/components/ReplyComposer.tsx

## Acceptance Criteria

- [ ] Template dropdown closes when clicking outside the menu
- [ ] Template dropdown closes on Escape key press
- [ ] Dropdown still opens/closes correctly via its trigger button
- [ ] Both BatchActionToolbar and ReplyComposer dropdowns fixed
