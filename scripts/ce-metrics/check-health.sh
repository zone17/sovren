#!/usr/bin/env bash
# CE Metrics — Health Check
# Verifies the metrics pipeline is working end-to-end

set -euo pipefail

HOOKS_DIR="$HOME/.claude/hooks/ce-metrics"
METRICS_DIR="$HOME/.claude/metrics"
SETTINGS_FILE="$HOME/.claude/settings.json"
PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"

passed=0
failed=0
warnings=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    echo "  [PASS] $name"
    ((passed++))
  elif [ "$result" = "warn" ]; then
    echo "  [WARN] $name"
    ((warnings++))
  else
    echo "  [FAIL] $name — $result"
    ((failed++))
  fi
}

echo "CE Metrics Health Check"
echo "======================="
echo ""

# 1. Prerequisites
echo "Prerequisites:"
if command -v jq &>/dev/null; then
  check "jq installed" "ok"
else
  check "jq installed" "jq not found — install with: brew install jq"
fi

if command -v curl &>/dev/null; then
  check "curl installed" "ok"
else
  check "curl installed" "curl not found"
fi

echo ""

# 2. Hook files
echo "Hook Files ($HOOKS_DIR):"
expected_hooks=(
  "lib.sh"
  "set-phase.sh"
  "session-start.sh"
  "session-end.sh"
  "turn-complete.sh"
  "agent-spawn.sh"
  "agent-complete.sh"
  "git-event.sh"
  "task-complete.sh"
)

for hook in "${expected_hooks[@]}"; do
  if [ -f "$HOOKS_DIR/$hook" ]; then
    if [ -x "$HOOKS_DIR/$hook" ] || [ "$hook" = "lib.sh" ]; then
      check "$hook" "ok"
    else
      check "$hook" "exists but not executable"
    fi
  else
    check "$hook" "missing"
  fi
done

echo ""

# 3. Settings registration
echo "Settings Registration ($SETTINGS_FILE):"
if [ -f "$SETTINGS_FILE" ]; then
  for hook in "session-start" "session-end" "turn-complete" "agent-spawn" "agent-complete" "git-event" "task-complete"; do
    if grep -q "ce-metrics/$hook.sh" "$SETTINGS_FILE" 2>/dev/null; then
      check "$hook registered" "ok"
    else
      check "$hook registered" "not found in settings.json"
    fi
  done
else
  check "settings.json" "file not found"
fi

echo ""

# 4. Metrics directory
echo "Metrics Directory ($METRICS_DIR):"
if [ -d "$METRICS_DIR" ]; then
  check "directory exists" "ok"
  perms=$(stat -f%Lp "$METRICS_DIR" 2>/dev/null || stat -c%a "$METRICS_DIR" 2>/dev/null || echo "???")
  if [ "$perms" = "700" ]; then
    check "permissions (700)" "ok"
  else
    check "permissions (700)" "current: $perms"
  fi
else
  check "directory exists" "not created yet (will be created on first session)"
fi

if [ -f "$METRICS_DIR/.disabled" ]; then
  check "metrics enabled" "DISABLED — remove $METRICS_DIR/.disabled to enable"
else
  check "metrics enabled" "ok"
fi

if [ -f "$METRICS_DIR/ce-events.jsonl" ]; then
  event_count=$(wc -l < "$METRICS_DIR/ce-events.jsonl" 2>/dev/null || echo 0)
  size=$(stat -f%z "$METRICS_DIR/ce-events.jsonl" 2>/dev/null || stat -c%s "$METRICS_DIR/ce-events.jsonl" 2>/dev/null || echo 0)
  check "events file ($event_count events, $(( size / 1024 ))KB)" "ok"
else
  check "events file" "warn"
fi

echo ""

# 5. Pushgateway
echo "Pushgateway ($PUSHGATEWAY_URL):"
if curl --connect-timeout 2 --max-time 5 --fail --silent "$PUSHGATEWAY_URL/-/healthy" >/dev/null 2>&1; then
  check "reachable" "ok"
else
  check "reachable" "cannot connect — is Docker running? (docker compose up -d)"
fi

# 6. Pending files
echo ""
echo "Pending Queue ($METRICS_DIR/pending/):"
if [ -d "$METRICS_DIR/pending" ]; then
  pending_count=$(find "$METRICS_DIR/pending" -name "*.prom" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$pending_count" -eq 0 ]; then
    check "pending queue empty" "ok"
  else
    check "$pending_count files queued" "warn"
  fi
else
  check "pending directory" "ok"
fi

echo ""
echo "======================="
echo "Results: $passed passed, $failed failed, $warnings warnings"

if [ "$failed" -gt 0 ]; then
  echo ""
  echo "Fix failures before metrics will work. Run install-hooks.sh to repair."
  exit 1
fi

exit 0
