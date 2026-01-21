#!/usr/bin/env node
/**
 * Test Auto-Grid Detection
 * Runs the auto-detection algorithm against ground-truth images
 * and compares detected cell counts to expected item counts.
 */

const fs = require('fs');
const path = require('path');

// Check for canvas support
let createCanvas, loadImage;
try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
    loadImage = canvasModule.loadImage;
} catch (_e) {
    console.error('Error: canvas module not available. Run: npm install canvas');
    process.exit(1);
}

// Paths
const GT_PATH = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
const IMAGES_BASE = path.join(__dirname, '../test-images/gameplay');

// Load ground truth
const groundTruth = JSON.parse(fs.readFileSync(GT_PATH, 'utf8'));

// ========================================
// Port the auto-detection algorithm from JS module
// ========================================

const RARITY_BORDER_COLORS = {
    common: {
        name: 'common',
        rgb: { r: [100, 200], g: [100, 200], b: [100, 200] },
    },
    uncommon: {
        name: 'uncommon',
        rgb: { r: [30, 150], g: [120, 255], b: [30, 150] },
    },
    rare: {
        name: 'rare',
        rgb: { r: [30, 150], g: [80, 200], b: [150, 255] },
    },
    epic: {
        name: 'epic',
        rgb: { r: [120, 220], g: [30, 150], b: [150, 255] },
    },
    legendary: {
        name: 'legendary',
        rgb: { r: [200, 255], g: [100, 220], b: [20, 120] },
    },
};

function detectRarityAtPixel(r, g, b) {
    for (const [rarity, def] of Object.entries(RARITY_BORDER_COLORS)) {
        if (
            r >= def.rgb.r[0] &&
            r <= def.rgb.r[1] &&
            g >= def.rgb.g[0] &&
            g <= def.rgb.g[1] &&
            b >= def.rgb.b[0] &&
            b <= def.rgb.b[1]
        ) {
            return rarity;
        }
    }
    return null;
}

function detectHotbarBand(ctx, width, height) {
    // Scan bottom 30% of screen
    const scanStartY = Math.floor(height * 0.7);

    // Only sample center 70% of width (where hotbar items are)
    const sampleStartX = Math.floor(width * 0.15);
    const sampleWidth = Math.floor(width * 0.7);

    const stripHeight = 2;
    const stripData = [];

    for (let y = scanStartY; y < height - stripHeight; y += stripHeight) {
        const imageData = ctx.getImageData(sampleStartX, y, sampleWidth, stripHeight);
        const pixels = imageData.data;

        let totalBrightness = 0;
        let totalVariance = 0;
        let colorfulPixels = 0;
        let rarityBorderPixels = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 16) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;

            const mean = brightness;
            const variance = Math.pow(r - mean, 2) + Math.pow(g - mean, 2) + Math.pow(b - mean, 2);
            totalVariance += variance;

            const saturation = Math.max(r, g, b) - Math.min(r, g, b);
            if (saturation > 50) colorfulPixels++;

            if (detectRarityAtPixel(r, g, b)) {
                rarityBorderPixels++;
            }

            count++;
        }

        stripData.push({
            y,
            avgBrightness: totalBrightness / count,
            avgVariance: totalVariance / count,
            colorfulRatio: colorfulPixels / count,
            rarityRatio: rarityBorderPixels / count,
        });
    }

    let bestBandStart = -1;
    let bestBandEnd = height;
    let bestScore = 0;

    // INCREASED window size: 35 strips × 2px = ~70px
    const windowSize = 35;

    for (let i = 0; i < stripData.length - windowSize; i++) {
        const windowSlice = stripData.slice(i, i + windowSize);

        const avgBrightness = windowSlice.reduce((s, d) => s + d.avgBrightness, 0) / windowSlice.length;
        const avgVariance = windowSlice.reduce((s, d) => s + d.avgVariance, 0) / windowSlice.length;
        const avgColorful = windowSlice.reduce((s, d) => s + d.colorfulRatio, 0) / windowSlice.length;
        const avgRarity = windowSlice.reduce((s, d) => s + d.rarityRatio, 0) / windowSlice.length;

        let score = 0;

        if (avgBrightness >= 25 && avgBrightness <= 160) {
            score += 25;
        }
        if (avgVariance > 200) {
            score += Math.min(35, avgVariance / 40);
        }
        if (avgColorful > 0.03) {
            score += avgColorful * 80;
        }
        if (avgRarity > 0.01) {
            score += avgRarity * 150;
        }

        const yPosition = windowSlice[0].y / height;
        if (yPosition > 0.88) {
            score += 25;
        } else if (yPosition > 0.82) {
            score += 15;
        }

        if (score > bestScore) {
            bestScore = score;
            bestBandStart = windowSlice[0].y;
            bestBandEnd = windowSlice[windowSlice.length - 1].y + stripHeight;
        }
    }

    if (bestBandStart === -1) {
        bestBandStart = Math.floor(height * 0.88);
        bestBandEnd = height - 5;
    }

    // Constrain band height - hotbar is typically 1-2 icon rows (~60-120px at 1080p)
    const maxBandHeight = Math.floor(height * 0.12);
    const minBandHeight = Math.floor(height * 0.06);

    const currentHeight = bestBandEnd - bestBandStart;
    if (currentHeight > maxBandHeight) {
        bestBandStart = bestBandEnd - maxBandHeight;
    }

    if (bestBandEnd - bestBandStart < minBandHeight) {
        bestBandStart = bestBandEnd - minBandHeight;
    }

    return {
        topY: bestBandStart,
        bottomY: bestBandEnd,
        height: bestBandEnd - bestBandStart,
        confidence: Math.min(1, bestScore / 100),
    };
}

