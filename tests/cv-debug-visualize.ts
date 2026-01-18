#!/usr/bin/env node
// Generate debug visualization images showing detections vs ground truth

import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
} catch { console.error('Canvas required'); process.exit(1); }

interface GameItem { id: string; name: string; image?: string; rarity: string; }
interface TemplateData { item: GameItem; canvas: any; imageData: any; width: number; height: number; }

const templateCache = new Map<string, TemplateData>();

// Optimized preprocessing (from scientific testing)
function enhanceContrast(imageData: any, factor: number = 1.5): any {
    const data = new Uint8ClampedArray(imageData.data);
    const midpoint = 128;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, midpoint + (data[i] - midpoint) * factor));
        data[i + 1] = Math.min(255, Math.max(0, midpoint + (data[i + 1] - midpoint) * factor));
        data[i + 2] = Math.min(255, Math.max(0, midpoint + (data[i + 2] - midpoint) * factor));
    }
    return { data, width: imageData.width, height: imageData.height };
}

function normalizeColors(imageData: any): any {
    const data = new Uint8ClampedArray(imageData.data);
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i]); maxR = Math.max(maxR, data[i]);
        minG = Math.min(minG, data[i+1]); maxG = Math.max(maxG, data[i+1]);
        minB = Math.min(minB, data[i+2]); maxB = Math.max(maxB, data[i+2]);
    }
    const rangeR = maxR - minR || 1, rangeG = maxG - minG || 1, rangeB = maxB - minB || 1;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round((data[i] - minR) / rangeR * 255);
        data[i+1] = Math.round((data[i+1] - minG) / rangeG * 255);
        data[i+2] = Math.round((data[i+2] - minB) / rangeB * 255);
    }
    return { data, width: imageData.width, height: imageData.height };
}

function calculateSSIM(img1: any, img2: any): number {
    if (img1.width !== img2.width || img1.height !== img2.height) return 0;
    const data1 = img1.data, data2 = img2.data;
    const n = data1.length / 4;
    let mean1 = 0, mean2 = 0;
    const gray1: number[] = [], gray2: number[] = [];
    for (let i = 0; i < data1.length; i += 4) {
        const g1 = (data1[i] + data1[i+1] + data1[i+2]) / 3;
        const g2 = (data2[i] + data2[i+1] + data2[i+2]) / 3;
        gray1.push(g1); gray2.push(g2);
        mean1 += g1; mean2 += g2;
    }
    mean1 /= n; mean2 /= n;
    let var1 = 0, var2 = 0, covar = 0;
    for (let i = 0; i < n; i++) {
        const d1 = gray1[i] - mean1, d2 = gray2[i] - mean2;
        var1 += d1 * d1; var2 += d2 * d2; covar += d1 * d2;
    }
    var1 /= n; var2 /= n; covar /= n;
    const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
    const ssim = ((2 * mean1 * mean2 + C1) * (2 * covar + C2)) / ((mean1 ** 2 + mean2 ** 2 + C1) * (var1 + var2 + C2));
    return (ssim + 1) / 2;
}

function calculateNCC(d1: any, d2: any): number {
    let sum1 = 0, sum2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    const len = Math.min(d1.data.length, d2.data.length);
    for (let i = 0; i < len; i += 4) {
        const g1 = (d1.data[i] + d1.data[i+1] + d1.data[i+2]) / 3;
        const g2 = (d2.data[i] + d2.data[i+1] + d2.data[i+2]) / 3;
        sum1 += g1; sum2 += g2; sp += g1 * g2; ss1 += g1 * g1; ss2 += g2 * g2; c++;
    }
    const m1 = sum1/c, m2 = sum2/c;
    const num = sp/c - m1*m2;
    const den = Math.sqrt((ss1/c - m1*m1) * (ss2/c - m2*m2));
    return den === 0 ? 0 : (num/den + 1) / 2;
}

async function loadTemplates() {
    if (templateCache.size > 0) return;
    const itemsPath = path.join(__dirname, '../data/items.json');
    const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
    for (const item of itemsData.items) {
        if (!item.image) continue;
        const imagePath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(imagePath)) continue;
        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            templateCache.set(item.id, { item, canvas, imageData: ctx.getImageData(0, 0, img.width, img.height), width: img.width, height: img.height });
        } catch {}
    }
}

