import { chromium } from 'playwright';

async function main() {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await context.newPage();
    
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    await page.waitForSelector('.item-card', { timeout: 10000 });
    
    const spicyCard = page.locator('.item-card:has-text("Spicy Meatball")');
    if (await spicyCard.count() > 0) {
        await spicyCard.first().click();
        await page.waitForTimeout(800); // Wait for modal animation
        
        await page.screenshot({ path: '/tmp/spicy-desktop.png', fullPage: false });
        console.log('Saved desktop screenshot');
        
        const chartCanvas = page.locator('.modal-graph-container canvas');
        const canvasCount = await chartCanvas.count();
        console.log('Desktop chart canvases:', canvasCount);
        if (canvasCount > 0) {
            const box = await chartCanvas.first().boundingBox();
            console.log('Desktop canvas box:', box);
        }
    }
    
    await browser.close();
}

main().catch(console.error);
