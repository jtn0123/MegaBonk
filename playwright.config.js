import { defineConfig, devices } from '@playwright/test';
import os from 'os';

// Use 75% of available CPUs for workers (leave headroom for browser processes)
const cpuCount = os.cpus().length;
const optimalWorkers = Math.max(4, Math.floor(cpuCount * 0.75));

const isCI = !!process.env.CI;

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /.*\.spec\.(js|mjs|ts)$/,
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 2 : optimalWorkers, // Dynamic: ~15 workers on 20-core machine
    reporter: isCI ? 'github' : [['html', { open: 'never' }]],
    timeout: 20000, // Reduced from 30s - fail faster
    expect: {
        timeout: 8000, // Reduced from 10s
    },
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: process.env.CI ? 'retain-on-failure' : 'off', // Disable video locally for speed
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'chromium', // Use headless shell (faster)
                launchOptions: {
                    args: ['--disable-gpu', '--no-sandbox'], // Chromium-only flags
                },
            },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            // Webkit is slower in CI - increase timeouts and retries
            timeout: 30000,
            retries: isCI ? 3 : 0,
        },
    ],
    webServer: {
        // CI: full build + preview for production-like testing
        // Local: dev server for faster iteration (start with npm run dev -- --port 4173)
        command: isCI ? 'npm run build && npm run preview -- --port 4173' : 'npm run dev -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 120 * 1000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
