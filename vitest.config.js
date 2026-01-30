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
        // Note: tests/archived/ contains old .js files replaced by TypeScript versions
        // Note: tests/desktop-only/ contains heavy -real.test.ts files for local execution
        // Parallelized configuration - memory leaks fixed in tests/setup.js
        pool: 'forks',
        isolate: true, // Each test file gets its own fresh context
        fileParallelism: true, // Run files in parallel (memory leaks fixed)
        // Forks pool options (Vitest 4+ uses top-level)
        forks: {
            singleFork: false, // Use multiple forks for parallelization
            maxForks: 2, // Reduced from 4 to prevent OOM on 16GB systems
            minForks: 1,
            // Note: execArgv heap size removed - memory leaks fixed via cleanup functions
        },
        // Test execution order - sequential within files to maintain state isolation
        sequence: {
            concurrent: false, // Tests within a file run sequentially (prevents state race conditions)
            shuffle: false,
        },
        // Teardown timeout - give time for cleanup
        teardownTimeout: 5000,
        // Disable watch mode file caching to reduce memory
        cache: false,
        // Limit hanging test timeouts
        testTimeout: 30000,
        hookTimeout: 30000,
        bail: 0, // Run all tests, don't stop on failure
        coverage: {
            provider: 'istanbul', // Changed from v8 - lower memory footprint
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/libs/**', 'src/sw.js', 'src/types/**', '**/*.test.js', '**/*.test.ts', '**/*.config.js'],
            // Reduce memory usage during coverage collection
            reportsDirectory: './coverage',
            clean: true,
            all: false, // Only include tested files
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
            // Overall coverage: ~54% (as of 2026-01-17)
            // Coverage improved after fixing test mock issues
            // Current actual: 54% statements, 49% branches, 57% functions, 54% lines
            // Thresholds set at 45/40/45/45 to catch regressions while allowing variance
            // Updated 2026-01-20: Increased thresholds after adding comprehensive tests
            // Target: 90% (aspirational), Current: ~63%
            // Added tests for: cv-error-analysis, debug-ui, offline-ui, search-history,
            // skeleton-loader, tab-loader
            thresholds: {
                statements: 60,
                branches: 55,
                functions: 60,
                lines: 60,
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
