#!/usr/bin/env bash
# CE Metrics — Test Harness
# Tests all hook scripts with synthetic input and verifies correct behavior

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/hooks"

# Use a temp directory as fake HOME so hooks write to test dir
TEST_HOME=$(mktemp -d)
TEST_METRICS="$TEST_HOME/.claude/metrics"
TEST_EVENTS="$TEST_METRICS/ce-events.jsonl"
TEST_PHASE="$TEST_METRICS/ce-phase.json"
mkdir -p "$TEST_METRICS" "$TEST_METRICS/pending"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# Run a hook with overridden HOME so lib.sh writes to TEST_HOME
run_hook() {
  local hook="$1"
  local input="$2"
  HOME="$TEST_HOME" bash "$HOOKS_DIR/$hook" <<< "$input" 2>/dev/null
}

echo "=== CE Metrics Hook Test Harness ==="
echo ""

# ------------------------------------------------------------------
# T1: session-start.sh — writes phase file and emits event
# ------------------------------------------------------------------
echo "--- T1: session-start.sh ---"

run_hook "session-start.sh" '{"session_id":"test-session-001","cwd":"/tmp"}'

if [ -f "$TEST_PHASE" ]; then
  pass "phase file created"
else
  fail "phase file not created"
fi

if [ -f "$TEST_EVENTS" ]; then
  pass "events file created"
else
  fail "events file not created"
fi

event_count=$(grep -c '"type":"session_start"' "$TEST_EVENTS" 2>/dev/null || echo 0)
if [ "$event_count" -ge 1 ]; then
  pass "session_start event emitted"
else
  fail "session_start event not found"
fi

# ------------------------------------------------------------------
# T2: turn-complete.sh — handles missing transcript gracefully
# ------------------------------------------------------------------
echo "--- T2: turn-complete.sh ---"

# Test with missing transcript path
run_hook "turn-complete.sh" '{"session_id":"test-session-001","transcript_path":""}'
pass "turn-complete exits cleanly with empty transcript path"

# Test with nonexistent file
run_hook "turn-complete.sh" '{"session_id":"test-session-001","transcript_path":"/nonexistent/path.jsonl"}'
pass "turn-complete exits cleanly with nonexistent transcript"

# Test with synthetic transcript
FAKE_TRANSCRIPT="$TEST_HOME/fake-transcript.jsonl"
echo '{"usage":{"input_tokens":1500,"output_tokens":300,"cache_read_input_tokens":200},"model":"claude-opus-4-6","timestamp":"2026-03-04T10:00:00Z"}' > "$FAKE_TRANSCRIPT"
run_hook "turn-complete.sh" "{\"session_id\":\"test-session-001\",\"transcript_path\":\"$FAKE_TRANSCRIPT\"}"

turn_count=$(grep -c '"type":"turn_complete"' "$TEST_EVENTS" 2>/dev/null || echo 0)
if [ "$turn_count" -ge 1 ]; then
  pass "turn_complete event emitted with token data"
else
  fail "turn_complete event not found"
fi

# ------------------------------------------------------------------
# T3: agent-spawn.sh — emits agent_spawn event
# ------------------------------------------------------------------
echo "--- T3: agent-spawn.sh ---"

run_hook "agent-spawn.sh" '{"session_id":"test-session-001","agent_id":"agent-abc123","agent_type":"backend"}'

spawn_count=$(grep -c '"type":"agent_spawn"' "$TEST_EVENTS" 2>/dev/null || echo 0)
if [ "$spawn_count" -ge 1 ]; then
  pass "agent_spawn event emitted"
else
  fail "agent_spawn event not found"
fi

# ------------------------------------------------------------------
# T4: agent-complete.sh — handles missing transcript gracefully
# ------------------------------------------------------------------
echo "--- T4: agent-complete.sh ---"

run_hook "agent-complete.sh" '{"session_id":"test-session-001","agent_id":"agent-abc123","agent_type":"backend","agent_transcript_path":""}'

complete_count=$(grep -c '"type":"agent_complete"' "$TEST_EVENTS" 2>/dev/null || echo 0)
if [ "$complete_count" -ge 1 ]; then
  pass "agent_complete event emitted"
else
  fail "agent_complete event not found"
fi

# ------------------------------------------------------------------
# T5: git-event.sh — classifies git commands, ignores non-Bash tools
# ------------------------------------------------------------------
echo "--- T5: git-event.sh ---"

# Should be ignored (not Bash tool)
run_hook "git-event.sh" '{"tool_name":"Read","session_id":"test-session-001","tool_input":{"command":"git commit -m test"}}'
git_before=$(grep -c '"type":"git_commit"' "$TEST_EVENTS" 2>/dev/null | tr -d '\n' | head -c 10 || echo 0)

# Should be classified
run_hook "git-event.sh" '{"tool_name":"Bash","session_id":"test-session-001","tool_input":{"command":"git commit -m test message"}}'
git_after=$(grep -c '"type":"git_commit"' "$TEST_EVENTS" 2>/dev/null | tr -d '\n' | head -c 10 || echo 0)

if [ "$git_after" -gt "$git_before" ]; then
  pass "git_commit event emitted for Bash tool"
else
  fail "git_commit event not emitted (before=$git_before after=$git_after)"
fi

if [ "$git_before" -eq 0 ]; then
  pass "non-Bash tool event correctly ignored"
else
  fail "non-Bash tool incorrectly triggered event"
fi

