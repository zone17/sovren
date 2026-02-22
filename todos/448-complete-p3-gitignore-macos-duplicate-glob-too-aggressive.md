---
id: 448
severity: P3
status: complete
title: '.gitignore: macOS duplicate file patterns may accidentally ignore legitimate files'
file: .gitignore
found_in: PR #89
reviewer: review-infra
---

# .gitignore macOS duplicate patterns are overly broad

## Problem

The new patterns added for macOS Finder duplicate files:

```
# macOS Finder duplicate files (created on filename conflicts)
* [0-9].*
* [0-9][0-9].*
```

These glob patterns match any file with a space followed by a digit before the extension. This could accidentally ignore legitimate files like:

- `chapter 1.md`
- `version 2.0.ts`
- `step 3.json`
- `US 1.test.ts`

While the Sovren codebase currently doesn't have such files, this is a broad pattern that could surprise future contributors.

## Location

```
.gitignore  lines 105-106
```

## Fix

Make the pattern more specific to Finder's duplicate naming:

```gitignore
# macOS Finder duplicate files (Finder adds " 2", " 3", etc.)
*\ 2.*
*\ 2
*\ 3.*
*\ 3
```

Or use a more targeted pattern:

```gitignore
# macOS Finder duplicates: "file 2.ext", "file 2" (no extension)
*[[:space:]][0-9]
*[[:space:]][0-9].*
*[[:space:]][0-9][0-9]
*[[:space:]][0-9][0-9].*
```

Note: The current patterns use `*\ [0-9].*` with an escaped space, which is correct Git glob syntax. But the risk of unintended matches remains.

## Severity Justification

P3: Developer experience. Could cause confusion when legitimate files are silently ignored by git.
