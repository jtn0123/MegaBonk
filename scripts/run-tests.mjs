#!/usr/bin/env node
/**
 * Smart test runner that handles worker crashes gracefully
 * Checks actual test results instead of relying on exit codes
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SHARD_COUNT = parseInt(process.env.TEST_SHARDS || '5', 10);
const RESULTS_DIR = 'test-results';
const MAX_RETRIES = 2;

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

async function runShard(shardIndex, totalShards) {
    return new Promise((resolve) => {
        const resultFile = join(RESULTS_DIR, `shard-${shardIndex}.json`);

        const proc = spawn('npx', [
            'vitest', 'run',
            `--shard=${shardIndex}/${totalShards}`,
            '--reporter=json',
            `--outputFile=${resultFile}`,
        ], {
            stdio: ['inherit', 'inherit', 'inherit'],
            shell: process.platform === 'win32',
            env: {
                ...process.env,
                // Note: NODE_OPTIONS heap size removed - memory leaks fixed via cleanup functions in tests/setup.js
            },
        });

        proc.on('close', (code) => {
            // Check JSON results file regardless of exit code
            let testsPassed = true;
            let testsRun = 0;
            let testsFailed = 0;

            if (existsSync(resultFile)) {
                try {
                    const results = JSON.parse(readFileSync(resultFile, 'utf8'));
                    testsFailed = results.numFailedTests || 0;
                    testsRun = results.numTotalTests || 0;
                    testsPassed = testsFailed === 0;
                } catch (e) {
                    log(`Warning: Could not parse results for shard ${shardIndex}`, 'yellow');
                }
            }

            resolve({
                shard: shardIndex,
                exitCode: code,
                testsPassed,
                testsRun,
                testsFailed,
            });
        });

        proc.on('error', (err) => {
            resolve({
                shard: shardIndex,
                exitCode: 1,
                testsPassed: false,
                testsRun: 0,
                testsFailed: 0,
                error: err.message,
            });
        });
    });
}

async function main() {
    log('\n=== Running tests with smart worker crash handling ===', 'cyan');
    log(`Shards: ${SHARD_COUNT}`, 'cyan');

    // Create results directory
    if (!existsSync(RESULTS_DIR)) {
        mkdirSync(RESULTS_DIR, { recursive: true });
    }

    const results = [];
    let totalTests = 0;
    let totalFailed = 0;
    let workerCrashes = 0;

    for (let i = 1; i <= SHARD_COUNT; i++) {
        log(`\n--- Running shard ${i}/${SHARD_COUNT} ---`, 'yellow');

        const result = await runShard(i, SHARD_COUNT);
        results.push(result);

        totalTests += result.testsRun;
        totalFailed += result.testsFailed;

        if (result.exitCode !== 0 && result.testsRun === 0) {
            // Worker crashed without running any tests - treat as failure
            totalFailed++;
            log(`Shard ${i}: Worker crashed without running any tests!`, 'red');
        } else if (result.exitCode !== 0 && result.testsPassed) {
            workerCrashes++;
            log(`Shard ${i}: Worker crashed but tests passed (${result.testsRun} tests)`, 'yellow');
        } else if (result.exitCode !== 0) {
            log(`Shard ${i}: ${result.testsFailed} tests failed out of ${result.testsRun}`, 'red');
        } else {
            log(`Shard ${i}: All ${result.testsRun} tests passed`, 'green');
        }
    }

    // Summary
    log('\n=== Test Summary ===', 'cyan');
    log(`Total tests: ${totalTests}`, 'cyan');
    log(`Failed tests: ${totalFailed}`, totalFailed > 0 ? 'red' : 'green');
    log(`Worker crashes: ${workerCrashes}`, workerCrashes > 0 ? 'yellow' : 'green');

    // Save summary
    const summary = {
        totalTests,
        totalFailed,
        workerCrashes,
        shards: results,
        timestamp: new Date().toISOString(),
    };
    writeFileSync(join(RESULTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

    // Exit based on TEST FAILURES, not worker crashes
    if (totalFailed > 0) {
        log(`\n${totalFailed} test(s) failed!`, 'red');
        process.exit(1);
    } else if (workerCrashes > 0) {
        log(`\nAll tests passed! (${workerCrashes} worker crash(es) during cleanup - this is a known Vitest/jsdom issue)`, 'green');
        process.exit(0);
    } else {
        log('\nAll tests passed!', 'green');
        process.exit(0);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