function detectRarityBorders(ctx, width, bandRegion) {
    const { topY, bottomY } = bandRegion;
    const bandHeight = bottomY - topY;

    // RESTRICT: Only scan center 70% of width
    const scanStartX = Math.floor(width * 0.15);
    const scanEndX = Math.floor(width * 0.85);

    const scanLines = [
        topY + Math.floor(bandHeight * 0.05),
        topY + Math.floor(bandHeight * 0.15),
        topY + Math.floor(bandHeight * 0.3),
        topY + Math.floor(bandHeight * 0.5),
        topY + Math.floor(bandHeight * 0.7),
        topY + Math.floor(bandHeight * 0.85),
        topY + Math.floor(bandHeight * 0.95),
    ];

    const allEdges = [];

    for (const scanY of scanLines) {
        if (scanY >= ctx.canvas.height) continue;

        const lineData = ctx.getImageData(scanStartX, scanY, scanEndX - scanStartX, 1);
        const pixels = lineData.data;

        let inBorder = false;
        let borderStart = -1;
        let currentRarity = null;

        for (let localX = 0; localX < scanEndX - scanStartX; localX++) {
            const x = localX + scanStartX;
            const idx = localX * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            const rarity = detectRarityAtPixel(r, g, b);

            if (rarity && !inBorder) {
                inBorder = true;
                borderStart = x;
                currentRarity = rarity;
            } else if (!rarity && inBorder) {
                const borderWidth = x - borderStart;

                if (borderWidth >= 2 && borderWidth <= 8) {
                    allEdges.push({
                        x: borderStart,
                        endX: x,
                        y: scanY,
                        width: borderWidth,
                        rarity: currentRarity,
                    });
                }

                inBorder = false;
                currentRarity = null;
            }
        }
    }

    // Cluster edges
    let clusteredEdges = clusterEdgesByX(allEdges, 6);

    // Filter by vertical consistency (true borders appear at multiple Y levels)
    clusteredEdges = filterByVerticalConsistency(clusteredEdges, 2);

    // Apply spacing consistency filter
    clusteredEdges = filterBySpacingConsistency(clusteredEdges);

    return {
        edges: clusteredEdges,
        allEdges,
    };
}

