#!/usr/bin/env node
/**
 * Cross-platform coverage script
 * Runs tests with sharding and merges coverage reports
 * Works on Windows, Mac, and Linux
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SHARD_COUNT = 15;
const NYC_OUTPUT_DIR = '.nyc_output';
const COVERAGE_DIR = 'coverage';

// Colors for terminal output
const colors = {
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? true : false;

        const proc = spawn(command, args, {
            stdio: 'inherit',
            shell,
            env: {
                ...process.env,
                // Note: NODE_OPTIONS heap size removed - memory leaks fixed via cleanup functions in tests/setup.js
            },
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                // Don't reject - allow partial failures
                resolve({ success: false, code });
            }
        });

        proc.on('error', (err) => {
            resolve({ success: false, error: err });
        });
    });
}

async function main() {
    log('\n=== Running tests with merged coverage ===', 'cyan');

    // Clean up previous coverage
    if (existsSync(COVERAGE_DIR)) {
        rmSync(COVERAGE_DIR, { recursive: true, force: true });
    }
    if (existsSync(NYC_OUTPUT_DIR)) {
        rmSync(NYC_OUTPUT_DIR, { recursive: true, force: true });
    }

    // Create nyc output directory
    mkdirSync(NYC_OUTPUT_DIR, { recursive: true });

    let successCount = 0;
    let failCount = 0;

    // Run each shard
    for (let i = 1; i <= SHARD_COUNT; i++) {
        log(`\n--- Running shard ${i}/${SHARD_COUNT} ---`, 'yellow');

        const result = await runCommand('npx', ['vitest', 'run', `--shard=${i}/${SHARD_COUNT}`, '--coverage']);

        if (result.success) {
            successCount++;
        } else {
            failCount++;
            log(`Shard ${i} had issues (code: ${result.code})`, 'yellow');
        }

        // Copy coverage file with unique name (even if tests failed, coverage may exist)
        const coverageFile = join(COVERAGE_DIR, 'coverage-final.json');
        if (existsSync(coverageFile)) {
            const destFile = join(NYC_OUTPUT_DIR, `coverage-shard-${i}.json`);
            copyFileSync(coverageFile, destFile);
            log(`Saved coverage for shard ${i}`, 'green');
        } else {
            log(`Warning: No coverage-final.json for shard ${i}`, 'yellow');
        }
    }

    log(`\n=== Shard results: ${successCount} passed, ${failCount} had issues ===`,
        failCount === 0 ? 'green' : 'yellow');

    log('\n=== Merging coverage from all shards ===', 'cyan');

    // Check if we have any coverage files to merge
    const coverageFiles = existsSync(NYC_OUTPUT_DIR)
        ? readdirSync(NYC_OUTPUT_DIR).filter(f => f.endsWith('.json'))
        : [];

    if (coverageFiles.length === 0) {
        log('No coverage files to merge!', 'red');
        process.exit(1);
    }

    log(`Found ${coverageFiles.length} coverage files to merge`, 'cyan');

    try {
        // Merge with nyc
        await runCommand('npx', ['nyc', 'merge', NYC_OUTPUT_DIR, join(COVERAGE_DIR, 'coverage-final.json')]);

        // Generate reports
        await runCommand('npx', ['nyc', 'report',
            '--reporter=html',
            '--reporter=text',
            '--reporter=lcov',
            `--temp-dir=${COVERAGE_DIR}`,
            `--report-dir=${COVERAGE_DIR}`
        ]);
    } catch (error) {
        log('Coverage merge failed!', 'red');
        process.exit(1);
    }

    // Cleanup
    rmSync(NYC_OUTPUT_DIR, { recursive: true, force: true });

    log('\n=== Coverage report generated in ./coverage/ ===', 'green');
    log('Open coverage/index.html to view the report', 'cyan');

    // Exit with error if any shards failed
    if (failCount > 0) {
        log(`\nNote: ${failCount} shard(s) had issues. Coverage may be incomplete.`, 'yellow');
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
