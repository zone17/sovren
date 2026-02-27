---
status: pending
priority: p3
issue_id: '593'
tags: [code-review, pr-108, frontend, cleanup]
---

# Unnecessary React imports with automatic JSX transform

## Problem Statement

`CreatorCard.tsx`, `DiscoveryPage.tsx`, and `DiscoveryPage.test.tsx` import `React` explicitly. With Vite's automatic JSX runtime (`"jsx": "react-jsx"`), this import is unnecessary.

**Flagged by: Kieran TS**

## Proposed Solutions

Remove `import React from 'react'` from files that don't use React namespace directly (e.g., `React.memo`, `React.FC`). Keep it if `React.FC` or `React.memo` is used.

## Acceptance Criteria

- [ ] Unused React imports removed from discovery components
