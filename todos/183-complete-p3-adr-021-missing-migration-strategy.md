# 183 - P3 - ADR-021 Missing Migration Strategy Section

## Priority: P3 (Nice-to-have)

## Source

PR #83 — Review Agent: architecture-strategist

## Description

ADR-021 (Custodial Design for Creator Payments) is thorough with clear decision rationale, pros/cons analysis, and technical notes. However, it's missing a "Migration Strategy" or "Implementation Plan" section that describes:

1. How to move from the current `lightningService` single-invoice model to the hybrid HODL+multi-invoice model
2. What changes are needed in the Lightning node infrastructure (LND upgrade path, HODL invoice plugin)
3. Whether the migration can be done incrementally (e.g., multi-invoice first, HODL later)
4. Backwards compatibility — what happens to existing payment flows during migration

This is a documentation-only improvement. The ADR decision itself is sound.

## Files

- `docs/adr/ADR-021-custodial-design.md`

## Fix

Add a "Migration Strategy" section after "Technical Notes" outlining the phased implementation approach.

## Impact

Documentation — future implementors lack migration guidance.
