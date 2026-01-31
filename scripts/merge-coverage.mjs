#!/usr/bin/env node
/**
 * Merge Vitest unit test coverage with Playwright E2E coverage
 * Uses monocart-coverage-reports to produce combined coverage report
 * 
 * Both unit and E2E tests output Istanbul-format coverage:
 * - Unit: coverage/unit/coverage-final.json (via @vitest/coverage-v8)
 * - E2E: .nyc_output/*.json (via Istanbul instrumentation + coverage-helper.mjs)
 */

import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { CoverageReport } from 'monocart-coverage-reports';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Coverage directories
const unitCoverageFile = join(projectRoot, 'coverage', 'unit', 'coverage-final.json');
const nycOutputDir = join(projectRoot, '.nyc_output');
const e2eCoverageFile = join(projectRoot, 'coverage', 'e2e-coverage.json');
const mergedCoverageDir = join(projectRoot, 'coverage', 'merged');

// Colors for terminal output
const colors = {
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
    console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}  ${message}${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
}

/**
 * Load Istanbul coverage from a JSON file
 */
function loadIstanbulCoverage(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        // Istanbul format: object with file paths as keys
        if (typeof data === 'object' && !Array.isArray(data)) {
            const keys = Object.keys(data);
            if (keys.length > 0 && (data[keys[0]].path || data[keys[0]].statementMap)) {
                return data;
            }
        }
        
        return null;
    } catch (error) {
        log(`  Error loading ${filePath}: ${error.message}`, 'yellow');
        return null;
    }
}

/**
 * Merge multiple Istanbul coverage objects
 */
function mergeIstanbulCoverage(...coverages) {
    const merged = {};
    
    for (const coverage of coverages) {
        if (!coverage) continue;
        
        for (const [filePath, fileData] of Object.entries(coverage)) {
            if (!merged[filePath]) {
                // Clone the coverage data
                merged[filePath] = JSON.parse(JSON.stringify(fileData));
            } else {
                // Merge hit counts
                const existing = merged[filePath];
                
                // Merge statement counts
                if (fileData.s && existing.s) {
                    for (const [key, value] of Object.entries(fileData.s)) {
                        existing.s[key] = (existing.s[key] || 0) + value;
                    }
                }
                
                // Merge branch counts
                if (fileData.b && existing.b) {
                    for (const [key, values] of Object.entries(fileData.b)) {
                        if (!existing.b[key]) {
                            existing.b[key] = values;
                        } else {
                            for (let i = 0; i < values.length; i++) {
                                existing.b[key][i] = (existing.b[key][i] || 0) + values[i];
                            }
                        }
                    }
                }
                
                // Merge function counts
                if (fileData.f && existing.f) {
                    for (const [key, value] of Object.entries(fileData.f)) {
                        existing.f[key] = (existing.f[key] || 0) + value;
                    }
                }
            }
        }
    }
    
    return merged;
}

