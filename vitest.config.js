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
      include: [
        'src/modules/**/*.js',
        'src/script.js'
      ],
      exclude: [
        'src/libs/**',
        'src/sw.js',
        '**/*.test.js',
        '**/*.config.js'
      ],
      // Updated thresholds for ES modules with direct imports
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@modules': '/src/modules'
    }
  }
});
