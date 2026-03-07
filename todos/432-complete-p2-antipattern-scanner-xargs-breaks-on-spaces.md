---
id: 432
severity: P2
status: complete
title: 'Anti-pattern scanner: xargs without -0 breaks on filenames with spaces'
file: scripts/check-antipatterns.sh
found_in: PR #89
reviewer: review-infra
---

# Anti-pattern scanner uses xargs without null-byte handling

## Problem

Multiple checks in `check-antipatterns.sh` pipe filenames through `xargs` without `-0` (null-byte delimiter) or quoting. If a staged file has spaces in its path, `xargs` will split it into separate arguments, causing false positives or missed files:

```bash
# Line 20 - breaks on spaces
MATCHES=$(echo "$STAGED_TS_SRC" | xargs grep -HnE '...' 2>/dev/null | ...)
```

While Sovren's current codebase doesn't have files with spaces, this is fragile for future contributors and violates defensive scripting practices.

Additionally, the `for f in $ROUTE_FILES` loops (lines 91, 103, etc.) will also break on filenames with spaces because the variable is unquoted.

## Location

```
scripts/check-antipatterns.sh  lines 20, 33, 47, 61 (xargs usage)
scripts/check-antipatterns.sh  lines 91, 103, 117, 131 (unquoted for loops)
```

## Fix

Use `while IFS= read -r` loops instead of `echo | xargs`:

```bash
# Instead of:
MATCHES=$(echo "$STAGED_TS_SRC" | xargs grep -HnE 'pattern' 2>/dev/null)

# Use:
MATCHES=""
while IFS= read -r f; do
  [ -n "$f" ] && MATCHES+=$(grep -HnE 'pattern' "$f" 2>/dev/null || true)$'\n'
done <<< "$STAGED_TS_SRC"
```

Or use `git diff --cached -z` with `xargs -0` for proper null-byte handling.

## Severity Justification

P2: CI/pre-commit hook reliability. Won't cause issues now but is a landmine for contributors with unconventional file naming.
