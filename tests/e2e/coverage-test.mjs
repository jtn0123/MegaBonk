/**
 * Coverage-aware test fixture for Playwright
 * 
 * Import { test, expect } from this file instead of @playwright/test
 * to automatically collect Istanbul coverage after each test.
 * 
 * Usage:
 *   import { test, expect } from './coverage-test.mjs';
 *   
 *   test('my test', async ({ page }) => {
 *     // ... your test
 *   }); // Coverage auto-collected after test
 */

import { test as baseTest, expect } from '@playwright/test';
import { collectCoverage } from './coverage-helper.mjs';

/**
 * Extended test that auto-collects coverage
 * Always tries to collect - gracefully handles when coverage isn't available
 */
export const test = baseTest.extend({
    // Override page fixture to collect coverage on cleanup
    page: async ({ page }, use, testInfo) => {
        // Give the page to the test
        await use(page);
        
        // After test completes, always try to collect coverage
        // collectCoverage handles the case when __coverage__ doesn't exist
        const testName = `${testInfo.titlePath.join('-')}`.replace(/[^a-zA-Z0-9-]/g, '_');
        await collectCoverage(page, testName);
    },
});

// Re-export expect for convenience
export { expect };

// Export coverage helper for manual collection if needed
export { collectCoverage };
