---
title: 'Hook Output Format Fix — additionalContext Must Be Top-Level'
date: 2026-03-06
category: infrastructure
tags: [hooks, claude-code, json, enforcement, debugging]
module: ~/.claude/hooks/enforcement/
symptoms:
  - 'UserPromptSubmit hook error on every prompt'
  - 'Soft-remind warnings never displayed despite hooks being registered'
  - 'Branch/squad context injection not working'
severity: P2
sprint: 'Hook Output Format Fix (03-06)'
---

# Hook Output Format Fix — additionalContext Must Be Top-Level

## Problem

After implementing 8 enforcement hooks in `~/.claude/hooks/enforcement/`, "UserPromptSubmit hook error" appeared on every prompt submission. The error persisted across Claude Code restarts and plugin disabling.

All soft-remind context injection (branch/squad info, watch-ci reminders, auth/payment file warnings, rm -rf warnings, test reminders) was silently broken. Hard blocks (exit 2 with `decision: deny`) were unaffected.

## Root Cause

All 8 hooks used the wrong JSON output format:

```bash
# WRONG — nested wrapper causes hook error
printf '{"hookSpecificOutput":{"additionalContext":"[%s]"}}' "$context"
```

Claude Code expects `additionalContext` as a **top-level key**, not nested inside `hookSpecificOutput`:

```bash
# CORRECT — top-level key
echo "{\"additionalContext\":\"[$context]\"}"
```

Additionally, `stop-test-reminder.sh` wrote its JSON to stderr (`>&2`) instead of stdout.

## Investigation Timeline

| Step | Action                                                               | Result                                     |
| ---- | -------------------------------------------------------------------- | ------------------------------------------ |
| 1    | Suspected hookify plugin, disabled it                                | Error persisted                            |
| 2    | Restarted Claude Code                                                | Error persisted                            |
| 3    | Tested hook with `bash -x`                                           | Ran cleanly (stderr redirect masked issue) |
| 4    | Added `exec 2>/dev/null` to suppress stderr                          | Error persisted (stderr not the cause)     |
| 5    | Emptied `UserPromptSubmit: []` in settings.json                      | Error stopped — confirmed it's our hook    |
| 6    | Replaced with 3-line no-op (`cat > /dev/null; exit 0`)               | No error                                   |
| 7    | Added `echo '{}'`                                                    | No error                                   |
| 8    | Added `echo '{"hookSpecificOutput":{"additionalContext":"[test]"}}'` | ERROR                                      |
| 9    | Changed to `echo '{"additionalContext":"[test]"}'`                   | No error                                   |

Binary search isolation (steps 5-9) was the key debugging method. Testing the hook in isolation with `bash -x` was misleading because it only tests exit code and stdout content, not whether Claude Code can parse the output schema.

## Fix

8 hooks updated across 5 files:

| File                      | Hook Event              | Locations                    |
| ------------------------- | ----------------------- | ---------------------------- |
| `phase-detect-context.sh` | UserPromptSubmit        | 1                            |
| `branch-discipline.sh`    | PreToolUse[Bash]        | 1                            |
| `security-gate-bash.sh`   | PreToolUse[Bash]        | 2                            |
| `security-gate-files.sh`  | PreToolUse[Edit\|Write] | 2                            |
| `post-git-actions.sh`     | PostToolUse[Bash]       | 2                            |
| `stop-test-reminder.sh`   | Stop                    | 1 (also fixed stderr→stdout) |

All changed from nested `hookSpecificOutput` wrapper to top-level `additionalContext`.

## Impact Assessment

| Category                                | Impact                                       |
| --------------------------------------- | -------------------------------------------- |
| Hard blocks (exit 2 + `decision: deny`) | **Unaffected** — different output format     |
| rm -rf / chmod 777 warnings             | Never displayed                              |
| Auth/payment file edit warnings         | Never displayed                              |
| Squad mismatch warnings                 | Never displayed                              |
| Watch-CI mandatory reminder             | Never displayed (but gate flag still worked) |
| Test reminder on Stop                   | Never displayed (also wrote to stderr)       |
| Branch/squad context injection          | Never delivered on any prompt                |

The safety layer (hard blocks) was always working. Only the quality-reminder layer was dead.

## Prevention

1. **Test hook output with minimal 3-line hook first** — before adding any logic:

   ```bash
   #!/usr/bin/env bash
   cat > /dev/null
   echo '{"additionalContext":"[test]"}'
   exit 0
   ```

2. **Binary search isolation for hook errors** — empty hook list → add back minimal hook → add features one at a time. This is faster and more reliable than `bash -x` tracing.

3. **Never write hook output to stderr** — only stdout is parsed for JSON responses.

4. **Verify the output schema against working examples** — don't copy patterns from documentation that may be outdated or incorrect for your hook event type.

## Cross-References

- Prior: [Enforcement Hooks Implementation](~/.claude/docs/solutions/infrastructure/enforcement-hooks-implementation.md) — patterns #98-#102
- Prior: [Agent Metrics Infrastructure Hardening](../observability/agent-metrics-infrastructure-hardening-20260306.md) — Bug 6 (set -u in hooks)
- Pattern: common-solutions.md #110 (hook output JSON top-level keys)
- Pattern: common-solutions.md #105 (never set -u in hooks)
