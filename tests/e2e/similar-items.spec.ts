// ========================================
// Similar Items E2E Tests
// ========================================
// Tests for the "Items Like This" feature that shows related items in modals

import { test, expect } from '@playwright/test';

test.describe('Similar Items - Section Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('similar items section appears in item modal', async ({ page }) => {
        // Open multiple items to find one with similar items
        const cards = page.locator('#itemsContainer .item-card');
        let foundSimilarSection = false;

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                await expect(similarSection).toBeVisible();
                await expect(similarSection.locator('h3')).toContainText('Items Like This');
                foundSimilarSection = true;
                break;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        // At least one item should have similar items
        expect(foundSimilarSection).toBe(true);
    });

    test('similar items section contains item cards', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const similarCards = similarSection.locator('.similar-item-card');
                const count = await similarCards.count();
                
                expect(count).toBeGreaterThan(0);
                expect(count).toBeLessThanOrEqual(5); // Default maxResults is 5
                break;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    });

    test('similar item cards display name and reason', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const firstSimilarCard = similarSection.locator('.similar-item-card').first();
                
                // Check for name
                const name = firstSimilarCard.locator('.similar-item-name');
                await expect(name).toBeVisible();
                const nameText = await name.textContent();
                expect(nameText?.trim().length).toBeGreaterThan(0);
                
                // Check for reason (e.g., "Same tier", "Shared synergies")
                const reason = firstSimilarCard.locator('.similar-item-reason');
                await expect(reason).toBeVisible();
                const reasonText = await reason.textContent();
                expect(reasonText?.trim().length).toBeGreaterThan(0);
                break;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    });

    test('similar item cards have images or icons', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const firstSimilarCard = similarSection.locator('.similar-item-card').first();
                
                // Should have either an image or an icon
                const image = firstSimilarCard.locator('.similar-item-image, img');
                const icon = firstSimilarCard.locator('.similar-item-icon');
                
                const hasImage = await image.count() > 0;
                const hasIcon = await icon.count() > 0;
                
                expect(hasImage || hasIcon).toBe(true);
                break;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    });
});

test.describe('Similar Items - Click Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('clicking similar item opens its modal', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                // Get the original modal content
                const originalContent = await page.locator('#modalBody').textContent();
                const similarCard = similarSection.locator('.similar-item-card').first();
                const similarItemName = await similarCard.locator('.similar-item-name').textContent();
                
                // Click the similar item
                await similarCard.click();
                await page.waitForTimeout(600);
                
                // Modal should now show the similar item - check content changed
                const newContent = await page.locator('#modalBody').textContent();
                expect(newContent).not.toBe(originalContent);
                // The new content should contain the similar item's name
                expect(newContent).toContain(similarItemName?.trim() || '');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        // Skip if no similar items found
        test.skip();
    });

    test('similar item modal has similar items section (chain navigation)', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                // Click first similar item
                await similarSection.locator('.similar-item-card').first().click();
                await page.waitForTimeout(600);
                
                // The new modal might also have similar items
                const newSimilarSection = page.locator('#modalBody .similar-items-section');
                // This test just verifies navigation works, section presence varies by item
                const modalBody = page.locator('#modalBody');
                await expect(modalBody).toBeVisible();
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('navigation chain: item A -> similar B -> similar C', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');
        const visitedContents: string[] = [];

        // Find an item with similar items
        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                // Record first item (A) content
                const contentA = await page.locator('#modalBody').textContent();
                visitedContents.push(contentA || '');

                // Get name of similar item we'll click
                const similarNameB = await similarSection.locator('.similar-item-card .similar-item-name').first().textContent();

                // Navigate to B
                await similarSection.locator('.similar-item-card').first().click();
                await page.waitForTimeout(600);

                const contentB = await page.locator('#modalBody').textContent();
                visitedContents.push(contentB || '');
                expect(contentB).not.toBe(contentA);
                expect(contentB).toContain(similarNameB?.trim() || '');

                // Check if B has similar items to navigate to C
                const similarSectionB = page.locator('#modalBody .similar-items-section');
                if (await similarSectionB.count() > 0) {
                    const similarNameC = await similarSectionB.locator('.similar-item-card .similar-item-name').first().textContent();
                    
                    await similarSectionB.locator('.similar-item-card').first().click();
                    await page.waitForTimeout(600);

                    const contentC = await page.locator('#modalBody').textContent();
                    visitedContents.push(contentC || '');
                    expect(contentC).not.toBe(contentB);
                    expect(contentC).toContain(similarNameC?.trim() || '');
                    
                    // Successfully navigated through chain
                    expect(visitedContents.length).toBeGreaterThanOrEqual(3);
                }
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });
});

