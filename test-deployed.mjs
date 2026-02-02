import { chromium } from 'playwright';

const MOBILE_VIEWPORT = { width: 375, height: 812, deviceScaleFactor: 3, isMobile: true };

async function main() {
    const browser = await chromium.launch();
    
    // Mobile test
    const mobileContext = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('https://jtn0123.github.io/MegaBonk/', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2000);
    
    const spicyCard = mobilePage.locator('.item-card:has-text("Spicy Meatball")');
    if (await spicyCard.count() > 0) {
        await spicyCard.first().click();
        await mobilePage.waitForTimeout(1000);
        await mobilePage.screenshot({ path: '/tmp/deployed-spicy-mobile.png', fullPage: false });
        console.log('Mobile modal saved');
        
        // Check canvas
        const canvas = mobilePage.locator('.modal-graph-container canvas');
        if (await canvas.count() > 0) {
            const box = await canvas.first().boundingBox();
            console.log('Mobile canvas:', box);
            
            // Get canvas computed dimensions via JS
            const dims = await mobilePage.evaluate(() => {
                const c = document.querySelector('.modal-graph-container canvas');
                if (c) {
                    const style = getComputedStyle(c);
                    return {
                        width: c.width,
                        height: c.height,
                        styleWidth: style.width,
                        styleHeight: style.height,
                        clientWidth: c.clientWidth,
                        clientHeight: c.clientHeight
                    };
                }
                return null;
            });
            console.log('Canvas dimensions:', dims);
        }
    }
    await mobileContext.close();
    
    // Desktop test
    const desktopContext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('https://jtn0123.github.io/MegaBonk/', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(2000);
    
    const deskCard = desktopPage.locator('.item-card:has-text("Spicy Meatball")');
    if (await deskCard.count() > 0) {
        await deskCard.first().click();
        await desktopPage.waitForTimeout(1000);
        await desktopPage.screenshot({ path: '/tmp/deployed-spicy-desktop.png', fullPage: false });
        console.log('Desktop modal saved');
        
        const canvas = desktopPage.locator('.modal-graph-container canvas');
        if (await canvas.count() > 0) {
            const box = await canvas.first().boundingBox();
            console.log('Desktop canvas:', box);
            
            const dims = await desktopPage.evaluate(() => {
                const c = document.querySelector('.modal-graph-container canvas');
                if (c) {
                    const style = getComputedStyle(c);
                    return {
                        width: c.width,
                        height: c.height,
                        styleWidth: style.width,
                        styleHeight: style.height,
                        clientWidth: c.clientWidth,
                        clientHeight: c.clientHeight
                    };
                }
                return null;
            });
            console.log('Canvas dimensions:', dims);
        }
    }
    
    await browser.close();
}

main().catch(console.error);
