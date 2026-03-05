---
status: complete
priority: p2
issue_id: 663
tags: [code-review, validation, security, wellness]
dependencies: []
---

## Problem Statement

The timezone field in the wellness validator accepts any arbitrary string with no format constraint or length limit. This allows storing invalid timezone identifiers, potential XSS payloads if rendered in HTML context, and strings up to 10MB which could impact storage and processing.

## Findings

- **Reporter**: security-sentinel (1 agent)
- **File**: `packages/backend/src/validators/wellness.ts:65`
- `timezone: z.string()` has no `.max()` length constraint
- No regex pattern to enforce IANA timezone identifier format (e.g., `America/New_York`, `UTC`)
- Arbitrary strings stored in the database could contain HTML/script content
- No frontend sanitization should be assumed; server-side validation is the defense

## Proposed Solutions

1. **Add max length + IANA regex**: Change to `z.string().max(64).regex(/^[A-Za-z][A-Za-z0-9/_+-]{0,63}$/)` which covers all valid IANA timezone identifiers while rejecting injection payloads and oversized strings.

2. **Validate against Intl.supportedValuesOf('timeZone')**: Use the runtime's known timezone list for exact validation. This is stricter but depends on the Node.js version and ICU data available.

3. **Enum of supported timezones**: Define an explicit allowlist of timezones the application supports. Most restrictive but may be too rigid if users need uncommon zones.

## Recommended Action

## Technical Details

- IANA timezone identifiers follow the pattern: `Area/Location` (e.g., `America/New_York`, `Europe/London`)
- Maximum known IANA identifier length is around 30 characters; 64 is a safe upper bound
- The regex `^[A-Za-z][A-Za-z0-9/_+-]{0,63}$` covers standard identifiers including `Etc/GMT+5`, `US/Eastern`, etc.
- Current schema: `timezone: z.string()` at line 65 of the wellness validator

## Acceptance Criteria

- [ ] Timezone field rejects strings longer than 64 characters
- [ ] Timezone field rejects strings not matching IANA identifier format
- [ ] Valid IANA identifiers (America/New_York, UTC, Etc/GMT+5) are accepted
- [ ] Invalid input returns a clear validation error message
- [ ] Existing tests pass; new test covers timezone validation edge cases

## Work Log

## Resources

- `packages/backend/src/validators/wellness.ts`
- [IANA Time Zone Database](https://www.iana.org/time-zones)
