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
            // Thresholds updated after refactoring test files to import real source modules:
            // Key coverage improvements:
            //   - filters.ts: 0% → 27%
            //   - build-planner.ts: 0% → 13%
            //   - favorites.ts: 0% → 88%
            //   - compare.ts: 0% → 33%
            //   - synergy.ts: 0% → 96%
            //   - toast.ts: 87% → 94%
            //   - utils.ts: 93%+ (already covered)
            // Overall coverage: 14.67%
            thresholds: {
                statements: 12,
                branches: 12,
                functions: 12,
                lines: 12,
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
