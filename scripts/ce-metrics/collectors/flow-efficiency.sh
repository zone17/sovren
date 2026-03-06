#!/usr/bin/env bash
# CE Metrics — Flow Efficiency Collector
# Now consolidated into the single-pass JSONL parser in agent-pipeline.sh
# This file provides the collect_flow_efficiency() wrapper for backward compat

collect_flow_efficiency() {
  # Flow efficiency is computed in the single-pass JSONL parser
  # in agent-pipeline.sh (collect_agent_and_phase_metrics).
  # This function is a no-op — kept for documentation clarity.
  :
}
