#!/usr/bin/env node
// Debug analysis - understand WHY matching is failing

import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
} catch { process.exit(1); }

async function analyzeOneImage() {
    // Load ground truth
    const gtPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
    const gt = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));

    // Use easiest test case
    const testCase = 'pc-1080p/level_21_english_desert_scorpion.jpg';
    const data = gt[testCase];

    console.log('='.repeat(60));
    console.log('DEBUG ANALYSIS: Why is matching failing?');
    console.log('='.repeat(60));
    console.log(`\nTest case: ${testCase}`);
    console.log(`Resolution: ${data.resolution}`);
    console.log(`Expected items: ${data.items.length}`);
    console.log(`Items: ${data.items.slice(0, 5).join(', ')}...`);

    // Load image
    const imgPath = path.join(__dirname, '../test-images/gameplay', testCase);
    const image = await loadImage(imgPath);
    console.log(`\nActual image size: ${image.width}x${image.height}`);

    // Calculate grid positions (same as CV runner)
    const width = image.width;
    const height = image.height;
    const iconSize = Math.round(40 * (height / 720));
    const spacing = Math.round(4 * (height / 720));
    const bottomMargin = Math.round(20 * (height / 720));
    const rowHeight = iconSize + spacing;

    console.log(`\nGrid parameters:`);
    console.log(`  Icon size: ${iconSize}px`);
    console.log(`  Spacing: ${spacing}px`);
    console.log(`  Bottom margin: ${bottomMargin}px`);

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    console.log(`\nRow Y positions (from top):`);
    rowYPositions.forEach((y, i) => {
        const valid = y >= height * 0.75;
        console.log(`  Row ${i+1}: y=${y} (${valid ? 'valid' : 'SKIPPED - above 75% threshold'})`);
    });

    // Load templates and check sizes
    const itemsPath = path.join(__dirname, '../data/items.json');
    const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

    // Sample some template sizes
    console.log(`\nTemplate sizes (sample):`);
    let templateCount = 0;
    const sizes: number[] = [];

    for (const item of itemsData.items.slice(0, 10)) {
        if (!item.image) continue;
        const tPath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(tPath)) continue;

        try {
            const tImg = await loadImage(tPath);
            sizes.push(tImg.width);
            console.log(`  ${item.name}: ${tImg.width}x${tImg.height}`);
            templateCount++;
        } catch {}
    }

    const avgTemplateSize = sizes.reduce((a,b) => a+b, 0) / sizes.length;
    console.log(`\nAverage template size: ${avgTemplateSize.toFixed(0)}px`);
    console.log(`Expected cell size: ${iconSize}px`);
    console.log(`Scale ratio: ${(iconSize / avgTemplateSize).toFixed(2)}x`);

    // Check expected items against actual template names
    console.log(`\n${'='.repeat(60)}`);
    console.log('ITEM NAME MATCHING:');
    console.log('='.repeat(60));

    const templateNames = new Set(itemsData.items.map((i: any) => i.name.toLowerCase()));
    const templateIds = new Set(itemsData.items.map((i: any) => i.id));

    for (const expectedItem of [...new Set(data.items)]) {
        const lower = expectedItem.toLowerCase();
        const id = lower.replace(/[^a-z0-9]+/g, '-');
        const hasName = templateNames.has(lower);
        const hasId = templateIds.has(id);

        if (!hasName && !hasId) {
            console.log(`  ❌ "${expectedItem}" - NO MATCHING TEMPLATE`);
            // Try fuzzy match
            const partial = [...templateNames].filter(n => n.includes(lower.split(' ')[0]));
            if (partial.length > 0) {
                console.log(`     Possible matches: ${partial.join(', ')}`);
            }
        } else {
            console.log(`  ✓ "${expectedItem}"`);
        }
    }

    // What are the actual template names?
    console.log(`\n${'='.repeat(60)}`);
    console.log('AVAILABLE TEMPLATES (sample):');
    console.log('='.repeat(60));
    itemsData.items.slice(0, 20).forEach((item: any) => {
        console.log(`  ${item.id}: "${item.name}" (${item.rarity})`);
    });
}

analyzeOneImage().catch(console.error);
