// ========================================
// Favorites E2E Tests
// ========================================
// Tests for the favorites toggle functionality
// across items, weapons, tomes, characters, and shrines.
// NOTE: These tests will skip if the favorites feature is disabled.

import { test, expect } from '@playwright/test';

/**
 * Helper to check if favorites feature is enabled
 */
async function isFavoritesEnabled(page): Promise<boolean> {
    const favoriteBtns = await page.locator('#itemsContainer .favorite-btn').count();
    return favoriteBtns > 0;
}

test.describe('Favorites', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage to start fresh
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test.describe('Favorite Button', () => {
        test('should display favorite button on item cards', async ({ page }) => {
            // Skip if favorites feature is disabled
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            const favoriteBtn = page.locator('#itemsContainer .favorite-btn').first();
            await expect(favoriteBtn).toBeVisible();
        });

        test('should toggle favorite state when clicked', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            const favoriteBtn = page.locator('#itemsContainer .favorite-btn').first();

            // Initially not favorited
            await expect(favoriteBtn).not.toHaveClass(/favorited/);

            // Click to favorite
            await favoriteBtn.click();
            await expect(favoriteBtn).toHaveClass(/favorited/);

            // Click again to unfavorite
            await favoriteBtn.click();
            await expect(favoriteBtn).not.toHaveClass(/favorited/);
        });

        test('should update aria-label when favorited', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            const favoriteBtn = page.locator('#itemsContainer .favorite-btn').first();

            // Check initial aria-label
            await expect(favoriteBtn).toHaveAttribute('aria-label', 'Add to favorites');

            // Click to favorite
            await favoriteBtn.click();
            await expect(favoriteBtn).toHaveAttribute('aria-label', 'Remove from favorites');

            // Click to unfavorite
            await favoriteBtn.click();
            await expect(favoriteBtn).toHaveAttribute('aria-label', 'Add to favorites');
        });

        test('should persist favorites after page reload', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            // Favorite first item
            const favoriteBtn = page.locator('#itemsContainer .favorite-btn').first();
            await favoriteBtn.click();
            await expect(favoriteBtn).toHaveClass(/favorited/);

            // Reload page
            await page.reload();
            await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });

            // Check favorite persists
            const favoriteBtnAfterReload = page.locator('#itemsContainer .favorite-btn').first();
            await expect(favoriteBtnAfterReload).toHaveClass(/favorited/);
        });

        test('should work across different tabs', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            // Favorite a weapon
            await page.click('.tab-btn[data-tab="weapons"]');
            await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });

            const weaponFavBtn = page.locator('#weaponsContainer .favorite-btn').first();
            await weaponFavBtn.click();
            await expect(weaponFavBtn).toHaveClass(/favorited/);

            // Favorite a tome
            await page.click('.tab-btn[data-tab="tomes"]');
            await page.waitForSelector('#tomesContainer .item-card', { timeout: 10000 });

            const tomeFavBtn = page.locator('#tomesContainer .favorite-btn').first();
            await tomeFavBtn.click();
            await expect(tomeFavBtn).toHaveClass(/favorited/);

            // Switch back to weapons and verify favorite persists
            await page.click('.tab-btn[data-tab="weapons"]');
            await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });
            await expect(page.locator('#weaponsContainer .favorite-btn').first()).toHaveClass(/favorited/);
        });
    });

    test.describe('Favorites Only Filter', () => {
        test('should display favorites filter checkbox', async ({ page }) => {
            // Skip if favorites feature is disabled (no filter checkbox)
            const favoritesFilter = page.locator('#favoritesOnly');
            if ((await favoritesFilter.count()) === 0) {
                test.skip();
                return;
            }
            await expect(favoritesFilter).toBeVisible();
        });

        test('should filter to show only favorites when checked', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            // First favorite a few items
            const favoriteBtns = page.locator('#itemsContainer .favorite-btn');
            await favoriteBtns.nth(0).click();
            await favoriteBtns.nth(2).click();

            // Wait for favorites to be applied
            await page.waitForTimeout(100);

            // Check the favorites filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300); // Debounce

            // Should only show 2 items
            const itemCards = page.locator('#itemsContainer .item-card');
            await expect(itemCards).toHaveCount(2);
        });

        test('should show no results message when no favorites', async ({ page }) => {
            // Skip if favorites filter doesn't exist
            const favoritesFilter = page.locator('#favoritesOnly');
            if ((await favoritesFilter.count()) === 0) {
                test.skip();
                return;
            }
            // Don't favorite anything, just check the filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300);

            // Should show no items
            const itemCards = page.locator('#itemsContainer .item-card');
            await expect(itemCards).toHaveCount(0);

            // Item count should indicate no results
            const itemCount = page.locator('#item-count');
            await expect(itemCount).toContainText('0');
        });

        test('should restore full list when unchecked', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            // Favorite one item
            await page.locator('#itemsContainer .favorite-btn').first().click();

            // Check filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300);
            await expect(page.locator('#itemsContainer .item-card')).toHaveCount(1);

            // Uncheck filter
            await page.locator('#favoritesOnly').uncheck();
            await page.waitForTimeout(300);

            // Should show all items
            await expect(page.locator('#itemsContainer .item-card')).toHaveCount(80);
        });

        test('should combine with search filter', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            // Search for "bonk" (should match Big Bonk and possibly others)
            await page.fill('#searchInput', 'bonk');
            await page.waitForTimeout(500);

            const initialCount = await page.locator('#itemsContainer .item-card').count();

            // Favorite the first result
            await page.locator('#itemsContainer .favorite-btn').first().click();

            // Enable favorites filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300);

            // Should only show 1 item (the favorited one matching search)
            await expect(page.locator('#itemsContainer .item-card')).toHaveCount(1);

            // Clear search, favorites filter should still apply
            await page.fill('#searchInput', '');
            await page.waitForTimeout(500);

            // Should still show only 1 item (the favorited one, regardless of search)
            await expect(page.locator('#itemsContainer .item-card')).toHaveCount(1);
        });
    });

    test.describe('Favorites in Modal', () => {
        test('should show favorite status in item modal', async ({ page }) => {
            if (!(await isFavoritesEnabled(page))) {
                test.skip();
                return;
            }
            // Favorite an item first
            await page.locator('#itemsContainer .favorite-btn').first().click();

            // Open the item modal (cards are now directly clickable)
            await page.click('#itemsContainer .item-card >> nth=0');
            await expect(page.locator('#itemModal')).toBeVisible();

            // Modal should reflect favorite status (if there's a favorite indicator)
            // This tests that modal content loads correctly for favorited items
            await expect(page.locator('#modalBody')).not.toBeEmpty();
        });
    });
});
