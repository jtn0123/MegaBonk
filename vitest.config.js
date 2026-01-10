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
            // Thresholds set to current coverage levels
            // Most tests use mock implementations - only utils.ts imports from source
            // TODO: Refactor tests to import from source modules to increase coverage
            thresholds: {
                statements: 3,
                branches: 4,
                functions: 6,
                lines: 3,
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
