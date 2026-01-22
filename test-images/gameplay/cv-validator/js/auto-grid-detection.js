/* ========================================
 * CV Validator - Auto Grid Detection
 * Dynamic edge detection + multi-pass refinement
 * Self-calibrating grid detection for any resolution
 * ======================================== */

/**
 * Magic Numbers Documentation for Auto-Grid Detection:
 *
 * Brightness/Color Thresholds:
 * - 25-160: Brightness range for UI panel detection. Below 25 is too dark (game world),
 *   above 160 is too bright (sky, glare). UI panels typically have moderate brightness.
 *
 * - Variance threshold 200: Minimum color variance to indicate "interesting" content.
 *   Uniform regions (empty cells, solid backgrounds) have variance < 200.
 *   Icon regions with details have higher variance.
 *
 * - Variance threshold 400-600: Cell validation thresholds.
 *   < 400: Likely empty cell
 *   400-600: Suspicious (may be empty or low-contrast icon)
 *   > 600: Likely contains an item
 *
 * - 0.01 (1%): Minimum ratio of rarity-colored pixels to consider a cell valid.
 *   Item borders have colored pixels; empty cells don't.
 *
 * Spatial Thresholds:
 * - 0.7/0.85: Screen width percentages for scan region.
 *   Hotbar is centered, so we skip the outer 15% on each side to avoid UI noise.
 *
 * - 0.88-0.98: Screen height percentage where hotbar lives.
 *   The item bar is at the very bottom of the screen.
 *
 * - maxDetectedRows (default 2): MegaBonk hotbar typically has 1-2 rows.
 *   Can be overridden via CONFIG.maxDetectedRows.
 *
 * Edge Detection:
 * - 2-8 pixel border width: Rarity borders are typically 2-6 pixels wide.
 *   We allow up to 8 to account for scaling artifacts.
 *
 * - 6 pixel X tolerance for clustering: Edges at the same X ±6 pixels are
 *   considered the same cell boundary (accounts for anti-aliasing).
 *
 * - minConsistency 2: An edge must appear in at least 2 scan lines to be
 *   considered a real cell boundary (filters single-line noise).
 *
 * - Mode gap tolerance 4: When finding dominant spacing, allow ±4px variance.
 *   This accounts for rounding/scaling differences across the grid.
 */

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

    // Scan bottom 30% of screen (hotbar is usually at very bottom)
    const scanStartY = Math.floor(height * 0.7);

    // Only sample center 70% of width (where hotbar items are, avoiding UI edges)
    const sampleStartX = Math.floor(width * 0.15);
    const sampleWidth = Math.floor(width * 0.7);

    // Analyze horizontal strips
    const stripData = [];
    const stripHeight = 2; // Sample every 2 pixels for speed

    for (let y = scanStartY; y < height - stripHeight; y += stripHeight) {
        const imageData = ctx.getImageData(sampleStartX, y, sampleWidth, stripHeight);
        const pixels = imageData.data;

        let totalBrightness = 0;
        let totalVariance = 0;
        let colorfulPixels = 0;
        let rarityBorderPixels = 0;
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

            // Count actual rarity border color matches (more specific)
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

    // Find the hotbar band by looking for:
    // 1. Region with moderate brightness (not too dark, not too bright)
    // 2. Higher color variance (icons are colorful)
    // 3. Some colorful pixels (rarity borders)

    let bestBandStart = -1;
    let bestBandEnd = height;
    let bestScore = 0;

    // INCREASED window size: 35 strips × 2px = ~70px to capture full icon height
    const windowSize = 35;

    for (let i = 0; i < stripData.length - windowSize; i++) {
        const windowSlice = stripData.slice(i, i + windowSize);

        const avgBrightness = windowSlice.reduce((s, d) => s + d.avgBrightness, 0) / windowSlice.length;
        const avgVariance = windowSlice.reduce((s, d) => s + d.avgVariance, 0) / windowSlice.length;
        const avgColorful = windowSlice.reduce((s, d) => s + d.colorfulRatio, 0) / windowSlice.length;
        const avgRarity = windowSlice.reduce((s, d) => s + d.rarityRatio, 0) / windowSlice.length;

        // Score: prefer moderate brightness, high variance, rarity borders present
        let score = 0;

        // Moderate brightness indicates UI panel area
        if (avgBrightness >= 25 && avgBrightness <= 160) {
            score += 25;
        }

        // High variance means colorful icons
        if (avgVariance > 200) {
            score += Math.min(35, avgVariance / 40);
        }

        // Colorful pixels
        if (avgColorful > 0.03) {
            score += avgColorful * 80;
        }

        // BONUS: Rarity border colors detected (strong signal)
        if (avgRarity > 0.01) {
            score += avgRarity * 150;
        }

        // Prefer lower on screen (hotbar is at very bottom)
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

    // Fallback if no band found
    if (bestBandStart === -1) {
        bestBandStart = Math.floor(height * 0.88);
        bestBandEnd = height - 5;
        log('Pass 1: Could not detect hotbar, using fallback position', LOG_LEVELS.WARNING);
    }

    // Constrain band height - hotbar is typically 1-2 icon rows (~60-120px at 1080p)
    // Max band height is ~12% of screen height (covers 2 full icon rows with margin)
    const maxBandHeight = Math.floor(height * 0.12);
    const minBandHeight = Math.floor(height * 0.06); // ~43px at 720p, ~65px at 1080p

    // If band is too tall, constrain it to reasonable size
    const currentHeight = bestBandEnd - bestBandStart;
    if (currentHeight > maxBandHeight) {
        // Keep the bottom of the band (where hotbar is) and move top down
        bestBandStart = bestBandEnd - maxBandHeight;
    }

    if (bestBandEnd - bestBandStart < minBandHeight) {
        bestBandStart = bestBandEnd - minBandHeight;
    }

    const result = {
        topY: bestBandStart,
        bottomY: bestBandEnd,
        height: bestBandEnd - bestBandStart,
        confidence: Math.min(1, bestScore / 100),
        debug: { stripData, bestScore },
    };

    log(
        `Pass 1: Detected hotbar band at Y=${result.topY}-${result.bottomY} (height=${result.height}px, confidence: ${(result.confidence * 100).toFixed(0)}%)`,
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

    // RESTRICT: Only scan center 70% of width (hotbar is centered, avoid UI edges)
    const scanStartX = Math.floor(width * 0.15);
    const scanEndX = Math.floor(width * 0.85);

    // Scan multiple horizontal lines within the band
    const scanLines = [
        topY + Math.floor(bandHeight * 0.05), // Very top edge of icons
        topY + Math.floor(bandHeight * 0.15), // Top of icons
        topY + Math.floor(bandHeight * 0.3), // Upper middle
        topY + Math.floor(bandHeight * 0.5), // Middle
        topY + Math.floor(bandHeight * 0.7), // Lower middle
        topY + Math.floor(bandHeight * 0.85), // Bottom of icons
        topY + Math.floor(bandHeight * 0.95), // Very bottom edge
    ];

    // Collect all detected edges across scan lines
    const allEdges = [];
    const colorCounts = {};

    for (const scanY of scanLines) {
        if (scanY >= ctx.canvas.height) continue;

        const lineData = ctx.getImageData(scanStartX, scanY, scanEndX - scanStartX, 1);
        const pixels = lineData.data;

        let inBorder = false;
        let borderStart = -1;
        let currentRarity = null;

        for (let localX = 0; localX < scanEndX - scanStartX; localX++) {
            const x = localX + scanStartX; // Convert to absolute X
            const idx = localX * 4;
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
    let clusteredEdges = clusterEdgesByX(allEdges, 6); // 6px tolerance

    if (clusteredEdges.length === 0) {
        log(`Pass 2: No vertical edge clusters found - image may not contain a hotbar`, LOG_LEVELS.WARNING);
    } else {
        log(`Pass 2: Clustered into ${clusteredEdges.length} cell positions`, LOG_LEVELS.INFO);
    }

    // VERTICAL CONSISTENCY FILTER: True borders appear at multiple Y positions
    const beforeVerticalFilter = clusteredEdges.length;
    clusteredEdges = filterByVerticalConsistency(clusteredEdges, 2);

    if (clusteredEdges.length === 0 && beforeVerticalFilter > 0) {
        log(
            `Pass 2: Vertical filter removed all edges - edges don't appear consistently across scan lines`,
            LOG_LEVELS.WARNING
        );
    } else {
        log(`Pass 2: After vertical filter: ${clusteredEdges.length} consistent positions`, LOG_LEVELS.INFO);
    }

    // SPACING CONSISTENCY FILTER: Remove edges that don't fit regular spacing pattern
    const beforeSpacingFilter = clusteredEdges.length;
    clusteredEdges = filterBySpacingConsistency(clusteredEdges, width);

    if (clusteredEdges.length === 0 && beforeSpacingFilter > 0) {
        log(`Pass 2: Spacing filter removed all edges - no consistent grid spacing found`, LOG_LEVELS.WARNING);
    } else {
        log(`Pass 2: After spacing filter: ${clusteredEdges.length} consistent positions`, LOG_LEVELS.SUCCESS);
    }

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
 * Filter edges to keep only those that form consistent spacing patterns
 * This removes random noise from gameplay elements (trees, etc.)
 */
function filterBySpacingConsistency(edges, _width) {
    if (edges.length < 3) {
        log(`Pass 2 (spacing): Skipping filter - need at least 3 edges, have ${edges.length}`, LOG_LEVELS.INFO);
        return edges;
    }

    // Calculate all gaps between consecutive edges
    const gaps = [];
    for (let i = 1; i < edges.length; i++) {
        const gap = edges[i].x - edges[i - 1].x;
        if (gap > 0 && gap < 150) {
            // Reasonable gap range
            gaps.push({ gap, fromIdx: i - 1, toIdx: i });
        }
    }

    if (gaps.length < 2) {
        log(
            `Pass 2 (spacing): Not enough valid gaps to determine spacing pattern (${gaps.length} gaps)`,
            LOG_LEVELS.INFO
        );
        return edges;
    }

    // Find dominant gap size (icon stride: iconWidth + spacing)
    // Use histogram approach to find mode
    const gapCounts = new Map();
    const tolerance = 4; // Allow ±4px variance

    for (const { gap } of gaps) {
        const bucket = Math.round(gap / tolerance) * tolerance;
        gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
    }

    // Find the most common gap size
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

    log(`Pass 2: Spacing filter - Mode gap=${modeGap}px (${modeCount} occurrences)`, LOG_LEVELS.INFO);

    // Keep only edges that participate in consistent-spacing relationships
    const consistentEdgeIndices = new Set();

    for (const { gap, fromIdx, toIdx } of gaps) {
        // Check if this gap matches the mode (within tolerance)
        if (Math.abs(gap - modeGap) <= tolerance) {
            consistentEdgeIndices.add(fromIdx);
            consistentEdgeIndices.add(toIdx);
        }
    }

    // Also check for multiples of the mode (skipped cells due to empty slots)
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

    // Filter to consistent edges only
    const filtered = edges.filter((_, idx) => consistentEdgeIndices.has(idx));

    // If we filtered out too many, fall back to original
    if (filtered.length < 3 && edges.length >= 3) {
        log(`Pass 2: Spacing filter too aggressive, keeping original edges`, LOG_LEVELS.WARNING);
        return edges;
    }

    return filtered;
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

    // Calculate vertical consistency - true borders appear at multiple Y positions
    const uniqueYs = new Set(edges.map(e => e.y));
    const verticalConsistency = uniqueYs.size;

    return {
        x: avgX,
        borderWidth: avgWidth,
        rarity: dominantRarity,
        confidence: edges.length / 7, // More scan lines = higher confidence
        detections: edges.length,
        verticalConsistency,
    };
}

/**
 * Filter clusters to keep only those with vertical consistency
 * True item borders appear at multiple Y positions, random elements don't
 */
function filterByVerticalConsistency(clusters, minConsistency = 2) {
    return clusters.filter(c => c.verticalConsistency >= minConsistency);
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

    // Icon height: typically equals width for square icons
    // Use band height to inform, but icons are usually square (height = width)
    const estimatedRowHeight = iconWidth + estimatedSpacing;
    const possibleRows = Math.floor(bandRegion.height / estimatedRowHeight);

    // Icons are typically square, so height should match width
    // Only constrain if band is unusually small (shouldn't happen with improved band detection)
    const maxIconHeight = possibleRows >= 1 ? iconWidth : bandRegion.height - 10;
    const iconHeight = Math.min(iconWidth, Math.max(iconWidth, maxIconHeight));

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
    // MegaBonk hotbar typically has 1-2 rows - configurable via CONFIG.maxDetectedRows
    const maxRows = CONFIG.maxDetectedRows || 2;
    const numRows = Math.min(possibleRows, maxRows);

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

        // Pass 6: Empty screen detection
        // Icons smaller than 22px absolute are likely false positives from UI elements
        const minAbsoluteIconSize = 22;
        const iconsTooSmall = metrics.iconWidth < minAbsoluteIconSize || metrics.iconHeight < minAbsoluteIconSize;

        const isLikelyEmpty = bandRegion.confidence < 0.4 && borderResult.edges.length < 3 && metrics.isDefault;

        const hasInconsistentDetection =
            borderResult.edges.length >= 2 && metrics.confidence < 0.3 && validation.validCells.length < 3;

        // Collect failure reasons for UI display
        const failureReasons = [];
        if (iconsTooSmall) {
            failureReasons.push('icons_too_small');
            log(
                `Pass 6: Icons too small (${metrics.iconWidth}x${metrics.iconHeight}px < ${minAbsoluteIconSize}px minimum)`,
                LOG_LEVELS.WARNING
            );
        }
        if (isLikelyEmpty) {
            failureReasons.push('likely_empty_screen');
            log('Pass 6: Low band confidence + few edges + using defaults = likely empty screen', LOG_LEVELS.WARNING);
        }
        if (hasInconsistentDetection) {
            failureReasons.push('inconsistent_detection');
            log('Pass 6: Edges found but metrics unreliable and few valid cells', LOG_LEVELS.WARNING);
        }
        if (borderResult.edges.length === 0) {
            failureReasons.push('no_vertical_clusters');
        }

        if (isLikelyEmpty || hasInconsistentDetection || iconsTooSmall) {
            log('Detected likely empty screen or false positives, clearing cells', LOG_LEVELS.INFO);
            validation.validCells = [];
            validation.confidence = 0;
            validation.failureReasons = failureReasons;
        }

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
            reasons: failureReasons.length > 0 ? failureReasons : null,
        };
    } catch (error) {
        log(`Auto-detection failed: ${error.message}`, LOG_LEVELS.ERROR);
        return {
            success: false,
            error: error.message,
            reasons: ['exception_thrown'],
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
