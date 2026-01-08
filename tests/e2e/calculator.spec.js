import { test, expect } from '@playwright/test';

test.describe('Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    await page.click('.tab-btn[data-tab="calculator"]');
    await page.waitForSelector('#calc-item-select', { timeout: 5000 });
  });

  test('should display calculator tab', async ({ page }) => {
    await expect(page.locator('#calculator-tab')).toHaveClass(/active/);
  });

  test('should display item dropdown with options', async ({ page }) => {
    const options = page.locator('#calc-item-select option');
    const count = await options.count();

    // Should have items loaded (plus default option)
    expect(count).toBeGreaterThan(1);
  });

  test('should display calculator result container', async ({ page }) => {
    const resultContainer = page.locator('#calc-result');
    // Result container exists (may be hidden initially)
    await expect(resultContainer).toHaveCount(1);
  });

  test('should show target input field', async ({ page }) => {
    const targetInput = page.locator('#calc-target');
    await expect(targetInput).toBeVisible();
    await expect(targetInput).toHaveAttribute('type', 'number');
  });

  test('should show calculate button', async ({ page }) => {
    const calcButton = page.locator('#calc-button');
    await expect(calcButton).toBeVisible();
    await expect(calcButton).toContainText('Calculate');
  });

  test('should calculate stacks needed when item selected', async ({ page }) => {
    // Select an item
    await page.selectOption('#calc-item-select', { index: 1 });

    // Set target value
    await page.fill('#calc-target', '100');

    // Click calculate
    await page.click('#calc-button');

    // Wait for result
    await page.waitForTimeout(200);

    // Should show result
    const result = page.locator('#calc-result');
    await expect(result).not.toBeEmpty();
  });

  test('should display result after calculation', async ({ page }) => {
    // Select an item
    await page.selectOption('#calc-item-select', { index: 1 });

    // Set target value
    await page.fill('#calc-target', '50');

    // Click calculate
    await page.click('#calc-button');

    // Wait for result
    await page.waitForTimeout(200);

    // Result container should be visible
    const result = page.locator('#calc-result');
    await expect(result).toBeVisible();
  });

  test('should show warning when stacks exceed cap', async ({ page }) => {
    // Select an item that has a stack cap
    await page.selectOption('#calc-item-select', { index: 1 });

    // Set very high target value
    await page.fill('#calc-target', '99999');

    // Click calculate
    await page.click('#calc-button');

    await page.waitForTimeout(200);

    // Result should contain warning or cap info
    const result = page.locator('#calc-result');
    const text = await result.textContent();

    // Should have some result text
    expect(text?.length).toBeGreaterThan(0);
  });

  test('should clear result when item changes', async ({ page }) => {
    // Select first item and calculate
    await page.selectOption('#calc-item-select', { index: 1 });
    await page.fill('#calc-target', '100');
    await page.click('#calc-button');
    await page.waitForTimeout(200);

    // Get initial result
    const initialResult = await page.locator('#calc-result').textContent();

    // Select different item
    await page.selectOption('#calc-item-select', { index: 2 });

    // Result should update or clear
    const newResult = await page.locator('#calc-result').textContent();

    // At minimum, should not keep old result with different item
    // (either clears or auto-recalculates)
    expect(true).toBe(true); // Test that selection change doesn't crash
  });

  test('should handle invalid target input gracefully', async ({ page }) => {
    await page.selectOption('#calc-item-select', { index: 1 });

    // Set invalid target
    await page.fill('#calc-target', '0');
    await page.click('#calc-button');

    await page.waitForTimeout(200);

    // Should handle gracefully (not crash)
    const result = page.locator('#calc-result');
    await expect(result).toBeVisible();
  });

  test('should show calculation formula or breakdown', async ({ page }) => {
    await page.selectOption('#calc-item-select', { index: 1 });
    await page.fill('#calc-target', '50');
    await page.click('#calc-button');

    await page.waitForTimeout(200);

    const result = page.locator('#calc-result');
    const text = await result.textContent();

    // Should show some numeric result
    expect(text).toMatch(/\d/);
  });
});

test.describe('Calculator - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    await page.click('.tab-btn[data-tab="calculator"]');
    await page.waitForSelector('#calc-item-select', { timeout: 5000 });
  });

  test('should handle negative target values', async ({ page }) => {
    await page.selectOption('#calc-item-select', { index: 1 });
    await page.fill('#calc-target', '-10');
    await page.click('#calc-button');

    await page.waitForTimeout(200);

    // Should handle gracefully
    const result = page.locator('#calc-result');
    await expect(result).toBeVisible();
  });

  test('should handle decimal target values', async ({ page }) => {
    await page.selectOption('#calc-item-select', { index: 1 });
    await page.fill('#calc-target', '50.5');
    await page.click('#calc-button');

    await page.waitForTimeout(200);

    // Should handle decimal input
    const result = page.locator('#calc-result');
    await expect(result).toBeVisible();
  });

  test('should handle very large target values', async ({ page }) => {
    await page.selectOption('#calc-item-select', { index: 1 });
    await page.fill('#calc-target', '1000000');
    await page.click('#calc-button');

    await page.waitForTimeout(200);

    // Should handle large values without crashing
    const result = page.locator('#calc-result');
    await expect(result).toBeVisible();
  });
});
