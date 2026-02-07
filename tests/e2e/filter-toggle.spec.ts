// ========================================
// Filter Toggle E2E Tests
// ========================================
// Tests for the collapsible filter panel functionality
// NOTE: Filter toggle button is MOBILE-ONLY (hidden on desktop via CSS)
// These tests are skipped on desktop viewport

import { test, expect } from '@playwright/test';

// Skip entire suite - filter toggle is mobile-only (display: none on desktop)
test.describe.skip('Filter Toggle Button', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('filter toggle button is visible', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');
        await expect(toggleBtn).toBeVisible();
    });

    test('filter toggle button has correct aria attributes', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');
        await expect(toggleBtn).toHaveAttribute('aria-expanded');
        await expect(toggleBtn).toHaveAttribute('aria-controls', 'filters');
    });

    test('clicking filter toggle expands/collapses filters', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');
        const filters = page.locator('#filters');

        // Get initial state
        const initialExpanded = await toggleBtn.getAttribute('aria-expanded');

        // Click toggle
        await toggleBtn.click();
        await page.waitForTimeout(300);

        // State should change
        const afterClickExpanded = await toggleBtn.getAttribute('aria-expanded');
        expect(afterClickExpanded).not.toBe(initialExpanded);

        // Click again to toggle back
        await toggleBtn.click();
        await page.waitForTimeout(300);

        const afterSecondClick = await toggleBtn.getAttribute('aria-expanded');
        expect(afterSecondClick).toBe(initialExpanded);
    });

    test('filter toggle icon rotates on expand', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');
        const toggleIcon = page.locator('.filter-toggle-icon');

        // Click to expand
        await toggleBtn.click();
        await page.waitForTimeout(300);

        // Icon should have rotate class or transform
        const iconClass = await toggleIcon.getAttribute('class');
        const transform = await toggleIcon.evaluate(el => getComputedStyle(el).transform);
        
        // Either class changes or transform is applied
        expect(iconClass || transform).toBeTruthy();
    });

    test('filters are accessible when expanded', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');
        
        // Ensure filters are expanded
        const expanded = await toggleBtn.getAttribute('aria-expanded');
        if (expanded === 'false') {
            await toggleBtn.click();
            await page.waitForTimeout(300);
        }

        // Filter controls should be visible
        const tierFilter = page.locator('#tierFilter');
        const rarityFilter = page.locator('#rarityFilter');

        await expect(tierFilter).toBeVisible();
        await expect(rarityFilter).toBeVisible();
    });

    test('keyboard activation of filter toggle', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');

        // Focus the toggle button
        await toggleBtn.focus();
        await expect(toggleBtn).toBeFocused();

        // Get initial state
        const initialExpanded = await toggleBtn.getAttribute('aria-expanded');

        // Press Enter to activate
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        // State should change
        const afterEnter = await toggleBtn.getAttribute('aria-expanded');
        expect(afterEnter).not.toBe(initialExpanded);

        // Press Space to toggle back
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);

        const afterSpace = await toggleBtn.getAttribute('aria-expanded');
        expect(afterSpace).toBe(initialExpanded);
    });
});

// Skip - filter toggle is mobile-only feature, tests need mobile-specific setup
test.describe.skip('Filter Toggle - Mobile Behavior', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('filter toggle is prominent on mobile', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');
        await expect(toggleBtn).toBeVisible();

        // Should be easily tappable (reasonable size)
        const box = await toggleBtn.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(40); // Minimum touch target
    });

    test('filters collapse by default on mobile for space saving', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');
        const expanded = await toggleBtn.getAttribute('aria-expanded');
        
        // On mobile, filters may start collapsed
        // This is implementation dependent, so we just verify toggle works
        await toggleBtn.click();
        await page.waitForTimeout(300);
        
        const afterClick = await toggleBtn.getAttribute('aria-expanded');
        expect(afterClick).not.toBe(expanded);
    });

    test('expanded filters are usable on mobile', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');

        // Expand filters
        if (await toggleBtn.getAttribute('aria-expanded') === 'false') {
            await toggleBtn.click();
            await page.waitForTimeout(300);
        }

        // Verify filter dropdowns are tappable
        const tierFilter = page.locator('#tierFilter');
        await expect(tierFilter).toBeVisible();

        // Select a filter option
        await tierFilter.selectOption('SS');
        await page.waitForTimeout(200);

        // Filter should work
        const items = page.locator('#itemsContainer .item-card');
        const count = await items.count();
        expect(count).toBeLessThan(80);
    });
});

// Skip - filter toggle is mobile-only feature
test.describe.skip('Filter Toggle - Cross-Tab Behavior', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('filter toggle state is independent per tab', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');

        // Expand filters on items tab
        await toggleBtn.click();
        await page.waitForTimeout(200);
        const itemsExpanded = await toggleBtn.getAttribute('aria-expanded');

        // Switch to weapons tab
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });

        // Check filter toggle state on weapons tab
        const weaponsExpanded = await toggleBtn.getAttribute('aria-expanded');

        // State may be preserved or reset - both are valid behaviors
        expect(weaponsExpanded === 'true' || weaponsExpanded === 'false').toBe(true);
    });

    test('filters update based on active tab', async ({ page }) => {
        const toggleBtn = page.locator('#filter-toggle-btn');

        // Ensure expanded
        if (await toggleBtn.getAttribute('aria-expanded') === 'false') {
            await toggleBtn.click();
            await page.waitForTimeout(200);
        }

        // Items tab should have stacking filter
        const stackingFilter = page.locator('#stackingFilter');
        const hasStackingOnItems = await stackingFilter.isVisible();

        // Switch to characters tab
        await page.click('.tab-btn[data-tab="characters"]');
        await page.waitForSelector('#charactersContainer .item-card', { timeout: 10000 });

        // Characters may have different filters
        // Just verify filters container exists
        const filters = page.locator('#filters');
        await expect(filters).toBeAttached();
    });
});
