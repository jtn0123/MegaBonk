#!/usr/bin/env node
// Measure exact UI layout from screenshots to find inventory position

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function measureImage(imagePath) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const height = image.height;
    const width = image.width;

    // Scan from bottom up to find UI regions
    // Look for horizontal lines of consistent variance (UI elements)

    const results = {
        width, height,
        bottomStrips: []
    };

    // Analyze bottom 200 pixels in 10px strips
    for (let y = height - 10; y > height - 200; y -= 10) {
        const strip = ctx.getImageData(0, y, width, 10);

        // Calculate variance across the strip
        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < strip.data.length; i += 4) {
            const gray = (strip.data[i] + strip.data[i+1] + strip.data[i+2]) / 3;
            sum += gray; sumSq += gray * gray; count++;
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;

        // Count high-variance pixels (items have texture)
        let highVarPixels = 0;
        const segmentSize = Math.floor(width / 20);
        for (let seg = 0; seg < 20; seg++) {
            let segSum = 0, segSumSq = 0, segCount = 0;
            for (let px = seg * segmentSize; px < (seg + 1) * segmentSize; px++) {
                for (let py = 0; py < 10; py++) {
                    const idx = (py * width + px) * 4;
                    const gray = (strip.data[idx] + strip.data[idx+1] + strip.data[idx+2]) / 3;
                    segSum += gray; segSumSq += gray * gray; segCount++;
                }
            }
            const segVar = segSumSq / segCount - (segSum / segCount) ** 2;
            if (segVar > 800) highVarPixels++;
        }

        results.bottomStrips.push({
            y,
            fromBottom: height - y,
            variance: Math.round(variance),
            mean: Math.round(mean),
            highVarSegments: highVarPixels
        });
    }

    return results;
}

async function main() {
    console.log('=== UI Layout Measurement ===\n');

    const testImages = [
        'test-images/gameplay/pc-1080p/level_33_english_forest_early.jpg',
        'test-images/gameplay/pc-1080p/level_75_portuguese_hell_final.jpg',
        'test-images/gameplay/pc-1080p/level_803_russian_stress_test.jpg'
    ];

    for (const imagePath of testImages) {
        if (!fs.existsSync(imagePath)) continue;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Image: ${path.basename(imagePath)}`);
        console.log('='.repeat(60));

        const result = await measureImage(imagePath);
        console.log(`Resolution: ${result.width}x${result.height}`);
        console.log(`\nBottom strips (y, fromBottom, variance, highVarSegs):`);

        // Find interesting regions
        let weaponBarEnd = null;
        let inventoryRows = [];

        for (const strip of result.bottomStrips) {
            const marker = strip.highVarSegments > 8 ? ' ***' : strip.highVarSegments > 4 ? ' **' : '';
            console.log(`  y=${strip.y} (${strip.fromBottom}px from bottom): var=${strip.variance}, segs=${strip.highVarSegments}${marker}`);

            // Detect weapon bar (high variance near bottom)
            if (strip.fromBottom < 60 && strip.highVarSegments > 5 && !weaponBarEnd) {
                weaponBarEnd = strip.fromBottom;
            }

            // Detect inventory rows (high variance segments above weapon bar)
            if (strip.fromBottom > 60 && strip.highVarSegments > 6) {
                inventoryRows.push(strip.fromBottom);
            }
        }

        console.log(`\nDetected regions:`);
        console.log(`  Weapon bar ends at: ~${weaponBarEnd || 'unknown'}px from bottom`);
        console.log(`  Inventory rows at: ${inventoryRows.slice(0, 5).join(', ')}px from bottom`);
    }
}

main().catch(console.error);
