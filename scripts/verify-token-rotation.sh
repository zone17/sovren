#!/bin/bash

################################################################################
# IMMED-003: GitHub Token Rotation Verification Script
################################################################################
#
# Purpose: Automatically verify that GitHub token rotation was successful
# Usage: ./scripts/verify-token-rotation.sh
# Exit Codes: 0 = success, 1 = failure
#
################################################################################

set -u  # Exit on undefined variable
# Note: set -e removed to allow script to complete all tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Tracking
PASSED=0
FAILED=0
WARNINGS=0

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

################################################################################
# Verification Tests
################################################################################

print_header "IMMED-003: GitHub Token Rotation Verification"

# Test 1: Check GitHub CLI Authentication
print_info "Test 1: Verifying GitHub CLI authentication..."
TOKEN_INFO=$(gh auth status 2>&1 || true)

if echo "$TOKEN_INFO" | grep -q "Logged in"; then
    echo "$TOKEN_INFO"

    # Check if token has appropriate scopes
    if echo "$TOKEN_INFO" | grep -q "repo"; then
        print_success "GitHub CLI authenticated with 'repo' scope"
    else
        print_error "Missing 'repo' scope on GitHub token"
    fi

    # Check for overly broad scopes (security issue)
    if echo "$TOKEN_INFO" | grep -q "admin"; then
        print_warning "Token has 'admin' scope - consider reducing privileges"
    fi
else
    print_error "GitHub CLI not authenticated - run: gh auth login"
fi

# Test 2: Verify Repository Access
print_info "Test 2: Verifying repository access..."
if gh repo view zone17/sovren >/dev/null 2>&1; then
    print_success "Repository access confirmed (zone17/sovren)"
else
    print_error "Cannot access repository - token may lack permissions"
fi

# Test 3: Check GitHub Actions Secret
print_info "Test 3: Verifying GitHub Actions secrets..."
if gh secret list | grep -q "GITHUB_TOKEN"; then
    SECRET_DATE=$(gh secret list | grep "GITHUB_TOKEN" | awk '{print $2, $3}')
    print_success "GITHUB_TOKEN secret exists (Updated: $SECRET_DATE)"
else
    print_warning "GITHUB_TOKEN secret not found (may be using default)"
    print_info "To set: gh secret set GITHUB_TOKEN"
fi

# Test 4: Check for Hardcoded Tokens in Codebase
print_info "Test 4: Scanning codebase for hardcoded tokens..."
cd "$(git rev-parse --show-toplevel)"

# Search for token patterns, excluding documentation and this script
HARDCODED_TOKENS=$(git grep -E "(ghp_|gho_|github_pat_)[a-zA-Z0-9]{36,}" -- \
    ':!*.md' \
    ':!docs/' \
    ':!scripts/verify-token-rotation.sh' \
    ':!IMMED-003-TOKEN-ROTATION-INSTRUCTIONS.md' \
    2>/dev/null || true)

if [ -z "$HARDCODED_TOKENS" ]; then
    print_success "No hardcoded tokens found in codebase"
else
    print_error "Found hardcoded tokens in codebase:"
    echo "$HARDCODED_TOKENS"
fi

# Test 5: Check .env Files Are Not Tracked
print_info "Test 5: Verifying .env files are not tracked in git..."
TRACKED_ENV=$(git ls-files | grep -E "\.env$" || true)

if [ -z "$TRACKED_ENV" ]; then
    print_success ".env files are not tracked in git"
else
    print_error ".env files are tracked in git (potential security issue):"
    echo "$TRACKED_ENV"
fi

# Test 6: Verify .gitignore Contains .env
print_info "Test 6: Checking .gitignore for .env pattern..."
if grep -q "^\.env$" .gitignore 2>/dev/null || grep -q "^\.env$" packages/frontend/.gitignore 2>/dev/null; then
    print_success ".env pattern found in .gitignore"
else
    print_warning ".env not found in .gitignore - add to prevent accidental commits"
fi

# Test 7: Test GitHub API Access
print_info "Test 7: Testing GitHub API access with current token..."
if gh api /user >/dev/null 2>&1; then
    USER_INFO=$(gh api /user 2>/dev/null | jq -r '.login' 2>/dev/null || echo "unknown")
    print_success "GitHub API access successful (User: $USER_INFO)"
else
    print_error "GitHub API access failed - token may be invalid"
fi

# Test 8: Check Token Scopes Are Minimal
print_info "Test 8: Verifying token follows principle of least privilege..."
TOKEN_SCOPES=$(gh auth status 2>&1 | grep "Token scopes" | cut -d"'" -f2)

REQUIRED_SCOPES="repo workflow"
FORBIDDEN_SCOPES="admin:org delete:* admin:repo_hook"

HAS_REQUIRED=true
for scope in $REQUIRED_SCOPES; do
    if ! echo "$TOKEN_SCOPES" | grep -q "$scope"; then
        print_warning "Missing recommended scope: $scope"
        HAS_REQUIRED=false
    fi
done

if [ "$HAS_REQUIRED" = true ]; then
    print_success "Token has all required scopes"
fi

HAS_FORBIDDEN=false
for scope in $FORBIDDEN_SCOPES; do
    if echo "$TOKEN_SCOPES" | grep -q "$scope"; then
        print_error "Token has forbidden scope: $scope (violates least privilege)"
        HAS_FORBIDDEN=true
    fi
done

if [ "$HAS_FORBIDDEN" = false ]; then
    print_success "Token does not have forbidden scopes"
fi

# Test 9: Verify Workflow Can Be Triggered
print_info "Test 9: Testing GitHub Actions workflow trigger capability..."
if gh workflow list | grep -q "ci.yml"; then
    print_success "GitHub Actions workflows accessible"
    print_info "To test workflow trigger: gh workflow run ci.yml"
else
    print_warning "No workflows found or insufficient permissions"
fi

# Test 10: Check Recent Commits Don't Contain Tokens
print_info "Test 10: Checking recent commits for exposed tokens..."
RECENT_TOKEN_COMMITS=$(git log --all --source -S "ghp_" --oneline --since="7 days ago" | head -5 || true)

if [ -z "$RECENT_TOKEN_COMMITS" ]; then
    print_success "No recent commits contain token patterns"
else
    print_warning "Recent commits may contain tokens (check if they're redacted):"
    echo "$RECENT_TOKEN_COMMITS"
fi

################################################################################
# Summary Report
################################################################################

print_header "Verification Summary"

echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ TOKEN ROTATION VERIFICATION SUCCESSFUL${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Update security audit log: docs/security/audit-log.md"
    echo "2. Test CI/CD pipeline: gh workflow run ci.yml"
    echo "3. Close issue: gh issue close IMMED-003"
    echo ""
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ TOKEN ROTATION VERIFICATION FAILED${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Please review the failures above and:"
    echo "1. Verify token was generated correctly"
    echo "2. Check token has required scopes (repo, workflow)"
    echo "3. Ensure GitHub CLI is authenticated: gh auth login"
    echo "4. Review instructions: IMMED-003-TOKEN-ROTATION-INSTRUCTIONS.md"
    echo ""
    exit 1
fi
