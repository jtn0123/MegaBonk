# Testing Guide

## Memory Leak Prevention

### Critical: Always Restore Mocks

**NEVER** use `vi.spyOn()` without proper cleanup. The test infrastructure has built-in cleanup in `tests/setup.js`, but if you add custom cleanup in individual test files, follow this pattern:

```javascript
// ❌ WRONG - Memory leak!
describe('My tests', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.clearAllMocks(); // ⚠️ Only clears history, NOT the spy!
    });
});

// ✅ CORRECT - Proper cleanup
describe('My tests', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks(); // ✅ Removes spy instances
    });
});
```

### The Difference

- **`vi.clearAllMocks()`** - Clears spy call history (`mockSpy.mock.calls = []`)
- **`vi.restoreAllMocks()`** - Removes spy completely and restores original function

Both are needed:
1. `clearAllMocks()` for clean test isolation
2. `restoreAllMocks()` to prevent memory leaks

### Global Cleanup Checklist

The `tests/setup.js` file handles cleanup for all tests. It **MUST** include:

```javascript
afterEach(() => {
    vi.clearAllTimers();     // Clear setTimeout/setInterval
    vi.clearAllMocks();      // Clear mock call history
    vi.restoreAllMocks();    // ⚠️ CRITICAL: Remove spy instances
    vi.resetModules();       // Clear module cache

    // Close JSDOM window
    if (currentDom && currentDom.window) {
        currentDom.window.close();
        currentDom = null;
    }
});
```

**Missing `vi.restoreAllMocks()` will cause memory leaks** that accumulate across test files and eventually crash the test runner.

### Memory Leak Detection

Run the canary test to verify cleanup is working:

```bash
bun test tests/unit/test-cleanup-guard.test.js
```

If this test fails, there's a memory leak in the test infrastructure.

## Best Practices

### 1. Use Global Setup for Common Mocks

Don't duplicate mock setup in every test file. Use `tests/setup.js` for:
- Console mocks
- LocalStorage mocks
- Fetch mocks
- Service worker mocks

### 2. Clean Up Custom Resources

If your test creates resources beyond what `setup.js` handles:

```javascript
describe('File system tests', () => {
    let tempFile;

    beforeEach(() => {
        tempFile = createTempFile();
    });

    afterEach(() => {
        // Clean up YOUR resources
        if (tempFile) {
            tempFile.delete();
            tempFile = null;
        }
        // Global cleanup still runs automatically
    });
});
```

### 3. Avoid Test Interdependence

Each test should be independent. Use `beforeEach` for setup, never rely on previous test state.

### 4. Watch for Event Listeners

Event listeners can cause memory leaks if not removed:

```javascript
afterEach(() => {
    // Remove any event listeners you added
    document.removeEventListener('click', myHandler);
});
```

### 5. Close Timers Explicitly

While `vi.clearAllTimers()` runs automatically, explicit cleanup is clearer:

```javascript
let intervalId;

beforeEach(() => {
    intervalId = setInterval(() => {}, 100);
});

afterEach(() => {
    clearInterval(intervalId);
});
```

## Debugging Memory Leaks

### Check Memory Usage

Run tests with Node's memory profiler:

```bash
NODE_OPTIONS="--max-old-space-size=4096" bun test
```

### Run Tests in Isolation

Find the leaking test by running files individually:

```bash
bun test tests/unit/specific-file.test.js
```

### Monitor Memory Growth

Add logging to track memory:

```javascript
afterEach(() => {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`Memory: ${Math.round(used)} MB`);
});
```

### Common Memory Leak Causes

1. **Unrestored spies** - Missing `vi.restoreAllMocks()`
2. **Unclosed DOM windows** - Not calling `dom.window.close()`
3. **Lingering timers** - Not clearing intervals/timeouts
4. **Event listeners** - Not removing listeners
5. **Module cache** - Not calling `vi.resetModules()`
6. **Large data structures** - Not nullifying references

## CI/CD Integration

### GitHub Actions

Add memory monitoring to your workflow:

```yaml
- name: Run tests with memory check
  run: |
    NODE_OPTIONS="--max-old-space-size=2048" bun test
  env:
    NODE_ENV: test
```

### Pre-commit Hook

Validate cleanup patterns before commit:

```bash
# .husky/pre-commit
grep -r "vi.spyOn" tests/ | while read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    if ! grep -q "restoreAllMocks" "$file"; then
        echo "⚠️  Warning: $file uses vi.spyOn but might not restore mocks"
    fi
done
```

## Further Reading

- [Vitest API: Mocking](https://vitest.dev/api/vi.html)
- [JSDOM Memory Management](https://github.com/jsdom/jsdom#closing-down-a-jsdom)
- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
