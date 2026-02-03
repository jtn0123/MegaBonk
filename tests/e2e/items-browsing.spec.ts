/* global MouseEvent */
import { test, expect } from '@playwright/test';

test.describe('Items Browsing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    });

    test('should display all items initially', async ({ page }) => {
        const itemCards = page.locator('#itemsContainer .item-card');
        // Should have 80 items according to the data
        await expect(itemCards).toHaveCount(80);
    });

    test('should display stats summary', async ({ page }) => {
        const itemCount = page.locator('#item-count');
        await expect(itemCount).toContainText('80 items');
    });

    test('should filter items by search', async ({ page }) => {
        await page.fill('#searchInput', 'Big Bonk');

        // Wait for debounce (300ms) plus render time
        await page.waitForTimeout(500);

        // Global search shows results across categories - verify results are shown
        const itemCount = page.locator('#item-count');
        await expect(itemCount).toContainText('results');

        // Verify Big Bonk is in the search results
        await expect(page.locator('img[alt="Big Bonk"]')).toBeVisible();
    });

    test('should filter by tier', async ({ page }) => {
        await page.selectOption('#tierFilter', 'SS');

        await page.waitForTimeout(100);

        const itemCards = page.locator('#itemsContainer .item-card');
        const count = await itemCards.count();

        // Should have some SS tier items but fewer than total
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(80);
    });

    test('should filter by rarity', async ({ page }) => {
        await page.selectOption('#rarityFilter', 'legendary');

        await page.waitForTimeout(100);

        const itemCards = page.locator('#itemsContainer .item-card');
        const count = await itemCards.count();

        // Should have some legendary items
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(80);
    });

    test('should filter by stacking behavior', async ({ page }) => {
        await page.selectOption('#stackingFilter', 'one_and_done');

        await page.waitForTimeout(100);

        const itemCards = page.locator('#itemsContainer .item-card');
        const count = await itemCards.count();

        // Should have some one-and-done items
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(80);
    });

    test('should clear search filter', async ({ page }) => {
        // First filter
        await page.fill('#searchInput', 'Big Bonk');
        await page.waitForTimeout(500);

        // Verify search results are shown
        const itemCount = page.locator('#item-count');
        await expect(itemCount).toContainText('results');

        // Clear filter
        await page.fill('#searchInput', '');
        await page.waitForTimeout(500);

        // Should show all items again (80 items in original grid)
        await expect(page.locator('#itemsContainer .item-card')).toHaveCount(80);
    });

    test('should open item detail modal', async ({ page }) => {
        // Click the first item card (cards are now directly clickable)
        await page.click('#itemsContainer .item-card >> nth=0');

        // Modal should be visible
        const modal = page.locator('#itemModal');
        await expect(modal).toBeVisible();

        // Modal should have content
        const modalBody = page.locator('#modalBody');
        await expect(modalBody).not.toBeEmpty();
    });

    test('should close modal on X click', async ({ page }) => {
        // Open modal
        await page.click('#itemsContainer .item-card >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Close modal
        await page.click('#itemModal .close');

        // Modal should be hidden
        await expect(page.locator('#itemModal')).not.toBeVisible();
    });

    // Skip on webkit - Mobile Safari has inconsistent behavior with programmatic click events on modals
    test('should close modal on outside click', async ({ page, browserName }) => {
        test.skip(browserName === 'webkit', 'Skipped on WebKit due to inconsistent modal backdrop click handling');

        // Open modal
        await page.click('#itemsContainer .item-card >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Wait for modal animation to complete
        await page.waitForTimeout(400);

        // Use JavaScript to dispatch click on the modal backdrop
        // This ensures consistent behavior across browsers
        await page.evaluate(() => {
            const modal = document.getElementById('itemModal');
            if (modal) {
                // Dispatch click event directly on the modal element (backdrop)
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                });
                modal.dispatchEvent(clickEvent);
            }
        });

        // Modal should be hidden
        await expect(page.locator('#itemModal')).not.toBeVisible();
    });

    test('should select items for comparison', async ({ page }) => {
        // Skip if compare feature is disabled (no checkbox labels rendered)
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }
        
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
        // Skip if compare feature is disabled
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }
        
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
        // Skip if compare feature is disabled
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }
        
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
        await page.waitForTimeout(300);

        // Verify items are sorted by tier (SS should come first)
        const firstCard = page.locator('#itemsContainer .item-card').first();
        await expect(firstCard).toContainText('SS Tier');
    });
});