function filterBySpacingConsistency(edges) {
    if (edges.length < 3) return edges;

    const gaps = [];
    for (let i = 1; i < edges.length; i++) {
        const gap = edges[i].x - edges[i - 1].x;
        if (gap > 0 && gap < 150) {
            gaps.push({ gap, fromIdx: i - 1, toIdx: i });
        }
    }

    if (gaps.length < 2) return edges;

    const gapCounts = new Map();
    const tolerance = 4;

    for (const { gap } of gaps) {
        const bucket = Math.round(gap / tolerance) * tolerance;
        gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
    }

    let modeGap = 0;
    let modeCount = 0;
    for (const [bucket, count] of gapCounts) {
        if (count > modeCount) {
            modeCount = count;
            modeGap = bucket;
        }
    }

    // Require at least 3 consistent spacings to be confident
    if (modeCount < 3) return edges;

    const consistentEdgeIndices = new Set();

    for (const { gap, fromIdx, toIdx } of gaps) {
        if (Math.abs(gap - modeGap) <= tolerance) {
            consistentEdgeIndices.add(fromIdx);
            consistentEdgeIndices.add(toIdx);
        }
    }

    // Check multiples of mode (skipped cells)
    for (const { gap, fromIdx, toIdx } of gaps) {
        const multiplier = Math.round(gap / modeGap);
        if (multiplier >= 2 && multiplier <= 4) {
            const expectedGap = modeGap * multiplier;
            if (Math.abs(gap - expectedGap) <= tolerance * multiplier) {
                consistentEdgeIndices.add(fromIdx);
                consistentEdgeIndices.add(toIdx);
            }
        }
    }

    const filtered = edges.filter((_, idx) => consistentEdgeIndices.has(idx));

    if (filtered.length < 3 && edges.length >= 3) {
        return edges;
    }

    return filtered;
}

function clusterEdgesByX(edges, tolerance) {
    if (edges.length === 0) return [];

    const sorted = [...edges].sort((a, b) => a.x - b.x);
    const clusters = [];
    let currentCluster = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const edge = sorted[i];
        const lastEdge = currentCluster[currentCluster.length - 1];

        if (edge.x - lastEdge.x <= tolerance) {
            currentCluster.push(edge);
        } else {
            clusters.push(processCluster(currentCluster));
            currentCluster = [edge];
        }
    }

    if (currentCluster.length > 0) {
        clusters.push(processCluster(currentCluster));
    }

    return clusters;
}

function processCluster(edges) {
    const avgX = Math.round(edges.reduce((s, e) => s + e.x, 0) / edges.length);
    const avgWidth = Math.round(edges.reduce((s, e) => s + e.width, 0) / edges.length);

    // Require edges to appear in at least 2 scan lines (vertical consistency)
    // True item borders appear at multiple Y positions, random elements don't
    const uniqueYs = new Set(edges.map(e => e.y));
    const verticalConsistency = uniqueYs.size;

    return {
        x: avgX,
        borderWidth: avgWidth,
        confidence: edges.length / 7,
        detections: edges.length,
        verticalConsistency,
    };
}

// Filter clusters to keep only those with vertical consistency
function filterByVerticalConsistency(clusters, minConsistency = 2) {
    return clusters.filter(c => c.verticalConsistency >= minConsistency);
}

function calculateIconMetrics(cellEdges, width, bandRegion) {
    if (cellEdges.length < 2) {
        return getDefaultMetrics(width, bandRegion);
    }

    const gaps = [];
    for (let i = 1; i < cellEdges.length; i++) {
        const gap = cellEdges[i].x - cellEdges[i - 1].x;
        if (gap >= 20 && gap <= 100) {
            gaps.push(gap);
        }
    }

    if (gaps.length < 2) {
        return getDefaultMetrics(width, bandRegion);
    }

    const gapMode = findMode(gaps);
    const avgBorderWidth = Math.round(cellEdges.reduce((s, e) => s + e.borderWidth, 0) / cellEdges.length);

    const estimatedSpacing = Math.max(2, Math.min(10, Math.round(avgBorderWidth * 1.2)));
    const iconWidth = gapMode - estimatedSpacing;

    // Icon height: icons are typically square
    const estimatedRowHeight = iconWidth + estimatedSpacing;
    const possibleRows = Math.floor(bandRegion.height / estimatedRowHeight);
    const maxIconHeight = possibleRows >= 1 ? iconWidth : bandRegion.height - 10;
    const iconHeight = Math.min(iconWidth, Math.max(iconWidth, maxIconHeight));

    return {
        iconWidth: Math.round(iconWidth),
        iconHeight: Math.round(iconHeight),
        xSpacing: estimatedSpacing,
        ySpacing: estimatedSpacing,
        cellStride: gapMode,
        borderWidth: avgBorderWidth,
        confidence: gaps.length / (cellEdges.length - 1),
        detectedCells: cellEdges.length,
        firstCellX: cellEdges[0].x,
    };
}

