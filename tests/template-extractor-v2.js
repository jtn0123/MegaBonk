#!/usr/bin/env node
// Template Extractor V2 - More aggressive extraction with lower thresholds
// Goal: Extract as many unique item templates as possible

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/template-extraction-v2';
const TEMPLATE_DIR = './test-results/extracted-templates-v2';

// Lower quality threshold to capture more items
const QUALITY_THRESHOLD = 0.3;  // Was 0.5
const WIKI_MATCH_THRESHOLD = 0.35;  // Was 0.4

function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    // Detect up to 3 rows
    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y < height * 0.65) continue;

        const sideMargin = Math.round(width * 0.15);
        const cellWidth = iconSize + spacing;
        const maxItemsPerRow = Math.min(22, Math.floor((width - sideMargin * 2) / cellWidth));
        const totalWidth = maxItemsPerRow * cellWidth;
        const startX = Math.round((width - totalWidth) / 2);

        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({
                x: startX + i * cellWidth,
                y,
                width: iconSize,
                height: iconSize,
                row,
                col: i
            });
        }
    }
    return positions;
}

function analyzeCell(imageData) {
    const w = imageData.width, h = imageData.height;
    let sum = 0, sumSq = 0, count = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Edge detection
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
    }

    let edgeSum = 0, edgeCount = 0;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = Math.abs(gray[y*w + x+1] - gray[y*w + x-1]);
            const gy = Math.abs(gray[(y+1)*w + x] - gray[(y-1)*w + x]);
            edgeSum += gx + gy;
            edgeCount++;
        }
    }
    const edgeDensity = edgeSum / edgeCount;

    // Center analysis
    const margin = Math.round(w * 0.2);
    let centerSum = 0, centerSumSq = 0, centerCount = 0;
    for (let y = margin; y < h - margin; y++) {
        for (let x = margin; x < w - margin; x++) {
            const i = (y * w + x) * 4;
            const g = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
            centerSum += g; centerSumSq += g * g; centerCount++;
        }
    }
    const centerVariance = centerSumSq / centerCount - (centerSum / centerCount) ** 2;

    const isEmpty = variance < 300 || mean < 25;  // Lower threshold

    let quality = 0;
    if (variance >= 400) quality += 0.25;
    else if (variance >= 250) quality += 0.15;
    if (centerVariance >= 300) quality += 0.25;
    else if (centerVariance >= 150) quality += 0.15;
    if (edgeDensity >= 10 && edgeDensity <= 70) quality += 0.25;
    if (mean >= 40 && mean <= 200) quality += 0.25;
    else if (mean >= 25) quality += 0.15;

    return { variance, mean, edgeDensity, centerVariance, isEmpty, quality };
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
            // Try multiple crop strategies
            const strategies = [
                { margin: 0.1 },   // Standard
                { margin: 0.05 },  // Less margin
                { margin: 0.15 }, // More margin
            ];

            // Use standard for now
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

// Calculate color histogram signature for clustering
function getColorSignature(imageData) {
    const bins = { r: new Array(8).fill(0), g: new Array(8).fill(0), b: new Array(8).fill(0) };
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        bins.r[Math.floor(data[i] / 32)]++;
        bins.g[Math.floor(data[i+1] / 32)]++;
        bins.b[Math.floor(data[i+2] / 32)]++;
    }

    // Normalize
    const total = data.length / 4;
    return {
        r: bins.r.map(v => v / total),
        g: bins.g.map(v => v / total),
        b: bins.b.map(v => v / total)
    };
}

function signatureDistance(s1, s2) {
    let dist = 0;
    for (let i = 0; i < 8; i++) {
        dist += Math.abs(s1.r[i] - s2.r[i]);
        dist += Math.abs(s1.g[i] - s2.g[i]);
        dist += Math.abs(s1.b[i] - s2.b[i]);
    }
    return dist;
}

