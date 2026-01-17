import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /.*\.spec\.(js|mjs)$/,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 8, // M4 MacBook Air has 10 cores
    reporter: [['html', { open: 'never' }]],
    use: {
        baseURL: 'http://localhost:8000',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
        },
    ],
    webServer: {
        command: 'bun run dev',
        url: 'http://localhost:8000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000, // Allow time for Vite to start
    },
});
