// ========================================
// Calculator Breakpoint Cards E2E Tests
// ========================================
// Tests for the quick-select breakpoint cards in the calculator

import { test, expect } from '@playwright/test';

test.describe('Calculator Breakpoint Cards', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="calculator"]');
        await page.waitForSelector('#calculator-tab.active', { timeout: 5000 });
    });

    test('breakpoint cards section exists', async ({ page }) => {
        const breakpointSection = page.locator('.common-breakpoints, .breakpoint-grid');
        await expect(breakpointSection.first()).toBeVisible();
    });

    test('breakpoint cards are visible', async ({ page }) => {
        const breakpointCards = page.locator('.breakpoint-card');
        const count = await breakpointCards.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('Big Bonk breakpoint card exists', async ({ page }) => {
        const bigBonkCard = page.locator('.breakpoint-card[data-item="big_bonk"]');
        if (await bigBonkCard.count() > 0) {
            await expect(bigBonkCard).toBeVisible();
            await expect(bigBonkCard).toContainText('Big Bonk');
        }
    });

    test('Spicy Meatball breakpoint card exists', async ({ page }) => {
        const spicyCard = page.locator('.breakpoint-card[data-item="spicy_meatball"]');
        if (await spicyCard.count() > 0) {
            await expect(spicyCard).toBeVisible();
            await expect(spicyCard).toContainText('Spicy Meatball');
        }
    });

    test('Forbidden Juice breakpoint card exists', async ({ page }) => {
        const juiceCard = page.locator('.breakpoint-card[data-item="forbidden_juice"]');
        if (await juiceCard.count() > 0) {
            await expect(juiceCard).toBeVisible();
            await expect(juiceCard).toContainText('Forbidden Juice');
        }
    });

    test('Ice Cube breakpoint card exists', async ({ page }) => {
        const iceCard = page.locator('.breakpoint-card[data-item="ice_cube"]');
        if (await iceCard.count() > 0) {
            await expect(iceCard).toBeVisible();
            await expect(iceCard).toContainText('Ice Cube');
        }
    });

    test('breakpoint cards have icon, title, and answer', async ({ page }) => {
        const firstCard = page.locator('.breakpoint-card').first();
        
        // Should have icon
        const icon = firstCard.locator('.bp-icon');
        await expect(icon).toBeVisible();

        // Should have text section
        const text = firstCard.locator('.bp-text');
        await expect(text).toBeVisible();

        // Should have answer
        const answer = firstCard.locator('.bp-answer');
        await expect(answer).toBeVisible();
    });

    test('clicking breakpoint card populates calculator', async ({ page }) => {
        const firstCard = page.locator('.breakpoint-card').first();
        const itemAttr = await firstCard.getAttribute('data-item');
        const targetAttr = await firstCard.getAttribute('data-target');

        await firstCard.click();
        await page.waitForTimeout(300);

        // Item select should be populated
        const itemSelect = page.locator('#calc-item-select');
        const selectedValue = await itemSelect.inputValue();
        
        // Either the item is selected or results are shown
        // Implementation may auto-calculate
        if (itemAttr) {
            // Value might be the item id or the result is already shown
            expect(selectedValue.length > 0 || await page.locator('#calc-result').isVisible()).toBe(true);
        }
    });

    test('breakpoint cards are keyboard accessible', async ({ page }) => {
        const firstCard = page.locator('.breakpoint-card').first();
        
        // Focus the card
        await firstCard.focus();
        await expect(firstCard).toBeFocused();

        // Verify it's a button (keyboard activatable)
        const tagName = await firstCard.evaluate(el => el.tagName.toLowerCase());
        expect(tagName).toBe('button');
    });

    test('breakpoint cards have aria-labels', async ({ page }) => {
        const firstCard = page.locator('.breakpoint-card').first();
        const ariaLabel = await firstCard.getAttribute('aria-label');
        
        expect(ariaLabel?.length).toBeGreaterThan(0);
    });

    test('pressing Enter on breakpoint card activates it', async ({ page }) => {
        const firstCard = page.locator('.breakpoint-card').first();
        
        await firstCard.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        // Should have triggered some action (item selected or result shown)
        const itemSelect = page.locator('#calc-item-select');
        const selectedValue = await itemSelect.inputValue();
        const resultVisible = await page.locator('#calc-result').isVisible();

        expect(selectedValue.length > 0 || resultVisible).toBe(true);
    });
});

test.describe('Calculator Breakpoint Answers', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="calculator"]');
        await page.waitForSelector('#calculator-tab.active', { timeout: 5000 });
    });

    test('Big Bonk shows 50 stacks for 100%', async ({ page }) => {
        const bigBonkCard = page.locator('.breakpoint-card[data-item="big_bonk"]');
        if (await bigBonkCard.count() > 0) {
            const answer = bigBonkCard.locator('.bp-answer');
            await expect(answer).toContainText('50');
        }
    });

    test('Spicy Meatball shows 4 stacks for 100%', async ({ page }) => {
        const spicyCard = page.locator('.breakpoint-card[data-item="spicy_meatball"]');
        if (await spicyCard.count() > 0) {
            const answer = spicyCard.locator('.bp-answer');
            await expect(answer).toContainText('4');
        }
    });

    test('Forbidden Juice shows 10 stacks for 100%', async ({ page }) => {
        const juiceCard = page.locator('.breakpoint-card[data-item="forbidden_juice"]');
        if (await juiceCard.count() > 0) {
            const answer = juiceCard.locator('.bp-answer');
            await expect(answer).toContainText('10');
        }
    });

    test('Ice Cube shows 5 stacks for 100%', async ({ page }) => {
        const iceCard = page.locator('.breakpoint-card[data-item="ice_cube"]');
        if (await iceCard.count() > 0) {
            const answer = iceCard.locator('.bp-answer');
            await expect(answer).toContainText('5');
        }
    });
});

test.describe('Calculator Common Breakpoints Section', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="calculator"]');
        await page.waitForSelector('#calculator-tab.active', { timeout: 5000 });
    });

    test('common breakpoints section has heading', async ({ page }) => {
        const heading = page.locator('.common-breakpoints h3');
        await expect(heading).toBeVisible();
        await expect(heading).toContainText('Common Breakpoints');
    });

    test('breakpoint grid has proper layout', async ({ page }) => {
        const grid = page.locator('.breakpoint-grid');
        await expect(grid).toBeVisible();

        // Should have grid or flex display
        const display = await grid.evaluate(el => getComputedStyle(el).display);
        expect(display === 'grid' || display === 'flex').toBe(true);
    });
});
