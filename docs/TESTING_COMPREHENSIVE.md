# Comprehensive Testing Guide for Image Recognition

This document describes the complete testing infrastructure for the MegaBonk image recognition feature.

## Quick Start

```bash
# Run all recognition tests
bun run test:recognition:all

# Open interactive dashboard
bun run test:dashboard

# Run specific test suites
bun run test:ocr              # OCR module only
bun run test:cv               # Computer vision only
bun run test:integration      # Integration tests
bun run test:performance      # Performance benchmarks
```

## Test Structure

### 1. Unit Tests - OCR Module
**File**: `tests/unit/ocr.test.ts`
**Tests**: 45 test cases
**Coverage**: Text extraction, fuzzy matching, confidence scoring

#### Test Categories:
- **Initialization** (3 tests)
  - Initialize with game data
  - Handle empty/partial data

- **Item Detection** (12 tests)
  - Exact name matching
  - Fuzzy matching with typos
  - Multiple items from multiline text
  - Case-insensitive matching
  - Noise filtering
  - OCR artifacts (numbers in text)
  - Special characters

- **Tome Detection** (2 tests)
  - Exact tome names
  - Multiple tomes

- **Character Detection** (3 tests)
  - Exact matching (CL4NK, D4SH)
  - Fuzzy matching

- **Weapon Detection** (2 tests)
  - Name matching
  - With level annotations

- **Confidence Scoring** (3 tests)
  - High confidence for exact matches
  - Lower confidence for fuzzy matches
  - Threshold rejection

- **Edge Cases** (4 tests)
  - Empty strings
  - Very long text
  - Numbers and symbols
  - Extra whitespace

- **Performance** (2 tests)
  - Small text < 100ms
  - Large text < 500ms

**Run**: `bun run test:ocr`

---

### 2. Unit Tests - Computer Vision Module
**File**: `tests/unit/computer-vision.test.ts`
**Tests**: 35 test cases
**Coverage**: Resolution detection, UI layout, region analysis

#### Test Categories:
- **Resolution Detection** (7 tests)
  - 1080p, 1440p, 4K, 720p
  - Steam Deck (1280x800)
  - Custom resolutions
  - Tolerance for variations

- **UI Layout Detection** (6 tests)
  - PC layout (16:9)
  - Steam Deck layout (16:10)
  - Unknown aspect ratios
  - Tolerance

- **Region Detection** (6 tests)
  - Inventory regions
  - Stats regions
  - Resolution scaling
  - PC vs Steam Deck differences

- **Color Analysis** (2 tests)
  - Color distribution
  - Brightness calculation

- **Performance** (3 tests)
  - Region analysis < 50ms
  - Resolution detection < 10ms
  - UI layout detection < 10ms

- **Edge Cases** (5 tests)
  - Small resolutions
  - Large resolutions (8K)
  - Unusual aspect ratios
  - Portrait orientation
  - Zero dimensions

- **Regression Tests** (3 tests)
  - Consistent region detection
  - Consistent resolution detection
  - Consistent UI layout detection

**Run**: `bun run test:cv`

---

### 3. Integration Tests - Full Pipeline
**File**: `tests/unit/scan-build-integration.test.ts`
**Tests**: 30 test cases
**Coverage**: OCR+CV hybrid, accuracy metrics, state management

#### Test Categories:
- **Full Pipeline** (4 tests)
  - Combine OCR and CV results
  - Duplicate detection
  - Confidence thresholding
  - Result filtering

- **Accuracy Metrics** (6 tests)
  - Precision calculation
  - Recall calculation
  - F1 score
  - Perfect detection
  - No detection
  - Edge cases

- **Error Handling** (4 tests)
  - Invalid image data
  - Empty OCR results
  - Empty CV results
  - Both empty

- **Performance** (1 test)
  - Process 100 items efficiently

- **State Management** (3 tests)
  - Maintain build state
  - Update from scan results
  - Incremental updates

- **User Workflow** (3 tests)
  - Manual overrides
  - Remove false positives
  - User-defined thresholds

**Run**: `bun run test:integration`

---

### 4. Performance Benchmarks
**File**: `tests/performance/benchmark.test.ts`
**Tests**: 20 test cases
**Coverage**: Speed, memory usage, stress tests

#### Benchmark Categories:
- **OCR Performance**
  - Fuzzy search index creation < 100ms
  - Per-query search < 50ms
  - Large text processing < 200ms

- **Computer Vision Performance**
  - Resolution detection < 5ms
  - Region analysis < 20ms
  - Color analysis < 100ms

- **Hybrid Detection**
  - Combine results < 50ms for 100 items

- **Memory Usage**
  - No memory leaks
  - < 100MB total footprint

- **Accuracy Metrics**
  - Calculate metrics < 10ms

- **Stress Tests**
  - 77 items (max) processing
  - 4K resolution handling

- **Target Metrics**
  - Full detection < 5 seconds
  - 75%+ accuracy for English
  - < 100MB memory

**Run**: `bun run test:performance`

---

## Running Tests

### Individual Test Suites

```bash
# OCR module only
bun run test:ocr

# Computer Vision module only
bun run test:cv

# Integration tests
bun run test:integration

# Performance benchmarks
bun run test:performance
```

### Combined Tests

