#!/usr/bin/env node
/**
 * E2E Coverage Collection Script
 * 
 * Runs Playwright tests with Istanbul instrumentation and merges
 * browser coverage with vitest unit test coverage.
 * 
 * Usage: node scripts/e2e-coverage.mjs
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const nycOutputDir = join(projectRoot, '.nyc_output');
const coverageDir = join(projectRoot, 'coverage');

function log(msg) {
    console.log(`\x1b[36m[e2e-coverage]\x1b[0m ${msg}`);
}

function logError(msg) {
    console.error(`\x1b[31m[e2e-coverage]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
    console.log(`\x1b[32m[e2e-coverage]\x1b[0m ${msg}`);
}

function runCommand(cmd, options = {}) {
    log(`Running: ${cmd}`);
    try {
        execSync(cmd, { 
            cwd: projectRoot, 
            stdio: 'inherit',
            env: { ...process.env, ...options.env }
        });
        return true;
    } catch (error) {
        logError(`Command failed: ${cmd}`);
        return false;
    }
}

async function main() {
    const startTime = Date.now();
    
    log('Starting E2E coverage collection...');
    
    // Step 1: Clean up
    log('Step 1: Cleaning previous coverage data...');
    if (existsSync(nycOutputDir)) {
        rmSync(nycOutputDir, { recursive: true, force: true });
    }
    mkdirSync(nycOutputDir, { recursive: true });
    
    // Step 2: Build with instrumentation
    log('Step 2: Building with Istanbul instrumentation...');
    if (!runCommand('npm run build', { env: { COVERAGE: 'true' } })) {
        logError('Failed to build with instrumentation');
        process.exit(1);
    }
    
    // Step 3: Verify instrumentation
    log('Step 3: Verifying instrumentation...');
    const distDir = join(projectRoot, 'dist');
    const jsFiles = readdirSync(join(distDir, 'assets')).filter(f => f.endsWith('.js'));
    
    let instrumented = false;
    for (const file of jsFiles.slice(0, 3)) {
        const content = readFileSync(join(distDir, 'assets', file), 'utf-8');
        if (content.includes('__coverage__') || content.includes('cov_')) {
            instrumented = true;
            log(`  ✓ Found instrumentation in ${file}`);
            break;
        }
    }
    
    if (!instrumented) {
        logError('WARNING: No Istanbul instrumentation found in build output!');
        logError('Coverage collection may not work properly.');
    }
    
    // Step 4: Run Playwright tests with coverage config
    log('Step 4: Running Playwright tests...');
    const playwrightResult = runCommand('npx playwright test --config=playwright.coverage.config.js');
    
    // Step 5: Check collected coverage files
    log('Step 5: Checking collected coverage...');
    const coverageFiles = existsSync(nycOutputDir) 
        ? readdirSync(nycOutputDir).filter(f => f.endsWith('.json'))
        : [];
    
    if (coverageFiles.length === 0) {
        logError('No coverage data collected from browser!');
        logError('This usually means:');
        logError('  1. Tests did not exercise instrumented code');
        logError('  2. Coverage helper not collecting window.__coverage__');
        logError('  3. Build instrumentation failed');
    } else {
        logSuccess(`Collected ${coverageFiles.length} coverage files`);
    }
    
    // Step 6: Generate NYC report
    log('Step 6: Generating coverage report...');
    if (coverageFiles.length > 0) {
        // First merge all coverage files
        runCommand('npx nyc merge .nyc_output coverage/e2e-coverage.json');
        
        // Generate report from merged data
        runCommand('npx nyc report --reporter=text --reporter=html --reporter=json --temp-dir=.nyc_output --report-dir=coverage/e2e');
    }
    
    // Step 7: Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log('');
    log('═══════════════════════════════════════════════════════');
    logSuccess(`E2E Coverage collection complete in ${elapsed}s`);
    log('═══════════════════════════════════════════════════════');
    
    if (coverageFiles.length > 0) {
        log('');
        log('Coverage reports generated:');
        log('  • HTML: coverage/e2e/index.html');
        log('  • JSON: coverage/e2e-coverage.json');
        log('');
    }
    
    // Exit with playwright result
    process.exit(playwrightResult ? 0 : 1);
}

main().catch(err => {
    logError(err.message);
    process.exit(1);
});
