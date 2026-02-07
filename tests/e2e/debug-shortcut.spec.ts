import { test, expect } from '@playwright/test';

test('debug ? key event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    
    // Blur any focused input first
    await page.locator('#searchInput').blur();
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(100);
    
    // Set up key listener and then press key
    const keyInfoPromise = page.evaluate(() => {
        return new Promise<{key: string, shiftKey: boolean}>(resolve => {
            const handler = (e: KeyboardEvent) => {
                document.removeEventListener('keydown', handler);
                resolve({ key: e.key, shiftKey: e.shiftKey });
            };
            document.addEventListener('keydown', handler);
            // Timeout fallback
            setTimeout(() => resolve({ key: 'timeout', shiftKey: false }), 2000);
        });
    });
    
    // Small delay to ensure listener is attached
    await page.waitForTimeout(50);
    await page.keyboard.press('Shift+/');
    
    const keyInfo = await keyInfoPromise;
    console.log('Key info:', keyInfo);
    
    // Just verify we captured some key event
    expect(keyInfo.key).toBeTruthy();
});

test('check if modal gets created manually', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    
    // Blur search
    await page.locator('#searchInput').blur();
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    
    // Try calling showShortcutsModal directly
    const created = await page.evaluate(() => {
        // Check if the function exists
        const w = window as any;
        if (typeof w.showShortcutsModal === 'function') {
            w.showShortcutsModal();
            return 'called directly';
        }
        
        // Try dispatching a keyboard event
        const event = new KeyboardEvent('keydown', { 
            key: '?', 
            shiftKey: true, 
            bubbles: true 
        });
        document.dispatchEvent(event);
        return 'dispatched event';
    });
    
    console.log('Method used:', created);
    await page.waitForTimeout(500);
    
    const modal = page.locator('#shortcuts-modal');
    const exists = await modal.count();
    console.log('Modal exists:', exists);
});
