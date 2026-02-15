#!/bin/bash

# 🚀 LAUNCH WEEK 1 AGENTS - EPIC-IMMEDIATE
# This script coordinates the execution of Week 1 critical path items

set -e

echo "═══════════════════════════════════════════════════════════"
echo "🚀 SOVREN PRODUCTION LAUNCH - WEEK 1 EXECUTION"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📅 Date: $(date)"
echo "📊 Stories: 7 (Issues #5-11)"
echo "🤖 Agents: security-engineer, code-review-specialist"
echo "⏱️  Duration: ~8 hours"
echo ""
echo "═══════════════════════════════════════════════════════════"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to update story status
update_status() {
    local issue=$1
    local status=$2
    local progress=$3
    local agent=$4
    local comment=$5

    ./scripts/update-story-status.sh "$issue" "$status" "$progress" "$agent" "$comment" 2>/dev/null || true
}

# Function to print section header
print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print task
print_task() {
    echo -e "${YELLOW}► $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ═══════════════════════════════════════════════════════════
# PHASE 1: MANUAL FIXES (User Guidance)
# ═══════════════════════════════════════════════════════════

print_section "PHASE 1: MANUAL FIXES (0-2 hours)"

echo ""
print_task "Issue #5 (IMMED-001): Fix Jest Configuration"
echo "  Action Required:"
echo "  1. Remove conflicting dashboard backup:"
echo "     ${YELLOW}rm -rf monitoring/dashboard-backup${NC}"
echo ""
echo "  2. Verify Jest configuration:"
echo "     ${YELLOW}cat jest.config.elite.ts${NC}"
echo ""
echo "  3. Run tests to confirm fix:"
echo "     ${YELLOW}npm run test:coverage${NC}"
echo ""
read -p "Press ENTER when complete..."
update_status 5 "Done" 100 "manual" "Jest configuration fixed"
print_success "Issue #5 complete"

echo ""
print_task "Issue #6 (IMMED-002): Fix pool.test.ts"
echo "  Action Required:"
echo "  1. Open and fix syntax error:"
echo "     ${YELLOW}code packages/backend/src/database/__tests__/pool.test.ts${NC}"
echo ""
echo "  2. Run specific test:"
echo "     ${YELLOW}npm test -- pool.test.ts${NC}"
echo ""
read -p "Press ENTER when complete..."
update_status 6 "Done" 100 "manual" "pool.test.ts fixed"
print_success "Issue #6 complete"

echo ""
print_task "Issue #9 (IMMED-005): Update npm Dependencies"
echo "  Action Required:"
echo "  1. Check vulnerabilities:"
echo "     ${YELLOW}npm audit${NC}"
echo ""
echo "  2. Apply fixes:"
echo "     ${YELLOW}npm audit fix${NC}"
echo ""
echo "  3. Verify build:"
echo "     ${YELLOW}npm run build${NC}"
echo ""
echo "  4. Run tests:"
echo "     ${YELLOW}npm run test:coverage${NC}"
echo ""
read -p "Press ENTER when complete..."
update_status 9 "Done" 100 "manual" "Dependencies updated"
print_success "Issue #9 complete"

# ═══════════════════════════════════════════════════════════
# PHASE 2: SECURITY REMEDIATION (Parallel Agent Execution)
# ═══════════════════════════════════════════════════════════

print_section "PHASE 2: SECURITY REMEDIATION (0-4 hours)"

echo ""
echo "Launching security-engineer agent for credential rotation..."
echo ""

print_task "Issue #7 (IMMED-003): Rotate GitHub Token"
echo "  Agent: security-engineer"
echo "  Task: Rotate exposed token [REDACTED - ROTATED]"
echo ""
echo "  ${YELLOW}AGENT INVOCATION:${NC}"
echo "  ┌────────────────────────────────────────────────────────┐"
echo "  │ Use Claude Code Task tool:                            │"
echo "  │                                                        │"
echo "  │ Agent: security-engineer                              │"
echo "  │                                                        │"
echo "  │ Task: 'Rotate exposed GitHub personal access token    │"
echo "  │ [REDACTED - ROTATED] that was                        │"
echo "  │ committed to the repository:                          │"
echo "  │ 1. Revoke the exposed token                          │"
echo "  │ 2. Generate new token with minimal required scopes    │"
echo "  │ 3. Update GitHub Actions secrets                      │"
echo "  │ 4. Update .env files with new token reference        │"
echo "  │ 5. Verify CI/CD workflows still function             │"
echo "  │ 6. Document in security audit log'                   │"
echo "  └────────────────────────────────────────────────────────┘"
echo ""

update_status 7 "In Progress" 0 "security-engineer" "Starting token rotation"

echo ""
print_task "Issue #8 (IMMED-004): Rotate Supabase Credentials"
echo "  Agent: security-engineer (parallel execution)"
echo "  Task: Rotate database credentials in AWS Secrets Manager"
echo ""
echo "  ${YELLOW}AGENT INVOCATION:${NC}"
echo "  ┌────────────────────────────────────────────────────────┐"
echo "  │ Use Claude Code Task tool:                            │"
echo "  │                                                        │"
echo "  │ Agent: security-engineer                              │"
echo "  │                                                        │"
echo "  │ Task: 'Rotate Supabase database credentials and       │"
echo "  │ ensure zero-downtime deployment:                      │"
echo "  │ 1. Generate new password in Supabase dashboard        │"
echo "  │ 2. Update AWS Secrets Manager via SecretsService      │"
echo "  │ 3. Update backend .env.production references          │"
echo "  │ 4. Test database connectivity                         │"
echo "  │ 5. Verify application still connects                  │"
echo "  │ 6. Document rotation in security audit'               │"
echo "  └────────────────────────────────────────────────────────┘"
echo ""

update_status 8 "In Progress" 0 "security-engineer" "Starting credential rotation"

echo ""
echo "⏳ Security agent working on both tasks in parallel..."
echo "   Expected completion: 2-3 hours"
echo ""
read -p "Press ENTER when security tasks complete..."

update_status 7 "Done" 100 "security-engineer" "GitHub token rotated successfully"
update_status 8 "Done" 100 "security-engineer" "Supabase credentials rotated successfully"
print_success "Security remediation complete"

# ═══════════════════════════════════════════════════════════
# PHASE 3: CODE REVIEW (After Manual Fixes)
# ═══════════════════════════════════════════════════════════

print_section "PHASE 3: CODE REVIEW US-007 (2-5 hours)"

echo ""
print_task "Issue #10 (IMMED-006): Review US-007 Staged Changes"
echo "  Agent: code-review-specialist"
echo "  Task: Review 77 staged files for error boundaries implementation"
echo ""
echo "  ${YELLOW}AGENT INVOCATION:${NC}"
echo "  ┌────────────────────────────────────────────────────────┐"
echo "  │ Use Claude Code Task tool:                            │"
echo "  │                                                        │"
echo "  │ Agent: code-review-specialist                         │"
echo "  │                                                        │"
echo "  │ Task: 'Comprehensive code review of US-007 error      │"
echo "  │ boundaries implementation (77 staged files):          │"
echo "  │ 1. Review implementation patterns                     │"
echo "  │ 2. Verify 95%+ test coverage                         │"
echo "  │ 3. Check Sentry integration                          │"
echo "  │ 4. Validate TypeScript strict compliance             │"
echo "  │ 5. Review accessibility (ARIA labels, keyboard nav)   │"
echo "  │ 6. Check Mermaid diagrams completeness               │"
echo "  │ 7. Verify CHANGELOG.md updates                       │"
echo "  │ 8. Provide detailed feedback report                  │"
echo "  │                                                       │"
echo "  │ Focus areas:                                          │"
echo "  │ - Error boundary hierarchy correctness               │"
echo "  │ - Fallback UI implementation                         │"
echo "  │ - Error recovery mechanisms                          │"
echo "  │ - Logging and monitoring integration'                │"
echo "  └────────────────────────────────────────────────────────┘"
echo ""

update_status 10 "In Review" 0 "code-review-specialist" "Starting code review"

echo ""
echo "⏳ Code review in progress..."
echo "   Expected completion: 3 hours"
echo ""
read -p "Press ENTER when code review complete..."

update_status 10 "Done" 100 "code-review-specialist" "Code review complete, approved for merge"
print_success "Code review complete"

# ═══════════════════════════════════════════════════════════
# PHASE 4: MERGE TO MAIN
# ═══════════════════════════════════════════════════════════

print_section "PHASE 4: MERGE US-007 (5-6 hours)"

echo ""
print_task "Issue #11 (IMMED-007): Merge US-007 to Main Branch"
echo "  Action Required:"
echo ""
echo "  1. Create pull request:"
echo "     ${YELLOW}gh pr create --title \"feat(US-007): Error boundaries with Sentry integration\" \\${NC}"
echo "     ${YELLOW}  --body \"Implements comprehensive error boundaries across all features\"${NC}"
echo ""
echo "  2. Wait for CI/CD checks:"
echo "     ${YELLOW}gh pr checks${NC}"
echo ""
echo "  3. Merge when approved:"
echo "     ${YELLOW}gh pr merge --squash --auto${NC}"
echo ""
echo "  4. Monitor deployment:"
echo "     ${YELLOW}gh run watch${NC}"
echo ""
echo "  5. Verify staging:"
echo "     ${YELLOW}curl https://sovren-staging.vercel.app/health${NC}"
echo ""
read -p "Press ENTER when merge complete..."

update_status 11 "Done" 100 "manual" "US-007 merged to main, deployed to staging"
print_success "US-007 merged successfully"

# ═══════════════════════════════════════════════════════════
# COMPLETION SUMMARY
# ═══════════════════════════════════════════════════════════

print_section "✅ WEEK 1 COMPLETE!"

echo ""
echo "📊 Summary:"
echo "  • Issues completed: 7/7"
echo "  • Manual fixes: 3 (Jest, pool.test.ts, dependencies)"
echo "  • Security rotations: 2 (GitHub token, Supabase credentials)"
echo "  • Code review: 1 (US-007 with 77 files)"
echo "  • Merge to main: 1 (US-007 error boundaries)"
echo ""
echo "🎯 Achievements:"
echo "  ✓ All blockers resolved"
echo "  ✓ Security vulnerabilities addressed"
echo "  ✓ US-007 deployed to staging"
echo "  ✓ Ready for Week 2 frontend work"
echo ""
echo "📅 Next Steps (Week 2):"
echo "  • Begin NOSTR authentication implementation"
echo "  • Launch design-ux-specialist for mockups"
echo "  • Start 4-agent pipeline workflow"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🚀 Week 1 execution complete! Ready for Week 2."
echo "═══════════════════════════════════════════════════════════"