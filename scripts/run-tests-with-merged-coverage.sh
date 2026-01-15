#!/bin/bash
# Runs tests in shards and merges coverage reports
# This solves the issue where sharding overwrites coverage between shards

set -e

echo "=== Running tests with merged coverage ==="
echo ""

# Clean up previous coverage
rm -rf coverage coverage-shard-*

# Run each shard with coverage
for i in 1 2 3 4 5; do
  echo "--- Running shard $i/5 ---"
  NODE_OPTIONS="--max-old-space-size=6144" bunx vitest run --shard=$i/5 --coverage || exit 1
  mv coverage coverage-shard-$i
  echo ""
done

echo "=== Merging coverage from all shards ==="

# Create merged coverage directory
mkdir -p coverage

# Merge all coverage-final.json files using nyc
# Note: Requires nyc to be installed (npm install -D nyc)
if command -v npx &> /dev/null && npx nyc --version &> /dev/null 2>&1; then
  npx nyc merge coverage-shard-1 coverage-shard-2 coverage-shard-3 coverage-shard-4 coverage-shard-5 coverage/coverage-final.json
  npx nyc report --reporter=html --reporter=text --temp-dir=coverage --report-dir=coverage
else
  # Fallback: Just use shard 1 coverage if nyc not available
  echo "Warning: nyc not found. Using last shard coverage only."
  mv coverage-shard-5/* coverage/ 2>/dev/null || true
fi

# Clean up shard directories
rm -rf coverage-shard-*

echo ""
echo "=== Coverage report generated in ./coverage/ ==="
