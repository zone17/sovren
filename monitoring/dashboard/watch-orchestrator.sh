#!/bin/bash

# Watch Orchestrator Progress
# Real-time monitoring of project-orchestrator agent activity

echo "🎯 Monitoring Project Orchestrator Progress"
echo "=========================================="
echo ""
echo "Dashboard: http://localhost:3000"
echo "Press Ctrl+C to stop monitoring"
echo ""
echo "=========================================="
echo ""

# Function to display current status
show_status() {
    clear
    echo "🎯 PROJECT ORCHESTRATOR DASHBOARD"
    echo "=========================================="
    echo ""

    # Show current metrics
    echo "📊 CURRENT METRICS:"
    jq -r '
        "  Uptime: \(.uptime_seconds)s",
        "  Current Phase: \(.current_phase)",
        "  Agents Active: \(.agents_active)",
        "  Stories Completed: \(.stories_completed)",
        "  Stories In Progress: \(.stories_in_progress)",
        "  Stories Queued: \(.stories_queued)"
    ' data/metrics.json 2>/dev/null || echo "  Waiting for data..."

    echo ""
    echo "📋 TASK SUMMARY:"
    jq -r '.summary |
        "  Total Tasks: \(.total_tasks)",
        "  ✅ Completed: \(.completed)",
        "  🔄 In Progress: \(.in_progress)",
        "  🚫 Blocked: \(.blocked)",
        "  ⏳ Queued: \(.queued)",
        "  Progress: \(.completion_percent)%"
    ' data/tasks.json 2>/dev/null || echo "  Waiting for data..."

    echo ""
    echo "🎭 PHASE STATUS:"
    jq -r '.phases | to_entries[] |
        "  \(.key): \(.value.name) - \(.value.status) (\(.value.progress)%)"
    ' data/tasks.json 2>/dev/null || echo "  Waiting for data..."

    echo ""
    echo "📝 RECENT ACTIVITY (Last 5 entries):"
    tail -5 data/orchestration.log 2>/dev/null || echo "  No activity yet..."

    echo ""
    echo "=========================================="
    echo "Last Updated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Dashboard: http://localhost:3000"
}

# Watch for changes and update display
while true; do
    show_status
    sleep 3
done