function findMode(values, tolerance = 2) {
    const counts = new Map();

    for (const val of values) {
        const bucket = Math.round(val / tolerance) * tolerance;
        counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }

    let maxCount = 0;
    let mode = values[0];

    for (const [value, count] of counts) {
        if (count > maxCount) {
            maxCount = count;
            mode = value;
        }
    }

    return mode;
}

function getDefaultMetrics(width, bandRegion) {
    const height = bandRegion.bottomY;
    const scale = height / 720;

    return {
        iconWidth: Math.round(40 * scale),
        iconHeight: Math.round(40 * scale),
        xSpacing: Math.round(4 * scale),
        ySpacing: Math.round(4 * scale),
        cellStride: Math.round(44 * scale),
        borderWidth: 3,
        confidence: 0,
        detectedCells: 0,
        firstCellX: null,
        isDefault: true,
    };
}

function buildPreciseGrid(metrics, bandRegion, width, height, cellEdges) {
    const positions = [];
    const { iconWidth, iconHeight, xSpacing, ySpacing, cellStride } = metrics;

    const rowHeight = iconHeight + ySpacing;
    const bandHeight = bandRegion.bottomY - bandRegion.topY;

    const possibleRows = Math.floor(bandHeight / rowHeight);
    // MegaBonk hotbar typically has 1-2 rows, not 3
    const numRows = Math.min(possibleRows, 2);

    const bottomMargin = 5;
    const firstRowY = bandRegion.bottomY - iconHeight - bottomMargin;

    let startX;
    let iconsPerRow;

    if (cellEdges && cellEdges.length >= 2 && metrics.firstCellX !== null) {
        startX = metrics.firstCellX;
        iconsPerRow = cellEdges.length;
    } else {
        iconsPerRow = Math.floor((width - 100) / cellStride);
        const totalGridWidth = iconsPerRow * cellStride - xSpacing;
        startX = Math.round((width - totalGridWidth) / 2);
    }

    for (let row = 0; row < numRows; row++) {
        const rowY = firstRowY - row * rowHeight;

        if (rowY < height * 0.7) break;

        for (let col = 0; col < iconsPerRow; col++) {
            const cellX = startX + col * cellStride;

            if (cellX < 0 || cellX + iconWidth > width) continue;

            positions.push({
                x: cellX,
                y: rowY,
                width: iconWidth,
                height: iconHeight,
                row,
                col,
                slotIndex: positions.length,
            });
        }
    }

    return {
        positions,
        iconsPerRow,
        numRows,
    };
}

function validateGrid(ctx, positions) {
    const validCells = [];
    const emptyCells = [];

    for (const cell of positions) {
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
        const pixels = cellData.data;

        let sumR = 0,
            sumG = 0,
            sumB = 0;
        let sumSqR = 0,
            sumSqG = 0,
            sumSqB = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 16) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            sumR += r;
            sumG += g;
            sumB += b;
            sumSqR += r * r;
            sumSqG += g * g;
            sumSqB += b * b;
            count++;
        }

        const meanR = sumR / count;
        const meanG = sumG / count;
        const meanB = sumB / count;
        const meanBrightness = (meanR + meanG + meanB) / 3;

        const varianceR = sumSqR / count - meanR * meanR;
        const varianceG = sumSqG / count - meanG * meanG;
        const varianceB = sumSqB / count - meanB * meanB;
        const totalVariance = varianceR + varianceG + varianceB;

        const isEmpty = totalVariance < 400 || meanBrightness < 30;

        if (isEmpty) {
            emptyCells.push(cell);
        } else {
            validCells.push(cell);
        }
    }

    return {
        validCells,
        emptyCells,
        totalCells: positions.length,
        confidence: validCells.length / positions.length,
    };
}

