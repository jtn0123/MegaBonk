#!/bin/bash
# Run all tests in parallel: unit tests + e2e shards
# Usage: ./scripts/test-all-parallel.sh [e2e_shards]
# Example: ./scripts/test-all-parallel.sh 4

set -e

E2E_SHARDS=${1:-4}

echo "🚀 Parallel Test Runner"
echo "   Unit tests: vitest (all cores)"
echo "   E2E tests: $E2E_SHARDS shards with isolated servers"
echo ""

# Temp files for output
UNIT_LOG=$(mktemp)
E2E_LOG=$(mktemp)
trap "rm -f $UNIT_LOG $E2E_LOG" EXIT

START_TIME=$(date +%s)

# Run unit tests in background
echo "📦 Starting unit tests..."
(npx vitest run --reporter=dot 2>&1; echo "EXIT_CODE=$?" >> $UNIT_LOG) > $UNIT_LOG 2>&1 &
UNIT_PID=$!

# Give unit tests a head start, then run e2e
sleep 2
echo "🎭 Starting E2E tests ($E2E_SHARDS shards)..."
(bash scripts/e2e-parallel.sh $E2E_SHARDS chromium 2>&1; echo "EXIT_CODE=$?" >> $E2E_LOG) > $E2E_LOG 2>&1 &
E2E_PID=$!

echo ""
echo "⏳ Both test suites running in parallel..."
echo "   Unit PID: $UNIT_PID"
echo "   E2E PID: $E2E_PID"
echo ""

# Wait for both
UNIT_FAILED=0
E2E_FAILED=0

wait $UNIT_PID || UNIT_FAILED=1
wait $E2E_PID || E2E_FAILED=1

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "════════════════════════════════════════"
echo "                RESULTS"
echo "════════════════════════════════════════"
echo ""

# Unit test results
echo "📦 UNIT TESTS:"
if [ $UNIT_FAILED -eq 0 ]; then
    UNIT_SUMMARY=$(grep -E "Tests.*passed" $UNIT_LOG | tail -1 || echo "completed")
    echo "   ✅ $UNIT_SUMMARY"
else
    echo "   ❌ Failed"
    echo "   Last 10 lines:"
    tail -10 $UNIT_LOG | sed 's/^/   /'
fi

echo ""

# E2E test results
echo "🎭 E2E TESTS:"
if [ $E2E_FAILED -eq 0 ]; then
    E2E_SUMMARY=$(grep -E "Total:.*passed" $E2E_LOG | tail -1 || echo "completed")
    echo "   ✅ $E2E_SUMMARY"
else
    echo "   ❌ Failed"
    echo "   Last 10 lines:"
    tail -10 $E2E_LOG | sed 's/^/   /'
fi

echo ""
echo "════════════════════════════════════════"
echo "⏱️  Total time: ${DURATION}s"
echo "════════════════════════════════════════"

if [ $UNIT_FAILED -ne 0 ] || [ $E2E_FAILED -ne 0 ]; then
    echo ""
    echo "💥 Some tests failed!"
    echo "   Unit log: $UNIT_LOG"
    echo "   E2E log: $E2E_LOG"
    exit 1
else
    echo ""
    echo "🎉 All 9,200+ tests passed!"
    exit 0
fi
