# Testing Guide

## Initial Setup

Before running tests for the first time, install dependencies:

```bash
npm install                # Install npm dependencies
npx playwright install     # Download browser binaries for E2E tests
```

**Note:** The Playwright browser download (~470MB) is required for E2E tests but not for unit tests.

## Running Tests

### Unit Tests
```bash
npm run test:unit          # Run with coverage (may hit memory limits)
npm run test:watch         # Run in watch mode
```

### E2E Tests
```bash
npx playwright install     # Required first time only
npm run test:e2e           # Run Playwright end-to-end tests
npm run test:e2e:ui        # Run with Playwright UI
```

### All Tests
```bash
npm run test:all           # Run both unit and e2e tests
```

## Known Issues

### Memory Overflow During Coverage Collection

**Symptom:** Tests pass (1705 passed) but worker crashes with "JavaScript heap out of memory" during coverage report generation.

**Root Cause:** V8 coverage provider accumulates data for all 50+ test files. When generating the final report, memory usage exceeds 8GB heap limit.

**Workarounds:**

1. **Run tests without coverage** (fastest, no memory issues):
   ```bash
   NODE_OPTIONS='--max-old-space-size=8192' npx vitest run
   ```

2. **Run specific test files with coverage**:
   ```bash
   npx vitest run tests/unit/computer-vision.test.ts --coverage
   npx vitest run tests/unit/filters.test.js --coverage
   ```

3. **Skip memory-intensive CV tests**:
   ```bash
   npx vitest run --exclude='**/cv-*.test.ts'  --coverage
   ```

**Configuration Applied:**
- Single fork mode (`singleFork: true`) to prevent worker accumulation
- 8GB heap limit (`--max-old-space-size=8192`)
- Sequential test execution (`isolate: false`, `concurrent: false`)
- Reduced coverage scope (`all: false`)

### Canvas Module Installation

The `canvas` module requires native dependencies (Cairo, Pango, etc.) and may fail to install on some systems.

**When is it needed?**
- CV tests with real images (`cv-real-images.test.ts`)
- Offline CV runner (`tests/offline-cv-runner.ts`)
- NOT needed for regular unit tests or E2E tests

**Installation:**

On Linux/Mac with dependencies:
```bash
npm install
```

On Windows or systems without build tools:
```bash
npm install --ignore-scripts
# Canvas will be unavailable but tests will skip gracefully
```

**Native dependencies required:**
- **Linux**: `apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
- **Mac**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
- **Windows**: Visual Studio Build Tools (or use --ignore-scripts)

**Graceful degradation:**
- Tests automatically skip canvas-dependent tests if module isn't available
- Offline CV runner exits with helpful error message
- Canvas is marked as `optionalDependencies` in package.json

## Test Coverage

**Current coverage:** ~29% (as of 2026-01-14)
**Threshold:** 28-30% (enforced by vitest.config.js)
**Long-term goal:** 40%+

### Well-Covered Modules ✅
- `dom-cache.ts`: 100%
- `charts.ts`: 99%
- `renderers.ts`: 93%
- `theme-manager.ts`: 92%
- `logger.ts`: 89%
- `favorites.ts`: 88%
- `error-boundary.ts`: 88%
- `utils.ts`: 91%
- `ocr.ts`: 78%

### Priority for Coverage Improvements 🎯

**High Priority** (user-facing features):
1. `modal.ts`: 3% → 40% - Modal interactions, item details
2. `build-planner.ts`: 13% → 40% - Build creation, tome selection
3. `calculator.ts`: 25% → 50% - Breakpoint calculations (expand existing tests)

**Medium Priority** (supporting features):
4. `advisor.ts`: 0% → 30% - Build recommendations
5. `data-service.ts`: 17% → 40% - Data loading and validation
6. `compare.ts`: 43% → 60% - Item comparison

**Lower Priority** (complex/specialized):
7. `scan-build.ts`: 0% → 20% - Screenshot build detection (requires canvas)
8. `computer-vision.ts`: 8% → 20% - CV algorithms (partially covered)
9. `changelog.ts`: 0% → 30% - Changelog rendering

### Coverage Strategy

1. **Quick Wins**: Improve calculator.ts and compare.ts (already have tests, just expand)
2. **User Impact**: Add modal.ts tests (high user interaction)
3. **Business Logic**: Cover build-planner.ts core functions
4. **Incremental**: Add 2-3 tests per module per sprint

### Running Coverage

```bash
# Full coverage report (may hit memory limits)
npm run test:unit

# Per-file coverage (recommended)
npx vitest run tests/unit/calculator.test.js --coverage

# Check coverage without running full suite
npx vitest run tests/unit/modal.test.js --coverage
```

## Test Structure

```
tests/
├── unit/              # Unit tests (vitest + jsdom)
├── e2e/               # End-to-end tests (Playwright)
├── integration/       # Integration tests
├── performance/       # Performance benchmarks
├── fixtures/          # Test data
├── helpers/           # Test utilities
└── test-images/       # Screenshots for CV testing
```

## Writing Tests

### Unit Tests

Use vitest with jsdom environment:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '../../src/modules/my-module.ts';

describe('myFunction', () => {
    it('should do something', () => {
        expect(myFunction()).toBe(expected);
    });
});
```

### E2E Tests

Use Playwright for browser automation:

```javascript
import { test, expect } from '@playwright/test';

test('should load homepage', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await expect(page).toHaveTitle(/MegaBonk/);
});
```

## CI/CD Recommendations

For CI environments with limited memory:

1. Split tests across multiple jobs
2. Run without coverage or use per-file coverage
3. Increase heap size to maximum available
4. Use test sharding: `vitest run --shard=1/4`