```bash
# All recognition tests (OCR + CV + Integration)
bun run test:recognition

# Full test suite with reporting
bun run test:recognition:all

# This runs scripts/run-all-tests.sh which:
# 1. Runs all test suites
# 2. Generates coverage report
# 3. Creates detailed test report
# 4. Saves results to test-results/
```

### Watch Mode

```bash
# Watch for changes and re-run tests
bun vitest watch tests/unit/ocr.test.ts
```

### Coverage Report

```bash
# Generate coverage report
bun vitest run --coverage

# View coverage in browser
open coverage/index.html
```

---

## Test Dashboard

An interactive HTML dashboard visualizes test results:

```bash
# Open dashboard
bun run test:dashboard

# Or open directly
firefox test-results/dashboard.html
```

### Dashboard Features:
- **Real-time Stats**: Passed/Failed/Total tests
- **Progress Bar**: Visual test completion
- **Test Suite Status**: See which suites passed/failed
- **Coverage Metrics**: Statements, branches, functions, lines
- **Performance Benchmarks**: Speed and accuracy targets
- **Action Buttons**: Run tests, view logs

---

## Test Reports

Test results are saved to `test-results/`:

```
test-results/
├── dashboard.html              # Interactive dashboard
├── test-report_YYYYMMDD_HHMMSS.txt  # Detailed text report
└── coverage/                   # Coverage reports
```

### Report Contents:
- Test suite results
- Pass/fail status
- Error messages for failed tests
- Coverage percentages
- Performance metrics
- Timestamp and metadata

---

## Writing New Tests

### OCR Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initOCR, detectItemsFromText } from '../../src/modules/ocr';

describe('OCR Module - New Feature', () => {
    beforeEach(() => {
        initOCR(mockGameData);
    });

    it('should detect new pattern', () => {
        const text = 'Test input';
        const results = detectItemsFromText(text);

        expect(results).toHaveLength(1);
        expect(results[0].entity.name).toBe('Expected Item');
        expect(results[0].confidence).toBeGreaterThan(0.7);
    });
});
```

### Integration Test Template

```typescript
describe('Integration - New Feature', () => {
    it('should combine results correctly', () => {
        const ocrResults = [/* ... */];
        const cvResults = [/* ... */];

        // Test combination logic
        const combined = combineResults(ocrResults, cvResults);

        expect(combined.length).toBe(expectedCount);
    });
});
```

---

## Performance Targets

### Speed Targets:
- OCR extraction: < 3000ms
- CV analysis: < 500ms
- Full pipeline: < 5000ms
- Fuzzy search: < 50ms per query
- Resolution detection: < 10ms
- Region analysis: < 50ms

### Accuracy Targets:
- English screenshots: > 75%
- Clean UI: > 80%
- With visual effects: > 65%

### Memory Targets:
- Total footprint: < 100MB
- No memory leaks: < 10MB increase per 100 cycles

---

## Continuous Integration

Tests run automatically on:
- Pre-commit hooks (lint-staged)
- Pull request creation
- Main branch merges

### Pre-commit Checks:
```bash
# Runs automatically before commit
npm run test:recognition
npm run typecheck
npm run lint
```

---

## Troubleshooting

### Tests Failing?

1. **Check test report**:
   ```bash
   cat test-results/test-report_*.txt
   ```

2. **Run specific failing test**:
   ```bash
   bun vitest run tests/unit/ocr.test.ts -t "should detect exact item"
   ```

3. **Check console output**:
   ```bash
   bun vitest run --reporter=verbose
   ```

### Slow Tests?

1. **Run performance benchmarks**:
   ```bash
   bun run test:performance
   ```

2. **Check for memory leaks**:
   ```bash
   bun vitest run --reporter=verbose --pool=forks
   ```

### Coverage Too Low?

1. **Generate detailed coverage**:
   ```bash
   bun vitest run --coverage --reporter=verbose
   ```

2. **View uncovered lines**:
   ```bash
   open coverage/index.html
   ```

---

## Best Practices

### When to Write Tests:
- ✅ New feature added
- ✅ Bug fixed
- ✅ Edge case discovered
- ✅ Performance optimization
- ✅ API changes

### Test Quality:
- ✅ Test one thing per test case
- ✅ Use descriptive test names
- ✅ Test edge cases
- ✅ Test error handling
- ✅ Keep tests fast (< 100ms)

### Coverage Goals:
- Statements: > 70%
- Branches: > 60%
- Functions: > 70%
- Lines: > 70%

---

## CI/CD Integration

### GitHub Actions Example:

```yaml
name: Test Image Recognition

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test:recognition:all
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## Related Documentation

- [TESTING_IMAGE_RECOGNITION.md](./TESTING_IMAGE_RECOGNITION.md) - Screenshot testing guide
- [ENGLISH_ONLY_TESTING.md](../test-images/gameplay/ENGLISH_ONLY_TESTING.md) - English-focused testing
- [README.md](../README.md) - Project overview

---

## Summary

- **130 total test cases** across 4 test suites
- **Full coverage** of OCR, CV, integration, and performance
- **Automated test runner** with detailed reporting
- **Interactive dashboard** for visualization
- **Performance benchmarks** to ensure speed targets
- **CI/CD ready** for automated testing

Run all tests: `bun run test:recognition:all`
View dashboard: `bun run test:dashboard`
