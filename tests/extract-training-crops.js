#!/usr/bin/env node
// Extract labeled training crops from gameplay screenshots
// Creates a dataset for CNN training

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './training-data/crops';
const CROP_SIZE = 48; // Standardized crop size

// Grid detection (matches CV runner)
function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(40 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(20 * scale);
    const positions = [];
    const rowHeight = iconSize + spacing;

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    const sideMargin = Math.round(width * 0.20);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    for (const rowY of rowYPositions) {
        if (rowY < height * 0.75) break;
        const totalWidth = maxItemsPerRow * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({
                x: startX + i * (iconSize + spacing),
                y: rowY,
                width: iconSize,
                height: iconSize,
                row: rowYPositions.indexOf(rowY),
                col: i
            });
        }
    }
    return positions;
}

// Check if cell is likely empty
function isEmptyCell(imageData) {
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 300 || mean < 40;
}

async function extractCrops() {
    console.log('=== Training Data Extraction ===\n');

    // Load ground truth
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Create output directory
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const stats = {
        totalImages: 0,
        totalCrops: 0,
        itemCounts: new Map(),
        skippedEmpty: 0
    };

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) {
            console.log(`Skip: ${name} (not found)`);
            continue;
        }

        console.log(`Processing: ${name}`);
        stats.totalImages++;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const gridPositions = detectGridPositions(image.width, image.height);
        const expectedItems = data.items || [];

        console.log(`  Grid cells: ${gridPositions.length}, Expected items: ${expectedItems.length}`);

        // Extract non-empty cells
        const nonEmptyCells = [];
        for (const cell of gridPositions) {
            const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
            if (!isEmptyCell(cellData)) {
                nonEmptyCells.push({ ...cell, imageData: cellData });
            }
        }

        console.log(`  Non-empty cells: ${nonEmptyCells.length}`);

        // We can't perfectly match cells to items without the CV working,
        // but we can extract all non-empty cells and label them based on position
        // For now, just extract cells as "unlabeled" training data

        // Also extract template-style crops from the game's item images
        let cropIndex = 0;
        for (const cell of nonEmptyCells) {
            // Resize to standard size
            const cropCanvas = createCanvas(CROP_SIZE, CROP_SIZE);
            const cropCtx = cropCanvas.getContext('2d');

            // Draw the cell resized
            const tempCanvas = createCanvas(cell.width, cell.height);
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(cell.imageData, 0, 0);

            cropCtx.drawImage(tempCanvas, 0, 0, cell.width, cell.height, 0, 0, CROP_SIZE, CROP_SIZE);

            // Save crop
            const cropName = `${name.replace(/[\/\.]/g, '_')}_r${cell.row}_c${cell.col}.png`;
            const cropPath = path.join(OUTPUT_DIR, 'unlabeled', cropName);
            fs.mkdirSync(path.dirname(cropPath), { recursive: true });

            const buffer = cropCanvas.toBuffer('image/png');
            fs.writeFileSync(cropPath, buffer);

            stats.totalCrops++;
            cropIndex++;
        }

        console.log(`  Extracted: ${cropIndex} crops`);
    }

    // Also extract from template images (these are labeled!)
    console.log('\nExtracting from template images...');
    const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));

    for (const item of itemsData.items) {
        if (!item.image) continue;
        const imagePath = path.join('./src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const cropCanvas = createCanvas(CROP_SIZE, CROP_SIZE);
            const cropCtx = cropCanvas.getContext('2d');

            // Center crop with margin
            const margin = Math.round(img.width * 0.1);
            cropCtx.drawImage(img, margin, margin,
                img.width - margin*2, img.height - margin*2,
                0, 0, CROP_SIZE, CROP_SIZE);

            // Save to labeled directory
            const itemId = item.id;
            const labelDir = path.join(OUTPUT_DIR, 'templates', itemId);
            fs.mkdirSync(labelDir, { recursive: true });

            const buffer = cropCanvas.toBuffer('image/png');
            fs.writeFileSync(path.join(labelDir, 'template.png'), buffer);

            stats.itemCounts.set(itemId, (stats.itemCounts.get(itemId) || 0) + 1);
        } catch (e) {}
    }

    console.log(`\n=== Extraction Summary ===`);
    console.log(`Images processed: ${stats.totalImages}`);
    console.log(`Unlabeled crops: ${stats.totalCrops}`);
    console.log(`Template items: ${stats.itemCounts.size}`);
    console.log(`Output: ${OUTPUT_DIR}`);
}

extractCrops().catch(console.error);
