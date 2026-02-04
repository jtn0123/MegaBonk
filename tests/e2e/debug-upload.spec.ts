import { test, expect } from '@playwright/test';

const TEST_IMAGE_PATH = 'src/images/items/battery.png';

test('debug image upload', async ({ page }) => {
    // Collect ALL console messages
    const consoleLogs: string[] = [];
    page.on('console', msg => {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Collect page errors
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
        pageErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    
    // Navigate to advisor tab
    await page.locator('.tab-btn[data-tab="advisor"]').click({ force: true });
    await expect(page.locator('#advisor-tab')).toHaveClass(/active/);
    
    // Wait for scan section
    await expect(page.locator('.scan-section')).toBeVisible({ timeout: 5000 });

    // Wait a bit for lazy loading to complete
    await page.waitForTimeout(1000);

    console.log('=== Before upload ===');
    console.log('Console logs:', consoleLogs.slice(-15));

    // Check file input exists
    const fileInput = page.locator('#scan-file-input');
    await expect(fileInput).toBeAttached();

    // Check if initScanBuild was called by looking for its log
    const scanBuildInitLog = consoleLogs.find(log => log.includes('scan_build.init'));
    console.log('scan_build.init log found:', !!scanBuildInitLog);

    // Add debug event listener in the page
    await page.evaluate(() => {
        const input = document.getElementById('scan-file-input');
        if (input) {
            const existingListeners = (window as any).__scanBuildListeners || 0;
            console.log('Existing listeners on scan-file-input:', existingListeners);
            input.addEventListener('change', () => {
                console.log('CHANGE EVENT FIRED on scan-file-input');
            });
        }
    });

    // Upload the file
    await fileInput.setInputFiles(TEST_IMAGE_PATH);
    console.log('File upload set');

    // Wait longer for the debounce and async processing
    await page.waitForTimeout(2000);

    console.log('=== After upload ===');
    console.log('Console logs:', consoleLogs.slice(-25));
    console.log('Page errors:', pageErrors);

    // Check if preview is visible
    const previewContainer = page.locator('#scan-image-preview');
    const isVisible = await previewContainer.isVisible();
    console.log('Preview visible:', isVisible);
    
    // Get the display style
    const displayStyle = await previewContainer.evaluate(el => window.getComputedStyle(el).display);
    console.log('Preview display style:', displayStyle);

    // Check innerHTML of preview
    const innerHTML = await previewContainer.evaluate(el => el.innerHTML);
    console.log('Preview innerHTML:', innerHTML.substring(0, 200));

    // Check if auto-detect area became visible
    const autoDetectArea = page.locator('#scan-auto-detect-area');
    const autoDetectVisible = await autoDetectArea.isVisible();
    console.log('Auto-detect area visible:', autoDetectVisible);

    // Log any console errors specifically
    const errorLogs = consoleLogs.filter(log => log.includes('[error]'));
    console.log('Error logs:', errorLogs);

    // Look for scan_build logs
    const scanBuildLogs = consoleLogs.filter(log => log.includes('scan_build'));
    console.log('scan_build logs:', scanBuildLogs);

    // This test should help us debug
    expect(scanBuildLogs.length).toBeGreaterThan(0);
});