async function main() {
    console.log('=== Template Extractor V2 (Aggressive) ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

    const wikiTemplates = await loadWikiTemplates();
    console.log(`Loaded ${wikiTemplates.size} wiki templates\n`);

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Track all extracted candidates grouped by best wiki match
    const candidates = new Map();
    // Track unmatched high-quality crops
    const unknownCrops = [];

    let totalCells = 0, nonEmptyCells = 0, matchedCells = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);
        const expectedItems = (data.items || []).map(normalizeItemId);

        console.log(`${filename.slice(9, 45)}:`);
        console.log(`  Grid: ${positions.length} slots, Expected: ${expectedItems.length} items`);

        let extracted = 0, matched = 0;

        for (const pos of positions) {
            totalCells++;
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            const stats = analyzeCell(cellData);

            if (stats.isEmpty) continue;
            nonEmptyCells++;

            // Resize to 32x32
            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.1);
            resizeCtx.drawImage(srcCanvas, margin, margin,
                pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            // Match against all wiki templates
            let bestMatch = null;
            let bestScore = 0;
            const allScores = [];

            for (const [itemId, template] of wikiTemplates) {
                const score = calculateNCC(resizedCell, template.imageData);
                allScores.push({ id: itemId, score });
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { id: itemId, name: template.name };
                }
            }

            // Sort to get top matches
            allScores.sort((a, b) => b.score - a.score);
            const topMatches = allScores.slice(0, 3);

            if (bestMatch && bestScore >= WIKI_MATCH_THRESHOLD) {
                matchedCells++;
                const matchedId = bestMatch.id;
                const inGroundTruth = expectedItems.includes(matchedId);

                if (stats.quality >= QUALITY_THRESHOLD) {
                    if (!candidates.has(matchedId)) {
                        candidates.set(matchedId, []);
                    }

                    candidates.get(matchedId).push({
                        source: filename,
                        position: pos,
                        quality: stats.quality,
                        wikiMatch: bestScore,
                        inGroundTruth,
                        topMatches,
                        stats,
                        resizedData: resizedCell,
                        signature: getColorSignature(resizedCell)
                    });

                    extracted++;
                    if (inGroundTruth) matched++;
                }
            } else if (stats.quality >= 0.4) {
                // High quality but no good wiki match - might be a new item or visual variant
                unknownCrops.push({
                    source: filename,
                    position: pos,
                    quality: stats.quality,
                    bestMatch,
                    bestScore,
                    topMatches,
                    stats,
                    resizedData: resizedCell,
                    signature: getColorSignature(resizedCell)
                });
            }
        }

        console.log(`  Extracted: ${extracted}, Matched GT: ${matched}\n`);
    }

    // Summary
    console.log('=== Extraction Summary ===');
    console.log(`Total cells scanned: ${totalCells}`);
    console.log(`Non-empty cells: ${nonEmptyCells}`);
    console.log(`Matched to wiki: ${matchedCells}`);
    console.log(`Unique items found: ${candidates.size}`);
    console.log(`Unknown high-quality crops: ${unknownCrops.length}`);

    // Select best candidate for each item
    console.log('\n=== Extracted Templates ===\n');
    console.log('| Item | Count | Best Q | Best W | In GT |');
    console.log('|------|-------|--------|--------|-------|');

    const selectedTemplates = [];

    for (const [itemId, itemCandidates] of [...candidates.entries()].sort((a, b) => b[1].length - a[1].length)) {
        // Sort by combined score
        itemCandidates.sort((a, b) => {
            const scoreA = a.quality * 0.4 + a.wikiMatch * 0.4 + (a.inGroundTruth ? 0.2 : 0);
            const scoreB = b.quality * 0.4 + b.wikiMatch * 0.4 + (b.inGroundTruth ? 0.2 : 0);
            return scoreB - scoreA;
        });

        const best = itemCandidates[0];
        const wikiTemplate = wikiTemplates.get(itemId);
        const gtCount = itemCandidates.filter(c => c.inGroundTruth).length;

        console.log(`| ${(wikiTemplate?.name || itemId).slice(0, 20).padEnd(20)} | ${String(itemCandidates.length).padStart(5)} | ${(best.quality * 100).toFixed(0).padStart(5)}% | ${(best.wikiMatch * 100).toFixed(0).padStart(5)}% | ${String(gtCount).padStart(5)} |`);

        // Save template
        const canvas = createCanvas(32, 32);
        canvas.getContext('2d').putImageData(best.resizedData, 0, 0);
        fs.writeFileSync(path.join(TEMPLATE_DIR, `${itemId}.png`), canvas.toBuffer('image/png'));

        selectedTemplates.push({
            id: itemId,
            name: wikiTemplate?.name || itemId,
            candidateCount: itemCandidates.length,
            gtMatchCount: gtCount,
            bestQuality: best.quality,
            bestWikiMatch: best.wikiMatch,
            source: best.source
        });
    }

    console.log('|------|-------|--------|--------|-------|');

    // Cluster unknown crops
    if (unknownCrops.length > 0) {
        console.log(`\n=== Unknown Crops (${unknownCrops.length}) ===`);
        console.log('These may be items not in wiki or visual variants:\n');

        // Simple clustering by color signature
        const clusters = [];
        for (const crop of unknownCrops) {
            let foundCluster = false;
            for (const cluster of clusters) {
                const dist = signatureDistance(crop.signature, cluster.centroid);
                if (dist < 0.5) {
                    cluster.items.push(crop);
                    foundCluster = true;
                    break;
                }
            }
            if (!foundCluster) {
                clusters.push({ centroid: crop.signature, items: [crop] });
            }
        }

        console.log(`Clustered into ${clusters.length} groups`);
        for (let i = 0; i < Math.min(5, clusters.length); i++) {
            const cluster = clusters[i];
            console.log(`  Cluster ${i+1}: ${cluster.items.length} items, best match: ${cluster.items[0].bestMatch?.name || 'unknown'} (${(cluster.items[0].bestScore * 100).toFixed(0)}%)`);
        }
    }

    // Final stats
    const avgQuality = selectedTemplates.reduce((s, t) => s + t.bestQuality, 0) / selectedTemplates.length;
    const avgWikiMatch = selectedTemplates.reduce((s, t) => s + t.bestWikiMatch, 0) / selectedTemplates.length;
    const totalGTMatches = selectedTemplates.reduce((s, t) => s + t.gtMatchCount, 0);

    console.log(`\n=== Final Stats ===`);
    console.log(`Templates extracted: ${selectedTemplates.length}`);
    console.log(`Average quality: ${(avgQuality * 100).toFixed(1)}%`);
    console.log(`Average wiki match: ${(avgWikiMatch * 100).toFixed(1)}%`);
    console.log(`Total ground truth matches: ${totalGTMatches}`);

    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'extraction-results.json'),
        JSON.stringify({
            summary: {
                totalCells,
                nonEmptyCells,
                matchedCells,
                uniqueItems: selectedTemplates.length,
                unknownCrops: unknownCrops.length,
                avgQuality,
                avgWikiMatch,
                totalGTMatches
            },
            templates: selectedTemplates
        }, null, 2)
    );

    console.log(`\nTemplates saved to: ${TEMPLATE_DIR}/`);
    console.log(`Results saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
