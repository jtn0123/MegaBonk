import { defineConfig, devices } from '@playwright/test';
import os from 'os';

// Use 75% of available CPUs for workers (leave headroom for browser processes)
const cpuCount = os.cpus().length;
const optimalWorkers = Math.max(4, Math.floor(cpuCount * 0.75));

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /.*\.spec\.(js|mjs|ts)$/,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : optimalWorkers, // Dynamic: ~15 workers on 20-core machine
    reporter: process.env.CI ? 'github' : [['html', { open: 'never' }]],
    timeout: 20000, // Reduced from 30s - fail faster
    expect: {
        timeout: 8000, // Reduced from 10s
    },
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: process.env.CI ? 'retain-on-failure' : 'off', // Disable video locally for speed
        launchOptions: {
            args: ['--disable-gpu', '--no-sandbox'], // Faster in headless
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { 
                ...devices['Desktop Chrome'],
                channel: 'chromium', // Use headless shell (faster)
            },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    webServer: {
        command: 'npm run build && npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
