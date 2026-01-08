import { test, expect } from '@playwright/test';

test.describe('Build Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    await page.click('.tab-btn[data-tab="build-planner"]');
    await page.waitForSelector('#build-character option:not([value=""])', { timeout: 5000 });
  });

  test('should display character dropdown with options', async ({ page }) => {
    const options = page.locator('#build-character option');
    const count = await options.count();

    // Should have characters loaded (plus default option)
    expect(count).toBeGreaterThan(1);
  });

  test('should display weapon dropdown with options', async ({ page }) => {
    const options = page.locator('#build-weapon option');
    const count = await options.count();

    // Should have weapons loaded (plus default option)
    expect(count).toBeGreaterThan(1);
  });

  test('should display tomes selection', async ({ page }) => {
    const tomeCheckboxes = page.locator('#tomes-selection input[type="checkbox"]');
    const count = await tomeCheckboxes.count();

    // Should have tomes available
    expect(count).toBeGreaterThan(0);
  });

  test('should display items selection', async ({ page }) => {
    const itemCheckboxes = page.locator('#items-selection input[type="checkbox"]');
    const count = await itemCheckboxes.count();

    // Should have items available
    expect(count).toBeGreaterThan(0);
  });

  test('should show placeholder when no character selected', async ({ page }) => {
    const statsDisplay = page.locator('#build-stats');
    await expect(statsDisplay).toContainText('Select character and weapon');
  });

  test('should calculate stats when character and weapon selected', async ({ page }) => {
    // Select a character (first non-empty option)
    await page.selectOption('#build-character', { index: 1 });

    // Select a weapon (first non-empty option)
    await page.selectOption('#build-weapon', { index: 1 });

    // Wait for stats to update
    await page.waitForTimeout(200);

    const statsDisplay = page.locator('#build-stats');
    await expect(statsDisplay).toContainText('Total Damage');
    await expect(statsDisplay).toContainText('Max HP');
    await expect(statsDisplay).toContainText('Crit Chance');
  });

  test('should display synergies section', async ({ page }) => {
    // Select character and weapon
    await page.selectOption('#build-character', { index: 1 });
    await page.selectOption('#build-weapon', { index: 1 });

    await page.waitForTimeout(200);

    const synergiesDisplay = page.locator('#build-synergies');
    // Should have some content (either synergies found or placeholder)
    await expect(synergiesDisplay).not.toBeEmpty();
  });

  test('should update stats when tome selected', async ({ page }) => {
    // Select character and weapon first
    await page.selectOption('#build-character', { index: 1 });
    await page.selectOption('#build-weapon', { index: 1 });
    await page.waitForTimeout(200);

    // Get initial damage value
    const initialStats = await page.locator('#build-stats').textContent();

    // Select a tome
    await page.click('#tomes-selection input[type="checkbox"] >> nth=0');
    await page.waitForTimeout(200);

    // Stats should have updated
    const updatedStats = await page.locator('#build-stats').textContent();
    expect(updatedStats).not.toBe(initialStats);
  });

  test('should export build code', async ({ page }) => {
    // Select character and weapon
    await page.selectOption('#build-character', { index: 1 });
    await page.selectOption('#build-weapon', { index: 1 });

    // Listen for alert
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('copied');
      await dialog.accept();
    });

    // Click export button
    await page.click('#export-build');
  });

  test('should clear build', async ({ page }) => {
    // Select character and weapon
    await page.selectOption('#build-character', { index: 1 });
    await page.selectOption('#build-weapon', { index: 1 });

    // Select a tome
    await page.click('#tomes-selection input[type="checkbox"] >> nth=0');

    // Click clear button
    await page.click('#clear-build');

    // Dropdowns should be reset
    await expect(page.locator('#build-character')).toHaveValue('');
    await expect(page.locator('#build-weapon')).toHaveValue('');

    // Tomes should be unchecked
    const checkedTomes = page.locator('#tomes-selection input[type="checkbox"]:checked');
    await expect(checkedTomes).toHaveCount(0);
  });

  test('should show stat cards with icons', async ({ page }) => {
    // Select character and weapon
    await page.selectOption('#build-character', { index: 1 });
    await page.selectOption('#build-weapon', { index: 1 });

    await page.waitForTimeout(200);

    // Should have stat cards
    const statCards = page.locator('#build-stats .stat-card');
    const count = await statCards.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Build Planner - Synergy Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    await page.click('.tab-btn[data-tab="build-planner"]');
    await page.waitForSelector('#build-character option:not([value=""])', { timeout: 5000 });
  });

  test('should show synergies when matching character and weapon selected', async ({ page }) => {
    // Look for CL4NK (known to synergize with Revolver)
    const characterOptions = await page.locator('#build-character option').allTextContents();
    const cl4nkIndex = characterOptions.findIndex(opt => opt.toLowerCase().includes('cl4nk'));

    if (cl4nkIndex > 0) {
      await page.selectOption('#build-character', { index: cl4nkIndex });

      // Look for Revolver
      const weaponOptions = await page.locator('#build-weapon option').allTextContents();
      const revolverIndex = weaponOptions.findIndex(opt => opt.toLowerCase().includes('revolver'));

      if (revolverIndex > 0) {
        await page.selectOption('#build-weapon', { index: revolverIndex });
        await page.waitForTimeout(200);

        // Should show synergy
        const synergiesDisplay = page.locator('#build-synergies');
        await expect(synergiesDisplay).toContainText(/synergizes|Synergies Found/i);
      }
    }
  });
});
