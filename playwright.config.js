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
    workers: isCI ? 3 : optimalWorkers, // Dynamic: ~15 workers on 20-core machine
    reporter: isCI ? 'github' : [['html', { open: 'never' }]],
    timeout: isCI ? 60000 : 20000, // CI runners are slower — give extra headroom
    expect: {
        timeout: isCI ? 15000 : 8000,
    },
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: process.env.CI ? 'retain-on-failure' : 'off', // Disable video locally for speed
        // Pre-seed localStorage so the "What's New" modal doesn't appear.
        // On CI, localStorage is empty → modal overlay covers tab buttons →
        // Playwright click() hangs for 60s waiting for actionability.
        storageState: './tests/e2e/storage-state.json',
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
        command: isCI ? 'npm run preview -- --port 4173' : 'npm run dev -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 120 * 1000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
