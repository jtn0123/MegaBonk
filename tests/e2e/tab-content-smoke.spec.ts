// ========================================
// Tab Content Smoke Tests
// ========================================
// Critical E2E tests to ensure all tabs load and
// item/entity clicking opens modals correctly.
// These tests catch regressions that break basic functionality.

import { test, expect } from '@playwright/test';

// All tabs that should be testable
const CONTENT_TABS = [
    { tab: 'items', container: '#itemsContainer', cardSelector: '.item-card', minCount: 80 },
    { tab: 'weapons', container: '#weaponsContainer', cardSelector: '.item-card', minCount: 29 },
    { tab: 'tomes', container: '#tomesContainer', cardSelector: '.item-card', minCount: 23 },
    { tab: 'characters', container: '#charactersContainer', cardSelector: '.item-card', minCount: 20 },
    { tab: 'shrines', container: '#shrinesContainer', cardSelector: '.item-card', minCount: 8 },
];

const FEATURE_TABS = [
    { tab: 'build-planner', container: '#build-planner-tab', titleSelector: 'h2, .build-planner-title' },
    { tab: 'calculator', container: '#calculator-tab', titleSelector: 'h2, .calculator-title' },
    { tab: 'advisor', container: '#advisor-tab', titleSelector: 'h2, .advisor-title' },
    { tab: 'changelog', container: '#changelog-tab', titleSelector: 'h2, .changelog-title' },
    { tab: 'about', container: '#about-tab, #aboutContainer', titleSelector: 'h2, .about-title' },
];

test.describe('Tab Content Loading - Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for initial data load
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    // Test each content tab loads with expected items
    for (const { tab, container, cardSelector, minCount } of CONTENT_TABS) {
        test(`${tab} tab loads with at least ${minCount} cards`, async ({ page }) => {
            // Switch to tab
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(200); // Tab switch debounce

            // Verify tab is active
            await expect(page.locator(`.tab-btn[data-tab="${tab}"]`)).toHaveClass(/active/);

            // Wait for content
            await page.waitForSelector(`${container} ${cardSelector}`, { timeout: 10000 });

            // Count cards
            const cards = page.locator(`${container} ${cardSelector}`);
            const count = await cards.count();
            expect(count).toBeGreaterThanOrEqual(minCount);
        });
    }

    // Test feature tabs load
    for (const { tab, container } of FEATURE_TABS) {
        test(`${tab} tab loads without error`, async ({ page }) => {
            // Switch to tab
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(200);

            // Verify tab is active
            await expect(page.locator(`.tab-btn[data-tab="${tab}"]`)).toHaveClass(/active/);

            // Verify container is visible
            const containerEl = page.locator(container).first();
            await expect(containerEl).toBeVisible({ timeout: 5000 });
        });
    }
});

test.describe('Card Click Opens Modal - Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    // Test clicking cards on each content tab opens modals
    for (const { tab, container, cardSelector } of CONTENT_TABS) {
        test(`clicking ${tab} card opens modal`, async ({ page }) => {
            // Switch to tab
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(200);
            await page.waitForSelector(`${container} ${cardSelector}`, { timeout: 10000 });

            // Click first card directly (not view-details button)
            const firstCard = page.locator(`${container} ${cardSelector}`).first();
            await firstCard.click();
            await page.waitForTimeout(500); // Modal animation

            // Verify modal opened
            const modal = page.locator('#itemModal');
            await expect(modal).toHaveClass(/active/, { timeout: 3000 });

            // Verify modal has content
            const modalBody = page.locator('#modalBody');
            await expect(modalBody).not.toBeEmpty();

            // Verify modal title exists
            const title = modalBody.locator('h2').first();
            await expect(title).toBeVisible();

            // Close modal
            await page.click('#itemModal .close, #itemModal .modal-close');
            await page.waitForTimeout(300);
            await expect(modal).not.toHaveClass(/active/);
        });
    }
});

test.describe('Card Data Attributes - Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    // Verify cards have required data attributes for click handling
    for (const { tab, container, cardSelector } of CONTENT_TABS) {
        test(`${tab} cards have entityType and entityId data attributes`, async ({ page }) => {
            // Switch to tab
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(200);
            await page.waitForSelector(`${container} ${cardSelector}`, { timeout: 10000 });

            // Get first card's data attributes
            const firstCard = page.locator(`${container} ${cardSelector}`).first();
            
            const entityType = await firstCard.getAttribute('data-entity-type');
            const entityId = await firstCard.getAttribute('data-entity-id');

            expect(entityType).toBeTruthy();
            expect(entityId).toBeTruthy();
        });

        test(`${tab} cards have clickable-card class`, async ({ page }) => {
            // Switch to tab
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(200);
            await page.waitForSelector(`${container} ${cardSelector}`, { timeout: 10000 });

            // Check class
            const firstCard = page.locator(`${container} ${cardSelector}`).first();
            await expect(firstCard).toHaveClass(/clickable-card/);
        });
    }
});

test.describe('Mobile Card Click - Smoke Tests', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    test('clicking item card on mobile opens modal', async ({ page }) => {
        const firstCard = page.locator('#itemsContainer .item-card').first();
        await firstCard.click();
        await page.waitForTimeout(500);

        const modal = page.locator('#itemModal');
        await expect(modal).toHaveClass(/active/, { timeout: 3000 });

        // Modal should have content
        const modalBody = page.locator('#modalBody');
        await expect(modalBody).not.toBeEmpty();
    });

    test('mobile bottom nav switches tabs correctly', async ({ page }) => {
        // Click weapons in bottom nav
        const weaponsNavBtn = page.locator('.mobile-bottom-nav .mobile-nav-btn[data-tab="weapons"]');
        if (await weaponsNavBtn.count() > 0) {
            await weaponsNavBtn.click();
            await page.waitForTimeout(200);
            await expect(page.locator('.tab-btn[data-tab="weapons"]')).toHaveClass(/active/);
        }
    });
});

test.describe('Console Error Detection', () => {
    test('no JS errors during tab navigation', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });

        // Navigate through all tabs
        for (const tab of ['items', 'weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator', 'advisor', 'changelog', 'about']) {
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(300);
        }

        // Should have no JS errors
        expect(errors).toHaveLength(0);
    });

    test('no JS errors when clicking cards', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });

        // Click first item
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        // Should have no JS errors
        expect(errors).toHaveLength(0);
    });
});
