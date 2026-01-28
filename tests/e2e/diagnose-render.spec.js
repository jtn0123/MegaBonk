import { test, expect } from '@playwright/test';

test.describe('Diagnose Rendering Issue', () => {
    test('Check initialization order and switchTab availability', async ({ page }) => {
        const logs = [];

        // Capture all console messages
        page.on('console', msg => {
            logs.push({ type: msg.type(), text: msg.text() });
        });

        page.on('pageerror', err => {
            logs.push({ type: 'error', text: `Page Error: ${err.message}` });
        });

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Wait for initialization to complete
        await page.waitForTimeout(5000);

        // Check if switchTab exists on window
        const switchTabExists = await page.evaluate(() => {
            return typeof window.switchTab === 'function';
        });
        console.log('switchTab exists on window:', switchTabExists);

        // Check store state
        const storeState = await page.evaluate(() => {
            return {
                hasAllData: !!window.allData,
                itemsInStore: window.allData?.items?.items?.length || 0,
                currentTab: window.currentTab || 'unknown',
            };
        });
        console.log('Store state:', storeState);

        // Check DOM state
        const domState = await page.evaluate(() => {
            return {
                itemCountEl: document.querySelector('#itemCount')?.textContent || 'not found',
                containerExists: !!document.querySelector('#itemsContainer'),
                cardCount: document.querySelectorAll('#itemsContainer .item-card').length,
                activeTab: document.querySelector('.tab-btn.active')?.dataset?.tab || 'none',
            };
        });
        console.log('DOM state:', domState);

        // Try calling switchTab manually
        const afterManualSwitch = await page.evaluate(() => {
            if (typeof window.switchTab === 'function') {
                window.switchTab('items');
                return {
                    called: true,
                    cardCount: document.querySelectorAll('#itemsContainer .item-card').length,
                };
            }
            return { called: false };
        });
        console.log('After manual switchTab:', afterManualSwitch);

        // Wait a bit and check again
        await page.waitForTimeout(1000);

        const finalState = await page.evaluate(() => {
            return {
                cardCount: document.querySelectorAll('#itemsContainer .item-card').length,
                itemCountText: document.querySelector('#itemCount')?.textContent || 'not found',
            };
        });
        console.log('Final state:', finalState);

        // Print relevant logs
        const relevantLogs = logs.filter(
            l =>
                l.text.includes('switchTab') ||
                l.text.includes('render') ||
                l.text.includes('error') ||
                l.text.includes('data.load') ||
                l.type === 'error'
        );
        console.log('Relevant logs:', relevantLogs);

        expect(switchTabExists).toBe(true);
        expect(storeState.itemsInStore).toBeGreaterThan(0);
    });

    test('Check if renderTabContent is called', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Inject tracking before any rendering
        await page.evaluate(() => {
            window.__renderCalls = [];
            const originalImport = window.import;
            // We can't easily intercept dynamic imports, so just track what we can
        });

        await page.waitForTimeout(5000);

        // Check if items tab content is active
        const tabState = await page.evaluate(() => {
            const itemsTab = document.querySelector('#items-tab');
            const itemsBtn = document.querySelector('.tab-btn[data-tab="items"]');
            return {
                itemsTabExists: !!itemsTab,
                itemsTabClasses: itemsTab?.className || '',
                itemsBtnActive: itemsBtn?.classList.contains('active') || false,
                allTabBtnClasses: Array.from(document.querySelectorAll('.tab-btn')).map(b => ({
                    tab: b.dataset.tab,
                    active: b.classList.contains('active'),
                })),
            };
        });
        console.log('Tab state:', JSON.stringify(tabState, null, 2));

        // Force a tab switch and check rendering
        const renderResult = await page.evaluate(async () => {
            // Try to import and call renderTabContent directly
            try {
                const { renderTabContent } = await import('/assets/main-*.js');
                return { imported: true };
            } catch (e) {
                return { imported: false, error: e.message };
            }
        });
        console.log('Render import result:', renderResult);
    });

    test('Check if getDataForTab returns data', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(5000);

        // Check data retrieval functions
        const dataCheck = await page.evaluate(() => {
            // Check window.allData structure
            const allData = window.allData;
            if (!allData) return { hasAllData: false };

            return {
                hasAllData: true,
                itemsKey: Object.keys(allData.items || {}),
                itemsItemsLength: allData.items?.items?.length || 0,
                sampleItem: allData.items?.items?.[0]?.name || 'no items',
            };
        });
        console.log('Data check:', dataCheck);

        expect(dataCheck.itemsItemsLength).toBeGreaterThan(0);
    });

    test('Manual render test', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        // Try to manually trigger rendering
        const manualRender = await page.evaluate(async () => {
            const results = {
                steps: [],
            };

            // Step 1: Check if allData is populated
            const items = window.allData?.items?.items;
            results.steps.push({ step: 1, hasItems: !!items, count: items?.length || 0 });

            if (!items || items.length === 0) {
                return results;
            }

            // Step 2: Get the container
            const container = document.getElementById('itemsContainer');
            results.steps.push({ step: 2, hasContainer: !!container });

            if (!container) {
                return results;
            }

            // Step 3: Try to create a card manually
            const item = items[0];
            const card = document.createElement('div');
            card.className = 'item-card';
            card.textContent = item.name;
            container.appendChild(card);

            results.steps.push({
                step: 3,
                cardAdded: true,
                newCardCount: document.querySelectorAll('#itemsContainer .item-card').length,
            });

            return results;
        });

        console.log('Manual render test:', JSON.stringify(manualRender, null, 2));

        // If we can manually add cards, the issue is in the render flow
        expect(manualRender.steps.find(s => s.step === 3)?.cardAdded).toBe(true);
    });
});
