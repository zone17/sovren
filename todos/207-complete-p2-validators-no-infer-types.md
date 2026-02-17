---
status: pending
priority: p2
issue_id: "207"
tags: [code-review, pr-85, architecture]
---

# Validators Don't Export Inferred Types from Zod Schemas

## Problem Statement
Shield and distribution validators define Zod schemas but don't export `z.infer` types. Route handlers duplicate type definitions instead of deriving from schemas.

## Findings
- **File**: `packages/backend/src/validators/shield.ts`
- **File**: `packages/backend/src/validators/distribution.ts`
- Both validator files define Zod schemas (e.g., `SignProvenanceBodySchema`, `CreateCrossPostSchema`) for request validation
- Neither file exports TypeScript types derived from these schemas using `z.infer<typeof Schema>`
- Route handlers and service methods manually define duplicate TypeScript interfaces/types that mirror the Zod schemas
- This creates a maintenance burden: changes to the Zod schema don't automatically propagate to the TypeScript types
- Type drift between schema and manually defined types can cause runtime validation to pass but TypeScript to accept/reject different shapes

## Proposed Solutions
1. Export inferred types from each validator file alongside the schemas:
   ```typescript
   export type SignProvenanceBody = z.infer<typeof SignProvenanceBodySchema>;
   export type CreateCrossPostBody = z.infer<typeof CreateCrossPostSchema>;
   ```
   Then update route handlers and services to import these types instead of maintaining duplicates.
2. Create a shared types barrel file that re-exports all inferred types from validators for convenient importing across the codebase.

## Acceptance Criteria
- [ ] All Zod schemas in shield.ts and distribution.ts have corresponding exported `z.infer` types
- [ ] Route handlers and services use the inferred types instead of manually defined duplicates
- [ ] No duplicate type definitions exist that mirror Zod schemas
- [ ] TypeScript compilation passes with the new type imports
