#!/bin/bash

# Comprehensive test runner for MegaBonk image recognition
# Runs unit tests, integration tests, and performance benchmarks
# Generates detailed test report

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="${PROJECT_ROOT}/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="${REPORT_DIR}/test-report_${TIMESTAMP}.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================"
echo "🧪 MegaBonk Image Recognition Test Suite"
echo "================================================"
echo ""

# Create report directory
mkdir -p "$REPORT_DIR"

# Start report
{
    echo "================================================"
    echo "MegaBonk Image Recognition Test Report"
    echo "Generated: $(date)"
    echo "================================================"
    echo ""
} > "$REPORT_FILE"

cd "$PROJECT_ROOT"

# Function to run tests and capture results
run_test_suite() {
    local suite_name=$1
    local command=$2

    echo -e "${BLUE}Running: ${suite_name}${NC}"
    echo ""

    {
        echo "----------------------------------------"
        echo "Test Suite: ${suite_name}"
        echo "----------------------------------------"
    } >> "$REPORT_FILE"

    if eval "$command" >> "$REPORT_FILE" 2>&1; then
        echo -e "${GREEN}✅ ${suite_name} PASSED${NC}"
        echo "Status: PASSED" >> "$REPORT_FILE"
    else
        echo -e "${RED}❌ ${suite_name} FAILED${NC}"
        echo "Status: FAILED" >> "$REPORT_FILE"
        FAILED_SUITES+=("$suite_name")
    fi

    echo "" >> "$REPORT_FILE"
    echo ""
}

# Track failed suites
FAILED_SUITES=()

echo "📋 Running Test Suites..."
echo ""

# 1. Unit Tests - OCR Module
run_test_suite "Unit Tests: OCR Module" \
    "bun test tests/unit/ocr.test.ts --reporter=verbose"

# 2. Unit Tests - Computer Vision Module
run_test_suite "Unit Tests: Computer Vision Module" \
    "bun test tests/unit/computer-vision.test.ts --reporter=verbose"

# 3. Integration Tests
run_test_suite "Integration Tests: Full Pipeline" \
    "bun test tests/unit/scan-build-integration.test.ts --reporter=verbose"

# 4. Performance Benchmarks
run_test_suite "Performance Benchmarks" \
    "bun test tests/performance/benchmark.test.ts --reporter=verbose"

# 5. Existing Unit Tests (filtering, search, etc.)
if [ -f "tests/unit/filtering.test.js" ]; then
    run_test_suite "Existing Unit Tests" \
        "bun test tests/unit/ --reporter=verbose"
fi

# 6. Coverage Report
echo -e "${BLUE}Generating Coverage Report...${NC}"
echo ""

{
    echo "----------------------------------------"
    echo "Code Coverage Report"
    echo "----------------------------------------"
} >> "$REPORT_FILE"

if bun test --coverage >> "$REPORT_FILE" 2>&1; then
    echo -e "${GREEN}✅ Coverage Report Generated${NC}"
else
    echo -e "${YELLOW}⚠️  Coverage Report Failed (non-critical)${NC}"
fi

echo "" >> "$REPORT_FILE"
echo ""

# Summary
echo "================================================"
echo "📊 Test Summary"
echo "================================================"
echo ""

{
    echo "================================================"
    echo "Test Summary"
    echo "================================================"
    echo ""
} >> "$REPORT_FILE"

if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All test suites passed!${NC}"
    {
        echo "Result: ALL TESTS PASSED ✅"
        echo ""
        echo "All test suites completed successfully."
    } >> "$REPORT_FILE"
    EXIT_CODE=0
else
    echo -e "${RED}❌ Some test suites failed:${NC}"
    {
        echo "Result: SOME TESTS FAILED ❌"
        echo ""
        echo "Failed test suites:"
    } >> "$REPORT_FILE"

    for suite in "${FAILED_SUITES[@]}"; do
        echo -e "${RED}  - ${suite}${NC}"
        echo "  - ${suite}" >> "$REPORT_FILE"
    done
    EXIT_CODE=1
fi

echo ""
{
    echo ""
    echo "Report saved to: ${REPORT_FILE}"
    echo ""
} >> "$REPORT_FILE"

# Display report location
echo "================================================"
echo "📄 Full report saved to:"
echo "   ${REPORT_FILE}"
echo "================================================"
echo ""

# Quick stats
echo "Quick Stats:"
echo "  Total suites run: $(grep -c "Test Suite:" "$REPORT_FILE" || echo "0")"
echo "  Passed: $(grep -c "Status: PASSED" "$REPORT_FILE" || echo "0")"
echo "  Failed: $(grep -c "Status: FAILED" "$REPORT_FILE" || echo "0")"
echo ""

# Next steps
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Ready for production.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review coverage report"
    echo "  2. Test with real screenshots"
    echo "  3. Tune parameters based on accuracy metrics"
else
    echo -e "${RED}⚠️  Some tests failed. Please review the report.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review failed tests in: ${REPORT_FILE}"
    echo "  2. Fix failing tests"
    echo "  3. Re-run: $0"
fi

echo ""

exit $EXIT_CODE
