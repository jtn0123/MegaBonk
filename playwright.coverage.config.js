/**
 * Playwright Configuration for Coverage Collection
 * Uses Istanbul instrumentation (via vite-plugin-istanbul) and collects window.__coverage__
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /.*\.spec\.(js|mjs|ts)$/,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 4,
    timeout: 60000,
    expect: {
        timeout: 15000,
    },

    // Global setup initializes coverage directory
    globalSetup: './tests/e2e/coverage-global-setup.mjs',

    reporter: [
        ['html', { open: 'never' }],
        ['list'],
        [
            'monocart-reporter',
            {
                name: 'MegaBonk E2E Coverage Report',
                outputFile: './coverage/e2e/monocart-report.html',
            },
        ],
    ],

    use: {
        baseURL: 'http://localhost:4173',
        trace: 'off',
        screenshot: 'off',
        video: 'off',
    },

    projects: [
        {
            name: 'chromium-coverage',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        // Build with Istanbul coverage instrumentation, then preview
        command: 'COVERAGE=true npm run build && npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: false,
        timeout: 180 * 1000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
