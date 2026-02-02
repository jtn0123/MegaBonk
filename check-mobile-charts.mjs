import { chromium } from 'playwright';

const MOBILE_VIEWPORT = { width: 375, height: 812, deviceScaleFactor: 3, isMobile: true };

async function main() {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();
    
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Wait for items to load
    await page.waitForSelector('.item-card', { timeout: 10000 });
    
    // Click on Spicy Meatball
    const spicyCard = page.locator('.item-card:has-text("Spicy Meatball")');
    if (await spicyCard.count() > 0) {
        await spicyCard.first().click();
        await page.waitForTimeout(500);
        
        // Take screenshot of the modal
        await page.screenshot({ path: '/tmp/spicy-meatball-modal.png', fullPage: false });
        console.log('Saved modal screenshot');
        
        // Check if chart canvas exists and is visible
        const chartCanvas = page.locator('.modal-graph-container canvas');
        const canvasCount = await chartCanvas.count();
        console.log('Chart canvases in modal:', canvasCount);
        
        if (canvasCount > 0) {
            const isVisible = await chartCanvas.first().isVisible();
            console.log('First canvas visible:', isVisible);
            const box = await chartCanvas.first().boundingBox();
            console.log('Canvas bounding box:', box);
        }
        
        // Close modal
        await page.click('.modal-close');
        await page.waitForTimeout(300);
    }
    
    // Now check Big Bonk for comparison
    const bigBonkCard = page.locator('.item-card:has-text("Big Bonk")');
    if (await bigBonkCard.count() > 0) {
        await bigBonkCard.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/big-bonk-modal.png', fullPage: false });
        console.log('Saved Big Bonk modal screenshot');
        
        const chartCanvas = page.locator('.modal-graph-container canvas');
        const canvasCount = await chartCanvas.count();
        console.log('Big Bonk chart canvases:', canvasCount);
        if (canvasCount > 0) {
            const box = await chartCanvas.first().boundingBox();
            console.log('Big Bonk canvas bounding box:', box);
        }
    }
    
    await browser.close();
}

main().catch(console.error);
