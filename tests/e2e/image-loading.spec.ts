/* global setTimeout, getComputedStyle */
import { test, expect } from '@playwright/test';

/**
 * Image Loading E2E Tests
 *
 * These tests verify that all entity images (items, weapons, tomes, characters)
 * load correctly in the UI. Images use <picture> elements with WebP sources
 * and PNG fallbacks.
 *
 * IMPORTANT: WebP images must be generated before these tests pass.
 * Run `bun run optimize:images` to generate WebP versions of all images.
 *
 * If tests fail with "hidden by error handler" errors, it usually means:
 * 1. WebP images haven't been generated
 * 2. Image paths in data/*.json don't match actual files
 * 3. Vite's SPA fallback is returning HTML for missing images
 */

/**
 * Helper function to scroll all images into view to trigger lazy loading,
 * wait for them to load, then check for broken ones.
 *
 * Images are considered broken if:
 * - naturalWidth === 0 AND naturalHeight === 0 (failed to load)
 * - display === 'none' (hidden by error handler)
 */
async function checkImagesLoaded(page, containerSelector) {
    // First, scroll through the container to trigger lazy loading
    await page.evaluate(async selector => {
        const container = document.querySelector(selector);
        if (!container) return;

        // Scroll to bottom and back to trigger all lazy images
        const images = container.querySelectorAll('img');
        for (const img of images) {
            img.scrollIntoView({ behavior: 'instant', block: 'center' });
            // Small delay to let image start loading
            await new Promise(r => setTimeout(r, 10));
        }
    }, containerSelector);

    // Wait for network to be idle (images loaded)
    await page.waitForLoadState('networkidle');

    // Additional small wait for error handlers to fire
    await page.waitForTimeout(500);

    // Now check all images
    const images = page.locator(`${containerSelector} img`);
    const count = await images.count();
    const brokenImages = [];

    for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const result = await img.evaluate(el => {
            return {
                src: el.src,
                alt: el.alt,
                naturalWidth: el.naturalWidth,
                naturalHeight: el.naturalHeight,
                complete: el.complete,
                isHidden: getComputedStyle(el).display === 'none',
            };
        });

        // Image is broken if: completed loading but has no dimensions, or is hidden by error handler
        const failedToLoad = result.complete && result.naturalWidth === 0 && result.naturalHeight === 0;
        if (failedToLoad || result.isHidden) {
            brokenImages.push({
                src: result.src,
                alt: result.alt,
                reason: result.isHidden ? 'hidden by error handler' : 'failed to load (0x0 dimensions)',
            });
        }
    }

    return brokenImages;
}

/**
 * Helper to wait for initial content to load
 */
async function waitForContentReady(page, containerSelector, timeout = 10000) {
    await page.waitForSelector(`${containerSelector} .item-card`, { timeout });
    await page.waitForLoadState('networkidle');
}

