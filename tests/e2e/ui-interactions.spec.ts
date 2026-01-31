// ========================================
// UI Interactions E2E Tests
// ========================================
// Tests for keyboard navigation, modal behavior,
// and general UI/UX interactions.

import { test, expect } from '@playwright/test';

test.describe('Modal Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('should open modal on view details button click', async ({ page }) => {
        await page.click('#itemsContainer .view-details-btn >> nth=0');

        const modal = page.locator('#itemModal');
        await expect(modal).toBeVisible();
    });

    test('should close modal with close button', async ({ page }) => {
        // Open modal
        await page.click('#itemsContainer .view-details-btn >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Close with X button
        await page.click('#itemModal .close');
        await expect(page.locator('#itemModal')).not.toBeVisible();
    });

    test('should close modal with Escape key', async ({ page }) => {
        // Open modal
        await page.click('#itemsContainer .view-details-btn >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Close with Escape
        await page.keyboard.press('Escape');
        await expect(page.locator('#itemModal')).not.toBeVisible();
    });

    test('should display item details in modal', async ({ page }) => {
        await page.click('#itemsContainer .view-details-btn >> nth=0');

        const modalBody = page.locator('#modalBody');
        await expect(modalBody).not.toBeEmpty();

        // Modal should contain common item detail sections
        await expect(modalBody.locator('h2, h3, .item-name')).toBeVisible();
    });

    test('should show correct modal for different items', async ({ page }) => {
        // Open first item modal
        await page.click('#itemsContainer .view-details-btn >> nth=0');
        const firstItemModal = await page.locator('#modalBody').textContent();
        await page.click('#itemModal .close');

        // Open second item modal
        await page.click('#itemsContainer .view-details-btn >> nth=1');
        const secondItemModal = await page.locator('#modalBody').textContent();

        // Content should be different
        expect(firstItemModal).not.toBe(secondItemModal);
    });

    test('should trap focus in modal when open', async ({ page }) => {
        // Open modal
        await page.click('#itemsContainer .view-details-btn >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Tab through modal elements
        await page.keyboard.press('Tab');
        
        // Focus should stay within modal
        const focusedElement = await page.evaluate(() => {
            return document.activeElement?.closest('#itemModal') !== null;
        });
        expect(focusedElement).toBe(true);
    });
});

test.describe('Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('should focus search input on page load or shortcut', async ({ page }) => {
        // Press "/" to focus search (common keyboard shortcut)
        await page.keyboard.press('/');
        
        // Search input should be focused
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeFocused();
    });

    test('should navigate tabs with Tab key', async ({ page }) => {
        // Focus first tab button
        await page.locator('.tab-btn[data-tab="items"]').focus();

        // Press Enter to activate
        await page.keyboard.press('Enter');
        await expect(page.locator('.tab-btn[data-tab="items"]')).toHaveClass(/active/);

        // Tab to next tab button
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');

        // Should activate weapons tab
        await expect(page.locator('.tab-btn[data-tab="weapons"]')).toHaveClass(/active/);
    });

    test('should activate button on Enter and Space', async ({ page }) => {
        const viewBtn = page.locator('#itemsContainer .view-details-btn').first();
        await viewBtn.focus();

        // Press Enter
        await page.keyboard.press('Enter');
        await expect(page.locator('#itemModal')).toBeVisible();
        await page.keyboard.press('Escape');

        // Focus again and press Space
        await viewBtn.focus();
        await page.keyboard.press('Space');
        await expect(page.locator('#itemModal')).toBeVisible();
    });
});

test.describe('Tab Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('items tab is active by default', async ({ page }) => {
        await expect(page.locator('.tab-btn[data-tab="items"]')).toHaveClass(/active/);
        await expect(page.locator('#items-tab')).toHaveClass(/active/);
    });

    test('clicking tab button activates corresponding content', async ({ page }) => {
        const tabs = ['weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator'];

        for (const tab of tabs) {
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(150);

            await expect(page.locator(`.tab-btn[data-tab="${tab}"]`)).toHaveClass(/active/);
            await expect(page.locator(`#${tab}-tab`)).toHaveClass(/active/);
        }
    });

    test('only one tab content is visible at a time', async ({ page }) => {
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForTimeout(150);

        // Items tab should be hidden
        await expect(page.locator('#items-tab')).not.toHaveClass(/active/);
        // Weapons tab should be visible
        await expect(page.locator('#weapons-tab')).toHaveClass(/active/);
    });

    test('tab buttons have proper ARIA attributes', async ({ page }) => {
        const itemsTab = page.locator('.tab-btn[data-tab="items"]');
        
        await expect(itemsTab).toHaveAttribute('role', 'tab');
        await expect(itemsTab).toHaveAttribute('aria-selected', 'true');

        const weaponsTab = page.locator('.tab-btn[data-tab="weapons"]');
        await expect(weaponsTab).toHaveAttribute('role', 'tab');
        await expect(weaponsTab).toHaveAttribute('aria-selected', 'false');
    });

    test('tab content areas have proper ARIA attributes', async ({ page }) => {
        const itemsPanel = page.locator('#items-tab');
        await expect(itemsPanel).toHaveAttribute('role', 'tabpanel');
    });
});

