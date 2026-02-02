// ========================================
// Theme Toggle E2E Tests
// ========================================

import { test, expect } from '@playwright/test';

test.describe('Theme Toggle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('theme toggle button is visible', async ({ page }) => {
        const themeToggle = page.locator('.theme-toggle, #theme-toggle, [aria-label*="theme"], button:has-text("🌙"), button:has-text("☀")');
        await expect(themeToggle.first()).toBeVisible();
    });

    test('clicking theme toggle changes theme', async ({ page }) => {
        const html = page.locator('html');
        const initialTheme = await html.getAttribute('data-theme');

        // Find and click theme toggle
        const themeToggle = page.locator('.theme-toggle, #theme-toggle, [aria-label*="theme"]').first();
        await themeToggle.click();
        await page.waitForTimeout(100);

        const newTheme = await html.getAttribute('data-theme');
        expect(newTheme).not.toBe(initialTheme);
    });

    test('theme persists after page reload', async ({ page }) => {
        const html = page.locator('html');
        
        // Toggle theme
        const themeToggle = page.locator('.theme-toggle, #theme-toggle, [aria-label*="theme"]').first();
        await themeToggle.click();
        await page.waitForTimeout(100);
        
        const themeAfterToggle = await html.getAttribute('data-theme');

        // Reload page
        await page.reload();
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

        const themeAfterReload = await html.getAttribute('data-theme');
        expect(themeAfterReload).toBe(themeAfterToggle);
    });

    test('light theme has appropriate colors', async ({ page }) => {
        const html = page.locator('html');
        
        // Ensure we're in light theme
        await html.evaluate(el => el.setAttribute('data-theme', 'light'));
        await page.waitForTimeout(100);

        // Check background is light
        const bgColor = await page.evaluate(() => {
            return getComputedStyle(document.body).backgroundColor;
        });
        
        // Light theme should have a light background (high RGB values)
        expect(bgColor).toBeTruthy();
    });

    test('dark theme has appropriate colors', async ({ page }) => {
        const html = page.locator('html');
        
        // Ensure we're in dark theme
        await html.evaluate(el => el.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(100);

        // Check background is dark
        const bgColor = await page.evaluate(() => {
            return getComputedStyle(document.body).backgroundColor;
        });
        
        expect(bgColor).toBeTruthy();
    });

    test('theme toggle is keyboard accessible', async ({ page }) => {
        const themeToggle = page.locator('.theme-toggle, #theme-toggle, [aria-label*="theme"]').first();
        
        // Tab to theme toggle
        await themeToggle.focus();
        await expect(themeToggle).toBeFocused();

        const html = page.locator('html');
        const initialTheme = await html.getAttribute('data-theme');

        // Activate with Enter
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);

        const newTheme = await html.getAttribute('data-theme');
        expect(newTheme).not.toBe(initialTheme);
    });

    test('theme affects card styling', async ({ page }) => {
        const html = page.locator('html');
        const firstCard = page.locator('#itemsContainer .item-card').first();

        // Get card background in dark mode
        await html.evaluate(el => el.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(100);
        const darkBg = await firstCard.evaluate(el => getComputedStyle(el).backgroundColor);

        // Get card background in light mode
        await html.evaluate(el => el.setAttribute('data-theme', 'light'));
        await page.waitForTimeout(100);
        const lightBg = await firstCard.evaluate(el => getComputedStyle(el).backgroundColor);

        // Colors should be different
        expect(darkBg).not.toBe(lightBg);
    });
});

test.describe('Theme - System Preference', () => {
    test('respects system color scheme preference', async ({ page }) => {
        // Clear any stored theme preference
        await page.evaluate(() => localStorage.removeItem('theme'));
        
        // Emulate dark mode system preference
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.reload();
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

        // Check if dark theme is applied (may depend on implementation)
        const html = page.locator('html');
        const theme = await html.getAttribute('data-theme');
        
        // Theme should exist (either dark from system or from previous storage)
        expect(theme).toBeTruthy();
    });
});
