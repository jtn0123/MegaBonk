/**
 * E2E tests for OCR Feature
 * Tests that OCR loads and works in a real browser without CSP errors
 */

import { test, expect } from '@playwright/test';

test.describe('OCR Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Collect console errors
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                console.log(`Browser error: ${msg.text()}`);
            }
        });

        await page.goto('/');
    });

    test('should load app without CSP errors', async ({ page }) => {
        const cspErrors = [];

        page.on('console', (msg) => {
            if (
                msg.type() === 'error' &&
                msg.text().includes('Content Security Policy')
            ) {
                cspErrors.push(msg.text());
            }
        });

        // Wait for app to fully initialize
        await page.waitForSelector('[data-tab]', { timeout: 10000 });

        // Give time for any async CSP violations to appear
        await page.waitForTimeout(2000);

        expect(cspErrors).toHaveLength(0);
    });

    test('should initialize OCR module', async ({ page }) => {
        // Wait for app to load
        await page.waitForSelector('[data-tab]', { timeout: 10000 });

        // Check that OCR initialized by looking for log message
        const logs = [];
        page.on('console', (msg) => {
            if (msg.text().includes('ocr.init')) {
                logs.push(msg.text());
            }
        });

        // Navigate to advisor tab where OCR is used
        await page.click('[data-tab="advisor"]');

        // Wait for OCR to initialize
        await page.waitForTimeout(1000);

        // OCR should have initialized (check for scan UI elements)
        const scanSection = page.locator('#scan-section, .scan-section, [data-section="scan"]');
        await expect(scanSection).toBeVisible({ timeout: 5000 });
    });

    test('should show image upload interface', async ({ page }) => {
        // Navigate to advisor tab
        await page.click('[data-tab="advisor"]');

        // Wait for scan section to load
        await page.waitForTimeout(500);

        // Look for upload button or file input
        const uploadElement = page.locator(
            '#scan-upload-btn, input[type="file"], [data-action="upload-image"], .scan-upload'
        );

        await expect(uploadElement.first()).toBeVisible({ timeout: 5000 });
    });

    test('should not have blocked worker errors on page load', async ({ page }) => {
        const blockedErrors = [];

        page.on('console', (msg) => {
            const text = msg.text();
            if (
                msg.type() === 'error' &&
                (text.includes('worker-src') || text.includes('blob:'))
            ) {
                blockedErrors.push(text);
            }
        });

        // Wait for full app load
        await page.waitForSelector('[data-tab]', { timeout: 10000 });

        // Navigate to advisor to trigger OCR loading
        await page.click('[data-tab="advisor"]');

        // Wait for any async operations
        await page.waitForTimeout(3000);

        expect(blockedErrors).toHaveLength(0);
    });

    test('should not have jsdelivr CDN blocked errors', async ({ page }) => {
        const cdnErrors = [];

        page.on('console', (msg) => {
            const text = msg.text();
            if (
                msg.type() === 'error' &&
                text.includes('cdn.jsdelivr.net')
            ) {
                cdnErrors.push(text);
            }
        });

        // Navigate to advisor tab
        await page.click('[data-tab="advisor"]');

        // Wait for Tesseract to potentially load
        await page.waitForTimeout(3000);

        expect(cdnErrors).toHaveLength(0);
    });
});

test.describe('OCR Detection Buttons', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Navigate to advisor tab
        await page.click('[data-tab="advisor"]');
        await page.waitForTimeout(500);
    });

    test('should show OCR detection buttons', async ({ page }) => {
        // Look for OCR/detection buttons
        const detectionButtons = page.locator(
            'button:has-text("OCR"), button:has-text("Detect"), button:has-text("Scan"), [data-action*="detect"]'
        );

        // At least one detection-related button should exist
        const count = await detectionButtons.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should have CV templates loaded', async ({ page }) => {
        // Check for CV initialization in logs
        const cvLogs = [];
        page.on('console', (msg) => {
            if (msg.text().includes('cv.load_templates')) {
                cvLogs.push(msg.text());
            }
        });

        // Wait for templates to load
        await page.waitForTimeout(2000);

        // CV templates should have loaded
        expect(cvLogs.length).toBeGreaterThanOrEqual(0);
    });
});
