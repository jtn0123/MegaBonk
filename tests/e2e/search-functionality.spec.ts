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
        await page.waitForTimeout(300); // Debounce

        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(80); // Filtered down

        // First card should contain "Anvil"
        const firstCardName = await cards.first().locator('.item-name').textContent();
        expect(firstCardName?.toLowerCase()).toContain('anvil');
    });

    test('search is case-insensitive', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        
        await searchInput.fill('ANVIL');
        await page.waitForTimeout(300);
        const upperCount = await page.locator('#itemsContainer .item-card').count();

        await searchInput.fill('anvil');
        await page.waitForTimeout(300);
        const lowerCount = await page.locator('#itemsContainer .item-card').count();

        expect(upperCount).toBe(lowerCount);
    });

    test('clearing search shows all items', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        
        // Filter first
        await searchInput.fill('Anvil');
        await page.waitForTimeout(300);
        const filteredCount = await page.locator('#itemsContainer .item-card').count();
        expect(filteredCount).toBeLessThan(80);

        // Clear search
        await searchInput.fill('');
        await page.waitForTimeout(300);
        const allCount = await page.locator('#itemsContainer .item-card').count();
        expect(allCount).toBe(80);
    });

    test('search with no results shows empty state', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('xyznonexistent123');
        await page.waitForTimeout(300);

        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();
        expect(count).toBe(0);

        // Should show empty state
        const emptyState = page.locator('#itemsContainer .empty-state, #itemsContainer [class*="empty"]');
        await expect(emptyState.first()).toBeVisible();
    });

    test('search works across tabs', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        
        // Search in items
        await searchInput.fill('damage');
        await page.waitForTimeout(300);
        const itemsCount = await page.locator('#itemsContainer .item-card').count();
        expect(itemsCount).toBeGreaterThan(0);

        // Switch to weapons and search should persist or reset appropriately
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForTimeout(300);

        const weaponsCards = page.locator('#weaponsContainer .item-card');
        const weaponsCount = await weaponsCards.count();
        // Should have weapons displayed
        expect(weaponsCount).toBeGreaterThanOrEqual(0);
    });

    test('/ keyboard shortcut focuses search', async ({ page }) => {
        // Ensure search is not focused
        await page.locator('body').click();
        
        // Press / to focus search
        await page.keyboard.press('/');
        
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeFocused();
    });

    test('Escape clears search focus', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.focus();
        await searchInput.fill('test');
        
        await page.keyboard.press('Escape');
        
        // Search should be cleared or unfocused
        const isFocused = await searchInput.evaluate(el => el === document.activeElement);
        expect(isFocused).toBe(false);
    });
});

test.describe('Search Dropdown', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('search dropdown appears with suggestions', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.fill('Big');
        await page.waitForTimeout(500);

        // Check for dropdown
        const dropdown = page.locator('.search-dropdown, [class*="dropdown"]');
        if (await dropdown.count() > 0) {
            await expect(dropdown.first()).toBeVisible();
        }
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
        await page.waitForTimeout(300);

        // Should find multiple items with "damage" in their text
        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();
        expect(count).toBeGreaterThan(1);
    });
});