async function main() {
    logHeader('Merging Unit + E2E Coverage');
    
    const startTime = Date.now();
    
    // Clean merged output directory
    if (existsSync(mergedCoverageDir)) {
        rmSync(mergedCoverageDir, { recursive: true, force: true });
    }
    mkdirSync(mergedCoverageDir, { recursive: true });
    
    const coverageData = [];
    
    // Step 1: Load unit test coverage
    log('Step 1: Loading unit test coverage...', 'cyan');
    
    if (existsSync(unitCoverageFile)) {
        const unitCoverage = loadIstanbulCoverage(unitCoverageFile);
        if (unitCoverage) {
            const fileCount = Object.keys(unitCoverage).length;
            log(`  ✓ Loaded ${fileCount} files from unit tests`, 'green');
            coverageData.push(unitCoverage);
        }
    } else {
        log(`  ✗ No unit coverage found at ${unitCoverageFile}`, 'yellow');
        log(`    Run 'npm run test:unit:coverage' first`, 'yellow');
    }
    
    // Step 2: Load E2E coverage from .nyc_output
    log('\nStep 2: Loading E2E coverage...', 'cyan');
    
    let e2eFileCount = 0;
    
    // Check .nyc_output directory (from coverage-helper.mjs)
    if (existsSync(nycOutputDir)) {
        const files = readdirSync(nycOutputDir).filter(f => f.endsWith('.json'));
        log(`  Found ${files.length} coverage files in .nyc_output`, 'cyan');
        
        for (const file of files) {
            const coverage = loadIstanbulCoverage(join(nycOutputDir, file));
            if (coverage) {
                coverageData.push(coverage);
                e2eFileCount += Object.keys(coverage).length;
            }
        }
        
        if (files.length > 0) {
            log(`  ✓ Loaded coverage from ${files.length} E2E test runs`, 'green');
        }
    }
    
    // Also check for merged E2E coverage
    if (existsSync(e2eCoverageFile)) {
        const coverage = loadIstanbulCoverage(e2eCoverageFile);
        if (coverage) {
            coverageData.push(coverage);
            log(`  ✓ Loaded merged E2E coverage file`, 'green');
        }
    }
    
    if (e2eFileCount === 0 && !existsSync(e2eCoverageFile)) {
        log(`  ✗ No E2E coverage found`, 'yellow');
        log(`    Run 'npm run test:e2e:coverage' first`, 'yellow');
    }
    
    if (coverageData.length === 0) {
        log('\n✗ No coverage data available to merge!', 'red');
        log('  Run unit tests and/or E2E tests with coverage first.', 'yellow');
        process.exit(1);
    }
    
    // Step 3: Merge all coverage data
    log('\nStep 3: Merging coverage data...', 'cyan');
    const mergedCoverage = mergeIstanbulCoverage(...coverageData);
    const totalFiles = Object.keys(mergedCoverage).length;
    log(`  Merged coverage for ${totalFiles} source files`, 'green');
    
    // Step 4: Generate reports using monocart-coverage-reports
    log('\nStep 4: Generating reports with monocart-coverage-reports...', 'cyan');
    
    const mcr = new CoverageReport({
        name: 'MegaBonk Combined Coverage',
        outputDir: mergedCoverageDir,
        
        // Report formats
        reports: [
            'html',
            'text',
            'lcov',
            'json',
            ['console-summary', { metrics: ['statements', 'branches', 'functions', 'lines'] }]
        ],
        
        // Source file filtering
        sourceFilter: (sourcePath) => {
            // Only include src/ files
            if (!sourcePath.includes('src/')) return false;
            // Exclude libs, sw.js, and types
            if (sourcePath.includes('src/libs/')) return false;
            if (sourcePath.includes('sw.js')) return false;
            if (sourcePath.includes('src/types/')) return false;
            return true;
        },
        
        // Coverage thresholds
        watermarks: {
            statements: [60, 80],
            branches: [55, 75],
            functions: [60, 80],
            lines: [60, 80]
        }
    });
    
    // Add the merged Istanbul coverage
    await mcr.add(mergedCoverage);
    
    // Generate the report
    const results = await mcr.generate();
    
    // Step 5: Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    logHeader('Coverage Merge Complete');
    
    log(`Time: ${elapsed}s`, 'green');
    log(`Output: ${mergedCoverageDir}`, 'green');
    log('', 'reset');
    
    // Display coverage summary
    if (results.summary) {
        const summary = results.summary;
        log('Combined Coverage Summary:', 'bold');
        log(`  Statements: ${summary.statements?.pct?.toFixed(2) || 'N/A'}%`, 'cyan');
        log(`  Branches:   ${summary.branches?.pct?.toFixed(2) || 'N/A'}%`, 'cyan');
        log(`  Functions:  ${summary.functions?.pct?.toFixed(2) || 'N/A'}%`, 'cyan');
        log(`  Lines:      ${summary.lines?.pct?.toFixed(2) || 'N/A'}%`, 'cyan');
    }
    
    log('\nReports generated:', 'green');
    log(`  • HTML:   ${mergedCoverageDir}/index.html`, 'reset');
    log(`  • LCOV:   ${mergedCoverageDir}/lcov.info`, 'reset');
    log(`  • JSON:   ${mergedCoverageDir}/coverage-final.json`, 'reset');
    
    return results;
}

main().catch(err => {
    log(`\nError: ${err.message}`, 'red');
    console.error(err.stack);
    process.exit(1);
});
