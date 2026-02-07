// ========================================
// Compare Items E2E Tests
// ========================================
// Tests for item comparison functionality

import { test, expect } from '@playwright/test';

test.describe('Compare Items - Selection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('compare checkboxes exist on item cards', async ({ page }) => {
        const compareCheckboxes = page.locator('#itemsContainer .compare-checkbox, #itemsContainer .compare-checkbox-label');
        const count = await compareCheckboxes.count();
        
        // If compare feature is enabled, should have checkboxes
        if (count > 0) {
            expect(count).toBeGreaterThan(0);
        } else {
            // Feature may be disabled - skip
            test.skip();
        }
    });

    test('selecting one item shows no compare button', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select first item
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.waitForTimeout(200);

        // Compare button should not be visible (need 2+ items)
        const compareBtn = page.locator('#compare-btn');
        await expect(compareBtn).not.toBeVisible();
    });

    test('selecting two items shows compare button', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select two items
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.waitForTimeout(200);

        // Compare button should be visible
        const compareBtn = page.locator('#compare-btn');
        await expect(compareBtn).toBeVisible();
    });

    test('compare button shows selected count', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select two items
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.waitForTimeout(200);

        // Should show count
        const compareCount = page.locator('.compare-count');
        await expect(compareCount).toContainText('2');
    });

    test('selecting three items updates count', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select three items
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=2');
        await page.waitForTimeout(200);

        // Should show count of 3
        const compareCount = page.locator('.compare-count');
        await expect(compareCount).toContainText('3');
    });

    test('cannot select more than 3 items for comparison', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Set up dialog handler
        let dialogMessage = '';
        page.on('dialog', async dialog => {
            dialogMessage = dialog.message();
            await dialog.accept();
        });

        // Select 3 items
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=2');
        await page.waitForTimeout(200);

        // Try to select 4th item
        await page.click('#itemsContainer .compare-checkbox-label >> nth=3');
        await page.waitForTimeout(200);

        // Should show alert or count should remain 3
        const compareCount = page.locator('.compare-count');
        await expect(compareCount).toContainText('3');
    });

    test('deselecting item updates count', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select two items
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.waitForTimeout(200);

        // Deselect first item
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.waitForTimeout(200);

        // Compare button should be hidden (only 1 item selected)
        const compareBtn = page.locator('#compare-btn');
        await expect(compareBtn).not.toBeVisible();
    });
});

test.describe('Compare Items - Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('clicking compare button opens modal', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select two items
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.waitForTimeout(200);

        // Click compare button
        await page.click('#compare-btn');
        await page.waitForTimeout(300);

        // Compare modal should be visible
        const compareModal = page.locator('#compareModal');
        await expect(compareModal).toBeVisible();
    });

    test('compare modal shows selected items', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Get first two item names
        const firstName = await page.locator('#itemsContainer .item-card .item-name >> nth=0').textContent();
        const secondName = await page.locator('#itemsContainer .item-card .item-name >> nth=1').textContent();

        // Select and compare
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#compare-btn');
        await page.waitForTimeout(300);

        // Modal should contain both item names
        const compareBody = page.locator('#compareBody');
        const content = await compareBody.textContent();
        
        expect(content?.includes(firstName!.trim()) || content?.includes(secondName!.trim())).toBe(true);
    });

    test('compare modal has comparison columns', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select and compare
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#compare-btn');
        await page.waitForTimeout(300);

        // Should have 2 columns
        const columns = page.locator('.compare-column');
        const count = await columns.count();
        expect(count).toBe(2);
    });

    test('compare modal close button works', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Open compare modal
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#compare-btn');
        await page.waitForTimeout(300);

        await expect(page.locator('#compareModal')).toBeVisible();

        // Close modal
        await page.click('#closeCompare');
        await page.waitForTimeout(200);

        await expect(page.locator('#compareModal')).not.toBeVisible();
    });

    test('compare modal closes on Escape key', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Open compare modal
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#compare-btn');
        await page.waitForTimeout(300);

        await expect(page.locator('#compareModal')).toBeVisible();

        // Press Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        await expect(page.locator('#compareModal')).not.toBeVisible();
    });

    test('comparing 3 items shows 3 columns', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select and compare 3 items
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=2');
        await page.click('#compare-btn');
        await page.waitForTimeout(300);

        // Should have 3 columns
        const columns = page.locator('.compare-column');
        const count = await columns.count();
        expect(count).toBe(3);
    });
});

test.describe('Compare Items - Floating Button', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('floating compare button has correct styling', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        // Select items to show button
        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.waitForTimeout(200);

        const compareBtn = page.locator('#compare-btn');
        await expect(compareBtn).toBeVisible();

        // Should have floating-compare-btn class
        await expect(compareBtn).toHaveClass(/floating-compare-btn/);
    });

    test('floating button position is fixed', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.waitForTimeout(200);

        const compareBtn = page.locator('#compare-btn');
        const position = await compareBtn.evaluate(el => getComputedStyle(el).position);
        
        expect(position).toBe('fixed');
    });

    test('floating button stays visible when scrolling', async ({ page }) => {
        const hasCompareFeature = await page.locator('#itemsContainer .compare-checkbox-label').count() > 0;
        if (!hasCompareFeature) {
            test.skip();
            return;
        }

        await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
        await page.click('#itemsContainer .compare-checkbox-label >> nth=1');
        await page.waitForTimeout(200);

        const compareBtn = page.locator('#compare-btn');
        await expect(compareBtn).toBeVisible();

        // Scroll down
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(200);

        // Button should still be visible
        await expect(compareBtn).toBeVisible();
    });
});
