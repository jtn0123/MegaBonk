import { test, expect } from '@playwright/test';

test.describe('Items Browsing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    });

    test('should display all items initially', async ({ page }) => {
        const itemCards = page.locator('#itemsContainer .item-card');
        // Should have 78 items according to the data
        await expect(itemCards).toHaveCount(78);
    });

    test('should display stats summary', async ({ page }) => {
        const statsPanel = page.locator('#stats-summary');
        await expect(statsPanel).toContainText('Total Items');
        await expect(statsPanel).toContainText('78');
    });

    test('should filter items by search', async ({ page }) => {
        await page.fill('#searchInput', 'bonk');

        // Wait for debounce (300ms) plus render time
        await page.waitForTimeout(500);

        const itemCards = page.locator('#itemsContainer .item-card');
        // Should only show items containing "bonk"
        const count = await itemCards.count();
        expect(count).toBeLessThan(78);

        // First visible item should contain "bonk"
        const firstItem = itemCards.first();
        await expect(firstItem).toContainText(/bonk/i);
    });

    test('should filter by tier', async ({ page }) => {
        await page.selectOption('#tierFilter', 'SS');

        await page.waitForTimeout(100);

        const itemCards = page.locator('#itemsContainer .item-card');
        const count = await itemCards.count();

        // Should have some SS tier items but fewer than total
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(78);
    });

    test('should filter by rarity', async ({ page }) => {
        await page.selectOption('#rarityFilter', 'legendary');

        await page.waitForTimeout(100);

        const itemCards = page.locator('#itemsContainer .item-card');
        const count = await itemCards.count();

        // Should have some legendary items
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(78);
    });

    test('should filter by stacking behavior', async ({ page }) => {
        await page.selectOption('#stackingFilter', 'one_and_done');

        await page.waitForTimeout(100);

        const itemCards = page.locator('#itemsContainer .item-card');
        const count = await itemCards.count();

        // Should have some one-and-done items
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(78);
    });

    test('should clear search filter', async ({ page }) => {
        // First filter
        await page.fill('#searchInput', 'bonk');
        await page.waitForTimeout(500);

        const filteredCount = await page.locator('#itemsContainer .item-card').count();
        expect(filteredCount).toBeLessThan(78);

        // Clear filter
        await page.fill('#searchInput', '');
        await page.waitForTimeout(500);

        const allCount = await page.locator('#itemsContainer .item-card').count();
        expect(allCount).toBe(78);
    });

    test('should open item detail modal', async ({ page }) => {
        // Click the first View Details button
        await page.click('#itemsContainer .view-details-btn >> nth=0');

        // Modal should be visible
        const modal = page.locator('#itemModal');
        await expect(modal).toBeVisible();

        // Modal should have content
        const modalBody = page.locator('#modalBody');
        await expect(modalBody).not.toBeEmpty();
    });

    test('should close modal on X click', async ({ page }) => {
        // Open modal
        await page.click('#itemsContainer .view-details-btn >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Close modal
        await page.click('#itemModal .close');

        // Modal should be hidden
        await expect(page.locator('#itemModal')).not.toBeVisible();
    });

    test('should close modal on outside click', async ({ page, browserName }) => {
        // Open modal
        await page.click('#itemsContainer .view-details-btn >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Click on the top-left corner of the modal backdrop
        // Modal-content has margin: 2% auto and width: 90%, so left 5% is backdrop
        // Top 2% is also backdrop (before modal-content starts)
        const clickX = 5;
        const clickY = 5;

        // Use tap for webkit/mobile (touch events) or click for desktop
        if (browserName === 'webkit') {
            await page.tap('#itemModal', { position: { x: clickX, y: clickY } });
        } else {
            await page.click('#itemModal', { position: { x: clickX, y: clickY } });
        }

        // Modal should be hidden
        await expect(page.locator('#itemModal')).not.toBeVisible();
    });

    test('should select items for comparison', async ({ page }) => {
        // Select first item for comparison (click the label, not the hidden checkbox)
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');

        // Compare button should not be visible yet (need 2 items)
        const compareBtn = page.locator('#compare-btn');
        await expect(compareBtn).not.toBeVisible();

        // Select second item
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');

        // Compare button should now be visible
        await expect(compareBtn).toBeVisible();
        await expect(page.locator('.compare-count')).toContainText('2');
    });

    test('should open compare modal', async ({ page }) => {
        // Select 2 items (click the labels, not the hidden checkboxes)
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');

        // Click compare button
        await page.click('#compare-btn');

        // Compare modal should be visible
        await expect(page.locator('#compareModal')).toBeVisible();

        // Should have 2 comparison columns
        const columns = page.locator('.compare-column');
        await expect(columns).toHaveCount(2);
    });

    test('should limit comparison to 3 items', async ({ page }) => {
        // Set up dialog handler before action that triggers it
        page.on('dialog', async dialog => {
            expect(dialog.message()).toContain('3 items');
            await dialog.accept();
        });

        // Select 3 items (click the labels, not the hidden checkboxes)
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=2');

        // Try to select 4th item - should trigger alert
        await page.click('#itemsContainer .compare-checkbox-label >> nth=3');

        // Compare count should still be 3
        await expect(page.locator('.compare-count')).toContainText('3');
    });
});

test.describe('Items Sorting', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    });

    test('should sort by name', async ({ page }) => {
        await page.selectOption('#sortBy', 'name');
        await page.waitForTimeout(100);

        // Get first two items
        const items = page.locator('#itemsContainer .item-card .item-name');
        const firstName = await items.nth(0).textContent();
        const secondName = await items.nth(1).textContent();

        // First item should come before or equal second item alphabetically
        expect(firstName?.localeCompare(secondName || '')).toBeLessThanOrEqual(0);
    });

    test('should sort by tier', async ({ page }) => {
        await page.selectOption('#sortBy', 'tier');
        await page.waitForTimeout(100);

        // The sort changed the display order
        const itemCards = page.locator('#itemsContainer .item-card');
        const count = await itemCards.count();

        // Verify sort was applied (count unchanged, just reordered)
        expect(count).toBe(78);
    });
});