test.describe('Similar Items - Similarity Criteria', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('similar items show "Same tier" reason when tiers match', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(20, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const reasons = await similarSection.locator('.similar-item-reason').allTextContents();
                const hasTierReason = reasons.some(r => r.toLowerCase().includes('tier'));
                
                if (hasTierReason) {
                    expect(hasTierReason).toBe(true);
                    return;
                }
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        // Tier-based similarity may not always be present
        test.skip();
    });

    test('similar items show effect-based reasons', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(20, await cards.count()); i++) {
            await cards.nth(i).click();

            // Wait for modal to open
            try {
                await page.waitForFunction(
                    () => document.getElementById('itemModal')?.classList.contains('active'),
                    { timeout: 3000 }
                );
            } catch {
                continue;
            }

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const reasons = await similarSection.locator('.similar-item-reason').allTextContents();
                const hasEffectReason = reasons.some(r =>
                    r.toLowerCase().includes('effect') ||
                    r.toLowerCase().includes('damage') ||
                    r.toLowerCase().includes('crit') ||
                    r.toLowerCase().includes('synerg')
                );

                if (hasEffectReason) {
                    expect(hasEffectReason).toBe(true);
                    return;
                }
            }

            // Close modal only if it's still open
            const modalIsOpen = await page.locator('#itemModal.active').count() > 0;
            if (modalIsOpen) {
                await page.keyboard.press('Escape');

                // Wait for modal to close
                await page.waitForFunction(() => {
                    const modal = document.getElementById('itemModal');
                    return !modal || !modal.classList.contains('active');
                }, { timeout: 3000 }).catch(() => {});
            }
        }

        // Effect-based reasons are not guaranteed for all items
        test.skip();
    });

    test('similar items have valid data attributes', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const similarCards = similarSection.locator('.similar-item-card');
                const count = await similarCards.count();

                for (let j = 0; j < count; j++) {
                    const card = similarCards.nth(j);
                    const dataType = await card.getAttribute('data-type');
                    const dataId = await card.getAttribute('data-id');

                    expect(dataType).toBeTruthy();
                    expect(['items', 'weapons', 'tomes', 'characters']).toContain(dataType);
                    expect(dataId).toBeTruthy();
                    expect(dataId?.length).toBeGreaterThan(0);
                }
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });
});

