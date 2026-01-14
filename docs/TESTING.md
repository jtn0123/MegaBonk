# Testing Guide

## Running Tests

### Unit Tests
```bash
bun run test:unit          # Run with coverage (may hit memory limits)
bun test tests/unit/       # Run without coverage (faster, no memory issues)
```

### E2E Tests
```bash
bun run test:e2e           # Run Playwright end-to-end tests
bun run test:e2e:ui        # Run with Playwright UI
```

### All Tests
```bash
bun run test:all           # Run both unit and e2e tests
```

## Known Issues

### Memory Overflow During Coverage Collection

**Symptom:** Tests pass (1705 passed) but worker crashes with "JavaScript heap out of memory" during coverage report generation.

**Root Cause:** V8 coverage provider accumulates data for all 50+ test files. When generating the final report, memory usage exceeds 8GB heap limit.

**Workarounds:**

1. **Run tests without coverage** (fastest, no memory issues):
   ```bash
   NODE_OPTIONS='--max-old-space-size=8192' bunx vitest run
   ```

2. **Run specific test files with coverage**:
   ```bash
   bun test tests/unit/computer-vision.test.ts --coverage
   bun test tests/unit/filters.test.js --coverage
   ```

3. **Skip memory-intensive CV tests**:
   ```bash
   bunx vitest run --exclude='**/cv-*.test.ts'  --coverage
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
bun install canvas
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

Current coverage: ~29%
Target coverage: 45%

Well-covered modules:
- `dom-cache.ts`: 100%
- `charts.ts`: 99%
- `renderers.ts`: 93%
- `theme-manager.ts`: 92%
- `logger.ts`: 89%

Needs coverage:
- `advisor.ts`: 0%
- `changelog.ts`: 0%
- `cv-enhanced.ts`: 0%
- `scan-build.ts`: 0%
- `recommendation.ts`: 0%
- `modal.ts`: 3%
- `computer-vision.ts`: 8%
- `build-planner.ts`: 13%

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
