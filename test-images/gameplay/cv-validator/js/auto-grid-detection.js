/* ========================================
 * CV Validator - Auto Grid Detection
 * Dynamic edge detection + multi-pass refinement
 * Self-calibrating grid detection for any resolution
 * ======================================== */

import { CONFIG } from './config.js';
import { log, LOG_LEVELS } from './utils.js';

// ========================================
// Rarity Border Color Definitions (HSL ranges)
// ========================================

const RARITY_BORDER_COLORS = {
    common: {
        name: 'common',
        // Gray - low saturation
        h: [0, 360],
        s: [0, 25],
        l: [35, 75],
        rgb: { r: [100, 200], g: [100, 200], b: [100, 200] },
    },
    uncommon: {
        name: 'uncommon',
        // Green
        h: [85, 155],
        s: [40, 100],
        l: [25, 65],
        rgb: { r: [30, 150], g: [120, 255], b: [30, 150] },
    },
    rare: {
        name: 'rare',
        // Blue
        h: [190, 250],
        s: [50, 100],
        l: [35, 70],
        rgb: { r: [30, 150], g: [80, 200], b: [150, 255] },
    },
    epic: {
        name: 'epic',
        // Purple
        h: [260, 320],
        s: [40, 100],
        l: [30, 65],
        rgb: { r: [120, 220], g: [30, 150], b: [150, 255] },
    },
    legendary: {
        name: 'legendary',
        // Orange/Gold
        h: [15, 55],
        s: [70, 100],
        l: [45, 75],
        rgb: { r: [200, 255], g: [100, 220], b: [20, 120] },
    },
};

// ========================================
// Color Utility Functions
// ========================================

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
        s,
        l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Check if a color matches a rarity border color
 */
function matchesRarityColor(r, g, b, rarity) {
    const def = RARITY_BORDER_COLORS[rarity];
    if (!def) return false;

    // Quick RGB range check first (faster)
    if (r < def.rgb.r[0] || r > def.rgb.r[1]) return false;
    if (g < def.rgb.g[0] || g > def.rgb.g[1]) return false;
    if (b < def.rgb.b[0] || b > def.rgb.b[1]) return false;

    // HSL check for more accuracy
    const hsl = rgbToHsl(r, g, b);

    // Handle hue wraparound for red/orange
    let hueMatch = false;
    if (def.h[0] <= def.h[1]) {
        hueMatch = hsl.h >= def.h[0] && hsl.h <= def.h[1];
    } else {
        hueMatch = hsl.h >= def.h[0] || hsl.h <= def.h[1];
    }

    const satMatch = hsl.s >= def.s[0] && hsl.s <= def.s[1];
    const lumMatch = hsl.l >= def.l[0] && hsl.l <= def.l[1];

    return hueMatch && satMatch && lumMatch;
}

/**
 * Check if pixel matches any rarity border color
 */
function detectRarityAtPixel(r, g, b) {
    for (const [rarity, _def] of Object.entries(RARITY_BORDER_COLORS)) {
        if (matchesRarityColor(r, g, b, rarity)) {
            return rarity;
        }
    }
    return null;
}

// ========================================
// Pass 1: Hotbar Band Detection
// ========================================

/**
 * Detect the hotbar band region at the bottom of the screen
 * Returns the Y coordinates where the item bar exists
 */