test.describe('Image Loading', () => {
    test('all item images should load successfully', async ({ page }) => {
        await page.goto('/');
        await waitForContentReady(page, '#itemsContainer');

        const brokenImages = await checkImagesLoaded(page, '#itemsContainer');

        if (brokenImages.length > 0) {
            console.log('Broken item images found:');
            brokenImages.forEach(img => {
                console.log(`  - ${img.src} (${img.reason})`);
            });
        }

        expect(brokenImages, `Found ${brokenImages.length} broken item images`).toHaveLength(0);
    });

    test('all weapon images should load successfully', async ({ page }) => {
        await page.goto('/');
        await waitForContentReady(page, '#itemsContainer');

        // Switch to weapons tab
        await page.click('[data-tab="weapons"]');
        await waitForContentReady(page, '#weaponsContainer');

        const brokenImages = await checkImagesLoaded(page, '#weaponsContainer');

        if (brokenImages.length > 0) {
            console.log('Broken weapon images found:');
            brokenImages.forEach(img => {
                console.log(`  - ${img.src} (${img.reason})`);
            });
        }

        expect(brokenImages, `Found ${brokenImages.length} broken weapon images`).toHaveLength(0);
    });

    test('all tome images should load successfully', async ({ page }) => {
        await page.goto('/');
        await waitForContentReady(page, '#itemsContainer');

        // Switch to tomes tab
        await page.click('[data-tab="tomes"]');
        await waitForContentReady(page, '#tomesContainer');

        const brokenImages = await checkImagesLoaded(page, '#tomesContainer');

        if (brokenImages.length > 0) {
            console.log('Broken tome images found:');
            brokenImages.forEach(img => {
                console.log(`  - ${img.src} (${img.reason})`);
            });
        }

        expect(brokenImages, `Found ${brokenImages.length} broken tome images`).toHaveLength(0);
    });

    test('all character images should load successfully', async ({ page }) => {
        await page.goto('/');
        await waitForContentReady(page, '#itemsContainer');

        // Switch to characters tab
        await page.click('[data-tab="characters"]');
        await waitForContentReady(page, '#charactersContainer');

        const brokenImages = await checkImagesLoaded(page, '#charactersContainer');

        if (brokenImages.length > 0) {
            console.log('Broken character images found:');
            brokenImages.forEach(img => {
                console.log(`  - ${img.src} (${img.reason})`);
            });
        }

        expect(brokenImages, `Found ${brokenImages.length} broken character images`).toHaveLength(0);
    });

    test('item modal images should load when opened', async ({ page }) => {
        await page.goto('/');
        await waitForContentReady(page, '#itemsContainer');

        // Open modal for first item (cards are now directly clickable)
        await page.click('#itemsContainer .item-card >> nth=0');
        await expect(page.locator('#itemModal')).toBeVisible();

        // Wait for modal to fully render and images to load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        const brokenImages = await checkImagesLoaded(page, '#modalBody');

        if (brokenImages.length > 0) {
            console.log('Broken modal images found:');
            brokenImages.forEach(img => {
                console.log(`  - ${img.src} (${img.reason})`);
            });
        }

        expect(brokenImages, `Found ${brokenImages.length} broken modal images`).toHaveLength(0);
    });
});

test.describe('Image Loading - Network Errors', () => {
    test('should detect when images fail to load due to 404', async ({ page }) => {
        // Track 404 responses for images
        const failedImageRequests = [];

        page.on('response', response => {
            const url = response.url();
            if ((url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.webp')) && response.status() === 404) {
                failedImageRequests.push(url);
            }
        });

        await page.goto('/');
        await waitForContentReady(page, '#itemsContainer');

        // Scroll through items to trigger lazy loading
        await checkImagesLoaded(page, '#itemsContainer');

        if (failedImageRequests.length > 0) {
            console.log('Images returned 404:');
            failedImageRequests.forEach(url => {
                console.log(`  - ${url}`);
            });
        }

        expect(failedImageRequests, `Found ${failedImageRequests.length} images returning 404`).toHaveLength(0);
    });
});

test.describe('Image Loading - All Tabs Comprehensive', () => {
    test('all entity images across all tabs should load', async ({ page }) => {
        const tabs = [
            { name: 'items', tabSelector: '[data-tab="items"]', container: '#itemsContainer' },
            { name: 'weapons', tabSelector: '[data-tab="weapons"]', container: '#weaponsContainer' },
            { name: 'tomes', tabSelector: '[data-tab="tomes"]', container: '#tomesContainer' },
            {
                name: 'characters',
                tabSelector: '[data-tab="characters"]',
                container: '#charactersContainer',
            },
        ];

        const allBrokenImages = [];

        await page.goto('/');
        await waitForContentReady(page, '#itemsContainer');

        for (const tab of tabs) {
            // Switch to tab (items is already active)
            if (tab.name !== 'items') {
                await page.click(tab.tabSelector);
                await waitForContentReady(page, tab.container);
            }

            const brokenImages = await checkImagesLoaded(page, tab.container);

            if (brokenImages.length > 0) {
                brokenImages.forEach(img => {
                    allBrokenImages.push({
                        tab: tab.name,
                        ...img,
                    });
                });
            }
        }

        if (allBrokenImages.length > 0) {
            console.log('\nBroken images summary:');
            allBrokenImages.forEach(img => {
                console.log(`  [${img.tab}] ${img.src} - ${img.reason}`);
            });
        }

        expect(allBrokenImages, `Found ${allBrokenImages.length} broken images across all tabs`).toHaveLength(0);
    });
});
