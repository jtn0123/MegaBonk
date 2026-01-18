#!/usr/bin/env node
// Semi-automated template extraction tool
// Extracts high-confidence in-game crops that can be verified and used as templates

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/template-extraction';
const TEMPLATE_DIR = './test-results/extracted-templates';

// Grid detection (from unified analyzer)
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
            positions.push({ x: startX + i * cellWidth, y: rowY, width: iconSize, height: iconSize, row: rowYPositions.indexOf(rowY), col: i });
        }
    }
    return positions;
}

// Analyze cell quality
function analyzeCell(imageData) {
    const w = imageData.width, h = imageData.height;
    let sum = 0, sumSq = 0, count = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Calculate edge content (good templates have clear edges)
    let edgeSum = 0, edgeCount = 0;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
    }

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = Math.abs(gray[y*w + x+1] - gray[y*w + x-1]);
            const gy = Math.abs(gray[(y+1)*w + x] - gray[(y-1)*w + x]);
            edgeSum += gx + gy;
            edgeCount++;
        }
    }

    const edgeDensity = edgeSum / edgeCount;

    // Center variance (good items have content in center)
    const margin = Math.round(w * 0.2);
    let centerSum = 0, centerSumSq = 0, centerCount = 0;
    for (let y = margin; y < h - margin; y++) {
        for (let x = margin; x < w - margin; x++) {
            const i = (y * w + x) * 4;
            const g = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
            centerSum += g; centerSumSq += g * g; centerCount++;
        }
    }
    const centerMean = centerSum / centerCount;
    const centerVariance = centerSumSq / centerCount - centerMean * centerMean;

    return {
        variance,
        mean,
        edgeDensity,
        centerVariance,
        centerMean,
        isEmpty: variance < 350 || mean < 30,
        quality: calculateQualityScore(variance, centerVariance, edgeDensity, mean)
    };
}

function calculateQualityScore(variance, centerVariance, edgeDensity, mean) {
    // Higher quality = good template candidate
    // Want: high variance, high center variance, moderate edge density, reasonable brightness
    let score = 0;

    // Variance in good range (not too low, not too high)
    if (variance >= 500 && variance <= 3000) score += 0.25;
    else if (variance >= 350) score += 0.1;

    // Center should have content
    if (centerVariance >= 400) score += 0.25;
    else if (centerVariance >= 200) score += 0.1;

    // Edge density (clear outlines)
    if (edgeDensity >= 15 && edgeDensity <= 60) score += 0.25;

    // Brightness (not too dark, not too bright)
    if (mean >= 50 && mean <= 180) score += 0.25;
    else if (mean >= 30) score += 0.1;

    return score;
}

// NCC matching against wiki templates
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
            templates.set(item.id, {
                name: item.name,
                imageData: ctx.getImageData(0, 0, 32, 32)
            });
        } catch {}
    }

    return templates;
}

