#!/usr/bin/env node
// Build optimal template set by filtering to only templates that match ground truth well

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const V2_DIR = './test-results/extracted-templates-v2';
const OUTPUT_DIR = './test-results/optimal-templates';

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

function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y < height * 0.65) continue;
        const sideMargin = Math.round(width * 0.15);
        const cellWidth = iconSize + spacing;
        const maxItemsPerRow = Math.min(22, Math.floor((width - sideMargin * 2) / cellWidth));
        const totalWidth = maxItemsPerRow * cellWidth;
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function normalizeItemId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function loadV2Templates() {
    const templates = new Map();
    if (!fs.existsSync(V2_DIR)) return templates;

    const files = fs.readdirSync(V2_DIR).filter(f => f.endsWith('.png'));
    for (const file of files) {
        const itemId = file.replace('.png', '');
        try {
            const img = await loadImage(path.join(V2_DIR, file));
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            templates.set(itemId, { name: itemId, imageData: ctx.getImageData(0, 0, 32, 32) });
        } catch {}
    }
    return templates;
}

async function main() {
    console.log('=== Building Optimal Template Set ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const templates = await loadV2Templates();
    console.log(`Loaded ${templates.size} V2 templates`);

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Get all unique expected items from ground truth
    const allExpectedItems = new Set();
    for (const [filename, data] of testCases) {
        for (const item of (data.items || [])) {
            allExpectedItems.add(normalizeItemId(item));
        }
    }
    console.log(`Ground truth has ${allExpectedItems.size} unique items\n`);

    // Test each template to see if it correctly identifies GT items
    const templateStats = new Map();

    for (const [templateId, template] of templates) {
        templateStats.set(templateId, { tp: 0, fp: 0, fn: 0, avgMatchScore: 0, matchScores: [] });
    }

    // For each test image, find cells that match ground truth and see which templates detect them
    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);
        const expectedItems = (data.items || []).map(normalizeItemId);
        const expectedCounts = new Map();
        for (const item of expectedItems) {
            expectedCounts.set(item, (expectedCounts.get(item) || 0) + 1);
        }

        const detectedCounts = new Map();

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < cellData.data.length; i += 4) {
                const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;
            if (variance < 350) continue;

            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.1);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            let bestMatch = null, bestScore = 0;
            for (const [itemId, template] of templates) {
                const score = calculateNCC(resizedCell, template.imageData);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = itemId;
                }
            }

            if (bestMatch && bestScore >= 0.55) {
                detectedCounts.set(bestMatch, (detectedCounts.get(bestMatch) || 0) + 1);
                const stats = templateStats.get(bestMatch);
                stats.matchScores.push(bestScore);
            }
        }

        // Update TP/FP/FN for each template
        for (const [templateId, stats] of templateStats) {
            const detected = detectedCounts.get(templateId) || 0;
            const expected = expectedCounts.get(templateId) || 0;

            if (expected > 0 && detected > 0) {
                stats.tp += Math.min(expected, detected);
            }
            if (detected > expected) {
                stats.fp += detected - expected;
            }
            if (expected > detected) {
                stats.fn += expected - detected;
            }
        }
    }

    // Calculate F1 and precision for each template
    const templateScores = [];
    for (const [templateId, stats] of templateStats) {
        const precision = stats.tp / (stats.tp + stats.fp) || 0;
        const recall = stats.tp / (stats.tp + stats.fn) || 0;
        const f1 = 2 * precision * recall / (precision + recall) || 0;
        const avgScore = stats.matchScores.length > 0
            ? stats.matchScores.reduce((a, b) => a + b, 0) / stats.matchScores.length
            : 0;

        templateScores.push({
            id: templateId,
            tp: stats.tp,
            fp: stats.fp,
            fn: stats.fn,
            precision,
            recall,
            f1,
            avgMatchScore: avgScore,
            inGroundTruth: allExpectedItems.has(templateId)
        });
    }

    // Sort by F1 score
    templateScores.sort((a, b) => b.f1 - a.f1);

    console.log('=== Template Performance ===\n');
    console.log('| Template | TP | FP | FN | Prec | Recall | F1 | In GT |');
    console.log('|----------|----|----|-------|------|--------|-----|-------|');

    const goodTemplates = [];

    for (const t of templateScores.slice(0, 30)) {
        const inGT = t.inGroundTruth ? '✓' : '';
        console.log(`| ${t.id.slice(0, 18).padEnd(18)} | ${String(t.tp).padStart(2)} | ${String(t.fp).padStart(2)} | ${String(t.fn).padStart(5)} | ${(t.precision * 100).toFixed(0).padStart(3)}% | ${(t.recall * 100).toFixed(0).padStart(5)}% | ${(t.f1 * 100).toFixed(0).padStart(2)}% | ${inGT.padStart(5)} |`);

        // Keep templates with F1 > 0 OR they're in ground truth and have some TPs
        if (t.f1 > 0 || (t.inGroundTruth && t.tp > 0)) {
            goodTemplates.push(t);
        }
    }

    console.log('|----------|----|----|-------|------|--------|-----|-------|\n');

    // Also include any template that's in ground truth and has reasonable precision
    for (const t of templateScores) {
        if (!goodTemplates.find(g => g.id === t.id) && t.inGroundTruth && t.precision > 0.1) {
            goodTemplates.push(t);
        }
    }

    // Copy good templates to output directory
    console.log(`\nSelected ${goodTemplates.length} optimal templates:\n`);

    for (const t of goodTemplates) {
        const srcPath = path.join(V2_DIR, `${t.id}.png`);
        const dstPath = path.join(OUTPUT_DIR, `${t.id}.png`);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, dstPath);
            console.log(`  ✓ ${t.id} (F1: ${(t.f1 * 100).toFixed(0)}%, TP: ${t.tp})`);
        }
    }

    // Save metadata
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'template-stats.json'),
        JSON.stringify({
            totalTemplates: goodTemplates.length,
            templates: goodTemplates
        }, null, 2)
    );

    console.log(`\nOptimal templates saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
