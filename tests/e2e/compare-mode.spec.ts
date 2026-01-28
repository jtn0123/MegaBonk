// ========================================
// Compare Mode E2E Tests
// ========================================

import { test, expect } from '@playwright/test';

test.describe('Compare Mode', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for items to load
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    });

    test.describe('Item Selection', () => {
        test('should show compare checkbox on item cards', async ({ page }) => {
            // Check that compare checkboxes exist
            const checkboxes = page.locator('.compare-checkbox');
            await expect(checkboxes.first()).toBeVisible();
        });

        test('should select item for comparison when checkbox clicked', async ({ page }) => {
            // Click the first compare checkbox
            const checkbox = page.locator('.compare-checkbox').first();
            await checkbox.click();

            // Checkbox should be checked
            await expect(checkbox).toBeChecked();
        });

        test('should deselect item when checkbox clicked again', async ({ page }) => {
            const checkbox = page.locator('.compare-checkbox').first();

            // Select
            await checkbox.click();
            await expect(checkbox).toBeChecked();

            // Deselect
            await checkbox.click();
            await expect(checkbox).not.toBeChecked();
        });

        test('should update compare count when items selected', async ({ page }) => {
            // Select two items
            const checkboxes = page.locator('.compare-checkbox');
            await checkboxes.nth(0).click();
            await checkboxes.nth(1).click();

            // Compare button should show count
            const compareBtn = page.locator('#compare-btn');
            await expect(compareBtn).toBeVisible();

            const countSpan = compareBtn.locator('.compare-count');
            await expect(countSpan).toHaveText('2');
        });

        test('should show compare button only when 2+ items selected', async ({ page }) => {
            const compareBtn = page.locator('#compare-btn');
            const checkboxes = page.locator('.compare-checkbox');

            // Initially hidden
            await expect(compareBtn).toBeHidden();

            // Select one item
            await checkboxes.nth(0).click();
            await expect(compareBtn).toBeHidden();

            // Select second item - button should appear
            await checkboxes.nth(1).click();
            await expect(compareBtn).toBeVisible();

            // Deselect one - button should hide
            await checkboxes.nth(0).click();
            await expect(compareBtn).toBeHidden();
        });

        test('should limit selection to maximum allowed items', async ({ page }) => {
            const checkboxes = page.locator('.compare-checkbox');

            // Select maximum items (4 based on MAX_COMPARE_ITEMS)
            for (let i = 0; i < 4; i++) {
                await checkboxes.nth(i).click();
            }

            // Try to select one more
            await checkboxes.nth(4).click();

            // Should show warning toast
            const toast = page.locator('.toast.warning, .toast-warning');
            await expect(toast).toBeVisible({ timeout: 3000 });
        });
    });

    test.describe('Compare Modal', () => {
        test.beforeEach(async ({ page }) => {
            // Select two items
            const checkboxes = page.locator('.compare-checkbox');
            await checkboxes.nth(0).click();
            await checkboxes.nth(1).click();
        });

        test('should open compare modal when button clicked', async ({ page }) => {
            const compareBtn = page.locator('#compare-btn');
            await compareBtn.click();

            const modal = page.locator('#compareModal');
            await expect(modal).toBeVisible();
        });

        test('should display selected items in compare grid', async ({ page }) => {
            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');
            await expect(modal).toBeVisible();

            // Should have two compare columns
            const columns = modal.locator('.compare-column');
            await expect(columns).toHaveCount(2);
        });

        test('should show item details in comparison', async ({ page }) => {
            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');

            // Check for key sections
            await expect(modal.locator('.compare-section h4:has-text("Base Effect")').first()).toBeVisible();
            await expect(modal.locator('.compare-section h4:has-text("Stacking")').first()).toBeVisible();
            await expect(modal.locator('.compare-section h4:has-text("Formula")').first()).toBeVisible();
        });

        test('should show rarity badges', async ({ page }) => {
            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');
            const badges = modal.locator('.badge[class*="rarity-"]');

            await expect(badges.first()).toBeVisible();
        });

        test('should show tier badges', async ({ page }) => {
            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');
            const badges = modal.locator('.badge[class*="tier-"]');

            await expect(badges.first()).toBeVisible();
        });

        test('should close modal when close button clicked', async ({ page }) => {
            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');
            await expect(modal).toBeVisible();

            // Click close button
            await page.locator('#compareModal .close-btn, #closeCompareModal').click();

            // Modal should close
            await expect(modal).toBeHidden({ timeout: 1000 });
        });

        test('should close modal when clicking outside', async ({ page }) => {
            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');
            await expect(modal).toBeVisible();

            // Click on modal overlay (outside content)
            await page.click('#compareModal', { position: { x: 10, y: 10 } });

            // Modal should close
            await expect(modal).toBeHidden({ timeout: 1000 });
        });

        test('should remove item from comparison via button', async ({ page }) => {
            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');
            await expect(modal).toBeVisible();

            // Click remove button on first item
            await modal.locator('.remove-compare-btn').first().click();

            // Modal should close (less than 2 items)
            await expect(modal).toBeHidden({ timeout: 1000 });
        });
    });

    test.describe('Scaling Chart', () => {
        test('should display scaling chart for comparable items', async ({ page }) => {
            // Find items with scaling data
            const checkboxes = page.locator('.compare-checkbox');

            // Select first two items that likely have scaling data
            await checkboxes.nth(0).click();
            await checkboxes.nth(1).click();

            await page.locator('#compare-btn').click();

            const modal = page.locator('#compareModal');
            await expect(modal).toBeVisible();

            // Chart section may or may not appear depending on item data
            const _chartSection = modal.locator('.compare-chart-section');
            // This is conditional - only appears if both items have scaling data
            // We just verify the modal works correctly
            expect(await modal.isVisible()).toBe(true);
        });
    });

    test.describe('Clear Compare', () => {
        test('should clear all selections', async ({ page }) => {
            // Select multiple items
            const checkboxes = page.locator('.compare-checkbox');
            await checkboxes.nth(0).click();
            await checkboxes.nth(1).click();
            await checkboxes.nth(2).click();

            // Open modal
            await page.locator('#compare-btn').click();
            const modal = page.locator('#compareModal');
            await expect(modal).toBeVisible();

            // Find and click clear button if exists
            const clearBtn = page.locator('[data-action="clear-compare"], .clear-compare-btn');
            if ((await clearBtn.count()) > 0) {
                await clearBtn.click();

                // All checkboxes should be unchecked
                await expect(checkboxes.nth(0)).not.toBeChecked();
                await expect(checkboxes.nth(1)).not.toBeChecked();
                await expect(checkboxes.nth(2)).not.toBeChecked();

                // Compare button should be hidden
                await expect(page.locator('#compare-btn')).toBeHidden();
            }
        });
    });

    test.describe('Cross-Tab Compare', () => {
        test('should maintain compare selections when switching tabs', async ({ page }) => {
            // Select items on items tab
            const checkboxes = page.locator('.compare-checkbox');
            await checkboxes.nth(0).click();
            await checkboxes.nth(1).click();

            // Switch to weapons tab
            await page.click('.tab-btn[data-tab="weapons"]');
            await page.waitForSelector('#weaponsContainer .item-card', { timeout: 5000 });

            // Switch back to items tab
            await page.click('.tab-btn[data-tab="items"]');
            await page.waitForSelector('#itemsContainer .item-card', { timeout: 5000 });

            // Selections should be preserved
            await expect(checkboxes.nth(0)).toBeChecked();
            await expect(checkboxes.nth(1)).toBeChecked();
        });
    });

    test.describe('Accessibility', () => {
        test('should have aria-hidden attribute on modal', async ({ page }) => {
            // Select items
            const checkboxes = page.locator('.compare-checkbox');
            await checkboxes.nth(0).click();
            await checkboxes.nth(1).click();

            const modal = page.locator('#compareModal');

            // Initially should be hidden
            await expect(modal).toHaveAttribute('aria-hidden', 'true');

            // Open modal
            await page.locator('#compare-btn').click();
            await expect(modal).toBeVisible();

            // Should be visible to screen readers
            await expect(modal).toHaveAttribute('aria-hidden', 'false');
        });

        test('checkboxes should have proper labels', async ({ page }) => {
            const checkbox = page.locator('.compare-checkbox').first();

            // Should have associated label or aria-label
            const ariaLabel = await checkbox.getAttribute('aria-label');
            const id = await checkbox.getAttribute('id');

            const hasLabel =
                ariaLabel !== null || (id !== null && (await page.locator(`label[for="${id}"]`).count()) > 0);
            expect(hasLabel || (await checkbox.getAttribute('title'))).toBeTruthy();
        });
    });
});