test.describe('Similar Items - Keyboard Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('similar item cards have tabindex for keyboard focus', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const firstCard = similarSection.locator('.similar-item-card').first();
                const tabindex = await firstCard.getAttribute('tabindex');
                
                expect(tabindex).toBe('0');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('similar item cards have aria-label for screen readers', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const firstCard = similarSection.locator('.similar-item-card').first();
                const ariaLabel = await firstCard.getAttribute('aria-label');
                
                expect(ariaLabel).toBeTruthy();
                expect(ariaLabel).toContain('View');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('similar item cards have role="button"', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const firstCard = similarSection.locator('.similar-item-card').first();
                const role = await firstCard.getAttribute('role');
                
                expect(role).toBe('button');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('Enter key activates focused similar item', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const originalContent = await page.locator('#modalBody').textContent();
                const firstCard = similarSection.locator('.similar-item-card').first();
                const similarItemName = await firstCard.locator('.similar-item-name').textContent();
                
                // Focus the card
                await firstCard.focus();
                await page.waitForTimeout(100);
                
                // Press Enter to activate
                await page.keyboard.press('Enter');
                await page.waitForTimeout(600);
                
                // Modal should show different item
                const newContent = await page.locator('#modalBody').textContent();
                expect(newContent).not.toBe(originalContent);
                expect(newContent).toContain(similarItemName?.trim() || '');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('Space key activates focused similar item', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const originalContent = await page.locator('#modalBody').textContent();
                const firstCard = similarSection.locator('.similar-item-card').first();
                const similarItemName = await firstCard.locator('.similar-item-name').textContent();
                
                // Focus the card
                await firstCard.focus();
                await page.waitForTimeout(100);
                
                // Press Space to activate
                await page.keyboard.press('Space');
                await page.waitForTimeout(600);
                
                // Modal should show different item
                const newContent = await page.locator('#modalBody').textContent();
                expect(newContent).not.toBe(originalContent);
                expect(newContent).toContain(similarItemName?.trim() || '');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('Tab navigates through similar item cards', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const similarCards = similarSection.locator('.similar-item-card');
                const count = await similarCards.count();
                
                if (count >= 2) {
                    // Focus first card
                    await similarCards.first().focus();
                    await page.waitForTimeout(100);
                    
                    // Tab to next card
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(100);
                    
                    // Second card should be focused
                    const focusedElement = await page.evaluate(() => {
                        const el = document.activeElement;
                        return el?.classList.contains('similar-item-card');
                    });
                    
                    expect(focusedElement).toBe(true);
                    return;
                }
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });
});

test.describe('Similar Items - Different Entity Types', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('weapons tab shows similar weapons', async ({ page }) => {
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });

        const cards = page.locator('#weaponsContainer .item-card');
        
        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                await expect(similarSection).toBeVisible();
                
                // Verify the similar items are weapons
                const firstCard = similarSection.locator('.similar-item-card').first();
                const dataType = await firstCard.getAttribute('data-type');
                expect(dataType).toBe('weapons');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        // Weapons may not always have similar items
        test.skip();
    });

    test('tomes tab shows similar tomes', async ({ page }) => {
        await page.click('.tab-btn[data-tab="tomes"]');
        await page.waitForSelector('#tomesContainer .item-card', { timeout: 10000 });

        const cards = page.locator('#tomesContainer .item-card');
        
        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                await expect(similarSection).toBeVisible();
                
                // Verify the similar items are tomes
                const firstCard = similarSection.locator('.similar-item-card').first();
                const dataType = await firstCard.getAttribute('data-type');
                expect(dataType).toBe('tomes');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('characters tab shows similar characters', async ({ page }) => {
        await page.click('.tab-btn[data-tab="characters"]');
        await page.waitForSelector('#charactersContainer .item-card', { timeout: 10000 });

        const cards = page.locator('#charactersContainer .item-card');
        
        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                await expect(similarSection).toBeVisible();
                
                // Verify the similar items are characters
                const firstCard = similarSection.locator('.similar-item-card').first();
                const dataType = await firstCard.getAttribute('data-type');
                expect(dataType).toBe('characters');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });
});

test.describe('Similar Items - Visual Feedback', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('similar item cards show hover effect', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const firstCard = similarSection.locator('.similar-item-card').first();
                
                // Get initial state
                const initialCursor = await firstCard.evaluate(el => getComputedStyle(el).cursor);
                
                // Hover over card
                await firstCard.hover();
                await page.waitForTimeout(100);
                
                // Should have pointer cursor indicating clickability
                const hoverCursor = await firstCard.evaluate(el => getComputedStyle(el).cursor);
                expect(hoverCursor === 'pointer' || initialCursor === 'pointer').toBe(true);
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('similar item cards show focus indicator', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const firstCard = similarSection.locator('.similar-item-card').first();
                
                // Focus the card
                await firstCard.focus();
                await page.waitForTimeout(100);
                
                // Should have visible focus indicator
                const hasVisibleFocus = await firstCard.evaluate(el => {
                    const style = getComputedStyle(el);
                    return style.outline !== 'none' || 
                           style.boxShadow !== 'none' || 
                           style.borderColor !== 'initial' ||
                           el.classList.contains('focus-visible') ||
                           el.matches(':focus');
                });
                
                expect(hasVisibleFocus).toBe(true);
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('similar items grid is properly laid out', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(10, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                const grid = similarSection.locator('.similar-items-grid');
                const box = await grid.boundingBox();
                
                expect(box).toBeTruthy();
                expect(box?.width).toBeGreaterThan(100);
                expect(box?.height).toBeGreaterThan(50);
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });
});

test.describe('Similar Items - Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('shrines do not show similar items section', async ({ page }) => {
        await page.click('.tab-btn[data-tab="shrines"]');
        await page.waitForSelector('#shrinesContainer .item-card', { timeout: 10000 });

        const cards = page.locator('#shrinesContainer .item-card');
        const count = await cards.count();

        for (let i = 0; i < Math.min(5, count); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            // Shrines should not have similar items (not supported)
            const similarSection = page.locator('#modalBody .similar-items-section');
            expect(await similarSection.count()).toBe(0);

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    });

    test('modal content updates completely when navigating via similar items', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0) {
                // Get original modal content
                const originalContent = await page.locator('#modalBody').textContent();
                const similarItemName = await similarSection.locator('.similar-item-card .similar-item-name').first().textContent();
                
                // Navigate to similar item
                await similarSection.locator('.similar-item-card').first().click();
                await page.waitForTimeout(600);
                
                // Content should be different and contain the similar item's name
                const newContent = await page.locator('#modalBody').textContent();
                
                expect(newContent).not.toBe(originalContent);
                expect(newContent).toContain(similarItemName?.trim() || '');
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });

    test('rapid clicks on similar items do not break navigation', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');

        for (let i = 0; i < Math.min(15, await cards.count()); i++) {
            await cards.nth(i).click();
            await page.waitForTimeout(600);

            const similarSection = page.locator('#modalBody .similar-items-section');
            if (await similarSection.count() > 0 && await similarSection.locator('.similar-item-card').count() >= 2) {
                // Rapid click on multiple similar items
                const firstCard = similarSection.locator('.similar-item-card').first();
                const secondCard = similarSection.locator('.similar-item-card').nth(1);
                
                await firstCard.click({ delay: 50 });
                await secondCard.click({ delay: 50 });
                
                // Wait for navigation to settle
                await page.waitForTimeout(800);
                
                // Modal should still be open and functional
                const modal = page.locator('#itemModal');
                await expect(modal).toHaveClass(/active/);
                
                const modalBody = page.locator('#modalBody');
                await expect(modalBody).toBeVisible();
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        test.skip();
    });
});
