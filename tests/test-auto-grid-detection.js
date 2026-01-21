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
    const scanStartY = Math.floor(height * 0.75);
    const stripHeight = 2;
    const stripData = [];

    for (let y = scanStartY; y < height - stripHeight; y += stripHeight) {
        const imageData = ctx.getImageData(0, y, width, stripHeight);
        const pixels = imageData.data;

        let totalBrightness = 0;
        let totalVariance = 0;
        let colorfulPixels = 0;
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

            count++;
        }

        stripData.push({
            y,
            avgBrightness: totalBrightness / count,
            avgVariance: totalVariance / count,
            colorfulRatio: colorfulPixels / count,
        });
    }

    let bestBandStart = -1;
    let bestBandEnd = height;
    let bestScore = 0;
    const windowSize = 15;

    for (let i = 0; i < stripData.length - windowSize; i++) {
        const window = stripData.slice(i, i + windowSize);

        const avgBrightness = window.reduce((s, d) => s + d.avgBrightness, 0) / window.length;
        const avgVariance = window.reduce((s, d) => s + d.avgVariance, 0) / window.length;
        const avgColorful = window.reduce((s, d) => s + d.colorfulRatio, 0) / window.length;

        let score = 0;
        if (avgBrightness >= 30 && avgBrightness <= 150) score += 30;
        if (avgVariance > 300) score += Math.min(40, avgVariance / 50);
        if (avgColorful > 0.05) score += avgColorful * 100;

        const yPosition = window[0].y / height;
        if (yPosition > 0.85) score += 20;

        if (score > bestScore) {
            bestScore = score;
            bestBandStart = window[0].y;
            bestBandEnd = window[window.length - 1].y + stripHeight;
        }
    }

    if (bestBandStart === -1) {
        bestBandStart = Math.floor(height * 0.9);
        bestBandEnd = height - 5;
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

    const scanLines = [
        topY + Math.floor(bandHeight * 0.1),
        topY + Math.floor(bandHeight * 0.3),
        topY + Math.floor(bandHeight * 0.5),
        topY + Math.floor(bandHeight * 0.7),
        topY + Math.floor(bandHeight * 0.9),
    ];

    const allEdges = [];

    for (const scanY of scanLines) {
        if (scanY >= ctx.canvas.height) continue;

        const lineData = ctx.getImageData(0, scanY, width, 1);
        const pixels = lineData.data;

        let inBorder = false;
        let borderStart = -1;
        let currentRarity = null;

        for (let x = 0; x < width; x++) {
            const idx = x * 4;
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
    const clusteredEdges = clusterEdgesByX(allEdges, 6);

    return {
        edges: clusteredEdges,
        allEdges,
    };
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

    return {
        x: avgX,
        borderWidth: avgWidth,
        confidence: edges.length / 5,
        detections: edges.length,
    };
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

    const maxIconHeight = bandRegion.height - 10;
    const iconHeight = Math.min(iconWidth, maxIconHeight);

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
    const numRows = Math.min(possibleRows, 3);

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
                `  Band: Y=${result.bandRegion.topY}-${result.bandRegion.bottomY}, conf=${(result.bandRegion.confidence * 100).toFixed(0)}%`
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
