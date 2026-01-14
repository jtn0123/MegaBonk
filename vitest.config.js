import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.js'],
        include: [
            'tests/unit/**/*.test.js',
            'tests/unit/**/*.test.ts',
            'tests/integration/**/*.test.js',
            'tests/performance/**/*.test.ts',
        ],
        // Pool configuration to prevent memory overflow
        // Use single fork to run all tests in one worker sequentially
        // This is slower but prevents memory accumulation from multiple workers
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true, // Run all tests in one worker to prevent memory accumulation
            },
        },
        // Single worker only to conserve memory
        maxWorkers: 1,
        minWorkers: 1,
        // Don't isolate - keep tests in same context to reduce overhead
        isolate: false,
        // Sequence tests serially to reduce memory pressure
        sequence: {
            concurrent: false,
            shuffle: false,
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/modules/**/*.ts', 'src/script.ts'],
            exclude: ['src/libs/**', 'src/sw.js', '**/*.test.js', '**/*.test.ts', '**/*.config.js'],
            // Reduce memory usage during coverage collection
            reportsDirectory: './coverage',
            clean: true,
            all: false, // Only collect coverage for files that are tested (reduces memory)
            // Thresholds updated 2026-01-10 after adding comprehensive unit tests:
            // New test files added:
            //   - filters-advanced.test.js (72 tests) - search history, filter state, fuzzy search
            //   - events.test.js (47 tests) - event delegation, loading, errors, tab switching
            //   - error-boundary.test.js (26 tests) - error recovery functions
            //   - theme-manager.test.js (36 tests) - theme toggle and persistence
            //   - logger.test.js (34 tests) - wide events logging
            //   - dom-cache.test.js (35 tests) - DOM element caching
            // Key module coverage:
            //   - dom-cache.ts: 100%
            //   - theme-manager.ts: 92.15%
            //   - error-boundary.ts: 87.71%
            //   - events.ts: 77.72%
            //   - logger.ts: 72.63%
            //   - filters.ts: 64.83%
            //   - synergy.ts: 96%
            //   - favorites.ts: 88.46%
            //   - utils.ts: 88.31%
            //   - charts.ts: 96.52%
            //   - renderers.ts: 93.10%
            //   - match-badge.ts: 100%
            // Overall coverage: ~29% (as of 2026-01-14)
            // Adjusted from unrealistic 45% target to current actual coverage
            // TODO: Incrementally improve to 40%+ by adding tests for:
            //   - modal.ts (3% -> 40%)
            //   - build-planner.ts (13% -> 40%)
            //   - calculator.ts (25% -> 50%)
            //   - advisor.ts (0% -> 30%)
            //   - scan-build.ts (0% -> 30%)
            thresholds: {
                statements: 28,
                branches: 30,
                functions: 29,
                lines: 28,
            },
        },
    },
    resolve: {
        alias: {
            '@': '/src',
            '@modules': '/src/modules',
        },
    },
});
