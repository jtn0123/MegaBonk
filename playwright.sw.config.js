import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Service Worker / Offline testing
 * Uses production build (preview) instead of dev server
 */
export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/offline.spec.js', // Only run offline tests
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1, // Single worker for SW tests to avoid conflicts
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'bun run build && bun run preview --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000, // Allow time for build + preview
    },
});
