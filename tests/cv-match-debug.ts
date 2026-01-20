#!/usr/bin/env node
// Debug: Show exactly what items are detected vs expected
import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
} catch { process.exit(1); }

const gtPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
const gt = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
const itemsPath = path.join(__dirname, '../data/items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

interface TemplateData {
    id: string;
    name: string;
    rarity: string;
    canvas: any;
    width: number;
    height: number;
}

const templates: TemplateData[] = [];

async function loadTemplates(): Promise<void> {
    for (const item of itemsData.items) {
        if (!item.image) continue;
        const tPath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(tPath)) continue;
        try {
            const img = await loadImage(tPath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            templates.push({ id: item.id, name: item.name, rarity: item.rarity, canvas, width: img.width, height: img.height });
        } catch {}
    }
    console.log(`Loaded ${templates.length} templates\n`);
}

// Simplified detection similar to offline-cv-runner
async function detectItems(imagePath: string): Promise<Array<{name: string; confidence: number}>> {
    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const height = img.height;
    const width = img.width;
    const iconSize = Math.round(40 * (height / 720));
    const spacing = Math.round(4 * (height / 720));
    const bottomMargin = Math.round(20 * (height / 720));
    const rowHeight = iconSize + spacing;

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    const sideMargin = Math.round(width * 0.20);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    const positions: Array<{x: number; y: number; w: number; h: number}> = [];
    for (const rowY of rowYPositions) {
        if (rowY < height * 0.75) break;
        const totalWidth = maxItemsPerRow * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * (iconSize + spacing), y: rowY, w: iconSize, h: iconSize });
        }
    }

    const detections: Array<{name: string; confidence: number; pos: string}> = [];

    for (const pos of positions) {
        const cellData = ctx.getImageData(pos.x, pos.y, pos.w, pos.h);

        // Check if empty
        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < cellData.data.length; i += 4) {
            const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
            sum += gray;
            sumSq += gray * gray;
            count++;
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        if (variance < 300 || mean < 40) continue;

        // Find best matching template
        let bestMatch: {name: string; confidence: number} | null = null;
        const margin = Math.round(pos.w * 0.15);
        const cw = pos.w - margin * 2;
        const ch = pos.h - margin * 2;

        // Extract center of cell
        const centerData = ctx.createImageData(cw, ch);
        for (let y = 0; y < ch; y++) {
            for (let x = 0; x < cw; x++) {
                const srcIdx = ((y + margin) * pos.w + (x + margin)) * 4;
                const dstIdx = (y * cw + x) * 4;
                centerData.data[dstIdx] = cellData.data[srcIdx];
                centerData.data[dstIdx + 1] = cellData.data[srcIdx + 1];
                centerData.data[dstIdx + 2] = cellData.data[srcIdx + 2];
                centerData.data[dstIdx + 3] = 255;
            }
        }

        for (const template of templates) {
            // Resize template center
            const tMargin = Math.round(template.width * 0.15);
            const resized = createCanvas(cw, ch);
            const rCtx = resized.getContext('2d');
            rCtx.drawImage(template.canvas, tMargin, tMargin, template.width - tMargin * 2, template.height - tMargin * 2, 0, 0, cw, ch);
            const tData = rCtx.getImageData(0, 0, cw, ch);

            // NCC
            let sum1 = 0, sum2 = 0, sumProd = 0, sumSq1 = 0, sumSq2 = 0, n = 0;
            for (let i = 0; i < centerData.data.length; i += 4) {
                const g1 = (centerData.data[i] + centerData.data[i+1] + centerData.data[i+2]) / 3;
                const g2 = (tData.data[i] + tData.data[i+1] + tData.data[i+2]) / 3;
                sum1 += g1; sum2 += g2; sumProd += g1 * g2; sumSq1 += g1 * g1; sumSq2 += g2 * g2; n++;
            }
            const mean1 = sum1 / n, mean2 = sum2 / n;
            const num = sumProd / n - mean1 * mean2;
            const denom = Math.sqrt((sumSq1 / n - mean1 * mean1) * (sumSq2 / n - mean2 * mean2));
            const ncc = denom > 0 ? (num / denom + 1) / 2 : 0;

            if (ncc > (bestMatch?.confidence || 0.40)) {
                bestMatch = { name: template.name, confidence: ncc };
            }
        }

        if (bestMatch) {
            detections.push({ ...bestMatch, pos: `(${pos.x},${pos.y})` });
        }
    }

    return detections;
}

async function main() {
    await loadTemplates();

    // Test one image
    const testCase = 'pc-1080p/level_21_english_desert_scorpion.jpg';
    const data = gt[testCase];
    const expected = data.items as string[];
    const imagePath = path.join(__dirname, '../test-images/gameplay', testCase);

    console.log('═'.repeat(60));
    console.log(`TEST CASE: ${testCase}`);
    console.log('═'.repeat(60));
    console.log(`\nEXPECTED (${expected.length} items):`);
    const expCounts = new Map<string, number>();
    for (const e of expected) expCounts.set(e, (expCounts.get(e) || 0) + 1);
    for (const [name, count] of [...expCounts.entries()].sort()) {
        console.log(`  ${count}x ${name}`);
    }

    const detected = await detectItems(imagePath);
    console.log(`\nDETECTED (${detected.length} items):`);
    const detCounts = new Map<string, number>();
    for (const d of detected) detCounts.set(d.name, (detCounts.get(d.name) || 0) + 1);
    for (const [name, count] of [...detCounts.entries()].sort()) {
        const isMatch = expCounts.has(name);
        console.log(`  ${count}x ${name} ${isMatch ? '✓' : '✗'} (conf: ${detected.find(d => d.name === name)?.confidence.toFixed(3)})`);
    }

    console.log(`\nMISSING (in expected but not detected):`);
    for (const [name, count] of expCounts) {
        if (!detCounts.has(name)) {
            console.log(`  ${count}x ${name}`);
        }
    }

    console.log(`\nFALSE POSITIVES (detected but not expected):`);
    for (const [name, count] of detCounts) {
        if (!expCounts.has(name)) {
            console.log(`  ${count}x ${name}`);
        }
    }

    // Calculate F1
    let tp = 0;
    for (const [name, count] of detCounts) {
        tp += Math.min(count, expCounts.get(name) || 0);
    }
    const precision = detected.length > 0 ? tp / detected.length : 0;
    const recall = expected.length > 0 ? tp / expected.length : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    console.log(`\nMETRICS:`);
    console.log(`  True Positives: ${tp}`);
    console.log(`  Precision: ${(precision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score: ${(f1 * 100).toFixed(1)}%`);
}

main().catch(console.error);
