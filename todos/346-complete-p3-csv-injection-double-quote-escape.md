---
status: pending
priority: p3
issue_id: 346
tags: [code-review, security]
---

# CSV injection protection incomplete — double quotes not escaped

## Problem Statement

The CSV export in TaxService escapes formula-trigger characters (`=`, `+`, `-`, `@`) but does not escape double quotes within quoted CSV fields, leaving a vector for CSV injection via quote breakout.

## Findings

- File: `packages/backend/src/services/finance/TaxService.ts` (`exportTaxReport` method)
- Formula-trigger character prefixing is present but insufficient
- A value like `"=CMD()|"` could break out of a quoted field if `"` is not escaped as `""`
- Standard CSV escaping requires doubling double quotes inside quoted fields (RFC 4180)

## Proposed Solutions

1. Escape all `"` characters as `""` within CSV field values before wrapping in quotes
2. Consider using a well-tested CSV library (e.g., `csv-stringify`) instead of manual CSV construction

## Acceptance Criteria

- [ ] Double quotes in field values are escaped as `""` per RFC 4180
- [ ] Existing formula-trigger character prefixing remains intact
- [ ] Unit test covers a field value containing `"` and verifies correct escaping
