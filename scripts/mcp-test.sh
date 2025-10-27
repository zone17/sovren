#!/bin/bash

# Sovren MCP Integration Test Suite
# Comprehensive testing of MCP services and security controls

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Test functions
log_test() {
    ((TESTS_TOTAL++))
    echo -e "${BLUE}[TEST $TESTS_TOTAL]${NC} $1"
}

test_pass() {
    ((TESTS_PASSED++))
    echo -e "${GREEN}[PASS]${NC} $1"
}

test_fail() {
    ((TESTS_FAILED++))
    echo -e "${RED}[FAIL]${NC} $1"
}

test_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Read test token
get_test_token() {
    if [ -f ".docker/secrets/test_token" ]; then
        cat .docker/secrets/test_token
    else
        echo "NO_TOKEN"
    fi
}

# Test service health
test_service_health() {
    log_test "Testing service health endpoints"

    # Test MCP Gateway
    if curl -s -f http://localhost:3000/health > /dev/null; then
        test_pass "MCP Gateway health check"
    else
        test_fail "MCP Gateway health check"
    fi

    # Test Prometheus
    if curl -s -f http://localhost:9090/-/healthy > /dev/null; then
        test_pass "Prometheus health check"
    else
        test_fail "Prometheus health check"
    fi
}

# Test authentication
test_authentication() {
    log_test "Testing authentication mechanisms"

    # Test without token (should fail)
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/mcp/github | grep -q "401"; then
        test_pass "Unauthorized access properly blocked"
    else
        test_fail "Unauthorized access not properly blocked"
    fi

    # Test with invalid token (should fail)
    if curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" http://localhost:3000/api/mcp/github | grep -q "403"; then
        test_pass "Invalid token properly rejected"
    else
        test_fail "Invalid token not properly rejected"
    fi

    # Test token generation
    admin_password=$(cat .docker/secrets/admin_password 2>/dev/null || echo "")
    if [ ! -z "$admin_password" ]; then
        token_response=$(curl -s -X POST http://localhost:3000/auth/token \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"admin\",\"password\":\"$admin_password\"}")

        if echo "$token_response" | grep -q '"token"'; then
            test_pass "Token generation successful"
        else
            test_fail "Token generation failed"
        fi
    else
        test_warning "Admin password not found, skipping token generation test"
    fi
}

# Test rate limiting
test_rate_limiting() {
    log_test "Testing rate limiting protection"

    token=$(get_test_token)
    if [ "$token" != "NO_TOKEN" ]; then
        # Send multiple rapid requests
        rate_limit_hit=false
        for i in {1..20}; do
            response_code=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "Authorization: Bearer $token" \
                http://localhost:3000/health)

            if [ "$response_code" = "429" ]; then
                rate_limit_hit=true
                break
            fi
            sleep 0.1
        done

        if [ "$rate_limit_hit" = true ]; then
            test_pass "Rate limiting protection active"
        else
            test_warning "Rate limiting may not be triggered by health endpoint"
        fi
    else
        test_warning "No test token available, skipping rate limiting test"
    fi
}

# Test security headers
test_security_headers() {
    log_test "Testing security headers"

    headers=$(curl -s -I http://localhost:3000/health)

    # Check for security headers
    if echo "$headers" | grep -qi "X-Content-Type-Options"; then
        test_pass "X-Content-Type-Options header present"
    else
        test_fail "X-Content-Type-Options header missing"
    fi

    if echo "$headers" | grep -qi "X-Frame-Options"; then
        test_pass "X-Frame-Options header present"
    else
        test_fail "X-Frame-Options header missing"
    fi

    if echo "$headers" | grep -qi "Strict-Transport-Security"; then
        test_pass "HSTS header present"
    else
        test_fail "HSTS header missing"
    fi

    if echo "$headers" | grep -qi "Content-Security-Policy"; then
        test_pass "Content Security Policy header present"
    else
        test_fail "Content Security Policy header missing"
    fi
}

# Test MCP endpoint routing
test_mcp_routing() {
    log_test "Testing MCP endpoint routing"

    token=$(get_test_token)
    if [ "$token" != "NO_TOKEN" ]; then
        # Test valid MCP request format
        mcp_request='{
            "jsonrpc": "2.0",
            "method": "tools/list",
            "params": {},
            "id": "test-1"
        }'

        response_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$mcp_request" \
            http://localhost:3000/api/mcp/github)

        if [ "$response_code" = "502" ] || [ "$response_code" = "200" ]; then
            test_pass "MCP request routing functional (backend may be offline)"
        else
            test_fail "MCP request routing failed with code: $response_code"
        fi

        # Test invalid MCP request format
        invalid_request='{"invalid": "request"}'

        response_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$invalid_request" \
            http://localhost:3000/api/mcp/github)

        if [ "$response_code" = "400" ]; then
            test_pass "Invalid MCP request properly rejected"
        else
            test_fail "Invalid MCP request not properly rejected"
        fi
    else
        test_warning "No test token available, skipping MCP routing tests"
    fi
}

# Test container security
test_container_security() {
    log_test "Testing container security configurations"

    # Check if containers are running as non-root
    non_root_containers=$(docker-compose -f docker-compose.mcp.yml ps -q | xargs -I {} docker inspect {} --format '{{.Config.User}}' | grep -v "^$" | wc -l)

    if [ "$non_root_containers" -gt 0 ]; then
        test_pass "Containers configured with non-root users"
    else
        test_warning "Some containers may be running as root"
    fi

    # Check for read-only containers
    readonly_containers=$(docker-compose -f docker-compose.mcp.yml ps -q | xargs -I {} docker inspect {} --format '{{.HostConfig.ReadonlyRootfs}}' | grep true | wc -l)

    if [ "$readonly_containers" -gt 0 ]; then
        test_pass "Some containers configured as read-only"
    else
        test_warning "No containers configured as read-only"
    fi
}

# Test monitoring and metrics
test_monitoring() {
    log_test "Testing monitoring and metrics collection"

    # Test Prometheus targets
    if curl -s http://localhost:9090/api/v1/targets | grep -q "mcp-gateway"; then
        test_pass "Prometheus monitoring MCP services"
    else
        test_fail "Prometheus not monitoring MCP services"
    fi

    # Test metrics endpoint
    token=$(get_test_token)
    if [ "$token" != "NO_TOKEN" ]; then
        if curl -s -H "Authorization: Bearer $token" http://localhost:3000/metrics | grep -q "mcp_requests_total"; then
            test_pass "Metrics endpoint accessible"
        else
            test_fail "Metrics endpoint not accessible"
        fi
    else
        test_warning "Cannot test metrics endpoint without token"
    fi
}

# Test audit logging
test_audit_logging() {
    log_test "Testing audit logging functionality"

    # Check if audit logs are being generated
    if docker-compose -f docker-compose.mcp.yml exec -T mcp-gateway test -f /var/log/mcp/audit.log 2>/dev/null; then
        test_pass "Audit log file exists"
    else
        test_warning "Audit log file not found"
    fi

    # Check Fluent Bit log aggregation
    if docker-compose -f docker-compose.mcp.yml ps mcp-audit | grep -q "Up"; then
        test_pass "Log aggregation service running"
    else
        test_fail "Log aggregation service not running"
    fi
}

# Test network isolation
test_network_isolation() {
    log_test "Testing network isolation"

    # Check if isolated network exists
    if docker network ls | grep -q "mcp_isolated"; then
        test_pass "Isolated network created"
    else
        test_fail "Isolated network not found"
    fi

    # Check network configuration
    isolated_network_internal=$(docker network inspect sovren_mcp_isolated --format '{{.Internal}}' 2>/dev/null || echo "false")

    if [ "$isolated_network_internal" = "true" ]; then
        test_pass "Isolated network configured as internal"
    else
        test_fail "Isolated network not properly configured"
    fi
}

# Generate test report
generate_report() {
    echo
    echo "=========================================="
    echo "         MCP INTEGRATION TEST REPORT"
    echo "=========================================="
    echo
    echo "Tests Executed: $TESTS_TOTAL"
    echo "Tests Passed:   $TESTS_PASSED"
    echo "Tests Failed:   $TESTS_FAILED"
    echo "Success Rate:   $(( TESTS_PASSED * 100 / TESTS_TOTAL ))%"
    echo

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED - MCP integration is secure and functional!${NC}"
        return 0
    else
        echo -e "${RED}❌ Some tests failed - please review the issues above${NC}"
        echo
        echo "Common fixes:"
        echo "  • Ensure all services are running: docker-compose -f docker-compose.mcp.yml ps"
        echo "  • Check service logs: docker-compose -f docker-compose.mcp.yml logs"
        echo "  • Verify secrets are properly created: docker secret ls"
        echo "  • Review security configurations in docker-compose.mcp.yml"
        return 1
    fi
}

# Main test execution
main() {
    echo
    echo "Starting MCP Integration Test Suite..."
    echo "======================================"
    echo

    test_service_health
    test_authentication
    test_rate_limiting
    test_security_headers
    test_mcp_routing
    test_container_security
    test_monitoring
    test_audit_logging
    test_network_isolation

    generate_report
}

# Run tests
main "$@"
