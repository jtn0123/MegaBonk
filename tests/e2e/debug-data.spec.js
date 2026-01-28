import { test, expect } from '@playwright/test';

test('Debug data loading', async ({ page }) => {
    // Add console message listener
    page.on('console', msg => console.log('Browser:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('Page Error:', err.message));

    await page.goto('/');

    // Wait for DOMContentLoaded
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for async operations
    await page.waitForTimeout(3000);

    // Check if data files are accessible via fetch
    const dataResponse = await page.evaluate(async () => {
        try {
            const res = await fetch('./data/items.json');
            const data = await res.json();
            return { ok: true, itemCount: data.items?.length, version: data.version };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    console.log('Data fetch result:', dataResponse);

    // Check store state via window.allData
    const storeState = await page.evaluate(() => {
        if (window.allData) {
            return {
                hasAllData: true,
                itemsCount: window.allData.items?.items?.length || 0,
                version: window.allData.items?.version,
            };
        }
        return { hasAllData: false };
    });

    console.log('Store state:', storeState);

    // Check what's in the DOM
    const domState = await page.evaluate(() => {
        const itemCount = document.querySelector('#itemCount');
        const itemsContainer = document.querySelector('#itemsContainer');
        const itemCards = document.querySelectorAll('#itemsContainer .item-card');
        return {
            itemCountText: itemCount?.textContent || 'not found',
            containerExists: !!itemsContainer,
            cardCount: itemCards.length,
            containerHTML: itemsContainer?.innerHTML?.substring(0, 500) || 'no container',
        };
    });

    console.log('DOM state:', domState);

    expect(dataResponse.ok).toBe(true);
    expect(dataResponse.itemCount).toBeGreaterThan(0);
});
