---
status: pending
priority: p3
issue_id: 754
tags: [code-review, slice-8, security, input-validation, unicode]
dependencies: []
---

# P3: stripControlChars missing extended Unicode ranges

## Problem Statement

The `stripControlChars` utility removes common control characters but misses several extended Unicode ranges that can be used for obfuscation or injection attacks. Specifically, it's missing:

- U+007F (DEL character)
- C1 controls (U+0080 to U+009F)
- Zero-width spaces (U+200B, U+200C, U+200D, U+FEFF)
- BiDi (bidirectional text) override characters (U+202A-U+202E)

## Findings

- File: `utils/stripControlChars.ts`
- Current regex: Likely only covers ASCII C0 controls (U+0000-U+001F)
- Missing ranges:
  - DEL: `\u007F`
  - C1 controls: `\u0080-\u009F`
  - Zero-width spaces: `\u200B`, `\u200C`, `\u200D`, `\uFEFF`
  - BiDi overrides: `\u202A-\u202E`
- Risk: Attackers can use these characters for homograph attacks or XSS bypasses

## Proposed Solutions

Extend the regex to include all control and formatting characters:

```typescript
export function stripControlChars(input: string): string {
  // C0 controls (0-31, 127), C1 controls (128-159),
  // zero-width spaces, BiDi overrides
  return input.replace(
    /[\u0000-\u001F\u007F\u0080-\u009F\u200B\u200C\u200D\u202A-\u202E\uFEFF]/g,
    ''
  );
}
```

## Technical Details

- **U+007F (DEL)**: ASCII delete character, historically used for erasure
- **U+0080–U+009F (C1)**: Extended control codes, rarely used but can cause issues
- **U+200B–U+200D**: Invisible spaces used in homograph attacks
- **U+FEFF (BOM)**: Byte order mark, can be embedded as zero-width space in UTF-8
- **U+202A–U+202E**: Left/right/pop directional overrides for BiDi text, can reverse text direction for obfuscation

Applied before storing or displaying user input prevents both accidental and malicious control character injection.

## Acceptance Criteria

- [ ] `stripControlChars` regex updated to include all control ranges
- [ ] Unit tests added for each control character range
  - [ ] DEL (U+007F)
  - [ ] C1 controls sample (U+0080, U+009F)
  - [ ] Zero-width spaces (U+200B, U+200C, U+200D, U+FEFF)
  - [ ] BiDi overrides (U+202A, U+202E)
- [ ] Integration test in content creation/validation flow
- [ ] All calls to `stripControlChars` remain unchanged (backward compatible)
- [ ] Documentation updated if file has comments
