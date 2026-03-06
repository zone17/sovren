#!/usr/bin/env bash
# CE Metrics — Shared Library
# All hook scripts source this file for common functions

set -euo pipefail
umask 077

# Require jq — all hooks depend on it
command -v jq &>/dev/null || { echo "CE metrics requires jq — skipping" >&2; exit 0; }

CE_METRICS_DIR="$HOME/.claude/metrics"
CE_EVENTS_FILE="$CE_METRICS_DIR/ce-events.jsonl"
CE_PHASE_FILE="$CE_METRICS_DIR/ce-phase.json"
CE_PENDING_DIR="$CE_METRICS_DIR/pending"
PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"

# Disable check — exit silently if metrics disabled
ce_check_disabled() {
  [ -f "$CE_METRICS_DIR/.disabled" ] && exit 0 || true
}

# Ensure metrics directory exists with restricted permissions
ce_ensure_dirs() {
  mkdir -p -m 0700 "$CE_METRICS_DIR" "$CE_PENDING_DIR"
}

# Initialize hook — reads stdin and parses session_id
# Sets global: $input, $session_id
ce_init() {
  ce_check_disabled
  ce_ensure_dirs
  input=$(cat)
  session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)
}

# Extract a field from JSON input
# Usage: ce_get_field "$input" ".field" "default"
ce_get_field() {
  echo "$1" | jq -r "$2 // \"${3:-unknown}\"" 2>/dev/null || echo "${3:-unknown}"
}

# Get current CE phase from phase file
get_phase() {
  if [ -f "$CE_PHASE_FILE" ]; then
    jq -r '.phase // "adhoc"' "$CE_PHASE_FILE" 2>/dev/null || echo "adhoc"
  else
    echo "adhoc"
  fi
}

# Get project name from git root basename
get_project() {
  local git_root
  git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [ -n "$git_root" ]; then
    basename "$git_root"
  else
    echo "unknown"
  fi
}

# Get current branch
get_branch() {
  git branch --show-current 2>/dev/null || echo "unknown"
}

# Get work slug from git branch — the meaningful part after type/squad/ prefix
# e.g. feat/squad-a/S2-business-manager-mvp -> business-manager-mvp
#      fix/p2-remediation-r5 -> p2-remediation-r5
#      main -> main
get_work_slug() {
  local branch
  branch=$(get_branch)
  [ "$branch" != "unknown" ] || { echo "unknown"; return 0; }
  # Take last path segment, strip ticket prefixes (SOV-NNN-, S2-, etc.)
  local slug
  slug=$(echo "$branch" | sed -E 's|.*/||; s/^(SOV-[0-9]+-|S[0-9]+-)//')
  echo "${slug:-unknown}"
}

# Sanitize a value for use as a Prometheus label
sanitize_label() {
  echo "$1" | tr -cd 'a-zA-Z0-9_-'
}

# Emit a JSON event to the JSONL events file
# Usage: emit_event "event_type" '{"key":"value",...}' "session_id"
emit_event() {
  local event_type="$1"
  local extra_json="${2:-{\}}"
  local session_id="${3:-unknown}"
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local phase
  phase=$(get_phase)
  local project
  project=$(get_project)

  local json
  json=$(jq -cn \
    --arg type "$event_type" \
    --arg ts "$timestamp" \
    --arg sid "$session_id" \
    --arg phase "$phase" \
    --arg project "$project" \
    --argjson extra "$extra_json" \
    '{type: $type, timestamp: $ts, session_id: $sid, phase: $phase, project: $project} + $extra')

  ce_ensure_dirs
  { printf '%s\n' "$json"; } >> "$CE_EVENTS_FILE"
}

# Parse last turn tokens from transcript
# Token data lives at .message.usage and .message.model in assistant entries
# Transcript may contain control chars that break jq, so use python3 fallback
parse_last_turn_tokens() {
  local transcript_path="$1"
  [ -f "$transcript_path" ] || return 0

  # Use python3 to handle control chars and find the last assistant entry with usage
  python3 -c "
import json, sys
last = None
for line in open('$transcript_path'):
    try:
        obj = json.loads(line)
        if obj.get('type') == 'assistant' and isinstance(obj.get('message'), dict):
            msg = obj['message']
            if msg.get('usage'):
                last = msg
    except: pass
if last:
    u = last.get('usage', {})
    print(json.dumps({
        'input_tokens': u.get('input_tokens', 0),
        'output_tokens': u.get('output_tokens', 0),
        'cache_read_tokens': u.get('cache_read_input_tokens', 0),
        'cache_creation_tokens': u.get('cache_creation_input_tokens', 0),
        'model': last.get('model', 'unknown')
    }))
" 2>/dev/null || echo ""
}

