/**
 * Playwright Configuration for Coverage Collection
 * Uses instrumented build and collects browser coverage
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /.*\.spec\.(js|mjs|ts)$/,
    fullyParallel: false, // Sequential for coverage reliability
    forbidOnly: !!process.env.CI,
    retries: 0, // No retries for coverage
    workers: 1, // Single worker for coverage
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 60000, // Longer timeout for instrumented code
    expect: {
        timeout: 15000,
    },
    
    // Global setup initializes coverage directory
    globalSetup: './tests/e2e/coverage-global-setup.mjs',
    
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'off', // Disable trace for coverage
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
        // Build with coverage instrumentation, then preview
        command: 'COVERAGE=true npm run build && npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: false, // Always use fresh coverage build
        timeout: 180 * 1000, // Longer timeout for instrumented build
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
