#!/usr/bin/env node
/**
 * Combined Coverage Report
 * 
 * Merges vitest unit test coverage with Playwright E2E browser coverage
 * to produce a unified coverage report.
 * 
 * Usage: node scripts/combined-coverage.mjs
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const nycOutputDir = join(projectRoot, '.nyc_output');
const coverageDir = join(projectRoot, 'coverage');

function log(msg) {
    console.log(`\x1b[36m[combined-coverage]\x1b[0m ${msg}`);
}

function logError(msg) {
    console.error(`\x1b[31m[combined-coverage]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
    console.log(`\x1b[32m[combined-coverage]\x1b[0m ${msg}`);
}

function runCommand(cmd, options = {}) {
    log(`Running: ${cmd}`);
    try {
        const result = execSync(cmd, { 
            cwd: projectRoot, 
            stdio: options.silent ? 'pipe' : 'inherit',
            env: { ...process.env, ...options.env }
        });
        return result?.toString() || true;
    } catch (error) {
        if (!options.ignoreError) {
            logError(`Command failed: ${cmd}`);
        }
        return false;
    }
}

async function main() {
    const startTime = Date.now();
    
    log('Starting combined coverage collection...');
    
    // Step 1: Clean up
    log('Step 1: Cleaning previous coverage data...');
    if (existsSync(nycOutputDir)) {
        runCommand('rm -rf .nyc_output/*', { ignoreError: true });
    }
    mkdirSync(nycOutputDir, { recursive: true });
    
    // Step 2: Run vitest with coverage to get unit test coverage
    log('Step 2: Running unit tests with coverage...');
    const vitestResult = runCommand('npx vitest run --coverage --coverage.provider=istanbul 2>&1 | tail -30');
    
    // Step 3: Convert vitest coverage to nyc format if needed
    // Vitest with istanbul generates coverage-final.json
    const vitestCoverageFile = join(coverageDir, 'coverage-final.json');
    if (existsSync(vitestCoverageFile)) {
        log('  ✓ Vitest coverage found');
        // Copy to nyc_output for merging
        cpSync(vitestCoverageFile, join(nycOutputDir, 'vitest-coverage.json'));
    } else {
        logError('  ✗ Vitest coverage not found');
    }
    
    // Step 4: Check for E2E coverage
    log('Step 3: Checking for E2E coverage...');
    const e2eCoverageFiles = existsSync(nycOutputDir) 
        ? readdirSync(nycOutputDir).filter(f => f.startsWith('coverage-') && f.endsWith('.json'))
        : [];
    
    if (e2eCoverageFiles.length > 0) {
        logSuccess(`  ✓ Found ${e2eCoverageFiles.length} E2E coverage files`);
    } else {
        log('  ! No E2E coverage found. Run "npm run test:e2e:coverage" first.');
    }
    
    // Step 5: Generate combined report
    log('Step 4: Generating combined coverage report...');
    runCommand('npx nyc merge .nyc_output coverage/combined-coverage.json');
    runCommand('npx nyc report --reporter=text --reporter=html --reporter=lcov --temp-dir=.nyc_output --report-dir=coverage/combined');
    
    // Step 6: Show summary
    log('');
    log('═══════════════════════════════════════════════════════');
    
    // Get summary
    const summary = runCommand('npx nyc report --reporter=text-summary --temp-dir=.nyc_output 2>&1', { silent: true });
    if (summary) {
        console.log(summary);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logSuccess(`Combined coverage report complete in ${elapsed}s`);
    log('═══════════════════════════════════════════════════════');
    log('');
    log('Reports generated:');
    log('  • HTML: coverage/combined/index.html');
    log('  • LCOV: coverage/combined/lcov.info');
    log('  • JSON: coverage/combined-coverage.json');
}

main().catch(err => {
    logError(err.message);
    process.exit(1);
});