# Aggregate ALL token usage from a transcript file
# Returns JSON: {input, output, cache_read, cache_creation, models: {model: {input, output}}, turns}
aggregate_transcript_tokens() {
  local transcript_path="$1"
  [ -f "$transcript_path" ] || { echo '{}'; return 0; }

  python3 -c "
import json
inp = out = cr = cc = turns = 0
models = {}
for line in open('$transcript_path'):
    try:
        obj = json.loads(line)
        if obj.get('type') == 'assistant' and isinstance(obj.get('message'), dict):
            msg = obj['message']
            usage = msg.get('usage')
            model = msg.get('model', 'unknown')
            if usage:
                turns += 1
                i = usage.get('input_tokens', 0)
                o = usage.get('output_tokens', 0)
                r = usage.get('cache_read_input_tokens', 0)
                c = usage.get('cache_creation_input_tokens', 0)
                inp += i; out += o; cr += r; cc += c
                if model not in models:
                    models[model] = {'input': 0, 'output': 0}
                models[model]['input'] += i
                models[model]['output'] += o
    except: pass
print(json.dumps({
    'input_tokens': inp, 'output_tokens': out,
    'cache_read_tokens': cr, 'cache_creation_tokens': cc,
    'turns': turns,
    'models': models
}))
" 2>/dev/null || echo '{}'
}

# Compute cost from transcript token data (not from JSONL)
# Opus: $15/$75, Sonnet: $3/$15, Haiku: $0.80/$4 per 1M tokens
compute_cost_from_transcript() {
  local transcript_path="$1"
  [ -f "$transcript_path" ] || { echo "0"; return 0; }

  python3 -c "
import json
RATES = {
    'opus': (15.0, 75.0),
    'sonnet': (3.0, 15.0),
    'haiku': (0.8, 4.0),
}
def get_rate(model):
    m = (model or '').lower()
    for key, rates in RATES.items():
        if key in m:
            return rates
    return RATES['opus']  # default

cost = 0.0
for line in open('$transcript_path'):
    try:
        obj = json.loads(line)
        if obj.get('type') == 'assistant' and isinstance(obj.get('message'), dict):
            msg = obj['message']
            usage = msg.get('usage')
            model = msg.get('model', 'unknown')
            if usage:
                inp = usage.get('input_tokens', 0) + usage.get('cache_creation_input_tokens', 0)
                cache_read = usage.get('cache_read_input_tokens', 0)
                out = usage.get('output_tokens', 0)
                in_rate, out_rate = get_rate(model)
                # Cache reads are 10% of input price
                cost += (inp * in_rate + cache_read * in_rate * 0.1 + out * out_rate) / 1_000_000
    except: pass
print(round(cost, 4))
" 2>/dev/null || echo "0"
}

# Classify git commands — reads ONLY the first 2 words, NEVER stores full command
classify_git_command() {
  local cmd_prefix="$1"
  case "$cmd_prefix" in
    "git commit"*)   echo "git_commit" ;;
    "git push"*)     echo "git_push" ;;
    "gh pr create"*) echo "pr_create" ;;
    "gh pr merge"*)  echo "pr_merge" ;;
    *)               echo "" ;;
  esac
}

# Sanitize task subject — strip anything that looks like a secret
sanitize_subject() {
  local subject="$1"
  echo "$subject" | sed -E \
    -e 's/(key|token|password|secret|credential)[=: ]+[^ ]*/\1=REDACTED/gi' \
    -e 's/[A-Za-z0-9+/]{40,}/REDACTED/g'
}

# Push metrics to Pushgateway with retry/pending mechanism
push_to_gateway() {
  local job="$1"
  local instance="${2:-}"
  local metrics_data="$3"

  local url="$PUSHGATEWAY_URL/metrics/job/$job"
  [ -n "$instance" ] && url="$url/instance/$instance"

  if echo "$metrics_data" | curl --connect-timeout 2 --max-time 5 --fail --silent \
    --data-binary @- "$url" 2>/dev/null; then
    replay_pending
    return 0
  else
    local pending_file
    pending_file="$CE_PENDING_DIR/$(date +%s)-$job.prom"
    echo "$metrics_data" > "$pending_file"
    echo "url=$url" >> "$pending_file.meta"
    return 1
  fi
}

# Replay pending pushgateway payloads
replay_pending() {
  [ -d "$CE_PENDING_DIR" ] || return 0

  # Expire old pending files (>24 hours)
  find "$CE_PENDING_DIR" -name "*.prom" -mmin +1440 -delete 2>/dev/null || true
  find "$CE_PENDING_DIR" -name "*.meta" -mmin +1440 -delete 2>/dev/null || true

  local pending_files
  pending_files=$(find "$CE_PENDING_DIR" -name "*.prom" -type f 2>/dev/null) || return 0
  [ -n "$pending_files" ] || return 0

  while IFS= read -r pfile; do
    [ -f "$pfile" ] || continue
    local meta_file="$pfile.meta"
    [ -f "$meta_file" ] || continue
    local url
    url=$(grep "^url=" "$meta_file" | cut -d= -f2-)
    [ -n "$url" ] || continue

    if curl --connect-timeout 2 --max-time 5 --fail --silent \
      --data-binary @"$pfile" "$url" 2>/dev/null; then
      rm -f "$pfile" "$meta_file"
    fi
  done <<< "$pending_files"
}

