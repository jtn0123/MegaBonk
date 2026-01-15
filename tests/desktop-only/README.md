# Desktop-Only Test Files

This directory contains **heavy integration tests** that should be run on a desktop computer with adequate resources, not in CI or constrained environments.

## Why desktop-only?

These tests are resource-intensive and may:
- Require significant memory (>4GB)
- Need actual browser rendering
- Perform heavy image processing
- Use real OCR libraries (Tesseract.js)
- Take a long time to execute

## Running these tests:

```bash
# Run all desktop-only tests
npm test tests/desktop-only/

# Run specific test file
npm test tests/desktop-only/cv-real-images.test.ts

# Run with coverage
npm run test:unit -- tests/desktop-only/
```

## Test Categories:

### 1. Real Integration Tests (*-real.test.ts)
These are full integration tests with actual DOM manipulation, real data loading, and complex interactions:
- `advisor-real.test.ts` - Real advisor recommendations with full game data
- `build-planner-real.test.ts` - Full build planner workflows
- `calculator-real.test.ts` - Complex calculation scenarios
- `modal-real.test.ts` - Real modal interactions and animations
- And 16 more...

### 2. Computer Vision Tests
- `cv-real-images.test.ts` - Tests with actual game screenshots
- `tesseract-integration.test.ts` - Real OCR with Tesseract.js

## Total: 24 test files

These tests provide comprehensive validation but are not run automatically to prevent CI memory issues.

## Recommendation:

Run these tests:
1. **Before major releases** - Full validation
2. **When modifying core logic** - Regression testing
3. **On desktop/laptop** - With adequate resources
4. **After pull requests** - Manual validation

The tests in `tests/unit/` should still provide good coverage for CI/CD pipelines.
