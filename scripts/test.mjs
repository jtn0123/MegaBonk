#!/usr/bin/env node
/**
 * Test runner wrapper that uses vitest programmatic API
 * Workaround for vitest CLI config loading hang
 */
import { startVitest } from 'vitest/node';

const args = process.argv.slice(2);
const hasCoverage = args.includes('--coverage');

// Don't pass specific test files - let vitest discover them
// Specifying files causes hangs for unknown reason
const testFiles = [];

async function main() {
  console.log('Starting tests...');

  const options = {
    run: true,
    config: false,  // Don't load config file
    watch: false,
    passWithNoTests: false,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.{js,ts}', 'tests/integration/**/*.test.{js,ts}'],
    testTimeout: 10000,
    hookTimeout: 10000,
  };

  // Add coverage if requested
  if (hasCoverage) {
    options.coverage = {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/modules/**/*.ts', 'src/script.ts'],
      exclude: ['src/libs/**', 'src/sw.js', '**/*.test.js', '**/*.config.js'],
      thresholds: {
        statements: 45,
        branches: 40,
        functions: 42,
        lines: 45,
      },
    };
  }

  try {
    const vitest = await startVitest('test', testFiles, options);

    if (vitest) {
      await vitest.close();
    }

    console.log('Tests completed.');
    process.exit(0);
  } catch (error) {
    console.error('Test error:', error.message);
    process.exit(1);
  }
}

main();
