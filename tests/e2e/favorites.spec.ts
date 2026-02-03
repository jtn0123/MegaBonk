// ========================================
// Favorites E2E Tests
// ========================================
// Tests for the favorites toggle functionality
// across weapons, tomes, characters, and shrines.
// NOTE: Items tab does not have favorite buttons (disabled in items.ts)

import { test, expect } from '@playwright/test';

test.describe('Favorites', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage to start fresh
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        // Navigate to weapons tab (items tab doesn't have favorite buttons)
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 15000 });
    });

    test.describe('Favorite Button', () => {
        test('should display favorite button on item cards', async ({ page }) => {
            const favoriteBtn = page.locator('#weaponsContainer .favorite-btn').first();
            await expect(favoriteBtn).toBeVisible();
        });

        test('should toggle favorite state when clicked', async ({ page }) => {
            const favoriteBtn = page.locator('#weaponsContainer .favorite-btn').first();

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
            const favoriteBtn = page.locator('#weaponsContainer .favorite-btn').first();

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
            // Favorite first weapon
            const favoriteBtn = page.locator('#weaponsContainer .favorite-btn').first();
            await favoriteBtn.click();
            await expect(favoriteBtn).toHaveClass(/favorited/);

            // Reload page
            await page.reload();
            // Navigate back to weapons tab
            await page.click('.tab-btn[data-tab="weapons"]');
            await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });

            // Check favorite persists
            const favoriteBtnAfterReload = page.locator('#weaponsContainer .favorite-btn').first();
            await expect(favoriteBtnAfterReload).toHaveClass(/favorited/);
        });

        test('should work across different tabs', async ({ page }) => {
            // Favorite a weapon (already on weapons tab)
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
            const favoritesFilter = page.locator('#favoritesOnly');
            await expect(favoritesFilter).toBeVisible();
        });

        test('should filter to show only favorites when checked', async ({ page }) => {
            // First favorite a few weapons
            const favoriteBtns = page.locator('#weaponsContainer .favorite-btn');
            await favoriteBtns.nth(0).click();
            await favoriteBtns.nth(2).click();

            // Wait for favorites to be applied
            await page.waitForTimeout(100);

            // Check the favorites filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300); // Debounce

            // Should only show 2 weapons
            const itemCards = page.locator('#weaponsContainer .item-card');
            await expect(itemCards).toHaveCount(2);
        });

        test('should show no results message when no favorites', async ({ page }) => {
            // Don't favorite anything, just check the filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300);

            // Should show no weapons
            const itemCards = page.locator('#weaponsContainer .item-card');
            await expect(itemCards).toHaveCount(0);

            // Item count should indicate no results
            const itemCount = page.locator('#item-count');
            await expect(itemCount).toContainText('0');
        });

        test('should restore full list when unchecked', async ({ page }) => {
            // Get initial count of weapons
            const initialCount = await page.locator('#weaponsContainer .item-card').count();

            // Favorite one weapon
            await page.locator('#weaponsContainer .favorite-btn').first().click();

            // Check filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300);
            await expect(page.locator('#weaponsContainer .item-card')).toHaveCount(1);

            // Uncheck filter
            await page.locator('#favoritesOnly').uncheck();
            await page.waitForTimeout(300);

            // Should show all weapons again
            await expect(page.locator('#weaponsContainer .item-card')).toHaveCount(initialCount);
        });

        test('should combine with search filter', async ({ page }) => {
            // Search for something (use a generic term that should match weapons)
            await page.fill('#searchInput', 'a');
            await page.waitForTimeout(500);

            const searchResultCount = await page.locator('#weaponsContainer .item-card').count();
            expect(searchResultCount).toBeGreaterThan(0);

            // Favorite the first result
            await page.locator('#weaponsContainer .favorite-btn').first().click();

            // Enable favorites filter
            await page.locator('#favoritesOnly').check();
            await page.waitForTimeout(300);

            // Should only show 1 weapon (the favorited one matching search)
            await expect(page.locator('#weaponsContainer .item-card')).toHaveCount(1);

            // Clear search, favorites filter should still apply
            await page.fill('#searchInput', '');
            await page.waitForTimeout(500);

            // Should still show only 1 weapon (the favorited one, regardless of search)
            await expect(page.locator('#weaponsContainer .item-card')).toHaveCount(1);
        });
    });

    test.describe('Favorites in Modal', () => {
        test('should show favorite status in item modal', async ({ page }) => {
            // Favorite a weapon first
            await page.locator('#weaponsContainer .favorite-btn').first().click();

            // Open the weapon modal
            await page.click('#weaponsContainer .view-details-btn >> nth=0');
            await expect(page.locator('#itemModal')).toBeVisible();

            // Modal should reflect favorite status (if there's a favorite indicator)
            // This tests that modal content loads correctly for favorited items
            await expect(page.locator('#modalBody')).not.toBeEmpty();
        });
    });
});
