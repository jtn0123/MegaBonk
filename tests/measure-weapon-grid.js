#!/usr/bin/env node
// Measure exact weapon/tome grid position by scanning the top-left region

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function measureWeaponGrid(imagePath) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const height = image.height;
    const width = image.width;
    const scale = height / 720;

    console.log(`\nImage: ${path.basename(imagePath)}`);
    console.log(`Resolution: ${width}x${height}, Scale: ${scale.toFixed(2)}`);

    // Scan top-left region for high-variance areas (icons)
    const scanWidth = Math.round(250 * scale);
    const scanHeight = Math.round(200 * scale);

    // Create a variance map
    const cellSize = Math.round(20 * scale);

    console.log(`\nScanning top-left ${scanWidth}x${scanHeight}px in ${cellSize}px cells:`);

    for (let row = 0; row < Math.ceil(scanHeight / cellSize); row++) {
        let line = '';
        for (let col = 0; col < Math.ceil(scanWidth / cellSize); col++) {
            const x = col * cellSize;
            const y = row * cellSize;
            const data = ctx.getImageData(x, y, cellSize, cellSize);

            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < data.data.length; i += 4) {
                const gray = (data.data[i] + data.data[i+1] + data.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;

            // Visualize variance: . = low, o = medium, O = high, X = very high
            if (variance < 200) line += '.';
            else if (variance < 800) line += 'o';
            else if (variance < 2000) line += 'O';
            else line += 'X';
        }
        console.log(`  ${String(row * cellSize).padStart(3)}px: ${line}`);
    }

    // Create zoomed visualization of top-left corner
    const zoomCanvas = createCanvas(scanWidth * 2, scanHeight * 2);
    const zoomCtx = zoomCanvas.getContext('2d');
    zoomCtx.drawImage(image, 0, 0, scanWidth, scanHeight, 0, 0, scanWidth * 2, scanHeight * 2);

    // Draw grid
    zoomCtx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    zoomCtx.lineWidth = 1;
    for (let x = 0; x < scanWidth * 2; x += cellSize * 2) {
        zoomCtx.beginPath();
        zoomCtx.moveTo(x, 0);
        zoomCtx.lineTo(x, scanHeight * 2);
        zoomCtx.stroke();
    }
    for (let y = 0; y < scanHeight * 2; y += cellSize * 2) {
        zoomCtx.beginPath();
        zoomCtx.moveTo(0, y);
        zoomCtx.lineTo(scanWidth * 2, y);
        zoomCtx.stroke();
    }

    const outputPath = `./test-results/weapon-zoom_${path.basename(imagePath).replace('.jpg', '.png')}`;
    fs.mkdirSync('./test-results', { recursive: true });
    fs.writeFileSync(outputPath, zoomCanvas.toBuffer('image/png'));
    console.log(`\nZoomed image saved: ${outputPath}`);
}

async function main() {
    const testImages = [
        'test-images/gameplay/pc-1080p/level_33_english_forest_early.jpg',
        'test-images/gameplay/pc-1080p/level_803_russian_stress_test.jpg'
    ];

    for (const img of testImages) {
        if (fs.existsSync(img)) {
            await measureWeaponGrid(img);
        }
    }
}

main().catch(console.error);
