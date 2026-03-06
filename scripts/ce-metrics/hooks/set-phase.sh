#!/usr/bin/env bash
# CE Metrics — Set Phase Helper
# Usage: bash set-phase.sh <phase>
# Called by workflow frontmatter hooks. Uses jq merge to preserve session_id/branch.

set -euo pipefail

PHASE="${1:?Usage: set-phase.sh <phase>}"
CE_PHASE_FILE="$HOME/.claude/metrics/ce-phase.json"

# Only update if phase file exists (session-start.sh creates it)
[ -f "$CE_PHASE_FILE" ] || exit 0

jq --arg phase "$PHASE" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '.phase = $phase | .phase_started_at = $ts' \
  "$CE_PHASE_FILE" > "${CE_PHASE_FILE}.tmp" && mv "${CE_PHASE_FILE}.tmp" "$CE_PHASE_FILE"
