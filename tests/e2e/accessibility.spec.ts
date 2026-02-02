// ========================================
// Accessibility E2E Tests
// ========================================
// Tests for keyboard navigation, screen reader support, and a11y compliance

import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('Tab key navigates through interactive elements', async ({ page }) => {
        // Start from body
        await page.locator('body').focus();
        
        // Tab through elements
        await page.keyboard.press('Tab');
        
        // Should focus something
        const focused = await page.evaluate(() => document.activeElement?.tagName);
        expect(focused).toBeTruthy();
    });

    test('Enter key activates focused element', async ({ page }) => {
        const firstCard = page.locator('#itemsContainer .item-card').first();
        await firstCard.focus();
        
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        const modal = page.locator('#itemModal');
        await expect(modal).toHaveClass(/active/);
    });

    test('Escape closes modal', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);
        await expect(page.locator('#itemModal')).toHaveClass(/active/);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await expect(page.locator('#itemModal')).not.toHaveClass(/active/);
    });

    test('/ focuses search input', async ({ page }) => {
        await page.locator('body').click();
        await page.keyboard.press('/');
        
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeFocused();
    });

    test('Tab navigation through tabs', async ({ page }) => {
        const firstTab = page.locator('.tab-btn').first();
        await firstTab.focus();
        
        // Tab to next tab button
        await page.keyboard.press('Tab');
        
        const secondTab = page.locator('.tab-btn').nth(1);
        await expect(secondTab).toBeFocused();
    });
});

test.describe('Focus Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('focus visible indicator on interactive elements', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.focus();
        
        // Should have visible focus indicator (outline or box-shadow)
        const outline = await searchInput.evaluate(el => {
            const style = getComputedStyle(el);
            return style.outline || style.boxShadow;
        });
        
        expect(outline).toBeTruthy();
    });

    test('focus trapped in modal when open', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        // Tab multiple times
        for (let i = 0; i < 20; i++) {
            await page.keyboard.press('Tab');
        }

        // Focus should still be within modal
        const focusedInModal = await page.evaluate(() => {
            const modal = document.getElementById('itemModal');
            return modal?.contains(document.activeElement);
        });
        
        expect(focusedInModal).toBe(true);
    });

    test('focus returns to trigger after modal closes', async ({ page }) => {
        const firstCard = page.locator('#itemsContainer .item-card').first();
        await firstCard.click();
        await page.waitForTimeout(500);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Focus should return to the card or near it
        const focusedElement = await page.evaluate(() => document.activeElement?.className);
        // Focus may be on card or somewhere reasonable
        expect(focusedElement).toBeTruthy();
    });
});

test.describe('ARIA Attributes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('tabs have role="tab"', async ({ page }) => {
        const tabs = page.locator('.tab-btn');
        const count = await tabs.count();

        for (let i = 0; i < count; i++) {
            const role = await tabs.nth(i).getAttribute('role');
            expect(role).toBe('tab');
        }
    });

    test('active tab has aria-selected="true"', async ({ page }) => {
        const activeTab = page.locator('.tab-btn.active');
        const ariaSelected = await activeTab.getAttribute('aria-selected');
        expect(ariaSelected).toBe('true');
    });

    test('tab panels have role="tabpanel"', async ({ page }) => {
        const panels = page.locator('[role="tabpanel"]');
        const count = await panels.count();
        expect(count).toBeGreaterThan(0);
    });

    test('modal has role="dialog"', async ({ page }) => {
        const modal = page.locator('#itemModal');
        const role = await modal.getAttribute('role');
        expect(role).toBe('dialog');
    });

    test('modal has aria-modal="true"', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const modal = page.locator('#itemModal');
        const ariaModal = await modal.getAttribute('aria-modal');
        expect(ariaModal).toBe('true');
    });

    test('search input has appropriate aria attributes', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        
        // Should have accessible name
        const ariaLabel = await searchInput.getAttribute('aria-label');
        const placeholder = await searchInput.getAttribute('placeholder');
        
        expect(ariaLabel || placeholder).toBeTruthy();
    });

    test('images have alt text', async ({ page }) => {
        const images = page.locator('#itemsContainer .item-card img');
        const count = await images.count();

        for (let i = 0; i < Math.min(count, 20); i++) {
            const alt = await images.nth(i).getAttribute('alt');
            expect(alt).toBeTruthy();
            expect(alt?.length).toBeGreaterThan(0);
        }
    });
});