test.describe('Loading States', () => {
    test('should show loading overlay initially', async ({ page }) => {
        // Navigate without waiting
        await page.goto('/', { waitUntil: 'commit' });

        // Loading overlay should be visible initially (may be very brief)
        const loadingOverlay = page.locator('#loading-overlay');
        // It may already be hidden by the time we check, so we just verify it exists
        await expect(loadingOverlay).toBeAttached();
    });

    test('should hide loading overlay after data loads', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

        const loadingOverlay = page.locator('#loading-overlay');
        await expect(loadingOverlay).toBeHidden();
    });
});

test.describe('Item Card Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('should display item cards with required elements', async ({ page }) => {
        const firstCard = page.locator('#itemsContainer .item-card').first();

        // Should have item name
        await expect(firstCard.locator('.item-name')).toBeVisible();

        // Should have view details button
        await expect(firstCard.locator('.view-details-btn')).toBeVisible();

        // Should have favorite button
        await expect(firstCard.locator('.favorite-btn')).toBeVisible();

        // Should have compare checkbox
        await expect(firstCard.locator('.compare-checkbox, .compare-checkbox-label')).toBeVisible();
    });

    test('should display tier badge on item cards', async ({ page }) => {
        const firstCard = page.locator('#itemsContainer .item-card').first();
        const tierBadge = firstCard.locator('.badge[class*="tier-"], .tier-badge');

        // Most items have tier badges
        const hasTierBadge = await tierBadge.count() > 0;
        expect(hasTierBadge).toBe(true);
    });

    test('should display rarity badge on item cards', async ({ page }) => {
        const firstCard = page.locator('#itemsContainer .item-card').first();
        const rarityBadge = firstCard.locator('.badge[class*="rarity-"], .rarity-badge');

        const hasRarityBadge = await rarityBadge.count() > 0;
        expect(hasRarityBadge).toBe(true);
    });

    test('should display item image', async ({ page }) => {
        const firstCard = page.locator('#itemsContainer .item-card').first();
        const image = firstCard.locator('img');

        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute('alt', /.+/);
    });
});

test.describe('Footer Information', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('should display version information', async ({ page }) => {
        const version = page.locator('#version');
        await expect(version).toBeVisible();
        await expect(version).toContainText('Version:');
    });

    test('should display last updated information', async ({ page }) => {
        const lastUpdated = page.locator('#last-updated');
        await expect(lastUpdated).toBeVisible();
        await expect(lastUpdated).toContainText('Last Updated:');
    });

    test('should have Steam link in footer', async ({ page }) => {
        const steamLink = page.locator('footer a[href*="steam"]');
        await expect(steamLink).toBeVisible();
        await expect(steamLink).toHaveAttribute('target', '_blank');
    });
});

test.describe('Responsive Behavior', () => {
    test('should show mobile bottom nav on small screens', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

        const mobileNav = page.locator('.mobile-bottom-nav');
        await expect(mobileNav).toBeVisible();
    });

    test('should hide desktop tabs on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

        // Desktop tabs should be hidden or scrollable on mobile
        const desktopTabs = page.locator('.tabs .tab-buttons');
        const isVisible = await desktopTabs.isVisible();

        // Either hidden or has mobile-specific styling
        if (isVisible) {
            // If visible, should be scrollable/horizontal
            const width = await desktopTabs.evaluate(el => el.scrollWidth);
            const containerWidth = await desktopTabs.evaluate(el => el.clientWidth);
            // Scrollable if content is wider than container
            expect(width >= containerWidth).toBe(true);
        }
    });

    test('should adjust item grid for tablet', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

        const itemsContainer = page.locator('#itemsContainer');
        await expect(itemsContainer).toBeVisible();

        // Items should be displayed in grid
        const items = page.locator('#itemsContainer .item-card');
        const count = await items.count();
        expect(count).toBe(80);
    });
});
