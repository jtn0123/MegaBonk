#!/usr/bin/env node
// Bootstrap: use seed templates to find more in-game examples

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const SEED_DIR = './training-data/smart-extracted/high-confidence';
const OUTPUT_DIR = './training-data/bootstrapped-templates';

function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    const rowYPositions = [];
    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y >= height * 0.70) rowYPositions.push(y);
    }

    const sideMargin = Math.round(width * 0.15);
    const cellWidth = iconSize + spacing;
    const maxItemsPerRow = Math.min(20, Math.floor((width - sideMargin * 2) / cellWidth));
    const totalWidth = maxItemsPerRow * cellWidth;
    const startX = Math.round((width - totalWidth) / 2);

    for (const rowY of rowYPositions) {
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y: rowY, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function isEmptyCell(imageData) {
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 350 || mean < 30;
}

function calculateNCC(d1, d2) {
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    const len = Math.min(d1.data.length, d2.data.length);
    for (let i = 0; i < len; i += 4) {
        const g1 = (d1.data[i] + d1.data[i+1] + d1.data[i+2]) / 3;
        const g2 = (d2.data[i] + d2.data[i+1] + d2.data[i+2]) / 3;
        s1 += g1; s2 += g2; sp += g1*g2; ss1 += g1*g1; ss2 += g2*g2; c++;
    }
    const m1 = s1/c, m2 = s2/c;
    const num = sp/c - m1*m2;
    const den = Math.sqrt((ss1/c - m1*m1) * (ss2/c - m2*m2));
    return den === 0 ? 0 : (num/den + 1) / 2;
}

async function loadTemplates(dir) {
    const templates = new Map();
    if (!fs.existsSync(dir)) return templates;

    const itemDirs = fs.readdirSync(dir);
    for (const itemId of itemDirs) {
        const itemDir = path.join(dir, itemId);
        if (!fs.statSync(itemDir).isDirectory()) continue;

        const files = fs.readdirSync(itemDir).filter(f => f.endsWith('.png'));
        const variants = [];

        for (const file of files) {
            const img = await loadImage(path.join(itemDir, file));
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            variants.push({
                imageData: ctx.getImageData(0, 0, 32, 32),
                canvas
            });
        }

        if (variants.length > 0) {
            templates.set(itemId, variants);
        }
    }
    return templates;
}

async function loadWikiTemplates() {
    const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
    const templates = new Map();

    for (const item of itemsData.items) {
        if (!item.image) continue;
        const imagePath = path.join('./src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            const margin = Math.round(img.width * 0.1);
            ctx.drawImage(img, margin, margin, img.width - margin*2, img.height - margin*2, 0, 0, 32, 32);
            templates.set(item.id, [{
                imageData: ctx.getImageData(0, 0, 32, 32),
                canvas
            }]);
        } catch {}
    }

    return templates;
}

async function bootstrap() {
    console.log('=== Template Bootstrapping ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Load existing seed templates
    let seedTemplates = await loadTemplates(SEED_DIR);
    const wikiTemplates = await loadWikiTemplates();

    console.log(`Initial seed templates: ${seedTemplates.size} items`);
    console.log(`Wiki templates: ${wikiTemplates.size} items\n`);

    // Load ground truth
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Build item ID to name mapping
    const itemNames = new Map();
    for (const [_, data] of testCases) {
        for (const item of data.items) {
            const id = item.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            itemNames.set(id, item);
        }
    }

    // Track new candidates
    const newCandidates = new Map(); // itemId -> array of { canvas, score, source }

    // Process each test image
    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        // Expected items for this image
        const expectedItems = data.items.map(item =>
            item.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        );
        const expectedCounts = new Map();
        expectedItems.forEach(id => expectedCounts.set(id, (expectedCounts.get(id) || 0) + 1));

        // Extract cells
        const cells = [];
        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            if (isEmptyCell(cellData)) continue;

            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.12);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);

            cells.push({
                canvas: resizeCanvas,
                imageData: resizeCtx.getImageData(0, 0, 32, 32)
            });
        }

        // For each cell, find best match against wiki templates
        for (const cell of cells) {
            let bestMatch = null;
            let bestScore = 0;

            for (const [itemId, variants] of wikiTemplates) {
                for (const v of variants) {
                    const score = calculateNCC(cell.imageData, v.imageData);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = itemId;
                    }
                }
            }

            // If item is in expected AND score is decent, consider it a candidate
            if (bestMatch && expectedCounts.has(bestMatch) && bestScore > 0.40) {
                if (!newCandidates.has(bestMatch)) {
                    newCandidates.set(bestMatch, []);
                }
                newCandidates.get(bestMatch).push({
                    canvas: cell.canvas,
                    score: bestScore,
                    source: filename
                });
            }
        }
    }

    // Process candidates - keep items with multiple high-scoring examples
    console.log('Candidate analysis:');
    const acceptedItems = new Map();

    for (const [itemId, candidates] of newCandidates) {
        // Sort by score
        candidates.sort((a, b) => b.score - a.score);

        const avgScore = candidates.reduce((s, c) => s + c.score, 0) / candidates.length;
        const bestScore = candidates[0].score;

        // Accept if: multiple examples OR high single score, AND not already in seeds
        const shouldAccept = !seedTemplates.has(itemId) && (
            (candidates.length >= 2 && avgScore > 0.42) ||
            (candidates.length >= 3 && avgScore > 0.38) ||
            (bestScore > 0.55)
        );

        const status = shouldAccept ? '✓ ACCEPT' : '  skip';
        console.log(`  ${itemId}: ${candidates.length} examples, best=${(bestScore*100).toFixed(1)}%, avg=${(avgScore*100).toFixed(1)}% ${status}`);

        if (shouldAccept) {
            // Keep top 3 examples
            acceptedItems.set(itemId, candidates.slice(0, 3));
        }
    }

    // Combine seed + accepted
    const finalTemplates = new Map();

    // Copy seeds
    for (const [id, variants] of seedTemplates) {
        const itemDir = path.join(OUTPUT_DIR, id);
        fs.mkdirSync(itemDir, { recursive: true });

        const canvases = [];
        for (let i = 0; i < variants.length; i++) {
            fs.writeFileSync(
                path.join(itemDir, `${id}_seed${i}.png`),
                variants[i].canvas.toBuffer('image/png')
            );
            canvases.push(variants[i]);
        }
        finalTemplates.set(id, canvases);
    }

    // Add accepted
    for (const [id, candidates] of acceptedItems) {
        const itemDir = path.join(OUTPUT_DIR, id);
        fs.mkdirSync(itemDir, { recursive: true });

        const canvases = finalTemplates.get(id) || [];
        for (let i = 0; i < candidates.length; i++) {
            fs.writeFileSync(
                path.join(itemDir, `${id}_boot${i}.png`),
                candidates[i].canvas.toBuffer('image/png')
            );
            canvases.push({ canvas: candidates[i].canvas });
        }
        finalTemplates.set(id, canvases);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('BOOTSTRAP RESULTS');
    console.log('='.repeat(50));
    console.log(`\nOriginal seed items: ${seedTemplates.size}`);
    console.log(`New accepted items: ${acceptedItems.size}`);
    console.log(`Total items with in-game templates: ${finalTemplates.size}`);

    // Count coverage
    const allExpectedItems = new Map();
    for (const [_, data] of testCases) {
        for (const item of data.items) {
            const id = item.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            allExpectedItems.set(id, (allExpectedItems.get(id) || 0) + 1);
        }
    }

    let covered = 0, uncovered = 0;
    for (const [id, count] of allExpectedItems) {
        if (finalTemplates.has(id)) {
            covered += count;
        } else {
            uncovered += count;
        }
    }

    console.log(`\nGround truth coverage: ${covered}/${covered + uncovered} items (${(covered/(covered+uncovered)*100).toFixed(1)}%)`);
    console.log(`\nTemplates saved to: ${OUTPUT_DIR}/`);

    // Run quick test
    console.log('\n--- Quick Matching Test ---');

    let tp = 0, fp = 0, fn = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        const truth = new Map();
        data.items.forEach(item => {
            const id = item.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            truth.set(id, (truth.get(id) || 0) + 1);
        });

        const detections = new Map();

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            if (isEmptyCell(cellData)) continue;

            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.12);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            let bestMatch = null;
            let bestScore = 0;

            for (const [itemId, variants] of finalTemplates) {
                for (const v of variants) {
                    const vData = v.imageData || v.canvas.getContext('2d').getImageData(0, 0, 32, 32);
                    const score = calculateNCC(resizedCell, vData);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = itemId;
                    }
                }
            }

            if (bestMatch && bestScore >= 0.50) {
                detections.set(bestMatch, (detections.get(bestMatch) || 0) + 1);
            }
        }

        detections.forEach((count, id) => {
            const expected = truth.get(id) || 0;
            tp += Math.min(count, expected);
            if (count > expected) fp += count - expected;
        });
        truth.forEach((count, id) => {
            const detected = detections.get(id) || 0;
            if (detected < count) fn += count - detected;
        });
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    console.log(`Bootstrapped templates F1: ${(f1*100).toFixed(1)}%`);
    console.log(`  Precision: ${(precision*100).toFixed(1)}%`);
    console.log(`  Recall: ${(recall*100).toFixed(1)}%`);
}

bootstrap().catch(console.error);
