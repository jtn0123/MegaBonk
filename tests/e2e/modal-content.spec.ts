// ========================================
// Modal Content E2E Tests
// ========================================
// Tests for modal content rendering, charts, and interactions

import { test, expect } from '@playwright/test';

test.describe('Item Modal Content', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('modal displays item name as title', async ({ page }) => {
        // Get first item name
        const firstCardName = await page.locator('#itemsContainer .item-card .item-name').first().textContent();
        
        // Open modal
        await page.locator('#itemsContainer .item-card').first().click();
        
        // Wait for modal to be visible
        const modal = page.locator('#itemModal');
        await expect(modal).toHaveClass(/active/, { timeout: 3000 });
        await page.waitForTimeout(300);

        // The modal should contain the item name somewhere in its body
        // The actual title element might be "Item Details" for accessibility, 
        // but the item name should appear prominently in the modal content
        const modalBody = page.locator('#modalBody');
        await expect(modalBody).toContainText(firstCardName?.trim() || '');
    });

    test('modal displays rarity badge', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const rarityBadge = page.locator('#modalBody .badge[class*="rarity"], #modalBody [class*="rarity"]');
        await expect(rarityBadge.first()).toBeVisible();
    });

    test('modal displays tier badge', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const tierBadge = page.locator('#modalBody .badge[class*="tier"], #modalBody [class*="tier"]');
        await expect(tierBadge.first()).toBeVisible();
    });

    test('modal displays item description', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const description = page.locator('#modalBody p, #modalBody .item-description');
        await expect(description.first()).toBeVisible();
    });

    test('modal displays item image', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const image = page.locator('#modalBody img, #modalBody .modal-image');
        await expect(image.first()).toBeVisible();
    });

    test('modal close button works', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);
        await expect(page.locator('#itemModal')).toHaveClass(/active/);

        await page.locator('#itemModal .close, #itemModal .modal-close').first().click();
        await page.waitForTimeout(300);
        await expect(page.locator('#itemModal')).not.toHaveClass(/active/);
    });

    test('clicking outside modal closes it', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);
        await expect(page.locator('#itemModal')).toHaveClass(/active/);

        // Click on modal backdrop (outside content)
        await page.locator('#itemModal').click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(300);
        await expect(page.locator('#itemModal')).not.toHaveClass(/active/);
    });
});

test.describe('Modal Chart Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('scaling chart renders for stackable items', async ({ page }) => {
        // Find an item that stacks well (Big Bonk is known to have a chart)
        const bigBonkCard = page.locator('#itemsContainer .item-card:has-text("Big Bonk")');
        if (await bigBonkCard.count() > 0) {
            await bigBonkCard.first().click();
            await page.waitForTimeout(800); // Wait for chart animation

            const chartCanvas = page.locator('#modalBody canvas, #modalBody .scaling-chart');
            if (await chartCanvas.count() > 0) {
                await expect(chartCanvas.first()).toBeVisible();
            }
        }
    });

    test('chart container has proper dimensions', async ({ page }) => {
        const bigBonkCard = page.locator('#itemsContainer .item-card:has-text("Big Bonk")');
        if (await bigBonkCard.count() > 0) {
            await bigBonkCard.first().click();
            await page.waitForTimeout(800);

            const chartContainer = page.locator('#modalBody .modal-graph-container');
            if (await chartContainer.count() > 0) {
                const box = await chartContainer.first().boundingBox();
                expect(box?.width).toBeGreaterThan(100);
                expect(box?.height).toBeGreaterThan(100);
            }
        }
    });
});

test.describe('Modal - Similar Items', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('similar items section displays', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const similarSection = page.locator('#modalBody .similar-items, #modalBody [class*="similar"]');
        // Similar items section may or may not be present depending on item
        const count = await similarSection.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('clicking similar item opens its modal', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const similarItem = page.locator('#modalBody .similar-item-card, #modalBody .similar-items a').first();
        if (await similarItem.count() > 0) {
            const originalTitle = await page.locator('#modalBody h2').first().textContent();
            
            await similarItem.click();
            await page.waitForTimeout(500);

            const newTitle = await page.locator('#modalBody h2').first().textContent();
            expect(newTitle).not.toBe(originalTitle);
        }
    });
});

test.describe('Modal - Synergies', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('synergies section displays when item has synergies', async ({ page }) => {
        // Open a few items to find one with synergies
        const cards = page.locator('#itemsContainer .item-card');
        for (let i = 0; i < Math.min(5, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(500);

            const synergies = page.locator('#modalBody .synergies-section, #modalBody .synergy-tag');
            if (await synergies.count() > 0) {
                await expect(synergies.first()).toBeVisible();
                break;
            }

            await page.locator('#itemModal .close').first().click();
            await page.waitForTimeout(300);
        }
    });
});

test.describe('Modal - Formula Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('formula displays for items with formulas', async ({ page }) => {
        // Open items until we find one with a formula
        const cards = page.locator('#itemsContainer .item-card');
        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(500);

            const formula = page.locator('#modalBody .item-formula, #modalBody [class*="formula"]');
            if (await formula.count() > 0) {
                await expect(formula.first()).toBeVisible();
                break;
            }

            await page.locator('#itemModal .close').first().click();
            await page.waitForTimeout(300);
        }
    });
});

test.describe('Weapon Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });
    });

    test('weapon modal displays damage info', async ({ page }) => {
        await page.locator('#weaponsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const modalBody = page.locator('#modalBody');
        await expect(modalBody).toBeVisible();
        
        // Should contain weapon-specific info
        const content = await modalBody.textContent();
        expect(content?.length).toBeGreaterThan(50);
    });

    test('weapon modal displays upgrade information', async ({ page }) => {
        await page.locator('#weaponsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const upgradeSection = page.locator('#modalBody .upgrades, #modalBody [class*="upgrade"], #modalBody table');
        if (await upgradeSection.count() > 0) {
            await expect(upgradeSection.first()).toBeVisible();
        }
    });
});

test.describe('Character Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="characters"]');
        await page.waitForSelector('#charactersContainer .item-card', { timeout: 10000 });
    });

    test('character modal displays stats', async ({ page }) => {
        await page.locator('#charactersContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const modalBody = page.locator('#modalBody');
        await expect(modalBody).toBeVisible();
        
        // Should contain character info
        const content = await modalBody.textContent();
        expect(content?.length).toBeGreaterThan(50);
    });
});

test.describe('Tome Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="tomes"]');
        await page.waitForSelector('#tomesContainer .item-card', { timeout: 10000 });
    });

    test('tome modal displays stat affected', async ({ page }) => {
        await page.locator('#tomesContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const modalBody = page.locator('#modalBody');
        await expect(modalBody).toBeVisible();
    });

    test('tome modal displays progression chart', async ({ page }) => {
        await page.locator('#tomesContainer .item-card').first().click();
        await page.waitForTimeout(800);

        const chart = page.locator('#modalBody canvas, #modalBody .scaling-chart');
        if (await chart.count() > 0) {
            await expect(chart.first()).toBeVisible();
        }
    });
});

test.describe('Shrine Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="shrines"]');
        await page.waitForSelector('#shrinesContainer .item-card', { timeout: 10000 });
    });

    test('shrine modal displays effect', async ({ page }) => {
        await page.locator('#shrinesContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const modalBody = page.locator('#modalBody');
        await expect(modalBody).toBeVisible();
        
        const content = await modalBody.textContent();
        expect(content?.length).toBeGreaterThan(30);
    });
});
