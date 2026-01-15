# Run tests with merged coverage (Windows-compatible)
# Uses Istanbul provider with sharding and nyc merge

$ErrorActionPreference = "Stop"

Write-Host "=== Running tests with merged coverage ===" -ForegroundColor Cyan
Write-Host ""

# Clean up previous coverage
if (Test-Path coverage) { Remove-Item -Recurse -Force coverage }
if (Test-Path .nyc_output) { Remove-Item -Recurse -Force .nyc_output }

# Create nyc output directory
New-Item -ItemType Directory -Force -Path .nyc_output | Out-Null

# Run each shard with coverage
for ($i = 1; $i -le 5; $i++) {
    Write-Host "--- Running shard $i/5 ---" -ForegroundColor Yellow
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    npx vitest run --shard="$i/5" --coverage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Shard $i failed!" -ForegroundColor Red
        exit 1
    }

    # Copy coverage file with unique name
    if (Test-Path "coverage/coverage-final.json") {
        Copy-Item "coverage/coverage-final.json" ".nyc_output/coverage-shard-$i.json"
        Write-Host "Saved coverage for shard $i" -ForegroundColor Green
    } else {
        Write-Host "Warning: No coverage-final.json for shard $i" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "=== Merging coverage from all shards ===" -ForegroundColor Cyan

# Merge with nyc
npx nyc merge .nyc_output coverage/coverage-final.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "Coverage merge failed!" -ForegroundColor Red
    exit 1
}

npx nyc report --reporter=html --reporter=text --reporter=lcov --temp-dir=coverage --report-dir=coverage

# Cleanup
Remove-Item -Recurse -Force .nyc_output

Write-Host ""
Write-Host "=== Coverage report generated in ./coverage/ ===" -ForegroundColor Green
Write-Host "Open coverage/index.html to view the report" -ForegroundColor Cyan