async function autoDetectGrid(ctx, width, height) {
    const bandRegion = detectHotbarBand(ctx, width, height);
    const borderResult = detectRarityBorders(ctx, width, bandRegion);
    const metrics = calculateIconMetrics(borderResult.edges, width, bandRegion);
    const gridResult = buildPreciseGrid(metrics, bandRegion, width, height, borderResult.edges);
    const validation = validateGrid(ctx, gridResult.positions);

    return {
        success: true,
        bandRegion,
        borders: borderResult,
        metrics,
        grid: gridResult,
        validation,
    };
}

// ========================================
// Test Runner
// ========================================

async function runTests() {
    console.log('='.repeat(60));
    console.log('Auto-Grid Detection Test');
    console.log('='.repeat(60));
    console.log('');

    const results = [];
    let totalImages = 0;
    let successfulDetections = 0;

    for (const [imagePath, truthData] of Object.entries(groundTruth)) {
        const fullPath = path.join(IMAGES_BASE, imagePath);

        if (!fs.existsSync(fullPath)) {
            console.log(`SKIP: ${imagePath} (file not found)`);
            continue;
        }

        totalImages++;
        const expectedItems = truthData.items?.length || 0;

        try {
            const image = await loadImage(fullPath);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const result = await autoDetectGrid(ctx, image.width, image.height);

            const detectedCells = result.validation.validCells.length;
            const totalCells = result.validation.totalCells;
            const accuracy =
                expectedItems > 0
                    ? Math.max(0, 100 - (Math.abs(detectedCells - expectedItems) / expectedItems) * 100)
                    : detectedCells === 0
                      ? 100
                      : 0;

            const isSuccess = Math.abs(detectedCells - expectedItems) <= Math.max(2, expectedItems * 0.2);
            if (isSuccess) successfulDetections++;

            const status = isSuccess ? '✓' : '✗';
            const color = isSuccess ? '\x1b[32m' : '\x1b[31m';
            const reset = '\x1b[0m';

            console.log(`${color}${status}${reset} ${imagePath}`);
            console.log(`  Resolution: ${image.width}x${image.height}`);
            console.log(`  Expected: ${expectedItems}, Detected: ${detectedCells} (${totalCells} total cells)`);
            console.log(
                `  Band: Y=${result.bandRegion.topY}-${result.bandRegion.bottomY} (height=${result.bandRegion.height}px), conf=${(result.bandRegion.confidence * 100).toFixed(0)}%`
            );
            console.log(`  Borders: ${result.borders.edges.length} edges detected`);
            console.log(
                `  Grid: ${result.grid.iconsPerRow}x${result.grid.numRows}, icon=${result.metrics.iconWidth}x${result.metrics.iconHeight}px`
            );
            console.log(`  Accuracy: ${accuracy.toFixed(1)}%`);
            console.log('');

            results.push({
                image: imagePath,
                resolution: `${image.width}x${image.height}`,
                expected: expectedItems,
                detected: detectedCells,
                accuracy,
                bandConfidence: result.bandRegion.confidence,
                edgesDetected: result.borders.edges.length,
                gridSize: `${result.grid.iconsPerRow}x${result.grid.numRows}`,
                iconSize: `${result.metrics.iconWidth}x${result.metrics.iconHeight}`,
                success: isSuccess,
            });
        } catch (error) {
            console.log(`✗ ${imagePath}: ERROR - ${error.message}`);
            results.push({
                image: imagePath,
                error: error.message,
                success: false,
            });
        }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total images tested: ${totalImages}`);
    console.log(
        `Successful detections: ${successfulDetections} (${((successfulDetections / totalImages) * 100).toFixed(1)}%)`
    );

    // Calculate average accuracy
    const accuracies = results.filter(r => r.accuracy !== undefined).map(r => r.accuracy);
    if (accuracies.length > 0) {
        const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
        console.log(`Average accuracy: ${avgAccuracy.toFixed(1)}%`);
    }

    // Find problem images
    const problemImages = results.filter(r => !r.success);
    if (problemImages.length > 0) {
        console.log('\nProblem images:');
        for (const img of problemImages) {
            if (img.error) {
                console.log(`  - ${img.image}: ${img.error}`);
            } else {
                console.log(`  - ${img.image}: expected ${img.expected}, got ${img.detected}`);
            }
        }
    }

    return results;
}

// Run tests
runTests().catch(console.error);
