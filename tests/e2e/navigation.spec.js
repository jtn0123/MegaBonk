import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for data to load
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should load page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/MegaBonk/);
  });

  test('should display items tab by default', async ({ page }) => {
    await expect(page.locator('.tab-btn[data-tab="items"]')).toHaveClass(/active/);
    await expect(page.locator('#items-tab')).toHaveClass(/active/);
  });

  test('should display version info', async ({ page }) => {
    const version = page.locator('#version');
    await expect(version).toContainText('Version:');
  });

  test('should switch to weapons tab', async ({ page }) => {
    await page.click('.tab-btn[data-tab="weapons"]');

    await expect(page.locator('.tab-btn[data-tab="weapons"]')).toHaveClass(/active/);
    await expect(page.locator('#weapons-tab')).toHaveClass(/active/);

    // Should display weapons
    await expect(page.locator('#weaponsContainer .item-card')).toHaveCount(29);
  });

  test('should switch to tomes tab', async ({ page }) => {
    await page.click('.tab-btn[data-tab="tomes"]');

    await expect(page.locator('.tab-btn[data-tab="tomes"]')).toHaveClass(/active/);
    await expect(page.locator('#tomes-tab')).toHaveClass(/active/);
  });

  test('should switch to characters tab', async ({ page }) => {
    await page.click('.tab-btn[data-tab="characters"]');

    await expect(page.locator('.tab-btn[data-tab="characters"]')).toHaveClass(/active/);
    await expect(page.locator('#characters-tab')).toHaveClass(/active/);
  });

  test('should switch to shrines tab', async ({ page }) => {
    await page.click('.tab-btn[data-tab="shrines"]');

    await expect(page.locator('.tab-btn[data-tab="shrines"]')).toHaveClass(/active/);
    await expect(page.locator('#shrines-tab')).toHaveClass(/active/);
  });

  test('should switch to build planner tab', async ({ page }) => {
    await page.click('.tab-btn[data-tab="build-planner"]');

    await expect(page.locator('.tab-btn[data-tab="build-planner"]')).toHaveClass(/active/);
    await expect(page.locator('#build-planner-tab')).toHaveClass(/active/);
  });

  test('should switch to calculator tab', async ({ page }) => {
    await page.click('.tab-btn[data-tab="calculator"]');

    await expect(page.locator('.tab-btn[data-tab="calculator"]')).toHaveClass(/active/);
    await expect(page.locator('#calculator-tab')).toHaveClass(/active/);
  });

  test('should navigate through all tabs', async ({ page }) => {
    const tabs = ['items', 'weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator'];

    for (const tab of tabs) {
      await page.click(`.tab-btn[data-tab="${tab}"]`);
      await expect(page.locator(`.tab-btn[data-tab="${tab}"]`)).toHaveClass(/active/);
      await expect(page.locator(`#${tab}-tab`)).toHaveClass(/active/);
    }
  });
});
