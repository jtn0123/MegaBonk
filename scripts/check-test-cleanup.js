#!/usr/bin/env node
/**
 * Test Cleanup Validator
 *
 * This script checks test files for common memory leak patterns.
 * Run it in CI or as a pre-commit hook to catch issues early.
 *
 * Usage:
 *   node scripts/check-test-cleanup.js
 *   bun scripts/check-test-cleanup.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const testsDir = path.join(rootDir, 'tests');

let hasErrors = false;
let hasWarnings = false;

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if a file contains mock spies without proper restoration
 */
function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(rootDir, filePath);
    const issues = [];

    // Check for vi.spyOn without restoreAllMocks in the same file
    const hasSpyOn = /vi\.spyOn\(/g.test(content);
    const hasRestoreAllMocks = /vi\.restoreAllMocks\(\)/g.test(content);
    const hasAfterEach = /afterEach\(/g.test(content);

    if (hasSpyOn && hasAfterEach && !hasRestoreAllMocks) {
        issues.push({
            type: 'warning',
            message: `Uses vi.spyOn() with afterEach() but no vi.restoreAllMocks()`,
            suggestion: 'Add vi.restoreAllMocks() in afterEach() to prevent memory leaks',
        });
    }

    // Check for setInterval without cleanup
    const setIntervalMatches = content.match(/setInterval\(/g);
    const clearIntervalMatches = content.match(/clearInterval\(/g);
    if (setIntervalMatches && (!clearIntervalMatches || setIntervalMatches.length > clearIntervalMatches.length)) {
        issues.push({
            type: 'warning',
            message: `Found ${setIntervalMatches.length} setInterval() but only ${clearIntervalMatches?.length || 0} clearInterval()`,
            suggestion: 'Ensure all intervals are cleared in afterEach()',
        });
    }

    // Check for addEventListener without cleanup pattern
    const addListenerMatches = content.match(/addEventListener\(/g);
    const removeListenerMatches = content.match(/removeEventListener\(/g);
    if (
        addListenerMatches &&
        (!removeListenerMatches || addListenerMatches.length > removeListenerMatches.length)
    ) {
        issues.push({
            type: 'warning',
            message: `Found ${addListenerMatches.length} addEventListener() but only ${removeListenerMatches?.length || 0} removeEventListener()`,
            suggestion: 'Ensure all event listeners are removed in afterEach()',
        });
    }

    // Check tests/setup.js specifically
    if (relativePath === 'tests/setup.js') {
        if (!hasRestoreAllMocks) {
            issues.push({
                type: 'error',
                message: 'CRITICAL: tests/setup.js missing vi.restoreAllMocks()',
                suggestion: 'This will cause memory leaks across ALL tests! Add it to afterEach() immediately.',
            });
        }

        if (!content.includes('vi.clearAllTimers()')) {
            issues.push({
                type: 'error',
                message: 'CRITICAL: tests/setup.js missing vi.clearAllTimers()',
                suggestion: 'Add vi.clearAllTimers() in afterEach()',
            });
        }

        if (!content.includes('vi.resetModules()')) {
            issues.push({
                type: 'warning',
                message: 'tests/setup.js missing vi.resetModules()',
                suggestion: 'Add vi.resetModules() in afterEach() to prevent module state leaks',
            });
        }

        if (!content.includes('window.close()')) {
            issues.push({
                type: 'error',
                message: 'CRITICAL: tests/setup.js not closing JSDOM window',
                suggestion: 'Call currentDom.window.close() in afterEach() to prevent memory leaks',
            });
        }
    }

    // Report issues
    if (issues.length > 0) {
        log(`\n📄 ${relativePath}`, 'blue');
        issues.forEach(issue => {
            if (issue.type === 'error') {
                log(`  ❌ ERROR: ${issue.message}`, 'red');
                log(`     → ${issue.suggestion}`, 'yellow');
                hasErrors = true;
            } else {
                log(`  ⚠️  WARNING: ${issue.message}`, 'yellow');
                log(`     → ${issue.suggestion}`, 'blue');
                hasWarnings = true;
            }
        });
    }
}

/**
 * Recursively find all test files
 */
function findTestFiles(dir) {
    const files = [];

    function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && /\.(test|spec)\.(js|ts)$/.test(entry.name)) {
                files.push(fullPath);
            }
        }
    }

    walk(dir);
    return files;
}

// Main execution
log('🔍 Checking test files for memory leak patterns...\n', 'blue');

// Always check setup.js first
const setupFile = path.join(testsDir, 'setup.js');
if (fs.existsSync(setupFile)) {
    checkFile(setupFile);
}

// Check all test files
const testFiles = findTestFiles(testsDir);
testFiles.forEach(checkFile);

// Summary
log('\n' + '='.repeat(60), 'blue');
if (hasErrors) {
    log('❌ FAILED: Found critical memory leak patterns', 'red');
    log('Fix these issues before committing!', 'red');
    process.exit(1);
} else if (hasWarnings) {
    log('⚠️  WARNINGS: Found potential memory leak patterns', 'yellow');
    log('Consider fixing these to prevent future issues', 'yellow');
    process.exit(0); // Don't fail on warnings, just inform
} else {
    log('✅ PASSED: No memory leak patterns detected', 'green');
    process.exit(0);
}
