import { test, expect } from '@playwright/test';

test('debug theme colors', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });

    const html = page.locator('html');
    const firstCard = page.locator('#itemsContainer .item-card').first();

    // Get card styles in dark mode
    await html.evaluate(el => el.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(200);
    const darkStyles = await firstCard.evaluate(el => {
        const style = getComputedStyle(el);
        return {
            bg: style.backgroundColor,
            color: style.color,
            border: style.borderColor
        };
    });
    const darkBodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Get card styles in light mode
    await html.evaluate(el => el.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(200);
    const lightStyles = await firstCard.evaluate(el => {
        const style = getComputedStyle(el);
        return {
            bg: style.backgroundColor,
            color: style.color,
            border: style.borderColor
        };
    });
    const lightBodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    console.log('=== DEBUG OUTPUT ===');
    console.log('Dark card bg:', darkStyles.bg);
    console.log('Light card bg:', lightStyles.bg);
    console.log('Dark card color:', darkStyles.color);
    console.log('Light card color:', lightStyles.color);
    console.log('Dark card border:', darkStyles.border);
    console.log('Light card border:', lightStyles.border);
    console.log('Dark body bg:', darkBodyBg);
    console.log('Light body bg:', lightBodyBg);
    
    const stylesMatch = darkStyles.bg === lightStyles.bg && 
                       darkStyles.color === lightStyles.color && 
                       darkStyles.border === lightStyles.border;
    console.log('Card styles match?', stylesMatch);
    console.log('Body bg different?', darkBodyBg !== lightBodyBg);

    expect(true).toBe(true);
});
