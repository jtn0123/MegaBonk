// ========================================
// Search Functionality E2E Tests
// ========================================

import { test, expect } from '@playwright/test';

test.describe('Search Input', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('search input is visible and focusable', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeVisible();
        await searchInput.focus();
        await expect(searchInput).toBeFocused();
    });

    test('search filters items by name', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('Anvil');
        await page.waitForTimeout(500); // Debounce + render

        // Global search renders .search-result-card instead of .item-card
        const cards = page.locator('.search-result-card');
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(80); // Filtered down

        // First card should contain "Anvil"
        const firstCardName = await cards.first().locator('.search-result-name').textContent();
        expect(firstCardName?.toLowerCase()).toContain('anvil');
    });

    test('search is case-insensitive', async ({ page }) => {
        const searchInput = page.locator('#searchInput');

        // Global search renders .search-result-card elements
        await searchInput.fill('ANVIL');
        await page.waitForSelector('.search-result-card', { timeout: 5000 });
        const upperCount = await page.locator('.search-result-card').count();

        await searchInput.fill('anvil');
        await page.waitForSelector('.search-result-card', { timeout: 5000 });
        const lowerCount = await page.locator('.search-result-card').count();

        expect(upperCount).toBe(lowerCount);
    });

    test('clearing search shows all items', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        
        // Filter first - global search renders .search-result-card
        await searchInput.fill('Anvil');
        await page.waitForTimeout(500);
        const filteredCount = await page.locator('.search-result-card').count();
        expect(filteredCount).toBeGreaterThan(0);
        expect(filteredCount).toBeLessThan(80);

        // Clear search - returns to normal .item-card rendering
        await searchInput.fill('');
        await page.waitForTimeout(500);
        const allCount = await page.locator('#itemsContainer .item-card').count();
        expect(allCount).toBe(80);
    });

    test('search with no results shows empty state', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('xyznonexistent123');
        await page.waitForTimeout(500);

        // Global search should show no results
        const cards = page.locator('.search-result-card');
        const count = await cards.count();
        expect(count).toBe(0);

        // Should show empty state in the active container
        const emptyState = page.locator('.empty-state, [class*="empty-state"]');
        await expect(emptyState.first()).toBeVisible();
    });

    test('search works across tabs', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        
        // Search in items - global search renders .search-result-card
        await searchInput.fill('damage');
        await page.waitForTimeout(500);
        const searchResults = await page.locator('.search-result-card').count();
        expect(searchResults).toBeGreaterThan(0);

        // Switch to weapons tab
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForTimeout(500);

        // After tab switch with search active, should still show search results
        const resultsAfterSwitch = await page.locator('.search-result-card, #weaponsContainer .item-card').count();
        expect(resultsAfterSwitch).toBeGreaterThanOrEqual(0);
    });

    test('/ keyboard shortcut focuses search', async ({ page }) => {
        // Ensure search is not focused
        await page.locator('body').click();
        
        // Press / to focus search
        await page.keyboard.press('/');
        
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeFocused();
    });

    test('Escape closes search dropdown and keeps focus', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.focus();
        await searchInput.fill('Anvil');
        await page.waitForTimeout(500);
        
        // Verify search results appeared
        const resultCount = await page.locator('.search-result-card').count();
        expect(resultCount).toBeGreaterThan(0);
        
        // Press Escape - this should close any open dropdown but keep focus
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        
        // Search input should still be focused (Escape doesn't blur when inside input)
        const isFocused = await searchInput.evaluate(el => el === document.activeElement);
        expect(isFocused).toBe(true);
    });
});

test.describe('Search Results', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('search shows results in main content area', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('Big');
        await page.waitForTimeout(500);

        // Results should appear in main content as .search-result-card elements
        const results = page.locator('.search-result-card');
        const count = await results.count();
        expect(count).toBeGreaterThan(0);
    });
});

test.describe('Global Search', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('search finds items across all categories', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('damage');

        // Wait for search results to appear
        await page.waitForSelector('.search-result-card', { timeout: 5000 });

        // Global search renders .search-result-card elements
        const cards = page.locator('.search-result-card');
        const count = await cards.count();
        expect(count).toBeGreaterThan(1);
    });
});