function normalizeItemId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
    console.log('=== Semi-Automated Template Extraction ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

    const wikiTemplates = await loadWikiTemplates();
    console.log(`Loaded ${wikiTemplates.size} wiki templates for reference matching\n`);

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Track all extracted candidates
    const candidates = new Map(); // itemId -> [{crop, quality, source, wikiMatch}]

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);
        const expectedItems = data.items.map(normalizeItemId);

        console.log(`\n${filename.slice(9, 40)}: ${expectedItems.length} expected items`);

        // Count items per position
        const itemCounts = new Map();
        for (const item of expectedItems) {
            itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
        }

        // Extract cells and try to match to ground truth
        let extractedCount = 0;

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            const stats = analyzeCell(cellData);

            if (stats.isEmpty) continue;

            // Resize to 32x32 for matching
            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.12);
            resizeCtx.drawImage(srcCanvas, margin, margin,
                pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            // Match against wiki templates
            let bestMatch = null;
            let bestScore = 0;

            for (const [itemId, template] of wikiTemplates) {
                const score = calculateNCC(resizedCell, template.imageData);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { id: itemId, name: template.name };
                }
            }

            // If we have a reasonable match AND it's in ground truth
            if (bestMatch && bestScore >= 0.4) {
                const matchedId = bestMatch.id;
                const inGroundTruth = expectedItems.includes(matchedId);

                if (inGroundTruth && stats.quality >= 0.5) {
                    // Good candidate for template
                    if (!candidates.has(matchedId)) {
                        candidates.set(matchedId, []);
                    }

                    candidates.get(matchedId).push({
                        source: filename,
                        position: pos,
                        quality: stats.quality,
                        wikiMatch: bestScore,
                        stats,
                        resizedData: resizedCell
                    });

                    extractedCount++;
                }
            }
        }

        console.log(`  Extracted ${extractedCount} high-quality candidates`);
    }

    // Select best candidate for each item
    console.log('\n=== Best Template Candidates ===\n');
    console.log('| Item | Candidates | Best Quality | Best Wiki Match |');
    console.log('|------|------------|--------------|-----------------|');

    const selectedTemplates = [];

    for (const [itemId, itemCandidates] of candidates) {
        // Sort by combined score (quality + wiki match)
        itemCandidates.sort((a, b) => {
            const scoreA = a.quality * 0.6 + a.wikiMatch * 0.4;
            const scoreB = b.quality * 0.6 + b.wikiMatch * 0.4;
            return scoreB - scoreA;
        });

        const best = itemCandidates[0];
        const wikiTemplate = wikiTemplates.get(itemId);

        console.log(`| ${(wikiTemplate?.name || itemId).padEnd(20)} | ${String(itemCandidates.length).padStart(10)} | ${(best.quality * 100).toFixed(0).padStart(11)}% | ${(best.wikiMatch * 100).toFixed(0).padStart(14)}% |`);

        // Save best candidate as template
        const canvas = createCanvas(32, 32);
        const ctx = canvas.getContext('2d');
        ctx.putImageData(best.resizedData, 0, 0);

        fs.writeFileSync(
            path.join(TEMPLATE_DIR, `${itemId}.png`),
            canvas.toBuffer('image/png')
        );

        selectedTemplates.push({
            id: itemId,
            name: wikiTemplate?.name || itemId,
            candidateCount: itemCandidates.length,
            bestQuality: best.quality,
            bestWikiMatch: best.wikiMatch,
            source: best.source
        });
    }

    console.log('|------|------------|--------------|-----------------|');

    // Summary
    console.log(`\n=== Extraction Summary ===`);
    console.log(`Total unique items with templates: ${candidates.size}`);
    console.log(`Total candidates extracted: ${[...candidates.values()].reduce((s, c) => s + c.length, 0)}`);

    const avgQuality = selectedTemplates.reduce((s, t) => s + t.bestQuality, 0) / selectedTemplates.length;
    const avgWikiMatch = selectedTemplates.reduce((s, t) => s + t.bestWikiMatch, 0) / selectedTemplates.length;

    console.log(`Average best quality: ${(avgQuality * 100).toFixed(1)}%`);
    console.log(`Average wiki match: ${(avgWikiMatch * 100).toFixed(1)}%`);

    // Create verification HTML page
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Template Verification</title>
    <style>
        body { font-family: monospace; background: #1a1a2e; color: #fff; padding: 20px; }
        .template { display: inline-block; margin: 10px; text-align: center; background: #2a2a4e; padding: 10px; border-radius: 8px; }
        .template img { width: 64px; height: 64px; image-rendering: pixelated; }
        .template .name { font-size: 11px; margin-top: 5px; }
        .template .score { font-size: 10px; color: #888; }
        h1, h2 { color: #fff; }
        .stats { background: #2a2a4e; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Extracted Templates</h1>
    <div class="stats">
        <p>Total templates: ${selectedTemplates.length}</p>
        <p>Average quality: ${(avgQuality * 100).toFixed(1)}%</p>
        <p>Average wiki match: ${(avgWikiMatch * 100).toFixed(1)}%</p>
    </div>
    <h2>Templates for Verification</h2>
    <p>Review these templates and delete any incorrect ones.</p>
    ${selectedTemplates.map(t => `
    <div class="template">
        <img src="../extracted-templates/${t.id}.png" alt="${t.name}">
        <div class="name">${t.name}</div>
        <div class="score">Q:${(t.bestQuality*100).toFixed(0)}% W:${(t.bestWikiMatch*100).toFixed(0)}%</div>
    </div>
    `).join('')}
</body>
</html>`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'verification.html'), html);

    // Save metadata
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'extraction-results.json'),
        JSON.stringify({
            summary: {
                totalTemplates: selectedTemplates.length,
                totalCandidates: [...candidates.values()].reduce((s, c) => s + c.length, 0),
                avgQuality,
                avgWikiMatch
            },
            templates: selectedTemplates
        }, null, 2)
    );

    console.log(`\nTemplates saved to: ${TEMPLATE_DIR}/`);
    console.log(`Verification page: ${OUTPUT_DIR}/verification.html`);
}

main().catch(console.error);
