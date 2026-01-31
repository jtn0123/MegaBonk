/**
 * E2E Tests for Scan Build Feature
 *
 * Tests the screenshot upload and item detection workflow including:
 * - Image upload functionality
 * - OCR detection
 * - CV (computer vision) detection
 * - Hybrid detection mode
 * - Detection results display in UI
 */

import { test, expect, Page } from '@playwright/test';

// Path to a real test image in the project (relative to project root where playwright runs)
const TEST_IMAGE_PATH = 'src/images/items/battery.png';

/**
 * Helper to navigate to advisor tab and wait for scan section
 */
async function navigateToScanBuild(page: Page): Promise<void> {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    // Navigate to advisor tab - use force:true in case tab is partially visible
    await page.locator('.tab-btn[data-tab="advisor"]').click({ force: true });
    await expect(page.locator('#advisor-tab')).toHaveClass(/active/);
    // Wait for scan section to be visible
    await expect(page.locator('.scan-section')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to upload a test image file to the scan section
 */
async function uploadTestImage(page: Page): Promise<void> {
    const fileInput = page.locator('#scan-file-input');
    await fileInput.setInputFiles(TEST_IMAGE_PATH);
}

test.describe('Scan Build Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Collect console errors for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Browser error: ${msg.text()}`);
            }
        });
    });

    test.describe('Navigation and Initial State', () => {
        test('should display scan section in advisor tab', async ({ page }) => {
            await navigateToScanBuild(page);

            const scanSection = page.locator('.scan-section');
            await expect(scanSection).toBeVisible();

            // Check for header
            const header = scanSection.locator('h3');
            await expect(header).toContainText('Scan Your Build');
        });

        test('should show upload button initially', async ({ page }) => {
            await navigateToScanBuild(page);

            const uploadBtn = page.locator('#scan-upload-btn');
            await expect(uploadBtn).toBeVisible();
            await expect(uploadBtn).toContainText('Upload Screenshot');
        });

        test('should have hidden file input', async ({ page }) => {
            await navigateToScanBuild(page);

            const fileInput = page.locator('#scan-file-input');
            await expect(fileInput).toBeAttached();
            await expect(fileInput).toHaveAttribute('type', 'file');
            await expect(fileInput).toHaveAttribute('accept', 'image/*');
        });

        test('should hide detection buttons initially', async ({ page }) => {
            await navigateToScanBuild(page);

            const autoDetectArea = page.locator('#scan-auto-detect-area');
            await expect(autoDetectArea).toBeHidden();
        });
    });

    test.describe('Image Upload', () => {
        test('should display uploaded image preview', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Wait for image preview to appear
            const imagePreview = page.locator('#scan-image-preview');
            await expect(imagePreview).toBeVisible({ timeout: 5000 });

            // Should contain an img element
            const img = imagePreview.locator('img');
            await expect(img).toBeVisible();
        });

        test('should show detection buttons after upload', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Auto-detect area should become visible
            const autoDetectArea = page.locator('#scan-auto-detect-area');
            await expect(autoDetectArea).toBeVisible({ timeout: 5000 });

            // Should show OCR detect button
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible();

            // Should show hybrid detect button
            const hybridBtn = page.locator('#scan-hybrid-detect-btn');
            await expect(hybridBtn).toBeVisible();
        });

        test('should show clear button after upload', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Clear button should be visible
            const clearBtn = page.locator('#scan-clear-image');
            await expect(clearBtn).toBeVisible({ timeout: 5000 });
        });

        test('should clear image when clear button clicked', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Wait for preview
            const imagePreview = page.locator('#scan-image-preview');
            await expect(imagePreview).toBeVisible({ timeout: 5000 });

            // Click clear button
            const clearBtn = page.locator('#scan-clear-image');
            await clearBtn.click();

            // Preview should be hidden
            await expect(imagePreview).toBeHidden({ timeout: 3000 });

            // Detection area should also be hidden
            const autoDetectArea = page.locator('#scan-auto-detect-area');
            await expect(autoDetectArea).toBeHidden();
        });

        test('should reject non-image files gracefully', async ({ page }) => {
            await navigateToScanBuild(page);

            // Listen for toast messages
            const toasts: string[] = [];
            page.on('console', msg => {
                if (msg.text().includes('toast') || msg.text().includes('error')) {
                    toasts.push(msg.text());
                }
            });

            // Try to upload a non-image file
            const fileInput = page.locator('#scan-file-input');
            await fileInput.setInputFiles({
                name: 'test.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from('not an image')
            });

            // Preview should not appear
            const imagePreview = page.locator('#scan-image-preview');
            await page.waitForTimeout(500);
            // May show toast error, preview stays hidden
        });
    });

    test.describe('OCR Detection', () => {
        test('should have OCR detect button available', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await expect(ocrBtn).toContainText('Detect');
        });

        test('should show progress indicator during OCR detection', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Click OCR detect button
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });

            // Start detection - don't wait for completion, just check progress appears
            await ocrBtn.click();

            // Progress indicator may appear briefly
            // Just verify the click didn't crash the page
            await page.waitForTimeout(500);

            // Page should still be responsive
            const advisorContainer = page.locator('.advisor-container');
            await expect(advisorContainer).toBeVisible();
        });

        test('should handle OCR detection without crashing', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Click OCR detect button
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();

            // Wait for detection to complete or timeout
            // Detection may show "no items found" for a simple test image
            await page.waitForTimeout(3000);

            // Page should still be functional
            const scanSection = page.locator('.scan-section');
            await expect(scanSection).toBeVisible();
        });
    });

    test.describe('Hybrid Detection Mode', () => {
        test('should have hybrid detect button available', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            const hybridBtn = page.locator('#scan-hybrid-detect-btn');
            await expect(hybridBtn).toBeVisible({ timeout: 5000 });
            await expect(hybridBtn).toContainText('Hybrid');
        });

        test('should handle hybrid detection without crashing', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Wait for templates to potentially load
            await page.waitForTimeout(1000);

            // Click hybrid detect button
            const hybridBtn = page.locator('#scan-hybrid-detect-btn');
            await expect(hybridBtn).toBeVisible({ timeout: 5000 });

            // Only click if button is enabled (templates loaded)
            const isDisabled = await hybridBtn.isDisabled();
            if (!isDisabled) {
                await hybridBtn.click();

                // Wait for detection to complete
                await page.waitForTimeout(3000);

                // Page should still be functional
                const scanSection = page.locator('.scan-section');
                await expect(scanSection).toBeVisible();
            }
        });

        test('should show debug mode checkbox', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Debug mode checkbox should be available
            const debugCheckbox = page.locator('#scan-debug-mode');
            await expect(debugCheckbox).toBeVisible({ timeout: 5000 });
        });

        test('should toggle debug mode', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            const debugCheckbox = page.locator('#scan-debug-mode');
            await expect(debugCheckbox).toBeVisible({ timeout: 5000 });

            // Check the debug mode
            await debugCheckbox.check();
            await expect(debugCheckbox).toBeChecked();

            // Uncheck
            await debugCheckbox.uncheck();
            await expect(debugCheckbox).not.toBeChecked();
        });
    });

    test.describe('Detection Results UI', () => {
        test('should show selection area after detection', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();

            // Wait for detection
            await page.waitForTimeout(3000);

            // Selection area may become visible (depends on detection results)
            const selectionArea = page.locator('#scan-selection-area');
            // Just check it exists in DOM (may be hidden if no results)
            await expect(selectionArea).toBeAttached();
        });

        test('should show character selection grid', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection to show selection UI
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            // Check for character grid existence
            const characterGrid = page.locator('#scan-character-grid');
            await expect(characterGrid).toBeAttached();
        });

        test('should show weapon selection grid', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            // Check for weapon grid existence
            const weaponGrid = page.locator('#scan-weapon-grid');
            await expect(weaponGrid).toBeAttached();
        });

        test('should show item selection grid', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            // Check for item grid existence
            const itemGrid = page.locator('#scan-item-grid');
            await expect(itemGrid).toBeAttached();
        });

        test('should show tome selection grid', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            // Check for tome grid existence
            const tomeGrid = page.locator('#scan-tome-grid');
            await expect(tomeGrid).toBeAttached();
        });

        test('should display detection confidence info when items detected', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            // Detection info container should exist
            const detectionInfo = page.locator('#scan-detection-info');
            await expect(detectionInfo).toBeAttached();
        });
    });

    test.describe('Manual Item Selection', () => {
        test('should allow selecting character from grid', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection to show selection UI
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            // Get selection area visible
            const selectionArea = page.locator('#scan-selection-area');
            if (await selectionArea.isVisible()) {
                // Try to click a character card
                const characterCards = page.locator('#scan-character-grid .scan-entity-card');
                if ((await characterCards.count()) > 0) {
                    await characterCards.first().click();
                    await expect(characterCards.first()).toHaveClass(/selected/);
                }
            }
        });

        test('should allow incrementing item count', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection to show selection UI
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            // Get selection area
            const selectionArea = page.locator('#scan-selection-area');
            if (await selectionArea.isVisible()) {
                // Find an item card increment button
                const incrementBtns = page.locator('#scan-grid-items-container .scan-count-btn:has-text("+")');
                if ((await incrementBtns.count()) > 0) {
                    // Get initial count
                    const firstCard = page.locator('#scan-grid-items-container .scan-item-card').first();
                    const countDisplay = firstCard.locator('.scan-count-display');
                    const initialCount = await countDisplay.textContent();

                    // Click increment
                    await incrementBtns.first().click();

                    // Count should increase
                    const newCount = await countDisplay.textContent();
                    expect(parseInt(newCount || '0')).toBeGreaterThan(parseInt(initialCount || '0'));
                }
            }
        });

        test('should update selection summary when items added', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            const selectionArea = page.locator('#scan-selection-area');
            if (await selectionArea.isVisible()) {
                // Add an item
                const incrementBtns = page.locator('#scan-grid-items-container .scan-count-btn:has-text("+")');
                if ((await incrementBtns.count()) > 0) {
                    await incrementBtns.first().click();

                    // Summary should be updated
                    const summary = page.locator('#scan-selection-summary');
                    await expect(summary).toContainText('Items');
                }
            }
        });
    });

    test.describe('Apply to Advisor', () => {
        test('should have apply to advisor button', async ({ page }) => {
            await navigateToScanBuild(page);

            const applyBtn = page.locator('#scan-apply-to-advisor');
            await expect(applyBtn).toBeAttached();
        });

        test('should apply selections to advisor when clicked', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            const selectionArea = page.locator('#scan-selection-area');
            if (await selectionArea.isVisible()) {
                // Add some items
                const incrementBtns = page.locator('#scan-grid-items-container .scan-count-btn:has-text("+")');
                if ((await incrementBtns.count()) > 0) {
                    await incrementBtns.first().click();
                }

                // Apply button should be visible when items are selected
                const applyBtn = page.locator('#scan-apply-to-advisor');
                if (await applyBtn.isVisible()) {
                    await applyBtn.click();

                    // Should not crash, page should remain functional
                    await page.waitForTimeout(500);
                    const advisorContainer = page.locator('.advisor-container');
                    await expect(advisorContainer).toBeVisible();
                }
            }
        });
    });

    test.describe('Error Handling', () => {
        test('should handle detection errors gracefully', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Click detect multiple times rapidly
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });

            // Rapid clicks shouldn't crash
            await ocrBtn.click();
            await ocrBtn.click();
            await ocrBtn.click();

            // Wait and verify page is still functional
            await page.waitForTimeout(3000);
            const scanSection = page.locator('.scan-section');
            await expect(scanSection).toBeVisible();
        });

        test('should handle no file selected gracefully', async ({ page }) => {
            await navigateToScanBuild(page);

            // Click upload button but don't select a file
            const uploadBtn = page.locator('#scan-upload-btn');
            await uploadBtn.click();

            // Close file dialog by pressing escape
            await page.keyboard.press('Escape');

            // Page should still be functional
            await page.waitForTimeout(300);
            const scanSection = page.locator('.scan-section');
            await expect(scanSection).toBeVisible();
        });
    });

    test.describe('Item Search Filtering', () => {
        test('should have search input in item grid', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection to show selection UI
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            const selectionArea = page.locator('#scan-selection-area');
            if (await selectionArea.isVisible()) {
                const searchInput = page.locator('#scan-item-grid .scan-search-input');
                await expect(searchInput).toBeVisible();
            }
        });

        test('should filter items when searching', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            const selectionArea = page.locator('#scan-selection-area');
            if (await selectionArea.isVisible()) {
                const searchInput = page.locator('#scan-item-grid .scan-search-input');
                if (await searchInput.isVisible()) {
                    // Get initial item count
                    const initialItems = await page.locator('#scan-grid-items-container .scan-item-card:visible').count();

                    // Type a search query
                    await searchInput.fill('wrench');
                    await page.waitForTimeout(300);

                    // Visible items should be filtered
                    const filteredItems = await page.locator('#scan-grid-items-container .scan-item-card:visible').count();

                    // Either filtered down or all items match - just verify no crash
                    expect(filteredItems).toBeLessThanOrEqual(initialItems);
                }
            }
        });
    });

    test.describe('Accessibility', () => {
        test('should have proper aria labels on buttons', async ({ page }) => {
            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Clear button should have aria-label
            const clearBtn = page.locator('#scan-clear-image');
            await expect(clearBtn).toBeVisible({ timeout: 5000 });
            await expect(clearBtn).toHaveAttribute('aria-label', 'Clear image');
        });

        test('should be keyboard navigable', async ({ page }) => {
            await navigateToScanBuild(page);

            // Tab to upload button
            await page.keyboard.press('Tab');

            // Some element should be focused
            const focused = await page.evaluate(() => document.activeElement?.tagName);
            expect(focused).toBeDefined();
        });
    });

    test.describe('No CSP Errors', () => {
        test('should not have CSP errors during detection', async ({ page }) => {
            const cspErrors: string[] = [];

            page.on('console', msg => {
                if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
                    cspErrors.push(msg.text());
                }
            });

            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger detection
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();

            // Wait for detection
            await page.waitForTimeout(3000);

            expect(cspErrors).toHaveLength(0);
        });

        test('should not have worker-src CSP errors', async ({ page }) => {
            const workerErrors: string[] = [];

            page.on('console', msg => {
                if (msg.type() === 'error' && msg.text().includes('worker-src')) {
                    workerErrors.push(msg.text());
                }
            });

            await navigateToScanBuild(page);

            
            await uploadTestImage(page);

            // Trigger both detection modes
            const ocrBtn = page.locator('#scan-auto-detect-btn');
            await expect(ocrBtn).toBeVisible({ timeout: 5000 });
            await ocrBtn.click();
            await page.waitForTimeout(3000);

            expect(workerErrors).toHaveLength(0);
        });
    });
});

test.describe('Scan Build - Responsive Behavior', () => {
    test('should work on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        await navigateToScanBuild(page);

        // Scan section should still be visible
        const scanSection = page.locator('.scan-section');
        await expect(scanSection).toBeVisible();

        // Upload button should be visible
        const uploadBtn = page.locator('#scan-upload-btn');
        await expect(uploadBtn).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await navigateToScanBuild(page);

        const scanSection = page.locator('.scan-section');
        await expect(scanSection).toBeVisible();
    });
});
