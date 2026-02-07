/**
 * Playwright Coverage Fixtures for monocart-reporter
 * Uses V8 coverage API to collect JavaScript coverage
 */
import { test as testBase, expect } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

const test = testBase.extend({
    // Auto-fixture for V8 coverage collection
    autoTestFixture: [async ({ page }, use, testInfo) => {
        // Only collect coverage for Chromium-based browsers
        const browserName = testInfo.project.name.toLowerCase();
        const isChromium = browserName.includes('chromium') || browserName.includes('chrome');

        if (isChromium) {
            // Start JS coverage before test
            await page.coverage.startJSCoverage({
                resetOnNavigation: false
            });
        }

        // Run the test
        await use('autoTestFixture');

        if (isChromium) {
            // Stop and collect JS coverage after test
            const jsCoverage = await page.coverage.stopJSCoverage();
            
            // Filter to only include app code (not node_modules, etc.)
            const filteredCoverage = jsCoverage.filter(entry => {
                const url = entry.url || '';
                // Include only localhost URLs that are JS files
                if (!url.includes('localhost')) return false;
                if (url.includes('node_modules')) return false;
                // Include .js files (bundled app code)
                return url.endsWith('.js');
            });

            if (filteredCoverage.length > 0) {
                // Add coverage to global monocart report
                await addCoverageReport(filteredCoverage, testInfo);
            }
        }
    }, {
        scope: 'test',
        auto: true
    }]
});

export { test, expect };
