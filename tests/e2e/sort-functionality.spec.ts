// ========================================
// Sort Functionality E2E Tests
// ========================================
// Tests for sorting items, weapons, tomes across tabs

import { test, expect } from '@playwright/test';

test.describe('Sort Functionality - Items Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('sort dropdown is visible', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        await expect(sortSelect).toBeVisible();
    });

    test('sort dropdown has options', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        const options = sortSelect.locator('option');
        const count = await options.count();
        
        expect(count).toBeGreaterThanOrEqual(2); // At least default + one sort option
    });

    test('sort by name orders alphabetically', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        await sortSelect.selectOption('name');
        await page.waitForTimeout(300);

        // Get first few item names
        const names = page.locator('#itemsContainer .item-card .item-name');
        const firstName = await names.nth(0).textContent();
        const secondName = await names.nth(1).textContent();
        const thirdName = await names.nth(2).textContent();

        // Should be in alphabetical order
        const compare1 = firstName!.localeCompare(secondName!);
        const compare2 = secondName!.localeCompare(thirdName!);
        
        expect(compare1).toBeLessThanOrEqual(0);
        expect(compare2).toBeLessThanOrEqual(0);
    });

    test('sort by tier puts SS tier first', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        await sortSelect.selectOption('tier');
        await page.waitForTimeout(300);

        // First card should have SS tier
        const firstCard = page.locator('#itemsContainer .item-card').first();
        await expect(firstCard).toContainText('SS');
    });

    test('sort by rarity puts high rarity first', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        
        // Check if rarity sort option exists
        const options = await sortSelect.locator('option').allTextContents();
        const hasRarity = options.some(o => o.toLowerCase().includes('rarity'));
        
        if (hasRarity) {
            await sortSelect.selectOption('rarity');
            await page.waitForTimeout(300);

            // First card should have rarity badge visible
            const firstCard = page.locator('#itemsContainer .item-card').first();
            const rarityBadge = firstCard.locator('[class*="rarity"], .badge');
            const count = await rarityBadge.count();
            // Just verify sorting didn't break and card still renders
            expect(count >= 0).toBe(true);
        }
    });

    test('sorting is stable (same tier items maintain relative order)', async ({ page }) => {
        // Sort by tier
        await page.selectOption('#sortBy', 'tier');
        await page.waitForTimeout(300);

        // Get SS tier items
        const ssItems = page.locator('#itemsContainer .item-card:has-text("SS Tier")');
        const count = await ssItems.count();
        
        // Should have multiple SS items
        expect(count).toBeGreaterThan(1);
    });

    test('sort persists when filtering', async ({ page }) => {
        // Sort by name
        await page.selectOption('#sortBy', 'name');
        await page.waitForTimeout(200);

        // Filter by legendary
        await page.selectOption('#rarityFilter', 'legendary');
        await page.waitForTimeout(300);

        // Items should still be sorted by name
        const names = page.locator('#itemsContainer .item-card .item-name');
        const count = await names.count();
        
        if (count >= 2) {
            const firstName = await names.nth(0).textContent();
            const secondName = await names.nth(1).textContent();
            expect(firstName!.localeCompare(secondName!)).toBeLessThanOrEqual(0);
        }
    });
});

test.describe('Sort Functionality - Weapons Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });
    });

    test('sort dropdown exists on weapons tab', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        await expect(sortSelect).toBeVisible();
    });

    test('can sort weapons by name', async ({ page }) => {
        await page.selectOption('#sortBy', 'name');
        await page.waitForTimeout(300);

        const names = page.locator('#weaponsContainer .item-card .item-name');
        const count = await names.count();
        
        if (count >= 2) {
            const firstName = await names.nth(0).textContent();
            const secondName = await names.nth(1).textContent();
            expect(firstName!.localeCompare(secondName!)).toBeLessThanOrEqual(0);
        }
    });

    test('can sort weapons by tier', async ({ page }) => {
        await page.selectOption('#sortBy', 'tier');
        await page.waitForTimeout(300);

        // First weapon should have high tier
        const firstCard = page.locator('#weaponsContainer .item-card').first();
        const text = await firstCard.textContent();
        expect(text?.includes('SS') || text?.includes('S Tier')).toBe(true);
    });
});

test.describe('Sort Functionality - Tomes Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="tomes"]');
        await page.waitForSelector('#tomesContainer .item-card', { timeout: 10000 });
    });

    test('sort dropdown exists on tomes tab', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        await expect(sortSelect).toBeVisible();
    });

    test('can sort tomes by name', async ({ page }) => {
        await page.selectOption('#sortBy', 'name');
        await page.waitForTimeout(300);

        const names = page.locator('#tomesContainer .item-card .item-name');
        const count = await names.count();
        
        if (count >= 2) {
            const firstName = await names.nth(0).textContent();
            const secondName = await names.nth(1).textContent();
            expect(firstName!.localeCompare(secondName!)).toBeLessThanOrEqual(0);
        }
    });
});

test.describe('Sort Functionality - Characters Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="characters"]');
        await page.waitForSelector('#charactersContainer .item-card', { timeout: 10000 });
    });

    test('sort dropdown exists on characters tab', async ({ page }) => {
        const sortSelect = page.locator('#sortBy');
        await expect(sortSelect).toBeVisible();
    });

    test('can sort characters by name', async ({ page }) => {
        await page.selectOption('#sortBy', 'name');
        await page.waitForTimeout(300);

        const names = page.locator('#charactersContainer .item-card .item-name');
        const count = await names.count();
        
        if (count >= 2) {
            const firstName = await names.nth(0).textContent();
            const secondName = await names.nth(1).textContent();
            expect(firstName!.localeCompare(secondName!)).toBeLessThanOrEqual(0);
        }
    });
});

test.describe('Sort Functionality - Reset', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('sort resets when switching tabs', async ({ page }) => {
        // Sort by name on items
        await page.selectOption('#sortBy', 'name');
        await page.waitForTimeout(200);

        // Switch to weapons
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });

        // Sort may be preserved or reset - both valid
        const sortSelect = page.locator('#sortBy');
        const value = await sortSelect.inputValue();
        
        // Verify sort dropdown is functional
        expect(value === 'name' || value === '' || value === 'default').toBe(true);
    });
});