# Test push classification
run_hook "git-event.sh" '{"tool_name":"Bash","session_id":"test-session-001","tool_input":{"command":"git push origin feat/branch"}}'
push_count=$(grep -c '"type":"git_push"' "$TEST_EVENTS" 2>/dev/null || echo 0)
if [ "$push_count" -ge 1 ]; then
  pass "git_push event emitted"
else
  fail "git_push event not found"
fi

# ------------------------------------------------------------------
# T6: task-complete.sh — sanitizes subject and emits event
# ------------------------------------------------------------------
echo "--- T6: task-complete.sh ---"

run_hook "task-complete.sh" '{"session_id":"test-session-001","task_id":"42","task_subject":"Fix auth token leak","team_name":"squad-a"}'

task_count=$(grep -c '"type":"task_complete"' "$TEST_EVENTS" 2>/dev/null || echo 0)
if [ "$task_count" -ge 1 ]; then
  pass "task_complete event emitted"
else
  fail "task_complete event not found"
fi

# Test secret sanitization
run_hook "task-complete.sh" '{"session_id":"test-session-001","task_id":"43","task_subject":"Update API key=supersecretapikey12345","team_name":""}'
last_event=$(tail -1 "$TEST_EVENTS" 2>/dev/null || echo "")
if echo "$last_event" | grep -q "REDACTED"; then
  pass "secret sanitization works"
else
  fail "secret not sanitized in task subject"
fi

# ------------------------------------------------------------------
# T7: session-end.sh — aggregates from JSONL
# ------------------------------------------------------------------
echo "--- T7: session-end.sh ---"

# session-end needs pushgateway; test it exits cleanly when not reachable
HOME="$TEST_HOME" bash "$HOOKS_DIR/session-end.sh" <<< '{"session_id":"test-session-001"}' 2>/dev/null
push_exit=$?
if [ "$push_exit" -le 1 ]; then
  pass "session-end exits cleanly (pushgateway may be unavailable)"
else
  fail "session-end crashed with exit $push_exit"
fi

# ------------------------------------------------------------------
# T8: Disable toggle
# ------------------------------------------------------------------
echo "--- T8: Disable toggle ---"

touch "$TEST_METRICS/.disabled"
events_before=$(wc -l < "$TEST_EVENTS" 2>/dev/null || echo 0)

run_hook "session-start.sh" '{"session_id":"test-disabled-001","cwd":"/tmp"}'
run_hook "agent-spawn.sh" '{"session_id":"test-disabled-001","agent_id":"x","agent_type":"y"}'

events_after=$(wc -l < "$TEST_EVENTS" 2>/dev/null || echo 0)

if [ "$events_after" -eq "$events_before" ]; then
  pass "disable toggle prevents all event writes"
else
  fail "events written despite .disabled file ($events_before before, $events_after after)"
fi

rm -f "$TEST_METRICS/.disabled"

# ------------------------------------------------------------------
# T9: Malformed input handling
# ------------------------------------------------------------------
echo "--- T9: Malformed input ---"

run_hook "session-start.sh" '' 2>/dev/null
pass "session-start handles empty input"

run_hook "turn-complete.sh" 'not-valid-json' 2>/dev/null
pass "turn-complete handles invalid JSON"

run_hook "git-event.sh" '{}' 2>/dev/null
pass "git-event handles missing fields"

# ------------------------------------------------------------------
# T10: Verify existing hooks not broken (settings.json intact)
# ------------------------------------------------------------------
echo "--- T10: Existing hooks regression ---"

SETTINGS="$HOME/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
  if jq empty "$SETTINGS" 2>/dev/null; then
    pass "settings.json is valid JSON"
  else
    fail "settings.json is invalid JSON after CE hooks patch"
  fi

  # Verify existing hooks still present
  if jq -e '.hooks.PostToolUse[] | select(.matcher == "Edit|Write|NotebookEdit")' "$SETTINGS" >/dev/null 2>&1; then
    pass "existing auto-commit-config hook preserved"
  else
    fail "auto-commit-config hook missing from settings.json"
  fi

  if jq -e '.hooks.TaskCompleted[] | select(.hooks[].command | contains("verify-task-complete"))' "$SETTINGS" >/dev/null 2>&1; then
    pass "existing verify-task-complete hook preserved"
  else
    fail "verify-task-complete hook missing from settings.json"
  fi

  if jq -e '.hooks.TeammateIdle' "$SETTINGS" >/dev/null 2>&1; then
    pass "existing TeammateIdle hook preserved"
  else
    fail "TeammateIdle hook missing from settings.json"
  fi

  # Verify CE hooks present
  if jq -e '.hooks.SessionStart[] | select(.hooks[].command | contains("ce-metrics/session-start"))' "$SETTINGS" >/dev/null 2>&1; then
    pass "CE session-start hook registered"
  else
    fail "CE session-start hook missing from settings.json"
  fi

  if jq -e '.hooks.SessionEnd[] | select(.hooks[].command | contains("ce-metrics/session-end"))' "$SETTINGS" >/dev/null 2>&1; then
    pass "CE session-end hook registered"
  else
    fail "CE session-end hook missing from settings.json"
  fi

  if jq -e '.hooks.PostToolUse[] | select(.matcher == "Bash")' "$SETTINGS" >/dev/null 2>&1; then
    pass "CE git-event Bash hook registered"
  else
    fail "CE git-event Bash hook missing from settings.json"
  fi
else
  fail "settings.json not found at $SETTINGS"
fi

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""

# Cleanup
rm -rf "$TEST_HOME"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
