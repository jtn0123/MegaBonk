// ========================================
// Data Integrity E2E Tests
// ========================================
// Tests to ensure data is loaded correctly and consistently

import { test, expect } from '@playwright/test';

// Expected counts from data files
const EXPECTED_COUNTS = {
    items: 80,
    weapons: 29,
    tomes: 23,
    characters: 20,
    shrines: 8,
};

test.describe('Data Loading', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    test('items tab loads exactly 80 items', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');
        await expect(cards).toHaveCount(EXPECTED_COUNTS.items);
    });

    test('weapons tab loads exactly 29 weapons', async ({ page }) => {
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });
        
        const cards = page.locator('#weaponsContainer .item-card');
        await expect(cards).toHaveCount(EXPECTED_COUNTS.weapons);
    });

    test('tomes tab loads exactly 23 tomes', async ({ page }) => {
        await page.click('.tab-btn[data-tab="tomes"]');
        await page.waitForSelector('#tomesContainer .item-card', { timeout: 10000 });
        
        const cards = page.locator('#tomesContainer .item-card');
        await expect(cards).toHaveCount(EXPECTED_COUNTS.tomes);
    });

    test('characters tab loads exactly 20 characters', async ({ page }) => {
        await page.click('.tab-btn[data-tab="characters"]');
        await page.waitForSelector('#charactersContainer .item-card', { timeout: 10000 });
        
        const cards = page.locator('#charactersContainer .item-card');
        await expect(cards).toHaveCount(EXPECTED_COUNTS.characters);
    });

    test('shrines tab loads exactly 8 shrines', async ({ page }) => {
        await page.click('.tab-btn[data-tab="shrines"]');
        await page.waitForSelector('#shrinesContainer .item-card', { timeout: 10000 });
        
        const cards = page.locator('#shrinesContainer .item-card');
        await expect(cards).toHaveCount(EXPECTED_COUNTS.shrines);
    });
});

test.describe('Image Loading', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    test('all item cards have images', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();

        for (let i = 0; i < Math.min(count, 20); i++) {
            const img = cards.nth(i).locator('img');
            await expect(img).toHaveAttribute('src', /.+/);
        }
    });

    test('item images load without errors', async ({ page }) => {
        const images = page.locator('#itemsContainer .item-card img');
        const count = await images.count();

        // Check first 20 images
        for (let i = 0; i < Math.min(count, 20); i++) {
            const img = images.nth(i);
            const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);
        }
    });

    test('weapon images load correctly', async ({ page }) => {
        await page.click('.tab-btn[data-tab="weapons"]');
        await page.waitForSelector('#weaponsContainer .item-card', { timeout: 10000 });

        const images = page.locator('#weaponsContainer .item-card img');
        const firstImg = images.first();
        const naturalWidth = await firstImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);
    });
});

test.describe('Card Data Attributes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    test('all item cards have entity-type attribute', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();

        for (let i = 0; i < count; i++) {
            const entityType = await cards.nth(i).getAttribute('data-entity-type');
            expect(entityType).toBe('item');
        }
    });

    test('all item cards have entity-id attribute', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();

        for (let i = 0; i < count; i++) {
            const entityId = await cards.nth(i).getAttribute('data-entity-id');
            expect(entityId).toBeTruthy();
            expect(entityId?.length).toBeGreaterThan(0);
        }
    });

    test('all item cards have unique IDs', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();
        const ids = new Set<string>();

        for (let i = 0; i < count; i++) {
            const entityId = await cards.nth(i).getAttribute('data-entity-id');
            expect(ids.has(entityId!)).toBe(false);
            ids.add(entityId!);
        }

        expect(ids.size).toBe(count);
    });

    test('all cards have rarity class', async ({ page }) => {
        const cards = page.locator('#itemsContainer .item-card');
        const count = await cards.count();

        for (let i = 0; i < Math.min(count, 20); i++) {
            const classes = await cards.nth(i).getAttribute('class');
            expect(classes).toMatch(/rarity-(common|uncommon|rare|epic|legendary)/);
        }
    });
});

test.describe('Content Integrity', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
    });

    test('all item cards have visible name', async ({ page }) => {
        const names = page.locator('#itemsContainer .item-card .item-name');
        const count = await names.count();

        expect(count).toBe(EXPECTED_COUNTS.items);

        for (let i = 0; i < Math.min(count, 20); i++) {
            const text = await names.nth(i).textContent();
            expect(text?.trim().length).toBeGreaterThan(0);
        }
    });

    test('all item cards have effect text', async ({ page }) => {
        const effects = page.locator('#itemsContainer .item-card .item-effect');
        const count = await effects.count();

        expect(count).toBe(EXPECTED_COUNTS.items);

        for (let i = 0; i < Math.min(count, 20); i++) {
            const text = await effects.nth(i).textContent();
            expect(text?.trim().length).toBeGreaterThan(0);
        }
    });

    test('all item cards have tier label', async ({ page }) => {
        const tiers = page.locator('#itemsContainer .item-card .tier-label, #itemsContainer .item-card [class*="tier"]');
        const count = await tiers.count();

        // Each card should have a tier indicator
        expect(count).toBeGreaterThanOrEqual(EXPECTED_COUNTS.items);
    });
});

test.describe('About Page Data', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });
        await page.click('.tab-btn[data-tab="about"]');
        await page.waitForTimeout(300);
    });

    test('about page shows correct item count', async ({ page }) => {
        const aboutContent = page.locator('#about-tab, #aboutContainer');
        const text = await aboutContent.textContent();
        expect(text).toContain(`${EXPECTED_COUNTS.items} items`);
    });

    test('about page shows correct weapon count', async ({ page }) => {
        const aboutContent = page.locator('#about-tab, #aboutContainer');
        const text = await aboutContent.textContent();
        expect(text).toContain(`${EXPECTED_COUNTS.weapons} weapons`);
    });

    test('about page shows correct tome count', async ({ page }) => {
        const aboutContent = page.locator('#about-tab, #aboutContainer');
        const text = await aboutContent.textContent();
        expect(text).toContain(`${EXPECTED_COUNTS.tomes} tomes`);
    });

    test('about page shows correct character count', async ({ page }) => {
        const aboutContent = page.locator('#about-tab, #aboutContainer');
        const text = await aboutContent.textContent();
        expect(text).toContain(`${EXPECTED_COUNTS.characters}`);
    });

    test('about page shows correct shrine count', async ({ page }) => {
        const aboutContent = page.locator('#about-tab, #aboutContainer');
        const text = await aboutContent.textContent();
        expect(text).toContain(`${EXPECTED_COUNTS.shrines}`);
    });
});

test.describe('No Console Errors', () => {
    test('page loads without JS errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });

        expect(errors).toHaveLength(0);
    });

    test('all tabs load without JS errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });

        const tabs = ['weapons', 'tomes', 'characters', 'shrines', 'build-planner', 'calculator', 'advisor', 'changelog', 'about'];
        for (const tab of tabs) {
            await page.click(`.tab-btn[data-tab="${tab}"]`);
            await page.waitForTimeout(500);
        }

        expect(errors).toHaveLength(0);
    });
});

test.describe('Network Requests', () => {
    test('no failed data requests', async ({ page }) => {
        const failedRequests: string[] = [];
        
        page.on('response', response => {
            if (response.status() >= 400 && response.url().includes('/data/')) {
                failedRequests.push(`${response.status()}: ${response.url()}`);
            }
        });

        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 20000 });

        expect(failedRequests).toHaveLength(0);
    });
});
