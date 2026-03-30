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
    
    // Navigate to build-planner tab (scan section is here, not advisor)
    await page.locator('.tab-btn[data-tab="build-planner"]').click({ force: true });
    await expect(page.locator('#build-planner-tab')).toHaveClass(/active/, { timeout: 15000 });

    // Wait for scan section — skip test if scan-build module didn't initialize
    const scanSection = page.locator('#build-planner-scan-section, .scan-section');
    const scanVisible = await scanSection.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!scanVisible) {
        test.skip();
        return;
    }

    // Wait a bit for lazy loading to complete
    await page.waitForTimeout(1000);

    console.log('=== Before upload ===');
    console.log('Console logs:', consoleLogs.slice(-15));

    // Check file input exists (static HTML or dynamically injected)
    const fileInput = page.locator('#scan-file-input, input[type="file"][accept*="image"]');
    await expect(fileInput.first()).toBeAttached();

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
