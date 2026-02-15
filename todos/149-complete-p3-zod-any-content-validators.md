---
status: pending
priority: p3
issue_id: '149'
tags:
  - code-review
  - round-7
  - typescript
  - validation
dependencies:
  - '108'
---

# 149: z.any() in Content Validation Schemas — Unchecked Metadata

## Problem Statement

Content validation schemas in `packages/backend/src/validators/content/index.ts` use `z.any()` for metadata fields. This bypasses all type checking and allows arbitrary data to be stored alongside content records.

**Why it matters**: `z.any()` in validators defeats the purpose of schema validation. Attackers can inject unexpected data types, oversized payloads, or malicious content through metadata fields.

**Note**: Related to todo 108 (ServiceToken<any> casts) but distinct — this is about Zod validation schemas, not TypeScript types.

## Findings

**TypeScript Quality (Kieran) (Round 7)**: 72/100 score. 1,961 `any` occurrences total, with `z.any()` in validators being the most impactful.

## Proposed Solutions

### Replace z.any() with Typed Schemas
**Effort**: Small | **Risk**: Low

```typescript
// Before
metadata: z.any()

// After
metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
```

## Acceptance Criteria

- [ ] Zero `z.any()` in `packages/backend/src/validators/content/index.ts`
- [ ] Metadata fields have typed schemas (e.g., `z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))`)
- [ ] Metadata schema has max keys limit (e.g., `.refine(obj => Object.keys(obj).length <= 50)`)
- [ ] Test: oversized metadata payload rejected with 400
- [ ] Test: deeply nested metadata rejected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 TypeScript review | z.any() in validators is a security concern, not just a type issue |