export function detectHotbarBand(ctx, width, height) {
    log('Pass 1: Detecting hotbar band...', LOG_LEVELS.INFO);

    // Scan bottom 25% of screen
    const scanStartY = Math.floor(height * 0.75);

    // Analyze horizontal strips
    const stripData = [];
    const stripHeight = 2; // Sample every 2 pixels for speed

    for (let y = scanStartY; y < height - stripHeight; y += stripHeight) {
        const imageData = ctx.getImageData(0, y, width, stripHeight);
        const pixels = imageData.data;

        let totalBrightness = 0;
        let totalVariance = 0;
        let colorfulPixels = 0;
        let count = 0;

        // Sample across the strip
        for (let i = 0; i < pixels.length; i += 16) {
            // Sample every 4th pixel
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;

            // Color variance (how different are RGB channels)
            const mean = brightness;
            const variance = Math.pow(r - mean, 2) + Math.pow(g - mean, 2) + Math.pow(b - mean, 2);
            totalVariance += variance;

            // Count colorful pixels (potential rarity borders)
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

    // Find the hotbar band by looking for:
    // 1. Region with moderate brightness (not too dark, not too bright)
    // 2. Higher color variance (icons are colorful)
    // 3. Some colorful pixels (rarity borders)

    let bestBandStart = -1;
    let bestBandEnd = height;
    let bestScore = 0;

    // Sliding window to find best band
    const windowSize = 15; // ~30px window

    for (let i = 0; i < stripData.length - windowSize; i++) {
        const window = stripData.slice(i, i + windowSize);

        const avgBrightness = window.reduce((s, d) => s + d.avgBrightness, 0) / window.length;
        const avgVariance = window.reduce((s, d) => s + d.avgVariance, 0) / window.length;
        const avgColorful = window.reduce((s, d) => s + d.colorfulRatio, 0) / window.length;

        // Score: prefer moderate brightness, high variance, some color
        // Hotbar typically has brightness 40-120, variance > 500, some colorful pixels
        let score = 0;

        if (avgBrightness >= 30 && avgBrightness <= 150) {
            score += 30;
        }
        if (avgVariance > 300) {
            score += Math.min(40, avgVariance / 50);
        }
        if (avgColorful > 0.05) {
            score += avgColorful * 100;
        }

        // Prefer lower on screen (hotbar is at very bottom)
        const yPosition = window[0].y / height;
        if (yPosition > 0.85) {
            score += 20;
        }

        if (score > bestScore) {
            bestScore = score;
            bestBandStart = window[0].y;
            bestBandEnd = window[window.length - 1].y + stripHeight;
        }
    }

    // Refine band edges
    if (bestBandStart === -1) {
        // Fallback: use default position
        bestBandStart = Math.floor(height * 0.9);
        bestBandEnd = height - 5;
        log('Pass 1: Could not detect hotbar, using fallback position', LOG_LEVELS.WARNING);
    }

    const result = {
        topY: bestBandStart,
        bottomY: bestBandEnd,
        height: bestBandEnd - bestBandStart,
        confidence: Math.min(1, bestScore / 100),
        debug: { stripData, bestScore },
    };

    log(
        `Pass 1: Detected hotbar band at Y=${result.topY}-${result.bottomY} (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
        LOG_LEVELS.SUCCESS
    );

    return result;
}

// ========================================
// Pass 2: Rarity Border Detection
// ========================================

/**
 * Detect item cell edges by finding rarity border colors
 */
export function detectRarityBorders(ctx, width, bandRegion) {
    log('Pass 2: Detecting rarity borders...', LOG_LEVELS.INFO);

    const { topY, bottomY } = bandRegion;
    const bandHeight = bottomY - topY;

    // Scan multiple horizontal lines within the band
    const scanLines = [
        topY + Math.floor(bandHeight * 0.1), // Top of icons
        topY + Math.floor(bandHeight * 0.3), // Upper middle
        topY + Math.floor(bandHeight * 0.5), // Middle
        topY + Math.floor(bandHeight * 0.7), // Lower middle
        topY + Math.floor(bandHeight * 0.9), // Bottom of icons
    ];

    // Collect all detected edges across scan lines
    const allEdges = [];
    const colorCounts = {};

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
                // Start of a border
                inBorder = true;
                borderStart = x;
                currentRarity = rarity;
            } else if (!rarity && inBorder) {
                // End of a border
                const borderWidth = x - borderStart;

                // Valid borders are typically 2-6 pixels wide
                if (borderWidth >= 2 && borderWidth <= 8) {
                    allEdges.push({
                        x: borderStart,
                        endX: x,
                        y: scanY,
                        width: borderWidth,
                        rarity: currentRarity,
                        type: 'left', // We detected the left edge of an icon
                    });

                    colorCounts[currentRarity] = (colorCounts[currentRarity] || 0) + 1;
                }

                inBorder = false;
                currentRarity = null;
            }
        }
    }

    log(`Pass 2: Found ${allEdges.length} potential border edges`, LOG_LEVELS.INFO);

    // Cluster edges by X position (edges at same X across different scan lines = same icon)
    const clusteredEdges = clusterEdgesByX(allEdges, 6); // 6px tolerance

    log(`Pass 2: Clustered into ${clusteredEdges.length} cell positions`, LOG_LEVELS.SUCCESS);

    return {
        edges: clusteredEdges,
        allEdges,
        colorCounts,
        dominantColors: Object.entries(colorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([color]) => color),
    };
}

/**
 * Cluster detected edges by X position
 */
function clusterEdgesByX(edges, tolerance) {
    if (edges.length === 0) return [];

    // Sort by X position
    const sorted = [...edges].sort((a, b) => a.x - b.x);

    const clusters = [];
    let currentCluster = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const edge = sorted[i];
        const lastEdge = currentCluster[currentCluster.length - 1];

        if (edge.x - lastEdge.x <= tolerance) {
            // Same cluster
            currentCluster.push(edge);
        } else {
            // New cluster
            clusters.push(processCluster(currentCluster));
            currentCluster = [edge];
        }
    }

    // Don't forget the last cluster
    if (currentCluster.length > 0) {
        clusters.push(processCluster(currentCluster));
    }

    return clusters;
}

/**
 * Process a cluster of edges into a single cell edge
 */
function processCluster(edges) {
    const avgX = Math.round(edges.reduce((s, e) => s + e.x, 0) / edges.length);
    const avgWidth = Math.round(edges.reduce((s, e) => s + e.width, 0) / edges.length);

    // Most common rarity in cluster
    const rarityCounts = {};
    edges.forEach(e => {
        rarityCounts[e.rarity] = (rarityCounts[e.rarity] || 0) + 1;
    });
    const dominantRarity = Object.entries(rarityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    return {
        x: avgX,
        borderWidth: avgWidth,
        rarity: dominantRarity,
        confidence: edges.length / 5, // More scan lines = higher confidence
        detections: edges.length,
    };
}

// ========================================
// Pass 3: Icon Size Calculation
// ========================================

/**
 * Calculate icon dimensions from detected cell edges
 */
export function calculateIconMetrics(cellEdges, width, bandRegion) {
    log('Pass 3: Calculating icon metrics...', LOG_LEVELS.INFO);

    if (cellEdges.length < 2) {
        log('Pass 3: Not enough edges detected, using defaults', LOG_LEVELS.WARNING);
        return getDefaultMetrics(width, bandRegion);
    }

    // Calculate gaps between consecutive edges (this is icon width + spacing)
    const gaps = [];
    for (let i = 1; i < cellEdges.length; i++) {
        const gap = cellEdges[i].x - cellEdges[i - 1].x;
        // Filter reasonable gaps (20-80px for icon + spacing)
        if (gap >= 20 && gap <= 100) {
            gaps.push(gap);
        }
    }

    if (gaps.length < 2) {
        log('Pass 3: Not enough valid gaps, using defaults', LOG_LEVELS.WARNING);
        return getDefaultMetrics(width, bandRegion);
    }

    // Find the mode (most common gap size) - this is iconWidth + spacing
    const gapMode = findMode(gaps);

    // Average border width from edges
    const avgBorderWidth = Math.round(cellEdges.reduce((s, e) => s + e.borderWidth, 0) / cellEdges.length);

    // Estimate spacing as border width * 1.5 (typical pattern)
    const estimatedSpacing = Math.max(2, Math.min(10, Math.round(avgBorderWidth * 1.2)));

    // Icon width = total gap - spacing
    const iconWidth = gapMode - estimatedSpacing;

    // Icon height typically equals width, but verify with band height
    const maxIconHeight = bandRegion.height - 10; // Leave some margin
    const iconHeight = Math.min(iconWidth, maxIconHeight);

    // Calculate how many icons fit
    const totalGridWidth = cellEdges.length * gapMode;
    const startX = cellEdges[0].x;
    const centerOffset = Math.round((width - totalGridWidth) / 2) - startX;

    const result = {
        iconWidth: Math.round(iconWidth),
        iconHeight: Math.round(iconHeight),
        xSpacing: estimatedSpacing,
        ySpacing: estimatedSpacing, // Usually same as X
        cellStride: gapMode, // iconWidth + spacing
        borderWidth: avgBorderWidth,
        confidence: gaps.length / (cellEdges.length - 1), // How consistent are the gaps
        detectedCells: cellEdges.length,
        firstCellX: cellEdges[0].x,
        centerOffset,
        debug: { gaps, gapMode },
    };

    log(
        `Pass 3: Icon size ${result.iconWidth}x${result.iconHeight}, spacing ${result.xSpacing}px, stride ${result.cellStride}px`,
        LOG_LEVELS.SUCCESS
    );

    return result;
}

/**
 * Find the mode (most common value) with tolerance
 */
function findMode(values, tolerance = 2) {
    const counts = new Map();

    for (const val of values) {
        // Round to nearest multiple of tolerance
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

/**
 * Get default metrics based on resolution
 */
function getDefaultMetrics(width, bandRegion) {
    const height = bandRegion.bottomY;
    const scale = height / CONFIG.BASE_RESOLUTION;

    return {
        iconWidth: Math.round(CONFIG.DEFAULT_CALIBRATION.iconWidth * scale),
        iconHeight: Math.round(CONFIG.DEFAULT_CALIBRATION.iconHeight * scale),
        xSpacing: Math.round(CONFIG.DEFAULT_CALIBRATION.xSpacing * scale),
        ySpacing: Math.round(CONFIG.DEFAULT_CALIBRATION.ySpacing * scale),
        cellStride: Math.round((CONFIG.DEFAULT_CALIBRATION.iconWidth + CONFIG.DEFAULT_CALIBRATION.xSpacing) * scale),
        borderWidth: 3,
        confidence: 0,
        detectedCells: 0,
        firstCellX: null,
        centerOffset: 0,
        isDefault: true,
    };
}

// ========================================
// Pass 4: Build Precise Grid
// ========================================

/**
 * Build the final grid positions from detected metrics
 */
export function buildPreciseGrid(metrics, bandRegion, width, height, cellEdges) {
    log('Pass 4: Building precise grid...', LOG_LEVELS.INFO);

    const positions = [];
    const { iconWidth, iconHeight, xSpacing, ySpacing, cellStride } = metrics;

    // Calculate Y positions for rows
    const rowHeight = iconHeight + ySpacing;
    const bandHeight = bandRegion.bottomY - bandRegion.topY;

    // How many rows can fit?
    const possibleRows = Math.floor(bandHeight / rowHeight);
    const numRows = Math.min(possibleRows, 3); // Max 3 rows typically

    // Y offset: position first row near bottom of band
    const bottomMargin = 5;
    const firstRowY = bandRegion.bottomY - iconHeight - bottomMargin;

    // X positioning: use detected edges if available, otherwise center
    let startX;
    let iconsPerRow;

    if (cellEdges && cellEdges.length >= 2 && metrics.firstCellX !== null) {
        // Use detected first cell position
        startX = metrics.firstCellX;
        iconsPerRow = cellEdges.length;
    } else {
        // Calculate centered grid
        iconsPerRow = Math.floor((width - 100) / cellStride); // 50px margin each side
        const totalGridWidth = iconsPerRow * cellStride - xSpacing;
        startX = Math.round((width - totalGridWidth) / 2);
    }

    // Build grid positions
    for (let row = 0; row < numRows; row++) {
        const rowY = firstRowY - row * rowHeight;

        // Don't place rows too high up
        if (rowY < height * 0.7) break;

        for (let col = 0; col < iconsPerRow; col++) {
            const cellX = startX + col * cellStride;

            // Skip if outside screen bounds
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

    // Convert to calibration format (base 720p values)
    const scale = height / CONFIG.BASE_RESOLUTION;
    const calibration = {
        xOffset: Math.round((startX - (width - iconsPerRow * cellStride) / 2) / scale),
        yOffset: Math.round(100 - (height - firstRowY - iconHeight) / scale), // Rebased slider value
        iconWidth: Math.round(iconWidth / scale),
        iconHeight: Math.round(iconHeight / scale),
        xSpacing: Math.round(xSpacing / scale),
        ySpacing: Math.round(ySpacing / scale),
        iconsPerRow,
        numRows,
        totalItems: positions.length,
    };

    log(`Pass 4: Built grid with ${positions.length} cells (${iconsPerRow} x ${numRows})`, LOG_LEVELS.SUCCESS);

    return {
        positions,
        calibration,
        debug: {
            startX,
            firstRowY,
            cellStride,
            scale,
        },
    };
}

// ========================================
// Pass 5: Validate Grid
// ========================================

/**
 * Validate detected grid positions by checking cell contents
 */
export function validateGrid(ctx, positions) {
    log('Pass 5: Validating grid cells...', LOG_LEVELS.INFO);

    const validCells = [];
    const emptyCells = [];
    const suspiciousCells = [];

    for (const cell of positions) {
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
        const validation = validateCell(cellData);

        if (validation.isEmpty) {
            emptyCells.push({ ...cell, validation });
        } else if (validation.isSuspicious) {
            suspiciousCells.push({ ...cell, validation });
        } else {
            validCells.push({ ...cell, validation });
        }
    }

    // Calculate overall confidence
    const totalCells = positions.length;
    const validRatio = validCells.length / totalCells;
    const emptyRatio = emptyCells.length / totalCells;

    // Good confidence if we have a reasonable number of valid cells
    // and not too many empty cells in the middle
    let confidence = validRatio;
    if (emptyRatio > 0.5) {
        confidence *= 0.5; // Penalize if mostly empty
    }

    const result = {
        validCells,
        emptyCells,
        suspiciousCells,
        totalCells,
        confidence,
        stats: {
            valid: validCells.length,
            empty: emptyCells.length,
            suspicious: suspiciousCells.length,
        },
    };

    log(
        `Pass 5: Validated ${validCells.length} valid, ${emptyCells.length} empty, ${suspiciousCells.length} suspicious cells`,
        LOG_LEVELS.SUCCESS
    );

    return result;
}

/**
 * Validate a single cell
 */
function validateCell(imageData) {
    const pixels = imageData.data;

    let sumR = 0,
        sumG = 0,
        sumB = 0;
    let sumSqR = 0,
        sumSqG = 0,
        sumSqB = 0;
    let colorfulPixels = 0;
    let count = 0;

    // Sample pixels
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

        // Check for colorful pixels
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (saturation > 40) colorfulPixels++;

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

    const colorfulRatio = colorfulPixels / count;

    // Determine cell status
    const isEmpty = totalVariance < 400 || meanBrightness < 30;
    const isSuspicious = totalVariance < 600 && colorfulRatio < 0.1;

    return {
        isEmpty,
        isSuspicious,
        meanBrightness,
        totalVariance,
        colorfulRatio,
    };
}

// ========================================
// Main Auto-Detection Function
// ========================================

/**
 * Run full auto-detection pipeline
 */
export async function autoDetectGrid(ctx, width, height, options = {}) {
    log('=== Starting Auto-Detection Pipeline ===', LOG_LEVELS.INFO);
    const startTime = Date.now();

    const { progressCallback } = options;

    try {
        // Pass 1: Detect hotbar band
        if (progressCallback) progressCallback(10, 'Detecting hotbar region...');
        const bandRegion = detectHotbarBand(ctx, width, height);

        // Pass 2: Detect rarity borders
        if (progressCallback) progressCallback(30, 'Finding item borders...');
        const borderResult = detectRarityBorders(ctx, width, bandRegion);

        // Pass 3: Calculate icon metrics
        if (progressCallback) progressCallback(50, 'Calculating icon sizes...');
        const metrics = calculateIconMetrics(borderResult.edges, width, bandRegion);

        // Pass 4: Build grid
        if (progressCallback) progressCallback(70, 'Building grid...');
        const gridResult = buildPreciseGrid(metrics, bandRegion, width, height, borderResult.edges);

        // Pass 5: Validate
        if (progressCallback) progressCallback(90, 'Validating cells...');
        const validation = validateGrid(ctx, gridResult.positions);

        const elapsed = Date.now() - startTime;
        log(`=== Auto-Detection Complete in ${elapsed.toFixed(0)}ms ===`, LOG_LEVELS.SUCCESS);

        if (progressCallback) progressCallback(100, 'Done!');

        return {
            success: true,
            bandRegion,
            borders: borderResult,
            metrics,
            grid: gridResult,
            validation,
            calibration: gridResult.calibration,
            elapsed,
            confidence: calculateOverallConfidence(bandRegion, metrics, validation),
        };
    } catch (error) {
        log(`Auto-detection failed: ${error.message}`, LOG_LEVELS.ERROR);
        return {
            success: false,
            error: error.message,
            calibration: null,
        };
    }
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(bandRegion, metrics, validation) {
    const bandConf = bandRegion.confidence || 0;
    const metricsConf = metrics.confidence || 0;
    const validationConf = validation.confidence || 0;

    // Weighted average
    const overall = bandConf * 0.2 + metricsConf * 0.4 + validationConf * 0.4;

    return Math.min(1, Math.max(0, overall));
}

// ========================================
// Comparison with Presets
// ========================================

/**
 * Compare auto-detected calibration with a saved preset
 */
export function compareWithPreset(autoCalibration, presetCalibration) {
    if (!autoCalibration || !presetCalibration) {
        return null;
    }

    const fields = ['iconWidth', 'iconHeight', 'xSpacing', 'ySpacing', 'xOffset', 'yOffset', 'iconsPerRow', 'numRows'];

    const comparison = {};
    let totalDiff = 0;
    let matchingFields = 0;

    for (const field of fields) {
        const autoVal = autoCalibration[field] || 0;
        const presetVal = presetCalibration[field] || 0;
        const diff = Math.abs(autoVal - presetVal);

        // Define tolerances for each field
        const tolerances = {
            iconWidth: 3,
            iconHeight: 3,
            xSpacing: 2,
            ySpacing: 2,
            xOffset: 10,
            yOffset: 10,
            iconsPerRow: 2,
            numRows: 1,
        };

        const tolerance = tolerances[field] || 5;
        const isClose = diff <= tolerance;

        comparison[field] = {
            auto: autoVal,
            preset: presetVal,
            diff,
            isClose,
        };

        totalDiff += diff;
        if (isClose) matchingFields++;
    }

    comparison.matchScore = (matchingFields / fields.length) * 100;
    comparison.totalDiff = totalDiff;
    comparison.recommendation =
        comparison.matchScore >= 70
            ? 'Auto-detection matches preset well'
            : 'Auto-detection differs significantly from preset';

    return comparison;
}

// ========================================
// Debug Visualization
// ========================================

/**
 * Draw detection overlay on canvas for debugging
 */
export function drawDetectionOverlay(ctx, detectionResult, options = {}) {
    const { showBand = true, showEdges = true, showGrid = true, showLabels = true } = options;

    ctx.save();

    // Draw hotbar band region
    if (showBand && detectionResult.bandRegion) {
        const band = detectionResult.bandRegion;
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(0, band.topY, ctx.canvas.width, band.height);
        ctx.setLineDash([]);

        if (showLabels) {
            ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
            ctx.font = '12px monospace';
            ctx.fillText(`Band: Y=${band.topY}-${band.bottomY}`, 5, band.topY - 5);
        }
    }

    // Draw detected border edges
    if (showEdges && detectionResult.borders?.edges) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        for (const edge of detectionResult.borders.edges) {
            ctx.beginPath();
            ctx.arc(edge.x, detectionResult.bandRegion.topY + 20, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw grid positions
    if (showGrid && detectionResult.grid?.positions) {
        for (const cell of detectionResult.grid.positions) {
            // Determine cell status
            const isValid = detectionResult.validation?.validCells?.some(v => v.slotIndex === cell.slotIndex);
            const isEmpty = detectionResult.validation?.emptyCells?.some(e => e.slotIndex === cell.slotIndex);

            if (isValid) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
                ctx.lineWidth = 2;
            } else if (isEmpty) {
                ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
                ctx.lineWidth = 2;
            }

            ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

            // Draw slot index
            if (showLabels && isValid) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
                ctx.font = '10px monospace';
                ctx.fillText(`${cell.slotIndex}`, cell.x + 2, cell.y + 10);
            }
        }
    }

    ctx.restore();
}

export default {
    autoDetectGrid,
    detectHotbarBand,
    detectRarityBorders,
    calculateIconMetrics,
    buildPreciseGrid,
    validateGrid,
    compareWithPreset,
    drawDetectionOverlay,
};
