#!/bin/bash
# e2e-parallel.sh - Run e2e tests in parallel with isolated servers
# Usage: ./scripts/e2e-parallel.sh [shards] [project]
# Example: ./scripts/e2e-parallel.sh 4 chromium

set -e

SHARDS=${1:-4}
PROJECT=${2:-chromium}
BASE_PORT=4001
PIDS=()
SERVER_PIDS=()

cleanup() {
    echo "Cleaning up..."
    for pid in "${SERVER_PIDS[@]}"; do
        kill $pid 2>/dev/null || true
    done
    for pid in "${PIDS[@]}"; do
        kill $pid 2>/dev/null || true
    done
    exit
}

trap cleanup EXIT INT TERM

echo "=== E2E Parallel Test Runner ==="
echo "Shards: $SHARDS"
echo "Project: $PROJECT"
echo ""

# Step 1: Build once
echo "[1/3] Building..."
npm run build --silent

# Step 2: Start servers
echo "[2/3] Starting $SHARDS servers..."
for i in $(seq 1 $SHARDS); do
    PORT=$((BASE_PORT + i - 1))
    npx serve dist -l $PORT -s > /tmp/server-$i.log 2>&1 &
    SERVER_PIDS+=($!)
    echo "  Server $i on port $PORT (PID: ${SERVER_PIDS[-1]})"
done

# Wait for servers to be ready
echo "  Waiting for servers..."
sleep 3

# Verify servers are up
for i in $(seq 1 $SHARDS); do
    PORT=$((BASE_PORT + i - 1))
    if ! curl -s -o /dev/null -w "" http://localhost:$PORT; then
        echo "  ERROR: Server $i (port $PORT) failed to start"
        exit 1
    fi
done
echo "  All servers ready!"

# Step 3: Run shards
echo "[3/3] Running $SHARDS test shards..."
echo ""

START_TIME=$(date +%s)

for i in $(seq 1 $SHARDS); do
    PORT=$((BASE_PORT + i - 1))
    BASE_URL="http://localhost:$PORT" npx playwright test \
        --project=$PROJECT \
        --shard=$i/$SHARDS \
        --workers=3 \
        > /tmp/shard-$i.log 2>&1 &
    PIDS+=($!)
    echo "  Shard $i started (PID: ${PIDS[-1]}) -> localhost:$PORT"
done

echo ""
echo "Waiting for all shards to complete..."
echo ""

# Wait for all test processes
FAILED=0
for i in $(seq 1 $SHARDS); do
    wait ${PIDS[$i-1]} || FAILED=$((FAILED + 1))
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=== Results ==="
echo ""

TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

for i in $(seq 1 $SHARDS); do
    RESULT=$(grep -E "[0-9]+ passed|[0-9]+ failed|[0-9]+ skipped" /tmp/shard-$i.log | tail -1 || echo "unknown")
    PASSED=$(echo "$RESULT" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" || echo 0)
    FAILED_COUNT=$(echo "$RESULT" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" || echo 0)
    SKIPPED=$(echo "$RESULT" | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" || echo 0)
    
    TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED_COUNT))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
    
    echo "Shard $i: $PASSED passed, $FAILED_COUNT failed, $SKIPPED skipped"
done

echo ""
echo "Total: $TOTAL_PASSED passed, $TOTAL_FAILED failed, $TOTAL_SKIPPED skipped"
echo "Time: ${DURATION}s"
echo ""

if [ $TOTAL_FAILED -gt 0 ]; then
    echo "❌ Some tests failed. Check /tmp/shard-*.log for details."
    exit 1
else
    echo "✅ All tests passed!"
    exit 0
fi