function detectGridPositions(width: number, height: number) {
    const iconSize = Math.round(40 * (height / 720));
    const spacing = Math.round(4 * (height / 720));
    const bottomMargin = Math.round(20 * (height / 720));
    const rowHeight = iconSize + spacing;
    const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
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
            positions.push({ x: startX + i * (iconSize + spacing), y: rowY, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function isEmptyCell(imageData: any): boolean {
    const pixels = imageData.data;
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 300 || mean < 40;
}

async function findBestMatch(cellData: any, cellW: number, cellH: number) {
    const margin = Math.round(cellW * 0.15);
    const cw = cellW - margin * 2, ch = cellH - margin * 2;
    if (cw <= 0 || ch <= 0) return null;

    const centerData = { data: new Uint8ClampedArray(cw * ch * 4), width: cw, height: ch };
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const src = ((y + margin) * cellW + (x + margin)) * 4;
            const dst = (y * cw + x) * 4;
            centerData.data[dst] = cellData.data[src];
            centerData.data[dst+1] = cellData.data[src+1];
            centerData.data[dst+2] = cellData.data[src+2];
            centerData.data[dst+3] = cellData.data[src+3];
        }
    }

    // Apply optimized preprocessing
    let processedCell = enhanceContrast(centerData);
    processedCell = normalizeColors(processedCell);

    let bestMatch: { item: GameItem; confidence: number } | null = null;

    for (const template of templateCache.values()) {
        // Resize template
        const tMargin = Math.round(template.width * 0.15);
        const tempCanvas = createCanvas(cw, ch);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(template.canvas, tMargin, tMargin, template.width - tMargin*2, template.height - tMargin*2, 0, 0, cw, ch);
        let templateData = tempCtx.getImageData(0, 0, cw, ch);

        // Apply same preprocessing
        templateData = enhanceContrast(templateData);
        templateData = normalizeColors(templateData);

        const ncc = calculateNCC(processedCell, templateData);
        const ssim = calculateSSIM(processedCell, templateData);
        const similarity = Math.max(ncc, ssim);

        if (!bestMatch || similarity > bestMatch.confidence) {
            bestMatch = { item: template.item, confidence: similarity };
        }
    }

    return bestMatch;
}

async function generateVisualization(testCase: string) {
    console.log(`\nGenerating visualization for: ${testCase}`);

    const gtPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
    const gt = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
    const data = gt[testCase];

    if (!data) { console.log('  Test case not found'); return; }

    const imagePath = path.join(__dirname, '../test-images/gameplay', testCase);
    const image = await loadImage(imagePath);

    // Create output canvas
    const outCanvas = createCanvas(image.width, image.height + 200);
    const outCtx = outCanvas.getContext('2d');

    // Draw original image
    outCtx.drawImage(image, 0, 0);

    // Get detections
    const srcCanvas = createCanvas(image.width, image.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(image, 0, 0);

    const gridPositions = detectGridPositions(image.width, image.height);
    const detections: Array<{ x: number; y: number; w: number; h: number; item: string; conf: number }> = [];

    console.log(`  Grid: ${gridPositions.length} positions`);
    console.log(`  Expected: ${data.items.length} items`);

    let nonEmpty = 0;
    for (const cell of gridPositions) {
        const cellData = srcCtx.getImageData(cell.x, cell.y, cell.width, cell.height);
        if (isEmptyCell(cellData)) continue;
        nonEmpty++;

        const match = await findBestMatch(cellData, cell.width, cell.height);
        if (match && match.confidence >= 0.45) {
            detections.push({ x: cell.x, y: cell.y, w: cell.width, h: cell.height, item: match.item.name, conf: match.confidence });
        }
    }

    console.log(`  Non-empty cells: ${nonEmpty}`);
    console.log(`  Detections: ${detections.length}`);

    // Draw detection boxes
    for (const det of detections) {
        // Check if correct
        const isCorrect = data.items.some((i: string) => i.toLowerCase() === det.item.toLowerCase());

        outCtx.strokeStyle = isCorrect ? '#00ff00' : '#ff0000';
        outCtx.lineWidth = 2;
        outCtx.strokeRect(det.x, det.y, det.w, det.h);

        // Label
        outCtx.fillStyle = isCorrect ? '#00ff00' : '#ff0000';
        outCtx.font = '10px Arial';
        outCtx.fillText(`${det.item.slice(0, 10)}`, det.x, det.y - 2);
    }

    // Draw legend at bottom
    outCtx.fillStyle = '#222';
    outCtx.fillRect(0, image.height, image.width, 200);

    outCtx.fillStyle = '#fff';
    outCtx.font = '14px Arial';
    outCtx.fillText(`Test: ${testCase}`, 10, image.height + 20);
    outCtx.fillText(`Expected: ${data.items.length} items | Detected: ${detections.length}`, 10, image.height + 40);

    // Show expected vs detected
    const expected = [...new Set(data.items)].slice(0, 15).join(', ');
    const detected = [...new Set(detections.map(d => d.item))].slice(0, 15).join(', ');

    outCtx.fillStyle = '#aaa';
    outCtx.font = '12px Arial';
    outCtx.fillText(`Expected: ${expected}...`, 10, image.height + 70);
    outCtx.fillText(`Detected: ${detected}...`, 10, image.height + 90);

    // Correct/incorrect counts
    let correct = 0, incorrect = 0;
    for (const det of detections) {
        if (data.items.some((i: string) => i.toLowerCase() === det.item.toLowerCase())) correct++;
        else incorrect++;
    }

    outCtx.fillStyle = '#0f0';
    outCtx.fillText(`Correct: ${correct}`, 10, image.height + 120);
    outCtx.fillStyle = '#f00';
    outCtx.fillText(`Incorrect: ${incorrect}`, 150, image.height + 120);

    // Save
    const outputPath = path.join(__dirname, '../test-results', `debug_${testCase.replace(/\//g, '_')}.png`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const buffer = outCanvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`  Saved: ${outputPath}`);
}

async function main() {
    console.log('Debug Visualization Generator\n');

    await loadTemplates();
    console.log(`Loaded ${templateCache.size} templates`);

    const gtPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
    const gt = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));

    const testCases = Object.keys(gt).filter(k => !k.startsWith('_'));

    // Generate for first 3 test cases
    for (const tc of testCases.slice(0, 3)) {
        await generateVisualization(tc);
    }

    console.log('\nDone! Check test-results/ for debug images.');
}

main().catch(console.error);
