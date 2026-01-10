import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.js'],
        include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/modules/**/*.ts', 'src/script.ts'],
            exclude: ['src/libs/**', 'src/sw.js', '**/*.test.js', '**/*.config.js'],
            // Thresholds updated after refactoring filtering.test.js and build-stats.test.js
            // to import from real source modules instead of standalone implementations.
            // Key coverage improvements:
            //   - filters.ts: 0% → 27%
            //   - build-planner.ts: 0% → 13%
            //   - utils.ts: 93%+ (already covered)
            // TODO: Continue refactoring other test files to reach 70%+ coverage
            thresholds: {
                statements: 9,
                branches: 9,
                functions: 9,
                lines: 9,
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
