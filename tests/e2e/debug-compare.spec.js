import { test, expect } from '@playwright/test';

test('debug compare functionality', async ({ page }) => {
    // Add console log listener
    page.on('console', msg => console.log('PAGE:', msg.text()));

    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });

    // Check if compare checkbox labels exist
    const labels = await page.locator('#itemsContainer .compare-checkbox-label').count();
    console.log('Compare labels found:', labels);

    // Check if compare checkboxes exist
    const checkboxes = await page.locator('#itemsContainer .compare-checkbox').count();
    console.log('Compare checkboxes found:', checkboxes);

    // Get initial compare count
    const initialCount = await page.locator('.compare-count').textContent();
    console.log('Initial compare count:', initialCount);

    // Get first checkbox data-id
    const firstCheckbox = page.locator('#itemsContainer .compare-checkbox').first();
    const dataId = await firstCheckbox.getAttribute('data-id');
    console.log('First checkbox data-id:', dataId);

    // Add a listener to see if click events are captured
    await page.evaluate(() => {
        document.addEventListener(
            'click',
            e => {
                const target = e.target;
                console.log('Click detected on:', target.tagName, target.className);
                console.log('Closest label:', target.closest?.('.compare-checkbox-label'));
            },
            true
        );
    });

    // Try clicking via Playwright
    console.log('Clicking via Playwright...');
    await page.click('#itemsContainer .compare-checkbox-label >> nth=0');
    await page.waitForTimeout(500);

    // Check compare count after JS click
    const afterJsCount = await page.locator('.compare-count').textContent();
    console.log('Compare count after JS click:', afterJsCount);

    // Now try toggling directly
    console.log('Trying direct toggle...');
    await page.evaluate(() => {
        const checkbox = document.querySelector('#itemsContainer .compare-checkbox');
        if (checkbox) {
            const id = checkbox.dataset.id;
            console.log('Direct toggle for id:', id);
            // Check if toggleCompareItem exists
            console.log('typeof window.toggleCompareItem:', typeof window.toggleCompareItem);
        }
    });

    expect(afterJsCount).toBe('1');
});