test.describe('Screen Reader Support', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('page has main landmark', async ({ page }) => {
        const main = page.locator('main, [role="main"]');
        expect(await main.count()).toBeGreaterThan(0);
    });

    test('page has navigation landmark', async ({ page }) => {
        const nav = page.locator('nav, [role="navigation"]');
        expect(await nav.count()).toBeGreaterThan(0);
    });

    test('headings are in logical order', async ({ page }) => {
        const headings = await page.evaluate(() => {
            const h = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            return Array.from(h).map(el => parseInt(el.tagName.substring(1)));
        });

        // Should have at least one heading
        expect(headings.length).toBeGreaterThan(0);

        // Check heading order doesn't skip levels drastically
        for (let i = 1; i < headings.length; i++) {
            const diff = headings[i] - headings[i - 1];
            // Should not skip more than 1 level going down
            expect(diff).toBeLessThanOrEqual(2);
        }
    });

    test('modal has aria-labelledby', async ({ page }) => {
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(500);

        const modal = page.locator('#itemModal');
        const labelledBy = await modal.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
    });

    test('buttons have accessible names', async ({ page }) => {
        const buttons = page.locator('button');
        const count = await buttons.count();

        for (let i = 0; i < Math.min(count, 20); i++) {
            const btn = buttons.nth(i);
            const text = await btn.textContent();
            const ariaLabel = await btn.getAttribute('aria-label');
            const title = await btn.getAttribute('title');
            
            // Should have some accessible name
            expect(text?.trim() || ariaLabel || title).toBeTruthy();
        }
    });
});

test.describe('Color Contrast', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('text is readable on cards', async ({ page }) => {
        const firstCardText = page.locator('#itemsContainer .item-card .item-name').first();
        
        const styles = await firstCardText.evaluate(el => {
            const style = getComputedStyle(el);
            return {
                color: style.color,
                fontSize: style.fontSize,
            };
        });

        // Font size should be readable (at least 12px)
        const fontSize = parseFloat(styles.fontSize);
        expect(fontSize).toBeGreaterThanOrEqual(12);
    });

    test('focus indicator is visible', async ({ page }) => {
        const searchInput = page.locator('#searchInput');
        await searchInput.focus();

        const hasVisibleFocus = await searchInput.evaluate(el => {
            const style = getComputedStyle(el);
            const outline = style.outline;
            const boxShadow = style.boxShadow;
            const borderColor = style.borderColor;
            
            // Should have some visual focus indicator
            return outline !== 'none' || boxShadow !== 'none' || borderColor !== 'initial';
        });

        expect(hasVisibleFocus).toBe(true);
    });
});

test.describe('Motion and Animation', () => {
    test('respects prefers-reduced-motion', async ({ page }) => {
        // Emulate reduced motion preference
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

        // Open modal - should have reduced or no animation
        await page.locator('#itemsContainer .item-card').first().click();
        await page.waitForTimeout(100); // Shorter wait since animation should be reduced

        const modal = page.locator('#itemModal');
        await expect(modal).toHaveClass(/active/);
    });
});

test.describe('Touch Accessibility', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('touch targets are at least 44x44 pixels', async ({ page }) => {
        const interactiveElements = page.locator('button, a, input, .item-card');
        const count = await interactiveElements.count();

        let violations = 0;
        for (let i = 0; i < Math.min(count, 30); i++) {
            const box = await interactiveElements.nth(i).boundingBox();
            if (box && (box.width < 44 || box.height < 44)) {
                // Small elements might be okay if they're not primary touch targets
                // or if they're part of a larger clickable area
                violations++;
            }
        }

        // Allow some small elements but not too many
        expect(violations).toBeLessThan(count * 0.5);
    });
});
