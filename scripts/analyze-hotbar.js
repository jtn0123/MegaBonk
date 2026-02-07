/**
 * Analyze screenshot hotbar positions to tune CV detection
 * Run with: node scripts/analyze-hotbar.js <image-path>
 */

const fs = require('fs');
const path = require('path');

// Get image dimensions from file
async function getImageDimensions(imagePath) {
    const sharp = require('sharp');
    const metadata = await sharp(imagePath).metadata();
    return { width: metadata.width, height: metadata.height };
}

// Analyze hotbar position based on image dimensions
function analyzeHotbarPosition(width, height) {
    console.log(`\nImage: ${width}x${height}`);
    console.log('='.repeat(40));

    // Current code (after my broken fix)
    const brokenY = Math.floor(height * 0.7);
    console.log(`❌ My broken fix (70% down): y=${brokenY}`);

    // Original code (before my fix)
    const inventoryHeight = Math.floor(height * 0.15);
    const inventoryY = height - inventoryHeight;
    const originalY = inventoryY + Math.floor((inventoryHeight - 64) / 2);
    console.log(`📍 Original code (bottom 15%): y=${originalY}`);

    // What it should be (bottom 8-10%)
    const correctY = Math.floor(height * 0.92);
    console.log(`✅ Actual hotbar (~92% down): y=${correctY}`);

    // Grid sizes
    const gridSizes = {
        '720p': { old: 48, new: 40 },
        '800p': { old: 52, new: 44 },
        '1080p': { old: 64, new: 52 },
        '1440p': { old: 80, new: 70 },
        '4K': { old: 96, new: 80 },
    };

    let resolution = 'unknown';
    if (height <= 720) resolution = '720p';
    else if (height <= 800) resolution = '800p';
    else if (height <= 1080) resolution = '1080p';
    else if (height <= 1440) resolution = '1440p';
    else resolution = '4K';

    console.log(`\nResolution category: ${resolution}`);

    // What the hotbar actually looks like in MegaBonk
    console.log(`\n📐 MegaBonk Hotbar Analysis:`);
    console.log(`   - Hotbar is at VERY BOTTOM of screen`);
    console.log(`   - Icons are approximately 40-48px for this resolution`);
    console.log(`   - Should scan y=${height - 60} to y=${height - 10}`);
    console.log(`   - Number of rows varies (1-3 rows depending on items)`);
}

// Main
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        // Test with common resolutions
        console.log('Testing common MegaBonk resolutions:\n');
        analyzeHotbarPosition(1920, 1080); // 1080p
        analyzeHotbarPosition(1280, 800); // 800p (Steam Deck-ish)
        analyzeHotbarPosition(1456, 816); // Weird resolution from screenshots
        analyzeHotbarPosition(2560, 1440); // 1440p
        analyzeHotbarPosition(1280, 720); // 720p

        console.log('\n' + '='.repeat(50));
        console.log('CONCLUSION: The hotbar is at the BOTTOM 5-10% of screen,');
        console.log('NOT at 70% down. Need to revert and fix properly.');
        console.log('='.repeat(50));
    } else {
        // Analyze provided image
        const imagePath = args[0];
        if (fs.existsSync(imagePath)) {
            try {
                const dims = await getImageDimensions(imagePath);
                analyzeHotbarPosition(dims.width, dims.height);
            } catch (e) {
                console.error('Error reading image:', e.message);
                console.log('Falling back to default analysis...');
                analyzeHotbarPosition(1920, 1080);
            }
        } else {
            console.error('File not found:', imagePath);
        }
    }
}

main();
