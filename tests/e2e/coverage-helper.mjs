/**
 * Playwright Coverage Helper
 * Collects Istanbul coverage data from browser and writes to .nyc_output/
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');
const nycOutputDir = join(projectRoot, '.nyc_output');

// Track coverage counter for unique filenames
let coverageCounter = 0;

/**
 * Initialize coverage collection - clean .nyc_output directory
 */
export function initCoverage() {
    if (existsSync(nycOutputDir)) {
        // Clean existing coverage files
        const files = readdirSync(nycOutputDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                rmSync(join(nycOutputDir, file));
            }
        }
    } else {
        mkdirSync(nycOutputDir, { recursive: true });
    }
    coverageCounter = 0;
    console.log('[Coverage] Initialized .nyc_output directory');
}

/**
 * Collect coverage from a Playwright page
 * Call this after each test or at the end of test file
 * @param {import('@playwright/test').Page} page
 * @param {string} testName - Name for the coverage file
 */
export async function collectCoverage(page, testName = 'test') {
    try {
        // Check if coverage is available
        const hasCoverage = await page.evaluate(() => {
            return typeof window.__coverage__ !== 'undefined';
        });

        if (!hasCoverage) {
            // Coverage not instrumented - this is fine in non-coverage runs
            return false;
        }

        // Get coverage data
        const coverage = await page.evaluate(() => {
            return window.__coverage__;
        });

        if (!coverage || Object.keys(coverage).length === 0) {
            console.log(`[Coverage] No coverage data for ${testName}`);
            return false;
        }

        // Ensure output directory exists
        if (!existsSync(nycOutputDir)) {
            mkdirSync(nycOutputDir, { recursive: true });
        }

        // Write coverage file with unique name (includes PID + random for parallel workers)
        const sanitizedName = testName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100);
        const uniqueId = `${process.pid}-${++coverageCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const filename = `coverage-${sanitizedName}-${uniqueId}.json`;
        const filepath = join(nycOutputDir, filename);

        writeFileSync(filepath, JSON.stringify(coverage, null, 2));
        console.log(`[Coverage] Written ${filepath} (${Object.keys(coverage).length} files)`);

        return true;
    } catch (error) {
        console.error(`[Coverage] Error collecting coverage for ${testName}:`, error.message);
        return false;
    }
}

/**
 * Create a Playwright fixture that auto-collects coverage after each test
 * Usage: import { test } from './coverage-helper.js';
 */
export function createCoverageTest(baseTest) {
    return baseTest.extend({
        // Auto-collect coverage after each test
        page: async ({ page }, use, testInfo) => {
            await use(page);
            // Collect after test completes
            await collectCoverage(page, testInfo.title);
        },
    });
}

export default {
    initCoverage,
    collectCoverage,
    createCoverageTest,
};