# Delete stale session metrics from pushgateway
cleanup_stale_session() {
  local prev_session_id="$1"
  [ -n "$prev_session_id" ] || return 0
  curl -s --connect-timeout 2 --max-time 5 \
    -X DELETE "$PUSHGATEWAY_URL/metrics/job/ce_session/instance/$prev_session_id" 2>/dev/null || true
}

# Get PR number from gh CLI or branch name, cache in ce-phase.json
get_pr_number() {
  # Check cache first
  if [ -f "$CE_PHASE_FILE" ]; then
    local cached
    cached=$(jq -r '.pr_number // ""' "$CE_PHASE_FILE" 2>/dev/null || echo "")
    if [ -n "$cached" ] && [ "$cached" != "null" ] && [ "$cached" != "0" ]; then
      echo "$cached"
      return 0
    fi
  fi

  # Try gh CLI with timeout
  local pr_num=""
  pr_num=$(timeout 2 gh pr view --json number -q '.number' 2>/dev/null || echo "")

  # Fallback: extract from branch name (e.g., feat/squad-a/SOV-123-slug → 123)
  if [ -z "$pr_num" ]; then
    local branch
    branch=$(get_branch)
    pr_num=$(echo "$branch" | grep -oE '[0-9]+' | head -1 || echo "")
  fi

  pr_num="${pr_num:-0}"

  # Cache in phase file
  if [ -f "$CE_PHASE_FILE" ]; then
    jq --argjson pr "$pr_num" '.pr_number = $pr' "$CE_PHASE_FILE" > "${CE_PHASE_FILE}.tmp" \
      && mv "${CE_PHASE_FILE}.tmp" "$CE_PHASE_FILE" 2>/dev/null || true
  fi

  echo "$pr_num"
}

# Get lines changed vs origin/main
get_lines_changed() {
  local stats
  stats=$(git diff --stat origin/main...HEAD 2>/dev/null | tail -1) || { echo "0 0"; return 0; }
  local adds dels
  adds=$(echo "$stats" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
  dels=$(echo "$stats" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
  echo "${adds:-0} ${dels:-0}"
}

# Get knowledge compounding counts
get_knowledge_counts() {
  local docs_count=0 pattern_lines=0
  docs_count=$(find docs/solutions -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ') || docs_count=0
  if [ -f "docs/solutions/patterns/common-solutions.md" ]; then
    pattern_lines=$(wc -l < "docs/solutions/patterns/common-solutions.md" 2>/dev/null | tr -d ' ') || pattern_lines=0
  fi
  echo "${docs_count:-0} ${pattern_lines:-0}"
}

# Legacy: compute_cost from JSONL (kept for backfill script compatibility)
# Prefer compute_cost_from_transcript() for session-end hook
compute_cost() {
  local events_file="$1"
  local sid="$2"
  [ -f "$events_file" ] || { echo "0"; return 0; }
  jq -s --arg sid "$sid" '
    [.[] | select(.session_id == $sid and .type == "turn_complete")] |
    group_by(.model // "unknown") |
    map({
      model: (.[0].model // "unknown"),
      input: ([.[].input_tokens // 0] | add // 0),
      output: ([.[].output_tokens // 0] | add // 0)
    }) |
    map(
      if .model | test("opus"; "i") then (.input * 0.000015) + (.output * 0.000075)
      elif .model | test("sonnet"; "i") then (.input * 0.000003) + (.output * 0.000015)
      elif .model | test("haiku"; "i") then (.input * 0.0000008) + (.output * 0.000004)
      else (.input * 0.000015) + (.output * 0.000075) end
    ) | add // 0 | . * 10000 | round / 10000
  ' "$events_file" 2>/dev/null || echo "0"
}

# JSONL rotation — copy + truncate to preserve open file descriptors
rotate_jsonl() {
  [ -f "$CE_EVENTS_FILE" ] || return 0
  local size
  size=$(stat -f%z "$CE_EVENTS_FILE" 2>/dev/null || stat -c%s "$CE_EVENTS_FILE" 2>/dev/null || echo 0)
  if [ "$size" -gt 10485760 ]; then
    cp "$CE_EVENTS_FILE" "${CE_EVENTS_FILE}.1"
    : > "$CE_EVENTS_FILE"
  fi
}
