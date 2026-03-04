---
status: pending
priority: p2
issue_id: '619'
tags: [code-review, frontend, types, content-shield]
dependencies: []
---

# P2: SignProvenanceBody Frontend Type Drifts from Backend Zod Schema

## Problem Statement

Frontend `SignProvenanceBody` has `relays?: string[]` (optional, no URL validation, no max). Backend Zod: `z.array(z.string().url()).max(20).optional().default([])`. The "sync with" comment is a known drift risk.

Also, `VALID_TRANSITIONS` in `AlertsFeed.tsx` duplicates `ALERT_STATUS_TRANSITIONS` from the shared package.

## Findings

- **Kieran TS (P2-1, P2-2)**: "The types have already drifted" + "exact copy of ALERT_STATUS_TRANSITIONS"

## Proposed Solutions

1. Import `ALERT_STATUS_TRANSITIONS` from shared package instead of duplicating
2. Move `SignProvenanceBody` to shared types or use Zod inference

## Acceptance Criteria

- [ ] VALID_TRANSITIONS replaced with import from shared
- [ ] SignProvenanceBody aligns with backend schema

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
