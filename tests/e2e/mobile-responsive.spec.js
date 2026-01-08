import { test, expect } from '@playwright/test';

test.describe('Mobile Responsive - iPhone', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12 Pro

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should display items in mobile layout', async ({ page }) => {
    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should have visible navigation tabs', async ({ page }) => {
    const tabButtons = page.locator('.tab-btn');
    const count = await tabButtons.count();

    expect(count).toBeGreaterThan(0);

    // All tabs should be visible
    for (let i = 0; i < count; i++) {
      await expect(tabButtons.nth(i)).toBeVisible();
    }
  });

  test('should allow tab switching on mobile', async ({ page }) => {
    await page.click('.tab-btn[data-tab="weapons"]');

    await expect(page.locator('.tab-btn[data-tab="weapons"]')).toHaveClass(/active/);
    await expect(page.locator('#weapons-tab')).toHaveClass(/active/);
  });

  test('should display search input on mobile', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();
  });

  test('should allow search on mobile', async ({ page }) => {
    await page.fill('#searchInput', 'bonk');
    await page.waitForTimeout(100);

    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();

    expect(count).toBeLessThan(77);
  });

  test('should display filter dropdowns on mobile', async ({ page }) => {
    const tierFilter = page.locator('#tierFilter');
    const rarityFilter = page.locator('#rarityFilter');

    await expect(tierFilter).toBeVisible();
    await expect(rarityFilter).toBeVisible();
  });

  test('should open modal on mobile', async ({ page }) => {
    await page.click('#itemsContainer .view-details-btn >> nth=0');

    const modal = page.locator('#itemModal');
    await expect(modal).toBeVisible();
  });

  test('should close modal with close button on mobile', async ({ page }) => {
    await page.click('#itemsContainer .view-details-btn >> nth=0');
    await expect(page.locator('#itemModal')).toBeVisible();

    await page.click('#itemModal .close');
    await expect(page.locator('#itemModal')).not.toBeVisible();
  });

  test('should display stats summary on mobile', async ({ page }) => {
    const statsPanel = page.locator('#stats-summary');
    await expect(statsPanel).toBeVisible();
  });
});

test.describe('Mobile Responsive - Small Phone', () => {
  test.use({ viewport: { width: 320, height: 568 } }); // iPhone SE

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should display content on very small screens', async ({ page }) => {
    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should allow navigation on small screens', async ({ page }) => {
    const tabs = ['items', 'weapons', 'tomes', 'characters', 'shrines'];

    for (const tab of tabs) {
      await page.click(`.tab-btn[data-tab="${tab}"]`);
      await expect(page.locator(`.tab-btn[data-tab="${tab}"]`)).toHaveClass(/active/);
    }
  });

  test('should handle build planner on small screen', async ({ page }) => {
    await page.click('.tab-btn[data-tab="build-planner"]');

    await expect(page.locator('#build-planner-tab')).toHaveClass(/active/);

    // Build planner elements should be visible
    const characterSelect = page.locator('#build-character');
    await expect(characterSelect).toBeVisible();
  });
});

test.describe('Mobile Responsive - Tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should display items in tablet layout', async ({ page }) => {
    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();

    expect(count).toBe(77);
  });

  test('should allow comparison on tablet', async ({ page }) => {
    // Select 2 items
    await page.click('#itemsContainer .compare-checkbox >> nth=0');
    await page.click('#itemsContainer .compare-checkbox >> nth=1');

    // Compare button should be visible
    await expect(page.locator('#compare-btn')).toBeVisible();

    // Click compare
    await page.click('#compare-btn');

    // Compare modal should be visible
    await expect(page.locator('#compareModal')).toBeVisible();
  });

  test('should display build planner properly on tablet', async ({ page }) => {
    await page.click('.tab-btn[data-tab="build-planner"]');

    // Select character and weapon
    await page.selectOption('#build-character', { index: 1 });
    await page.selectOption('#build-weapon', { index: 1 });

    await page.waitForTimeout(200);

    // Stats should be visible
    const statsDisplay = page.locator('#build-stats');
    await expect(statsDisplay).toContainText('Total Damage');
  });
});

test.describe('Mobile Responsive - Landscape', () => {
  test.use({ viewport: { width: 844, height: 390 } }); // iPhone 12 Pro landscape

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should display items in landscape mode', async ({ page }) => {
    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should allow filtering in landscape mode', async ({ page }) => {
    await page.selectOption('#tierFilter', 'SS');
    await page.waitForTimeout(100);

    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();

    expect(count).toBeLessThan(77);
    expect(count).toBeGreaterThan(0);
  });

  test('should display modal properly in landscape', async ({ page }) => {
    await page.click('#itemsContainer .view-details-btn >> nth=0');

    const modal = page.locator('#itemModal');
    await expect(modal).toBeVisible();

    const modalBody = page.locator('#modalBody');
    await expect(modalBody).not.toBeEmpty();
  });
});

test.describe('Touch Interactions', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should handle touch on item cards', async ({ page }) => {
    const firstCard = page.locator('#itemsContainer .item-card').first();

    // Touch should work for view details
    await firstCard.locator('.view-details-btn').tap();

    await expect(page.locator('#itemModal')).toBeVisible();
  });

  test('should handle touch on tabs', async ({ page }) => {
    const weaponsTab = page.locator('.tab-btn[data-tab="weapons"]');
    await weaponsTab.tap();

    await expect(weaponsTab).toHaveClass(/active/);
  });

  test('should handle touch scroll on item list', async ({ page }) => {
    // This mainly tests that the page doesn't crash with touch events
    const container = page.locator('#itemsContainer');
    await expect(container).toBeVisible();

    // Simulate scroll
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);

    // Page should still be functional
    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();
    expect(count).toBeGreaterThan(0);
  });
});
