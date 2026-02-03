import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /.*\.spec\.(js|mjs|ts)$/,
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 1 : (process.env.PW_WORKERS ? parseInt(process.env.PW_WORKERS) : undefined),
    reporter: isCI ? 'github' : [['html', { open: 'never' }]],
    timeout: 30000,
    expect: {
        timeout: 10000,
    },
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    webServer: {
        // CI: full build + preview for production-like testing
        // Local: dev server for faster iteration (start with npm run dev -- --port 4173)
        command: isCI 
            ? 'npm run build && npm run preview -- --port 4173'
            : 'npm run dev -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 120 * 1000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
