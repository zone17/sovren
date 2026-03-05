---
status: complete
priority: p2
issue_id: 668
tags: [code-review, data-integrity, type-safety, migration, wellness]
dependencies: []
---

## Problem Statement

New columns `energy`, `motivation`, and `stress` were added as nullable (no NOT NULL constraint). Historical rows have NULL for these columns. If the `PulseCheckIn` TypeScript interface declares these as `number` rather than `number | null`, there is a type contract mismatch. The frontend could break when displaying historical data that unexpectedly contains null values.

## Findings

- **Reporters**: data-integrity-guardian, architecture-strategist (2 agent consensus)
- **Files**:
  - Migration file (lines 27-29) defining the new columns without NOT NULL
  - `packages/backend/src/services/wellness/WellnessService.ts:339-346`
- New columns added as nullable: `energy`, `motivation`, `stress`
- Historical rows in the database have NULL values for these columns
- TypeScript interface may declare `number` instead of `number | null`
- Frontend components consuming this data may not handle null gracefully (NaN in calculations, "null" rendered as text, broken charts)

## Proposed Solutions

1. **Update TypeScript types to `number | null` and handle in frontend**: Update `PulseCheckIn` interface to declare `energy: number | null`, `motivation: number | null`, `stress: number | null`. Update frontend components to handle null (show "N/A", skip in charts, use fallback values). This is the most honest representation.

2. **Add NOT NULL with backfill migration**: Create a migration that backfills historical rows with a sentinel value (e.g., 0 or -1) and then adds NOT NULL constraints. Preserves the non-null type contract but loses the distinction between "not recorded" and "recorded as 0".

3. **Add COALESCE in the query/view layer**: Use `COALESCE(energy, 0)` in the SQL query or Supabase select so the service layer always receives numbers. Keep the DB nullable but ensure the API contract is non-null. Document the default value semantics.

## Recommended Action

## Technical Details

- Migration lines 27-29 likely look like:
  ```sql
  ADD COLUMN energy INTEGER,
  ADD COLUMN motivation INTEGER,
  ADD COLUMN stress INTEGER
  ```
- Without NOT NULL, these default to NULL for existing rows
- WellnessService.ts lines 339-346 query these columns and return them in the response
- The PulseCheckIn interface (check `@shared/types` or local interfaces) needs inspection
- Frontend components rendering pulse check-in data need null guards if option 1 is chosen
- Option 3 aligns with common-solutions.md #59 (COALESCE at VIEW layer)

## Acceptance Criteria

- [ ] TypeScript types accurately reflect database nullability
- [ ] Frontend renders historical data (with null energy/motivation/stress) without errors
- [ ] No runtime type mismatch between DB data and TypeScript interface
- [ ] If backfill chosen: migration is reversible and sentinel value is documented
- [ ] If COALESCE chosen: default value semantics are documented
- [ ] Existing tests pass; new test covers historical data scenario

## Work Log

## Resources

- Migration file adding energy/motivation/stress columns
- `packages/backend/src/services/wellness/WellnessService.ts`
- PulseCheckIn interface definition
- common-solutions.md #59 (COALESCE at VIEW layer)
