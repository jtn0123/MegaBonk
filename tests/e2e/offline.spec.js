import { test, expect } from '@playwright/test';

/**
 * Offline Support Tests
 *
 * Note: Service worker tests require HTTPS or localhost and may not work
 * in all test environments. Tests that require actual offline functionality
 * are skipped by default - they can be run manually with proper setup.
 */

test.describe('Service Worker Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should have service worker API available', async ({ page }) => {
    const swSupported = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });

    expect(swSupported).toBe(true);
  });

  test('should have Cache API available', async ({ page }) => {
    const cacheSupported = await page.evaluate(() => {
      return 'caches' in window;
    });

    expect(cacheSupported).toBe(true);
  });

  test('should have sw.js file accessible', async ({ page }) => {
    // Try to fetch the service worker file
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/sw.js');
        return { ok: res.ok, status: res.status };
      } catch {
        return { ok: false, error: true };
      }
    });

    // Service worker file should be accessible
    expect(response.ok).toBe(true);
  });
});

test.describe('PWA Manifest', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should have manifest link in head', async ({ page }) => {
    const manifestLink = await page.locator('link[rel="manifest"]').count();
    expect(manifestLink).toBe(1);
  });

  test('should have accessible manifest.json', async ({ page }) => {
    const manifest = await page.evaluate(async () => {
      try {
        const res = await fetch('/manifest.json');
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    });

    expect(manifest).not.toBeNull();
    expect(manifest.name).toBeTruthy();
  });

  test('should have proper PWA meta tags', async ({ page }) => {
    // Check for theme-color
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
  });
});

test.describe('App Functionality (Online)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
  });

  test('should load all data files successfully', async ({ page }) => {
    // Check items loaded
    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();
    expect(count).toBe(78);
  });

  test('should handle tab switching', async ({ page }) => {
    await page.click('.tab-btn[data-tab="weapons"]');
    await expect(page.locator('.tab-btn[data-tab="weapons"]')).toHaveClass(/active/);

    await page.click('.tab-btn[data-tab="items"]');
    await expect(page.locator('.tab-btn[data-tab="items"]')).toHaveClass(/active/);
  });

  test('should handle search functionality', async ({ page }) => {
    await page.fill('#searchInput', 'gold');
    await page.waitForTimeout(400);

    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();
    expect(count).toBeLessThan(78);
  });

  test('should handle filter functionality', async ({ page }) => {
    await page.selectOption('#tierFilter', 'SS');
    await page.waitForTimeout(200);

    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();
    expect(count).toBeLessThan(78);
    expect(count).toBeGreaterThan(0);
  });
});

// Skip actual offline tests as they require service worker to be properly registered
// These tests can be run manually with proper HTTPS/localhost setup
test.describe.skip('Offline Functionality (Requires Service Worker)', () => {
  test('should load page structure offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for SW to cache

    await context.setOffline(true);
    await page.reload();

    const tabs = page.locator('.tab-btn');
    await expect(tabs.first()).toBeVisible();
  });

  test('should display items from cache when offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    await page.waitForTimeout(2000);

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(1000);

    const itemCards = page.locator('#itemsContainer .item-card');
    const count = await itemCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should allow tab switching offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 10000 });
    await page.waitForTimeout(2000);

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(500);

    await page.click('.tab-btn[data-tab="weapons"]');
    await expect(page.locator('.tab-btn[data-tab="weapons"]')).toHaveClass(/active/);
  });
});
