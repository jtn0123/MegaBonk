# Testing Guide

## Setup

```bash
npm install                # Install npm dependencies
npx playwright install     # Download browser binaries for E2E tests (~470MB, required once)
```

## Quick Reference

| Command | What it runs |
|---------|-------------|
| `npm run test:unit` | Unit tests with coverage |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Playwright E2E tests (all browsers) |
| `npm run test:e2e:fast` | E2E tests (Chromium only) |
| `npm run test:all` | Unit + E2E |
| `npm run test:ocr` | OCR module tests |
| `npm run test:cv` | Computer vision tests |
| `npm run test:cv:real` | CV tests with real screenshots (requires `canvas`) |
| `npm run test:integration` | OCR + CV integration tests |
| `npm run test:performance` | Performance benchmarks |
| `npm run test:recognition` | All recognition tests (OCR + CV + integration) |

### Single file

```bash
npx vitest run tests/unit/filtering.test.js
```

## Test Structure

```
tests/
├── unit/              # Vitest + jsdom
├── e2e/               # Playwright browser tests
├── integration/       # Integration tests
├── performance/       # Benchmarks
├── fixtures/          # Sample JSON data
├── helpers/           # DOM setup and mock utilities
└── test-images/       # Screenshots for CV testing
```

## Writing Tests

### Unit Tests (Vitest)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '../../src/modules/my-module.ts';

describe('myFunction', () => {
    it('should do something', () => {
        expect(myFunction()).toBe(expected);
    });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('should load homepage', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await expect(page).toHaveTitle(/MegaBonk/);
});
```

## Memory Leak Prevention

### Always Restore Mocks

```javascript
// Global cleanup in tests/setup.js handles this, but if you add custom cleanup:
afterEach(() => {
    vi.clearAllMocks();      // Clear mock call history
    vi.restoreAllMocks();    // Remove spy instances (prevents memory leaks)
});
```

**Key difference:**
- `vi.clearAllMocks()` — clears spy call history
- `vi.restoreAllMocks()` — removes spy and restores original function

Missing `vi.restoreAllMocks()` causes memory leaks that accumulate across test files and crash the runner.

### Memory Leak Detection

```bash
npx vitest run tests/unit/test-cleanup-guard.test.js  # Canary test
```

### Common Leak Causes

1. Unrestored spies — missing `vi.restoreAllMocks()`
2. Unclosed DOM windows — not calling `dom.window.close()`
3. Lingering timers — not clearing intervals/timeouts
4. Event listeners — not removing listeners
5. Module cache — not calling `vi.resetModules()`

## Coverage

**Thresholds** (enforced in `vitest.config.js`): 80% statements, 70% branches, 80% functions, 80% lines.

```bash
npm run test:unit                                    # Full coverage report
npx vitest run tests/unit/calculator.test.js --coverage  # Per-file coverage
```

## Known Issues

### Memory Overflow During Coverage Collection

V8 coverage provider can exceed 8GB heap when running all 50+ test files. Workarounds:

```bash
# Run without coverage
NODE_OPTIONS='--max-old-space-size=8192' npx vitest run

# Run specific files with coverage
npx vitest run tests/unit/computer-vision.test.ts --coverage
```

### Canvas Module

Required only for CV tests with real images (`cv-real-images.test.ts`). Tests skip gracefully if unavailable.

**Install native deps:**
- **Linux**: `apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
- **Mac**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`

## Image Recognition Testing

### CV/OCR Test Suites

| Suite | File | Tests | What it covers |
|-------|------|-------|---------------|
| OCR | `tests/unit/ocr.test.ts` | ~45 | Text extraction, fuzzy matching, confidence |
| CV | `tests/unit/computer-vision.test.ts` | ~35 | Resolution detection, UI layout, regions |
| Integration | `tests/unit/scan-build-integration.test.ts` | ~30 | OCR+CV pipeline, accuracy metrics |
| Performance | `tests/performance/benchmark.test.ts` | ~20 | Speed, memory, stress tests |

### Performance Targets

| Metric | Target |
|--------|--------|
| OCR extraction | < 3s |
| CV analysis | < 500ms |
| Full pipeline | < 5s |
| Fuzzy search | < 50ms/query |
| Memory footprint | < 100MB |

### Test Screenshots

For best results, use pause-menu screenshots (clear text, minimal effects, full screen, PNG format).

**Ground truth format** (`ground-truth.json`):

```json
{
  "screenshot1.png": {
    "character": "CL4NK",
    "weapon": "Hammer",
    "items": ["Battery", "Battery", "Gym Sauce", "Anvil"],
    "tomes": ["Damage Tome", "Crit Tome"]
  }
}
```

## CI/CD

Tests run on pre-commit hooks (lint-staged), PR creation, and main branch merges.

For CI environments with limited memory:
- Split tests across multiple jobs
- Use test sharding: `vitest run --shard=1/4`
- Increase heap size: `NODE_OPTIONS="--max-old-space-size=8192"`
