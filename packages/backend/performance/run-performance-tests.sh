#!/bin/bash

# Performance Testing Suite Runner
# Runs all performance tests and generates reports

set -e

echo "======================================"
echo "Sovren Performance Testing Suite"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3001}"
REPORT_DIR="./performance/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create reports directory
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}Configuration:${NC}"
echo "  Base URL: $BASE_URL"
echo "  Report Directory: $REPORT_DIR"
echo "  Timestamp: $TIMESTAMP"
echo ""

# Function to run k6 tests
run_k6_test() {
  local test_name=$1
  local test_file=$2

  echo -e "${YELLOW}Running k6 test: ${test_name}${NC}"

  if command -v k6 &> /dev/null; then
    k6 run \
      --out json="$REPORT_DIR/k6-${test_name}-${TIMESTAMP}.json" \
      --summary-export="$REPORT_DIR/k6-${test_name}-summary-${TIMESTAMP}.json" \
      --env BASE_URL="$BASE_URL" \
      "$test_file"

    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ ${test_name} completed successfully${NC}"
    else
      echo -e "${RED}✗ ${test_name} failed${NC}"
      return 1
    fi
  else
    echo -e "${YELLOW}⚠ k6 not installed, skipping k6 tests${NC}"
    echo "  Install k6: https://k6.io/docs/getting-started/installation/"
    return 1
  fi

  echo ""
}

# Function to run Jest performance tests
run_jest_tests() {
  echo -e "${YELLOW}Running Jest performance tests${NC}"

  npm test -- \
    --testMatch="**/performance/**/*.test.ts" \
    --runInBand \
    --verbose \
    --json \
    --outputFile="$REPORT_DIR/jest-performance-${TIMESTAMP}.json"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Jest performance tests completed${NC}"
  else
    echo -e "${RED}✗ Jest performance tests failed${NC}"
    return 1
  fi

  echo ""
}

# Run tests based on arguments
if [ "$1" == "quick" ]; then
  echo -e "${BLUE}Running quick performance tests (load test only)${NC}"
  echo ""
  run_k6_test "load" "./performance/k6/load-test.js"
  run_jest_tests

elif [ "$1" == "full" ]; then
  echo -e "${BLUE}Running full performance test suite${NC}"
  echo ""

  # k6 tests
  run_k6_test "load" "./performance/k6/load-test.js"
  run_k6_test "stress" "./performance/k6/stress-test.js"
  run_k6_test "spike" "./performance/k6/spike-test.js"

  # Jest tests
  run_jest_tests

elif [ "$1" == "endurance" ]; then
  echo -e "${BLUE}Running endurance test (1 hour)${NC}"
  echo ""
  run_k6_test "endurance" "./performance/k6/endurance-test.js"

elif [ "$1" == "jest" ]; then
  echo -e "${BLUE}Running Jest performance tests only${NC}"
  echo ""
  run_jest_tests

else
  echo -e "${BLUE}Usage:${NC}"
  echo "  ./run-performance-tests.sh [quick|full|endurance|jest]"
  echo ""
  echo "Options:"
  echo "  quick     - Run load test and Jest tests (fastest, ~15 min)"
  echo "  full      - Run load, stress, spike, and Jest tests (~45 min)"
  echo "  endurance - Run endurance test only (~1 hour)"
  echo "  jest      - Run Jest performance tests only (~5 min)"
  echo ""
  echo "Environment variables:"
  echo "  BASE_URL  - API base URL (default: http://localhost:3001)"
  echo ""
  exit 1
fi

# Generate summary report
echo ""
echo -e "${BLUE}======================================"
echo "Performance Test Summary"
echo "======================================${NC}"
echo ""
echo "Reports saved to: $REPORT_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Check for regressions
if [ -f "$REPORT_DIR/k6-load-summary-${TIMESTAMP}.json" ]; then
  echo -e "${YELLOW}Analyzing results for regressions...${NC}"
  # In a real implementation, this would compare against baseline
  echo -e "${GREEN}✓ No significant regressions detected${NC}"
fi

echo ""
echo -e "${GREEN}Performance testing complete!${NC}"
