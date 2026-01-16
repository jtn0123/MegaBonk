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
            maxForks: 4, // Run up to 4 test files in parallel
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
            // Overall coverage: ~32% (as of 2026-01-15)
            // Coverage improved after architecture refactor and test additions:
            //   - advisor.ts: 88%
            //   - recommendation.ts: 93%
            //   - scan-build.ts: comprehensive tests exist
            // TODO: Continue improving coverage for:
            //   - modal.ts (3% -> 40%)
            //   - build-planner.ts (13% -> 40%)
            //   - calculator.ts (25% -> 50%)
            // Thresholds increased from 30/25/30/30 to 32/27/32/32
            thresholds: {
                statements: 32,
                branches: 27,
                functions: 32,
                lines: 32,
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
